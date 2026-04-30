import {
  DEFAULT_FONT_PRESET,
  DEFAULT_FONT_SIZE_PRESET,
  FONT_PRESETS,
  FONT_SIZE_PRESETS,
  getFontPreset,
  getFontSizePreset,
} from "@/lib/appearance";

export const COOKIE_CONSENT_NAME = "myowedue_cookie_consent";
export const UI_PREFERENCES_COOKIE_NAME = "myowedue_ui_prefs";
export const COOKIE_CONSENT_ACCEPTED = "accepted";
export const COOKIE_CONSENT_REJECTED = "rejected";
const COOKIE_MAX_AGE_DAYS = 180;

const PUBLIC_PATH_PREFIXES = ["/contact-us", "/privacy-policy", "/login", "/signup"];

function getCookieMaxAgeSeconds(days = COOKIE_MAX_AGE_DAYS) {
  return days * 24 * 60 * 60;
}

function buildCookieString(name, value, maxAgeSeconds = getCookieMaxAgeSeconds()) {
  const secure =
    typeof window !== "undefined" &&
    window.location.protocol === "https:"
      ? "; Secure"
      : "";

  return `${name}=${value}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

export function isPublicCookiePath(pathname = "/") {
  return pathname === "/" || PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function getBrowserCookie(name) {
  if (typeof document === "undefined") return null;

  const prefix = `${name}=`;
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(prefix));

  return match ? match.slice(prefix.length) : null;
}

export function setBrowserCookie(name, value, maxAgeSeconds = getCookieMaxAgeSeconds()) {
  if (typeof document === "undefined") return;
  document.cookie = buildCookieString(name, value, maxAgeSeconds);
}

export function clearBrowserCookie(name) {
  if (typeof document === "undefined") return;
  document.cookie = buildCookieString(name, "", 0);
}

export function getCookieConsentStatus() {
  const value = getBrowserCookie(COOKIE_CONSENT_NAME);
  return value || null;
}

export function hasAcceptedOptionalCookies() {
  return getCookieConsentStatus() === COOKIE_CONSENT_ACCEPTED;
}

export function setCookieConsentStatus(status) {
  if (!status) {
    clearBrowserCookie(COOKIE_CONSENT_NAME);
    return;
  }

  setBrowserCookie(COOKIE_CONSENT_NAME, status);
}

export function readUiPreferencesCookie() {
  try {
    const raw = getBrowserCookie(UI_PREFERENCES_COOKIE_NAME);
    if (!raw) return null;

    const parsed = JSON.parse(decodeURIComponent(raw));
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearUiPreferencesCookie() {
  clearBrowserCookie(UI_PREFERENCES_COOKIE_NAME);
}

function writeUiPreferencesCookie(data) {
  if (typeof document === "undefined") return false;
  const payload = encodeURIComponent(JSON.stringify({ v: 1, ...data }));
  setBrowserCookie(UI_PREFERENCES_COOKIE_NAME, payload);
  return true;
}

export function persistUiPreferences(nextPartial) {
  if (!hasAcceptedOptionalCookies()) return false;

  const current = readUiPreferencesCookie() || {};
  return writeUiPreferencesCookie({ ...current, ...nextPartial });
}

export function persistThemePreference({ scope = "auth", isDarkMode }) {
  const key = scope === "public" ? "themePublic" : "themeAuth";
  return persistUiPreferences({
    [key]: isDarkMode ? "dark" : "light",
  });
}

export function persistAppearancePreference({
  fontPreset = DEFAULT_FONT_PRESET,
  fontSizePreset = DEFAULT_FONT_SIZE_PRESET,
  isPremium = false,
} = {}) {
  return persistUiPreferences({
    fontPreset,
    fontSizePreset,
    isPremium: Boolean(isPremium),
  });
}

export function rememberCurrentUiPreferences() {
  if (typeof document === "undefined") return false;

  const root = document.documentElement;
  const pathname = window.location.pathname || "/";
  const theme = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const fontPreset = root.getAttribute("data-font-preset") || DEFAULT_FONT_PRESET;
  const fontSizePreset = root.getAttribute("data-font-size-preset") || DEFAULT_FONT_SIZE_PRESET;
  const isPremium = root.getAttribute("data-premium-ui") === "true";

  const scope = isPublicCookiePath(pathname) ? "public" : "auth";

  return persistUiPreferences({
    [scope === "public" ? "themePublic" : "themeAuth"]: theme,
    fontPreset,
    fontSizePreset,
    isPremium,
  });
}

export function markConsentRejected() {
  setCookieConsentStatus(COOKIE_CONSENT_REJECTED);
  clearUiPreferencesCookie();
}

export function applyAppearanceDataset({
  fontPreset = DEFAULT_FONT_PRESET,
  fontSizePreset = DEFAULT_FONT_SIZE_PRESET,
  isPremium = false,
} = {}) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.setAttribute("data-premium-ui", isPremium ? "true" : "false");
  root.setAttribute("data-font-preset", fontPreset);
  root.setAttribute("data-font-size-preset", fontSizePreset);
}

export function getUiPreferenceBootstrapScript() {
  const fontMap = Object.fromEntries(
    FONT_PRESETS.map((item) => [
      item.key,
      { body: item.body, display: item.display },
    ])
  );
  const sizeMap = Object.fromEntries(
    FONT_SIZE_PRESETS.map((item) => [item.key, item.scale])
  );

  return `
(() => {
  try {
    const getCookie = (name) => {
      const prefix = name + "=";
      const match = document.cookie.split("; ").find((entry) => entry.startsWith(prefix));
      return match ? match.slice(prefix.length) : null;
    };

    if (getCookie("${COOKIE_CONSENT_NAME}") !== "${COOKIE_CONSENT_ACCEPTED}") return;

    const raw = getCookie("${UI_PREFERENCES_COOKIE_NAME}");
    if (!raw) return;

    const prefs = JSON.parse(decodeURIComponent(raw));
    if (!prefs || typeof prefs !== "object") return;

    const root = document.documentElement;
    const pathname = window.location.pathname || "/";
    const isPublicPath =
      pathname === "/" ||
      pathname.startsWith("/contact-us") ||
      pathname.startsWith("/privacy-policy") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup");

    const theme = isPublicPath
      ? prefs.themePublic || prefs.themeAuth
      : prefs.themeAuth || prefs.themePublic;

    if (theme === "dark" || theme === "light") {
      root.setAttribute("data-theme", theme);
    }

    if (typeof prefs.isPremium === "boolean") {
      root.setAttribute("data-premium-ui", prefs.isPremium ? "true" : "false");
    }

    const fonts = ${JSON.stringify(fontMap)};
    const sizes = ${JSON.stringify(sizeMap)};
    const font = fonts[prefs.fontPreset];
    const scale = Number(sizes[prefs.fontSizePreset]);

    if (font) {
      root.style.setProperty("--ui-body-font", font.body);
      root.style.setProperty("--ui-display-font", font.display);
      root.setAttribute("data-font-preset", prefs.fontPreset);
    }

    if (Number.isFinite(scale) && scale > 0) {
      const mobileScale = scale <= 1 ? scale : 1 + (scale - 1) * 0.55;
      root.style.setProperty("--ui-font-scale", String(scale));
      root.style.setProperty("--ui-font-size-mobile", String(15 * mobileScale) + "px");
      root.style.setProperty("--ui-font-size-desktop", String(16 * scale) + "px");
      root.style.setProperty("--ui-type-scale-mobile", String(mobileScale));
      root.style.setProperty("--ui-type-scale-desktop", String(scale));
      root.setAttribute("data-font-size-preset", prefs.fontSizePreset);
    }
  } catch {}
})();
  `.trim();
}

export function getSerializedAppearancePreference({
  fontPreset = DEFAULT_FONT_PRESET,
  fontSizePreset = DEFAULT_FONT_SIZE_PRESET,
  isPremium = false,
} = {}) {
  const font = getFontPreset(fontPreset);
  const size = getFontSizePreset(fontSizePreset);

  return {
    fontPreset,
    fontSizePreset,
    isPremium: Boolean(isPremium),
    font,
    size,
  };
}
