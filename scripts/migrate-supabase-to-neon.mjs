/**
 * One-time migration: Supabase Postgres → Neon.
 * Usage: node scripts/migrate-supabase-to-neon.mjs
 */
import { config } from "dotenv";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import pg from "pg";

config({ path: ".env.local" });

const { Client } = pg;

function stripTlsQueryParams(connStr) {
  const qIndex = connStr.indexOf("?");
  if (qIndex === -1) return connStr;
  const base = connStr.slice(0, qIndex);
  const rest = connStr.slice(qIndex + 1);
  const params = new URLSearchParams(rest);
  params.delete("sslmode");
  params.delete("ssl");
  params.delete("channel_binding");
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

function pgClientOptions(url) {
  const connectionString = stripTlsQueryParams(url);
  const isLocal = /127\.0\.0\.1|localhost/i.test(connectionString);
  return {
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  };
}

const SUPABASE_URL = (() => {
  if (process.env.SUPABASE_SOURCE_URL) return process.env.SUPABASE_SOURCE_URL;
  const projectUrl = process.env.myoweduesupa_SUPABASE_URL || "";
  const m = projectUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i);
  const password = process.env.myoweduesupa_POSTGRES_PASSWORD;
  if (m && password) {
    return `postgresql://postgres:${encodeURIComponent(password)}@db.${m[1]}.supabase.co:5432/postgres`;
  }
  return (
    process.env.myoweduesupa_POSTGRES_URL_NON_POOLING ||
    process.env.myoweduesupa_POSTGRES_URL ||
    ""
  );
})();

const NEON_URL =
  process.env.NEON_TARGET_URL ||
  process.env.NEON_DATABASE_URL ||
  "postgresql://neondb_owner:npg_GCvNxoOD1g9h@ep-floral-queen-a7kn1rt6.ap-southeast-2.aws.neon.tech/neondb?sslmode=require";

if (!SUPABASE_URL) {
  console.error("Missing Supabase source URL.");
  process.exit(1);
}

const migrationsDir = join(process.cwd(), "supabase", "migrations");

async function connect(url, label) {
  const client = new Client(pgClientOptions(url));
  await client.connect();
  console.log(`[${label}] connected`);
  return client;
}

function stripSqlComments(sql) {
  return sql.replace(/^\s*--.*$/gm, "");
}

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
      if (c === "'") inSingle = false;
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
        const closeIdx = normalized.indexOf(close, i + openLen);
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

