"use client";

/** @returns {boolean} */
export function isOnline() {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

/** @param {(online: boolean) => void} listener */
export function onNetworkStatusChange(listener) {
  if (typeof window === "undefined") return () => {};

  const handleOnline = () => listener(true);
  const handleOffline = () => listener(false);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}
