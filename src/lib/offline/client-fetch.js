"use client";

import { enqueueMutation } from "@/lib/offline/mutation-queue";
import { isOnline } from "@/lib/offline/network";
import { applyOptimisticMutation, notifyOfflineQueueChanged } from "@/lib/offline/optimistic-cache";
import { useUserStore } from "@/stores/useUserStore";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** @type {typeof fetch | null} */
let nativeFetch = null;
let fetchPatched = false;

export function getNativeFetch() {
  return nativeFetch;
}

/**
 * @param {RequestInfo | URL} input
 */
function resolveUrl(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return String(input);
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

function isApiUrl(url) {
  return url.startsWith("/api/") || (url.startsWith("http") && url.includes("/api/"));
}

async function queueMutationAndRespond(url, method, body, headers) {
  const userId = useUserStore.getState().user?._id || null;
  await enqueueMutation({
    url,
    method,
    body,
    headers,
    userId,
  });
  applyOptimisticMutation(url, method, body);
  notifyOfflineQueueChanged();

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

/**
 * Drop-in fetch for `/api/*` — queues mutations when offline or network fails.
 * @param {RequestInfo | URL} input
 * @param {RequestInit} [init]
 */
export async function clientFetch(input, init = {}) {
  const url = resolveUrl(input);
  const method = (init.method || "GET").toUpperCase();
  const nf = nativeFetch || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);

  if (!isApiUrl(url) || !MUTATION_METHODS.has(method)) {
    if (!nf) throw new Error("fetch is not available");
    return nf(input, {
      credentials: "include",
      cache: init.cache ?? "no-store",
      ...init,
    });
  }

  const body = await serializeBody(init.body);
  if (body === null && init.body != null && typeof init.body !== "string") {
    return new Response(
      JSON.stringify({
        message: "This action cannot be saved offline (file uploads need internet).",
        offline: true,
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const headers = normalizeHeaders(init.headers);

  if (isOnline() && nf) {
    try {
      const res = await nf(input, {
        credentials: "include",
        cache: "no-store",
        ...init,
      });
      if (res.ok) return res;
      if (res.status < 500) return res;
    } catch {
      // Network failed while browser reports online — queue below.
    }
  }

  return queueMutationAndRespond(url, method, body, headers);
}

/** Patch window.fetch once so existing pages queue writes automatically. */
export function installOfflineFetchPatch() {
  if (typeof window === "undefined" || fetchPatched) return;
  fetchPatched = true;
  nativeFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const url = resolveUrl(input);
    if (!isApiUrl(url)) return nativeFetch(input, init);

    try {
      return await clientFetch(input, init);
    } catch (err) {
      const method = (init?.method || "GET").toUpperCase();
      if (MUTATION_METHODS.has(method)) {
        try {
          const body = await serializeBody(init?.body);
          if (body === null && init?.body != null && typeof init.body !== "string") {
            throw err;
          }
          return await queueMutationAndRespond(url, method, body, normalizeHeaders(init?.headers));
        } catch {
          throw err;
        }
      }
      return nativeFetch(input, init);
    }
  };
}
