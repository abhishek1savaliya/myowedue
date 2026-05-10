/**
 * Community “Posts” live in Supabase Postgres (SQL). The rest of the app uses MongoDB.
 * If SUPABASE_DATABASE_URL is set, we can auto-create community tables from
 * supabase/migrations when they are missing (001–003 core feed; 004 comment likes;
 * 005 usernames).
 *
 * Use Session mode (port 5432) or Direct connection — transaction pooler (6543) often cannot run DDL.
 */
import { readFileSync } from "fs";
import { join } from "path";
import pg from "pg";
import { getSupabaseDatabaseUrl, resolvePostgresConnectionString } from "@/lib/supabase-env";

const { Pool } = pg;

let pool;
let schemaReady = false;

function shutdownPool() {
  if (pool) {
    void pool.end().catch(() => {});
    pool = null;
  }
}

function stripSqlComments(sql) {
  return sql.replace(/^\s*--.*$/gm, "");
}

/**
 * Split SQL on semicolons only outside strings and dollar-quoted blocks.
 * Naive splitting breaks PL/pgSQL (`as $$ ... return; ... end; $$;`).
 */
function splitSqlStatements(sql) {
  const normalized = stripSqlComments(sql).replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const statements = [];
  let start = 0;
  let i = 0;
  let inSingle = false;

  while (i < normalized.length) {
    const c = normalized[i];

    if (inSingle) {
      if (c === "'" && normalized[i + 1] === "'") {
        i += 2;
        continue;
      }
      if (c === "'") {
        inSingle = false;
      }
      i++;
      continue;
    }

    if (c === "$") {
      const rest = normalized.slice(i);
      const tagMatch = rest.match(/^\$([A-Za-z0-9_]*)\$/);
      if (tagMatch) {
        const tag = tagMatch[1];
        const openLen = tagMatch[0].length;
        const close = `$${tag}$`;
        const j = i + openLen;
        const closeIdx = normalized.indexOf(close, j);
        if (closeIdx === -1) {
          i = normalized.length;
          break;
        }
        i = closeIdx + close.length;
        continue;
      }
    }

    if (c === "'") {
      inSingle = true;
      i++;
      continue;
    }

    if (c === ";") {
      const stmt = normalized.slice(start, i).trim();
      if (stmt) statements.push(stmt);
      start = i + 1;
    }
    i++;
  }

  const tail = normalized.slice(start).trim();
  if (tail) statements.push(tail);
  return statements;
}

async function runMigrationWithPool(clientPool, sql) {
  const statements = splitSqlStatements(sql);
  const client = await clientPool.connect();
  try {
    for (const statement of statements) {
      const q = statement.endsWith(";") ? statement : `${statement};`;
      await client.query(q);
    }
  } finally {
    client.release();
  }
}

function sslOption(url) {
  if (url.includes("127.0.0.1") || url.includes("localhost")) return false;
  return { rejectUnauthorized: false };
}

/**
 * Remove sslmode/ssl from the URI so node-pg does not apply libpq-style strict verify
 * on top of Pool.ssl (which would still fail with corporate/self-signed intermediates).
 */
function stripTlsQueryParamsFromPostgresUrl(connStr) {
  const qIndex = connStr.indexOf("?");
  if (qIndex === -1) return connStr;
  const base = connStr.slice(0, qIndex);
  const rest = connStr.slice(qIndex + 1);
  const hashIndex = rest.indexOf("#");
  const query = hashIndex >= 0 ? rest.slice(0, hashIndex) : rest;
  const hash = hashIndex >= 0 ? rest.slice(hashIndex) : "";
  const params = new URLSearchParams(query);
  if (!params.has("sslmode") && !params.has("ssl")) return connStr;
  params.delete("sslmode");
  params.delete("ssl");
  const q = params.toString();
  return q ? `${base}?${q}${hash}` : `${base}${hash}`;
}

function getPool() {
  const raw = getSupabaseDatabaseUrl();
  if (!raw) return null;
  const resolved = resolvePostgresConnectionString(raw);
  const url = stripTlsQueryParamsFromPostgresUrl(resolved);
  if (!url) return null;

  if (!/^postgres(ql)?:/i.test(url)) {
    console.error(
      "[community] SUPABASE_DATABASE_URL must be a Postgres URI (postgres://…), not the HTTPS project URL. Copy it from Supabase → Database → Connection string."
    );
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: url,
      ssl: sslOption(url),
      max: 2,
      connectionTimeoutMillis: 65_000,
      idleTimeoutMillis: 10_000,
    });
  }
  return pool;
}

const migrationsDir = join(process.cwd(), "supabase", "migrations");

/**
 * Migrations added after the initial 001–003 bootstrap must run even when `schemaReady`
 * is already true (older processes never created these tables).
 * @param {import("pg").Pool} clientPool
 */
