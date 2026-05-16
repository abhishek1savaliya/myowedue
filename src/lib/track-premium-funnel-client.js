/**
 * Fire-and-forget premium funnel tracking (browser only).
 * @param {string} eventType
 * @param {{ source?: string; meta?: Record<string, unknown> }} [options]
 */
export function trackPremiumFunnel(eventType, options = {}) {
  if (typeof window === "undefined") return;

  const body = {
    eventType,
    source: options.source || "",
    path: window.location.pathname,
    meta: options.meta || {},
  };

  try {
    fetch("/api/analytics/premium-funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }
}
