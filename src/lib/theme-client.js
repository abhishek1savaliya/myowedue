import {
  DEFAULT_FONT_PRESET,
  DEFAULT_FONT_SIZE_PRESET,
  getFontPreset,
  getFontSizePreset,
} from "@/lib/appearance";

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

export function applyAppearancePreference({
  fontPreset = DEFAULT_FONT_PRESET,
  fontSizePreset = DEFAULT_FONT_SIZE_PRESET,
  isPremium = false,
} = {}) {
  if (typeof window === "undefined") return;

  const font = getFontPreset(fontPreset);
  const size = getFontSizePreset(fontSizePreset);
  const desktopScale = size.scale;
  const mobileScale = size.scale <= 1 ? size.scale : 1 + (size.scale - 1) * 0.55;

  document.documentElement.style.setProperty("--ui-body-font", font.body);
  document.documentElement.style.setProperty("--ui-display-font", font.display);
  document.documentElement.style.setProperty("--ui-font-scale", String(size.scale));
  document.documentElement.style.setProperty("--ui-font-size-mobile", `${15 * mobileScale}px`);
  document.documentElement.style.setProperty("--ui-font-size-desktop", `${16 * desktopScale}px`);
  document.documentElement.style.setProperty("--ui-type-scale-mobile", String(mobileScale));
  document.documentElement.style.setProperty("--ui-type-scale-desktop", String(desktopScale));
  document.documentElement.setAttribute("data-premium-ui", isPremium ? "true" : "false");
}

export function resetAppearancePreference() {
  applyAppearancePreference({
    fontPreset: DEFAULT_FONT_PRESET,
    fontSizePreset: DEFAULT_FONT_SIZE_PRESET,
    isPremium: false,
  });
}