async function ensureNeonRoles(client) {
  for (const role of ["anon", "authenticated", "service_role"]) {
    await client.query(`DO $$ BEGIN CREATE ROLE ${role} NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
  }
}

async function runMigrations(neon) {
  await ensureNeonRoles(neon);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const statements = splitSqlStatements(sql).filter(
      (s) => !/^notify\s+pgrst\b/i.test(s)
    );
    console.log(`[schema] applying ${file} (${statements.length} statements)...`);
    for (const statement of statements) {
      try {
        await neon.query(statement.endsWith(";") ? statement : `${statement};`);
      } catch (err) {
        if (/already exists/i.test(err.message)) {
          continue;
        }
        throw new Error(`${file}: ${err.message}`);
      }
    }
  }
}

async function listPublicTables(client) {
  const { rows } = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return rows.map((r) => r.table_name);
}

async function getColumns(client, table) {
  const { rows } = await client.query(
    `
    SELECT column_name, udt_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `,
    [table]
  );
  return rows;
}

async function sortTablesByDependencies(client, tables) {
  const { rows } = await client.query(
    `
    SELECT
      tc.table_name AS child,
      ccu.table_name AS parent
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = ANY($1::text[])
      AND ccu.table_name = ANY($1::text[])
  `,
    [tables]
  );

  const deps = new Map(tables.map((t) => [t, new Set()]));
  for (const { child, parent } of rows) {
    if (child !== parent) deps.get(child)?.add(parent);
  }

  const sorted = [];
  const pending = new Set(tables);
  while (pending.size > 0) {
    const ready = [...pending].filter((t) => {
      for (const p of deps.get(t) ?? []) {
        if (pending.has(p)) return false;
      }
      return true;
    });
    if (ready.length === 0) {
      throw new Error(`Circular FK dependency among: ${[...pending].join(", ")}`);
    }
    ready.sort();
    for (const t of ready) {
      sorted.push(t);
      pending.delete(t);
    }
  }
  return sorted;
}

async function copyAllData(source, target, tables) {
  if (tables.length === 0) return 0;

  const ordered = await sortTablesByDependencies(source, tables);
  console.log(`[data] copy order: ${ordered.join(" → ")}`);

  await target.query("BEGIN");
  try {
    const tableList = ordered.map((t) => `public."${t}"`).join(", ");
    await target.query(`TRUNCATE ${tableList} CASCADE`);

    let total = 0;
    for (const table of ordered) {
      if (table === "community_comments") {
        total += await copyCommentsWithParents(source, target);
        continue;
      }
      total += await copyTable(source, target, table, { skipTruncate: true, noTransaction: true });
    }

    await target.query("COMMIT");
    return total;
  } catch (err) {
    await target.query("ROLLBACK");
    throw err;
  }
}

async function copyCommentsWithParents(source, target) {
  const table = "community_comments";
  const { rows: countRow } = await source.query(
    `SELECT COUNT(*)::int AS n FROM public."${table}"`
  );
  const count = countRow[0].n;
  if (count === 0) {
    console.log(`[data] ${table}: 0 rows (skip)`);
    return 0;
  }

  const cols = await getColumns(source, table);
  const colNames = cols.map((c) => c.column_name);
  const quotedCols = colNames.map((c) => `"${c}"`).join(", ");

  const { rows } = await source.query(
    `SELECT ${quotedCols} FROM public."${table}" ORDER BY created_at ASC NULLS LAST`
  );

  const insertedIds = new Set();
  let inserted = 0;
  let remaining = [...rows];

  while (remaining.length > 0) {
    const batch = remaining.filter(
      (row) => !row.parent_id || insertedIds.has(row.parent_id)
    );
    if (batch.length === 0) {
      throw new Error(`${table}: unable to resolve parent_id ordering`);
    }
    remaining = remaining.filter((row) => !batch.includes(row));

    for (let i = 0; i < batch.length; i += 200) {
      const chunk = batch.slice(i, i + 200);
      const placeholders = chunk
        .map(
          (_, ri) =>
            `(${colNames.map((_, ci) => `$${ri * colNames.length + ci + 1}`).join(", ")})`
        )
        .join(", ");
      const values = chunk.flatMap((row) => colNames.map((c) => row[c]));
      await target.query(
        `INSERT INTO public."${table}" (${quotedCols}) VALUES ${placeholders}`,
        values
      );
      for (const row of chunk) insertedIds.add(row.id);
      inserted += chunk.length;
    }
  }

  console.log(`[data] ${table}: ${inserted} rows copied`);
  return inserted;
}

async function copyTable(source, target, table, opts = {}) {
  const { skipTruncate = false, noTransaction = false } = opts;
  const { rows: countRow } = await source.query(
    `SELECT COUNT(*)::int AS n FROM public."${table}"`
  );
  const count = countRow[0].n;
  if (count === 0) {
    console.log(`[data] ${table}: 0 rows (skip)`);
    return 0;
  }

  const cols = await getColumns(source, table);
  const colNames = cols.map((c) => c.column_name);
  const quotedCols = colNames.map((c) => `"${c}"`).join(", ");

  const { rows } = await source.query(`SELECT ${quotedCols} FROM public."${table}"`);

  if (!noTransaction) await target.query("BEGIN");
  try {
    if (!skipTruncate) await target.query(`TRUNCATE public."${table}" CASCADE`);
    const batchSize = 200;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const placeholders = batch
        .map(
          (_, ri) =>
            `(${colNames.map((_, ci) => `$${ri * colNames.length + ci + 1}`).join(", ")})`
        )
        .join(", ");
      const values = batch.flatMap((row) => colNames.map((c) => row[c]));
      await target.query(
        `INSERT INTO public."${table}" (${quotedCols}) VALUES ${placeholders}`,
        values
      );
      inserted += batch.length;
    }
    if (!noTransaction) await target.query("COMMIT");
    console.log(`[data] ${table}: ${inserted} rows copied`);
    return inserted;
  } catch (err) {
    if (!noTransaction) await target.query("ROLLBACK");
    throw err;
  }
}

async function main() {
  const source = await connect(SUPABASE_URL, "supabase");
  const target = await connect(NEON_URL, "neon");

  try {
    console.log("[schema] running migrations on Neon...");
    await runMigrations(target);

    const tables = await listPublicTables(source);
    console.log(`[data] public tables on Supabase: ${tables.join(", ") || "(none)"}`);

    const total = await copyAllData(source, target, tables);

    console.log(`\nDone. ${total} total rows migrated across ${tables.length} tables.`);
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
