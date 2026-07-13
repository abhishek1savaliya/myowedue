/**
 * Supabase config
 * Uses:
 * 1. process.env (standard names, then myoweduesupa_* fallbacks for Vercel / multi-env)
 * 2. optional local file: supabase.local.json
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

let cachedLocalJson;

function trimQuoted(value) {
  let s = String(value ?? "").trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/**
 * Load local JSON config for development only
 */
function loadLocalSupabaseJson() {
  if (process.env.NODE_ENV === "production") return null;

  if (cachedLocalJson !== undefined) {
    return cachedLocalJson;
  }

  const filePath = join(process.cwd(), "supabase.local.json");

  if (!existsSync(filePath)) {
    cachedLocalJson = null;
    return null;
  }

  try {
    const raw = JSON.parse(readFileSync(filePath, "utf8"));

    cachedLocalJson =
      raw && typeof raw === "object" ? raw : null;

    return cachedLocalJson;
  } catch {
    cachedLocalJson = null;
    return null;
  }
}

/**
 * First non-empty value among keys, from process.env then supabase.local.json
 * @param {string[]} keys
 */
function fromEnvKeys(keys) {
  const local = loadLocalSupabaseJson();

  for (const key of keys) {
    const envValue = trimQuoted(process.env[key]);
    if (envValue) return envValue;
  }

  if (local) {
    for (const key of keys) {
      if (local[key] != null && typeof local[key] === "string") {
        const v = trimQuoted(local[key]);
        if (v) return v;
      }
    }
  }

  return "";
}

/**
 * Public project URL (HTTPS)
 */
export function getSupabaseProjectUrl() {
  return fromEnvKeys(["NEXT_PUBLIC_SUPABASE_URL", "myoweduesupa_SUPABASE_URL"]);
}

/**
 * Server-only secret: sb_secret_… JWT or legacy service_role JWT
 */
export function getSupabaseSecretKey() {
  return fromEnvKeys([
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
    "myoweduesupa_SUPABASE_SERVICE_ROLE_KEY",
    "myoweduesupa_SUPABASE_SECRET_KEY",
  ]);
}

/**
 * Browser-safe: publishable or anon JWT
 */
export function getSupabasePublishableKey() {
  return fromEnvKeys([
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_myoweduesupa_SUPABASE_ANON_KEY",
    "myoweduesupa_SUPABASE_PUBLISHABLE_KEY",
  ]);
}

export function isSupabaseCommunityEnvComplete() {
  return Boolean(getSupabaseProjectUrl() && getSupabaseSecretKey());
}

/** e.g. https://abcd.supabase.co → db.abcd.supabase.co */
function inferDirectDbHostFromProjectUrl(projectUrl) {
  const u = String(projectUrl || "").trim();
  const m = u.match(/^https:\/\/([a-z0-9]+)\.supabase\.co(?:\/|$)/i);
  if (!m) return "";
  return `db.${m[1]}.supabase.co`;
}

/**
 * Direct PostgreSQL connection string for migrations (pg).
 *
 * Order: SUPABASE_DATABASE_URL, then myoweduesupa_POSTGRES_URL_NON_POOLING (5432, best for DDL),
 * myoweduesupa_POSTGRES_URL / PRISMA_URL, then discrete SUPABASE_DB_* or myoweduesupa_POSTGRES_* + inferred host.
 */
export function getSupabaseDatabaseUrl() {
  const full = fromEnvKeys([
    "NEON_DATABASE_URL",
    "SUPABASE_DATABASE_URL",
    "myoweduesupa_POSTGRES_URL_NON_POOLING",
    "myoweduesupa_POSTGRES_URL",
    "myoweduesupa_POSTGRES_PRISMA_URL",
  ]);
  if (full) return full;

  const password = fromEnvKeys(["SUPABASE_DB_PASSWORD", "myoweduesupa_POSTGRES_PASSWORD"]);
  if (!password) return "";

  const host =
    fromEnvKeys(["SUPABASE_DB_HOST", "myoweduesupa_POSTGRES_HOST"]) ||
    inferDirectDbHostFromProjectUrl(getSupabaseProjectUrl());
  if (!host) return "";

  const port = fromEnvKeys(["SUPABASE_DB_PORT", "myoweduesupa_POSTGRES_PORT"]) || "5432";
  const database =
    fromEnvKeys([
      "SUPABASE_DB_DATABASE",
      "SUPABASE_DB_NAME",
      "myoweduesupa_POSTGRES_DATABASE",
    ]) || "postgres";
  const user = fromEnvKeys(["SUPABASE_DB_USER", "myoweduesupa_POSTGRES_USER"]) || "postgres";

  const encUser = encodeURIComponent(user);
  const encPass = encodeURIComponent(password);
  const encDb = encodeURIComponent(database);

  return `postgresql://${encUser}:${encPass}@${host}:${port}/${encDb}`;
}

/**
 * Add libpq params when missing (Supabase over public internet)
 */
export function resolvePostgresConnectionString(raw) {
  let s = String(raw || "").trim();

  if (!s) return s;

  if (!/^postgres(ql)?:/i.test(s)) {
    return s;
  }

  const hasParam = (name) =>
    new RegExp(`[?&]${name}=`, "i").test(s);

  const append = (name, value) => {
    if (hasParam(name)) return;

    s +=
      (s.includes("?") ? "&" : "?") +
      `${name}=${value}`;
  };

  if (
    s.includes("supabase.co") ||
    s.includes("pooler.supabase.com")
  ) {
    // Do not append sslmode=require: node-pg + Node TLS treats that as strict chain
    // verification and fails on some networks with "self-signed certificate in
    // certificate chain". Community Postgres uses Pool.ssl instead.
    append("connect_timeout", "60");
  }

  return s;
}
