const THEME_KEYS = {
  auth: "myowedue-theme-auth",
  public: "myowedue-theme-public",
  legacy: "myowedue-theme",
};

function resolveKey(scope = "auth") {
  return scope === "public" ? THEME_KEYS.public : THEME_KEYS.auth;
}

export function applyThemePreference(isDarkMode, scope = "auth") {
  if (typeof window === "undefined") return;
  const value = isDarkMode ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", value);
  window.localStorage.setItem(resolveKey(scope), value);
}

export function getStoredThemePreference(scope = "auth") {
  if (typeof window === "undefined") return null;
  const scopedValue = window.localStorage.getItem(resolveKey(scope));
  const value = scopedValue ?? window.localStorage.getItem(THEME_KEYS.legacy);
  return value === "dark" ? true : value === "light" ? false : null;
}
