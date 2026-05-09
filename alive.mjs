import { createServer } from "node:http";

const PORT = Number(process.env.PORT || process.env.ALIVE_PORT || 10000);
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const MIN_INTERVAL_MS = 30 * 1000;

function normalizeUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    return new URL(text).toString().replace(/\/$/, "");
  } catch {
    console.warn(`[alive] Ignoring invalid URL: ${text}`);
    return "";
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function getTargetUrls() {
  const extraUrls = String(process.env.KEEP_ALIVE_URLS || "")
    .split(",")
    .map(normalizeUrl);

  return unique([
    normalizeUrl(process.env.APP_URL),
    normalizeUrl(process.env.NEXT_PUBLIC_APP_URL),
    normalizeUrl(process.env.SOCKET_URL),
    normalizeUrl(process.env.NEXT_PUBLIC_SOCKET_URL),
    ...extraUrls,
  ]);
}

function getSelfUrl() {
  return normalizeUrl(process.env.SELF_URL || process.env.RENDER_EXTERNAL_URL);
}

function getIntervalMs() {
  const value = Number(process.env.PING_INTERVAL_MS || DEFAULT_INTERVAL_MS);
  if (!Number.isFinite(value)) return DEFAULT_INTERVAL_MS;
  return Math.max(MIN_INTERVAL_MS, Math.round(value));
}

const startedAt = new Date();
let lastRunAt = null;
let lastResults = [];
let runCount = 0;
let timer = null;

async function pingUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "myowedue-alive/1.0",
      },
    });

    return {
      url,
      ok: response.ok,
      status: response.status,
      at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      url,
      ok: false,
      status: 0,
      error: error?.name === "AbortError" ? "timeout" : error?.message || "request failed",
      at: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runKeepAlive() {
  const targets = unique([...getTargetUrls(), getSelfUrl()]);
  lastRunAt = new Date();
  runCount += 1;

  if (targets.length === 0) {
    lastResults = [];
    console.warn("[alive] No targets configured. Set APP_URL, SOCKET_URL, SELF_URL, or KEEP_ALIVE_URLS.");
    return;
  }

  console.log(`[alive] Ping run ${runCount}: ${targets.join(", ")}`);
  lastResults = await Promise.all(targets.map(pingUrl));

  for (const result of lastResults) {
    const status = result.ok ? "ok" : "failed";
    const detail = result.error ? ` ${result.error}` : ` HTTP ${result.status}`;
    console.log(`[alive] ${status}: ${result.url}${detail}`);
  }
}

function statusPayload() {
  return {
    ok: true,
    service: "myowedue-alive",
    startedAt: startedAt.toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    intervalMs: getIntervalMs(),
    targets: unique([...getTargetUrls(), getSelfUrl()]),
    lastRunAt: lastRunAt ? lastRunAt.toISOString() : null,
    runCount,
    lastResults,
  };
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (url.pathname === "/ping") {
    await runKeepAlive();
  }

  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(statusPayload(), null, 2));
});

server.listen(PORT, () => {
  console.log(`[alive] Service listening on :${PORT}`);
  runKeepAlive().catch((error) => console.error("[alive] Initial ping failed:", error));
  timer = setInterval(() => {
    runKeepAlive().catch((error) => console.error("[alive] Ping failed:", error));
  }, getIntervalMs());
});

function shutdown() {
  if (timer) clearInterval(timer);
  server.close(() => process.exit(0));
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
