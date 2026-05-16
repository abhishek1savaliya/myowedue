"use client";

import { enqueueMutation } from "@/lib/offline/mutation-queue";
import { isOnline } from "@/lib/offline/network";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * @param {RequestInfo | URL} input
 */
function resolveUrl(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

/**
 * @param {BodyInit | null | undefined} body
 */
async function serializeBody(body) {
  if (body == null) return null;
  if (typeof body === "string") return body;
  if (body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer) {
    return null;
  }
  try {
    return JSON.stringify(body);
  } catch {
    return null;
  }
}

/**
 * @param {HeadersInit | undefined} headers
 */
function normalizeHeaders(headers) {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const out = {};
    headers.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return { ...headers };
}

/**
 * Drop-in fetch for `/api/*` — queues mutations when offline.
 * @param {RequestInfo | URL} input
 * @param {RequestInit} [init]
 */
export async function clientFetch(input, init = {}) {
  const url = resolveUrl(input);
  const method = (init.method || "GET").toUpperCase();
  const isApi = url.startsWith("/api/") || url.includes("/api/");

  if (!isApi || !MUTATION_METHODS.has(method)) {
    return fetch(input, {
      credentials: "include",
      cache: init.cache ?? "no-store",
      ...init,
    });
  }

  if (isOnline()) {
    return fetch(input, {
      credentials: "include",
      cache: "no-store",
      ...init,
    });
  }

  const body = await serializeBody(init.body);
  if (body === null && init.body != null && !(typeof init.body === "string")) {
    return new Response(
      JSON.stringify({
        message: "This action cannot be saved offline (file uploads need internet).",
        offline: true,
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  await enqueueMutation({
    url,
    method,
    body,
    headers: normalizeHeaders(init.headers),
  });

  return new Response(
    JSON.stringify({
      success: true,
      queued: true,
      offline: true,
      message: "Saved offline. Changes will sync when you're back online.",
    }),
    { status: 202, headers: { "Content-Type": "application/json" } }
  );
}

let fetchPatched = false;

/** Patch window.fetch once so existing pages queue writes automatically. */
export function installOfflineFetchPatch() {
  if (typeof window === "undefined" || fetchPatched) return;
  fetchPatched = true;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const url = resolveUrl(input);
    const isApi =
      url.startsWith("/api/") ||
      (url.startsWith("http") && url.includes("/api/"));

    if (!isApi) return nativeFetch(input, init);

    try {
      return await clientFetch(input, init);
    } catch {
      return nativeFetch(input, init);
    }
  };
}
