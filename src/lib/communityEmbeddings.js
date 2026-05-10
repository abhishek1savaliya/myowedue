const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
const VECTOR_DIMS = 384;

let extractorPromise = null;

function normalizeVector(values, dims = VECTOR_DIMS) {
  const out = new Array(dims).fill(0);
  for (let i = 0; i < Math.min(dims, values.length); i += 1) {
    out[i] = Number(values[i] || 0);
  }
  let norm = 0;
  for (let i = 0; i < out.length; i += 1) norm += out[i] * out[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < out.length; i += 1) out[i] /= norm;
  return out;
}

function fallbackEmbedding(text) {
  const v = new Array(VECTOR_DIMS).fill(0);
  const src = String(text || "").toLowerCase();
  for (let i = 0; i < src.length; i += 1) {
    const code = src.charCodeAt(i);
    const idx = code % VECTOR_DIMS;
    v[idx] += 1;
  }
  return normalizeVector(v);
}

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline } = await import("@xenova/transformers");
      return pipeline("feature-extraction", MODEL_NAME);
    })();
  }
  return extractorPromise;
}

export async function embedText(text) {
  const src = String(text || "").trim();
  if (!src) return fallbackEmbedding("");
  try {
    const extractor = await getExtractor();
    const output = await extractor(src, { pooling: "mean", normalize: true });
    const raw = Array.from(output?.data || []);
    if (!raw.length) return fallbackEmbedding(src);
    return normalizeVector(raw);
  } catch {
    return fallbackEmbedding(src);
  }
}

export function embeddingModelName() {
  return MODEL_NAME;
}

export function vectorToPgLiteral(vector) {
  return `[${(vector || []).map((n) => Number(n || 0).toFixed(8)).join(",")}]`;
}

export function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length) return 0;
  const len = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < len; i += 1) dot += Number(a[i] || 0) * Number(b[i] || 0);
  return dot;
}