async function ensureLateCommunityMigrations(clientPool) {
  const usernamesRel = await clientPool.query(`SELECT to_regclass('public.community_usernames') AS rel`);
  if (!usernamesRel.rows[0]?.rel) {
    const sql005 = readFileSync(join(migrationsDir, "005_community_usernames.sql"), "utf8");
    await runMigrationWithPool(clientPool, sql005);
    console.info("[community] Postgres community_usernames ensured (005_community_usernames.sql).");
  }

  const commentsRel = await clientPool.query(`SELECT to_regclass('public.community_comments') AS rel`);
  const commentLikesRel = await clientPool.query(`SELECT to_regclass('public.community_comment_likes') AS rel`);
  if (commentsRel.rows[0]?.rel && !commentLikesRel.rows[0]?.rel) {
    const sql004 = readFileSync(join(migrationsDir, "004_community_comment_likes.sql"), "utf8");
    await runMigrationWithPool(clientPool, sql004);
    console.info("[community] Postgres community_comment_likes ensured (004_community_comment_likes.sql).");
  }

  const followsRel = await clientPool.query(`SELECT to_regclass('public.community_follows') AS rel`);
  if (!followsRel.rows[0]?.rel) {
    const sql008 = readFileSync(join(migrationsDir, "008_community_follows.sql"), "utf8");
    await runMigrationWithPool(clientPool, sql008);
    console.info("[community] Postgres community_follows ensured (008_community_follows.sql).");
  }

  const suggestFn = await clientPool.query(
    `SELECT 1 FROM pg_proc p
     INNER JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'community_username_suggest'
     LIMIT 1`
  );
  if (suggestFn.rows.length === 0) {
    const sql009 = readFileSync(join(migrationsDir, "009_community_username_suggest.sql"), "utf8");
    await runMigrationWithPool(clientPool, sql009);
    console.info("[community] Postgres community_username_suggest ensured (009_community_username_suggest.sql).");
  }

  const embeddingsRel = await clientPool.query(`SELECT to_regclass('public.community_post_embeddings') AS rel`);
  if (!embeddingsRel.rows[0]?.rel) {
    const sql010 = readFileSync(join(migrationsDir, "010_community_ai_phase2.sql"), "utf8");
    await runMigrationWithPool(clientPool, sql010);
    console.info("[community] Postgres AI phase2 tables ensured (010_community_ai_phase2.sql).");
  }
}

/**
 * @returns {Promise<{ skipped?: boolean; ok?: boolean; existed?: boolean; created?: boolean; error?: string }>}
 */
export async function prepareCommunityPostgresSchema() {
  const rawUrl = getSupabaseDatabaseUrl();
  if (!rawUrl) {
    return { skipped: true };
  }

  const resolved = resolvePostgresConnectionString(rawUrl);
  if (resolved.includes(":6543")) {
    console.warn(
      "[community] SUPABASE_DATABASE_URL uses port 6543 (transaction pooler). DDL often fails; prefer Session mode (5432) or Direct connection from Supabase → Database."
    );
  }

  const clientPool = getPool();
  if (!clientPool) {
    return {
      ok: false,
      error:
        "Invalid SUPABASE_DATABASE_URL: use the Postgres connection string (postgres://…) from Supabase → Database, not https://…",
    };
  }

  try {
    await ensureLateCommunityMigrations(clientPool);

    if (schemaReady) {
      return { ok: true, existed: true };
    }

    const postsRel = await clientPool.query(`SELECT to_regclass('public.community_posts') AS rel`);
    if (!postsRel.rows[0]?.rel) {
      const sql001 = readFileSync(join(migrationsDir, "001_community.sql"), "utf8");
      await runMigrationWithPool(clientPool, sql001);
      console.info("[community] Postgres community tables ensured (001_community.sql).");
    }

    const sharesRel = await clientPool.query(`SELECT to_regclass('public.community_post_shares') AS rel`);
    if (!sharesRel.rows[0]?.rel) {
      const sql002 = readFileSync(join(migrationsDir, "002_community_post_shares.sql"), "utf8");
      await runMigrationWithPool(clientPool, sql002);
      console.info("[community] Postgres community_post_shares ensured (002_community_post_shares.sql).");
    }

    const topicsRel = await clientPool.query(`SELECT to_regclass('public.post_topics') AS rel`);
    if (!topicsRel.rows[0]?.rel) {
      const sql003 = readFileSync(join(migrationsDir, "003_post_topics.sql"), "utf8");
      await runMigrationWithPool(clientPool, sql003);
      console.info("[community] Postgres post_topics ensured (003_post_topics.sql).");
    }

    // 004 depends on community_comments from 001; run again after core bootstrap.
    await ensureLateCommunityMigrations(clientPool);

    schemaReady = true;
    return { ok: true, existed: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[community] Auto-bootstrap failed:", message);
    shutdownPool();
    return { ok: false, error: message };
  }
}

/** After fixing DB outside the app, call so the next request retries bootstrap / checks. */
export function resetCommunityPostgresBootstrap() {
  schemaReady = false;
  shutdownPool();
}
