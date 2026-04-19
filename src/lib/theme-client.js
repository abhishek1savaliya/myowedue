export function applyThemePreference(isDarkMode) {
  if (typeof window === "undefined") return;
  const value = isDarkMode ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", value);
  window.localStorage.setItem("myowedue-theme", value);
}

export function getStoredThemePreference() {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem("myowedue-theme");
  return value === "dark" ? true : value === "light" ? false : null;
}
