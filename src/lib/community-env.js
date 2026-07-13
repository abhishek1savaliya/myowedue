/**
 * Community Postgres (Neon) connection config — server-only.
 */
import "server-only";

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

function loadLocalCommunityJson() {
  if (process.env.NODE_ENV === "production") return null;
  if (cachedLocalJson !== undefined) return cachedLocalJson;
  const filePath = join(process.cwd(), "supabase.local.json");
  if (!existsSync(filePath)) {
    cachedLocalJson = null;
    return null;
  }
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf8"));
    cachedLocalJson = raw && typeof raw === "object" ? raw : null;
    return cachedLocalJson;
  } catch {
    cachedLocalJson = null;
    return null;
  }
}

function fromEnvKeys(keys) {
  const local = loadLocalCommunityJson();
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
 * Direct PostgreSQL connection string (Neon pooler or direct).
 * Prefer NEON_DATABASE_URL for runtime; COMMUNITY_DATABASE_URL / SUPABASE_DATABASE_URL for DDL.
 */
export function getCommunityDatabaseUrl() {
  const full = fromEnvKeys([
    "NEON_DATABASE_URL",
    "COMMUNITY_DATABASE_URL",
    "SUPABASE_DATABASE_URL",
    "myoweduesupa_POSTGRES_URL_NON_POOLING",
    "myoweduesupa_POSTGRES_URL",
    "myoweduesupa_POSTGRES_PRISMA_URL",
  ]);
  if (full) return full;

  const password = fromEnvKeys(["COMMUNITY_DB_PASSWORD", "myoweduesupa_POSTGRES_PASSWORD"]);
  if (!password) return "";

  const host = fromEnvKeys(["COMMUNITY_DB_HOST", "myoweduesupa_POSTGRES_HOST"]);
  if (!host) return "";

  const port = fromEnvKeys(["COMMUNITY_DB_PORT", "myoweduesupa_POSTGRES_PORT"]) || "5432";
  const database =
    fromEnvKeys(["COMMUNITY_DB_DATABASE", "myoweduesupa_POSTGRES_DATABASE"]) || "neondb";
  const user = fromEnvKeys(["COMMUNITY_DB_USER", "myoweduesupa_POSTGRES_USER"]) || "neondb_owner";

  const encUser = encodeURIComponent(user);
  const encPass = encodeURIComponent(password);
  const encDb = encodeURIComponent(database);

  return `postgresql://${encUser}:${encPass}@${host}:${port}/${encDb}`;
}

export function isCommunityEnvComplete() {
  return Boolean(getCommunityDatabaseUrl());
}

export function resolvePostgresConnectionString(raw) {
  let s = String(raw || "").trim();
  if (!s || !/^postgres(ql)?:/i.test(s)) return s;

  const hasParam = (name) => new RegExp(`[?&]${name}=`, "i").test(s);
  const append = (name, value) => {
    if (hasParam(name)) return;
    s += (s.includes("?") ? "&" : "?") + `${name}=${value}`;
  };

  if (s.includes("neon.tech") || s.includes("supabase.co") || s.includes("pooler.supabase.com")) {
    append("connect_timeout", "60");
  }
  return s;
}
