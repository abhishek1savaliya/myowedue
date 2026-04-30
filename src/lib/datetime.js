import moment from "moment-timezone";

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Australia/Sydney";

export function parseDateOnly(value, timezone = APP_TIMEZONE) {
  const text = String(value || "").trim();
  if (!text) return null;
  const parsed = moment.tz(text, "YYYY-MM-DD", true, timezone);
  return parsed.isValid() ? parsed.toDate() : null;
}

export function parseDateTime(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseDateInputValue(value, timezone = APP_TIMEZONE) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return parseDateOnly(text, timezone);
  }
  return parseDateTime(text);
}

export function formatDateOnly(value, timezone = APP_TIMEZONE) {
  if (!value) return "";
  return moment(value).tz(timezone).format("YYYY-MM-DD");
}

export function formatMonthKey(value, timezone = APP_TIMEZONE) {
  if (!value) return "";
  return moment(value).tz(timezone).format("YYYY-MM");
}

export function formatDateTimeLabel(value, timezone = APP_TIMEZONE) {
  if (!value) return "";
  return moment(value).tz(timezone).format("YYYY-MM-DD HH:mm:ss z");
}

export function nextDateOnly(value, timezone = APP_TIMEZONE) {
  const parsed = parseDateOnly(value, timezone);
  return parsed ? moment(parsed).tz(timezone).add(1, "day").toDate() : null;
}
