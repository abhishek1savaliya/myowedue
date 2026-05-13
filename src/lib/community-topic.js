/** Normalize topic query / URL param to match `post_topics.topic` storage (lowercase, trimmed, max 120 code points). */
export function normalizeCommunityTopicParam(raw) {
  let t = String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
  if (!t) return "";
  const chars = [...t];
  if (chars.length > 120) t = chars.slice(0, 120).join("");
  return t.length >= 2 ? t : "";
}
