const NAMED_ENTITIES = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

/** Strip CMS HTML tags and decode entities for plain-text UI. */
export function cmsPlainText(html) {
  if (html == null || html === "") return "";

  let text = String(html).replace(/<[^>]+>/g, " ");

  text = text.replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
  text = text.replace(/&#(\d+);/g, (_, code) => {
    const n = Number(code);
    return Number.isFinite(n) ? String.fromCodePoint(n) : _;
  });
  text = text.replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
    const n = parseInt(hex, 16);
    return Number.isFinite(n) ? String.fromCodePoint(n) : _;
  });

  return text.replace(/\s+/g, " ").trim();
}
