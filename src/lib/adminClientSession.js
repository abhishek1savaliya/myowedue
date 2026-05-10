/** Client-only cache for admin profile (role, name, etc.). Cleared on logout. */

export const ADMIN_PROFILE_SESSION_KEY = "myowedue_admin_profile_v1";

export function readStoredAdminProfile() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ADMIN_PROFILE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeStoredAdminProfile(profile) {
  if (typeof window === "undefined" || !profile) return;
  try {
    sessionStorage.setItem(ADMIN_PROFILE_SESSION_KEY, JSON.stringify(profile));
  } catch {
    // ignore quota / private mode
  }
}

export function clearStoredAdminProfile() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(ADMIN_PROFILE_SESSION_KEY);
  } catch {
    // ignore
  }
}
