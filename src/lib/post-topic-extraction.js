import nlp from "compromise";

const STOP = new Set(
  `the a an and or but if then else when at from by for in on to of as is am are was were be been being
  it its this that these those with without about into over under again further once here there
  all any both each few more most other some such no nor not only own same so than too very can
  could should would may might must shall will just also what which who whom whose why how
  do does did doing done get got getting go going went come came make made take took use used
  using like up out off down your my our their i you he she we they me him her us them
  has have had having been being`.split(/\s+|\n/g).map((s) => s.trim().toLowerCase()).filter(Boolean)
);

const SPAM_PHRASES = new Set(
  `click here buy now subscribe free money crypto airdrop guaranteed winner act now limited time
  viagra cialis casino poker porn xxx nude sex dating hot singles earn $ work from home
  follow me dm me check bio link in bio`.split(/\s+|\n/g).map((s) => s.trim().toLowerCase()).filter(Boolean)
);

const ACRONYM_ALLOW = new Set(["ai", "ui", "ux", "js", "ts", "io", "os", "db", "api", "ml", "vr", "ar", "qa", "ci", "cd", "id", "ip", "it", "hr", "pr", "seo"]);

const TECH_ALIASES = new Map([
  ["nextjs", "next.js"],
  ["next js", "next.js"],
  ["reactjs", "react"],
  ["react js", "react"],
  ["node js", "node.js"],
  ["nodejs", "node.js"],
  ["type script", "typescript"],
  ["java script", "javascript"],
  ["mongo db", "mongodb"],
  ["post gre", "postgres"],
]);

/** Strip most emoji / pictographic symbols for NLP. */
export function stripEmojis(text) {
  return String(text || "")
    .replace(/\p{Extended_Pictographic}[\uFE0F\u200D]*/gu, "")
    .replace(/[\uFE0F\u200D]/g, "");
}

export function stripUrls(text) {
  return String(text || "").replace(/\bhttps?:\/\/\S+/gi, " ");
}

function isSpamTopic(topic) {
  const t = String(topic || "")
    .toLowerCase()
    .trim();
  if (!t) return true;
  if (SPAM_PHRASES.has(t)) return true;
  if (/https?:\/\//i.test(t)) return true;
  if (/^\d+$/.test(t)) return true;
  if (t.length > 80) return true;
  return false;
}

function normalizeTechPhrase(s) {
  const key = s.toLowerCase().trim().replace(/\s+/g, " ");
  return TECH_ALIASES.get(key) || key;
}

function tokenOk(word) {
  const w = word.toLowerCase();
  if (w.length >= 3) return !STOP.has(w);
  if (w.length === 2) return ACRONYM_ALLOW.has(w);
  return false;
}

function phraseValid(phrase) {
  const t = phrase.toLowerCase().trim().replace(/\s+/g, " ");
  if (!t) return false;
  const shortOk = t.length >= 2 || /[^\u0000-\u007F]/.test(t);
  if (!shortOk) return false;
  if (isSpamTopic(t)) return false;
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return false;
  if (parts.every((p) => STOP.has(p))) return false;
  if (parts.length === 1) {
    const p0 = parts[0];
    if (p0.length < 1) return false;
    const hasNonAscii = /[^\u0000-\u007F]/.test(p0);
    if (p0.length === 1) {
      return hasNonAscii && /\p{L}|\p{N}/u.test(p0) && !STOP.has(p0);
    }
    if (!hasNonAscii) {
      if (p0.length === 2 && !ACRONYM_ALLOW.has(p0)) return false;
      if (p0.length < 3 && !ACRONYM_ALLOW.has(p0)) return false;
    }
    return !STOP.has(p0);
  }
  return parts.some((p) => tokenOk(p) || /[\d.]/.test(p));
}

function splitOnConjunctions(chunk) {
  return String(chunk || "")
    .split(/\s+(?:and|&|und|et|或|和|与|以及)\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** #tags from original text (case-insensitive, no # in output). */
export function extractHashtags(text) {
  const raw = String(text || "");
  const re = /#([\p{L}][\p{L}\p{N}_]*)/gu;
  const out = [];
  let m;
  while ((m = re.exec(raw)) !== null) {
    const tag = m[1].toLowerCase();
    if (phraseValid(tag)) out.push(tag);
  }
  return out;
}

/**
 * Extract normalized topic strings for storage in post_topics.
 * @param {string} body
 * @returns {string[]}
 */
export function extractPostTopics(body) {
  const original = String(body || "").trim();
  if (!original) return [];

  const hashtags = extractHashtags(original);
  const withoutUrls = stripUrls(original);
  const forNlp = stripEmojis(withoutUrls).replace(/#[\p{L}][\p{L}\p{N}_]*/gu, " ");

  const doc = nlp(forNlp);
  const nounChunks = doc.nouns().out("array");

  const candidates = [];
  for (const h of hashtags) {
    candidates.push(normalizeTechPhrase(h));
  }

  for (const chunk of nounChunks) {
    for (const piece of splitOnConjunctions(chunk)) {
      const norm = normalizeTechPhrase(piece);
      if (phraseValid(norm)) candidates.push(norm);
    }
  }

  // Any-script word runs (Compromise nouns are English-centric; this seeds trending for all languages.)
  const wordRuns = forNlp.match(/\p{L}[\p{L}\p{M}\p{N}]*/gu) || [];
  for (const w of wordRuns) {
    const norm = normalizeTechPhrase(w);
    if (phraseValid(norm)) candidates.push(norm);
  }

  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    const key = c.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= 24) break;
  }
  return out;
}
