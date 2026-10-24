/**
 * embeddingEngine.js
 * ──────────────────────────────────────────────────────────
 * SwiftMatch AI — Local semantic embedding layer.
 *
 * Runs the open-source sentence-transformer `all-MiniLM-L6-v2` (384-d)
 * fully on-device via ONNX (@xenova/transformers). No SME data leaves
 * the server for embedding, which matters for POPIA.
 *
 * - Model is downloaded once (~23 MB) and cached in server/.model-cache
 * - If the model cannot load (offline venue Wi-Fi etc.) the matching
 *   engine transparently falls back to lexical scoring and reports it.
 * ──────────────────────────────────────────────────────────
 */

const path = require('path');

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const DIMENSIONS = 384;

let extractor = null;
let loadPromise = null;
let loadError = null;

async function loadModel() {
  if (extractor) return extractor;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    // @xenova/transformers is ESM-only; use dynamic import from CommonJS.
    const { pipeline, env } = await import('@xenova/transformers');
    // Serverless filesystems are read-only except the OS temp dir.
    env.cacheDir = process.env.MODEL_CACHE_DIR
      || (process.env.VERCEL ? path.join(require('os').tmpdir(), 'swiftmatch-model-cache') : path.join(__dirname, '..', '.model-cache'));
    env.allowLocalModels = true;
    extractor = await pipeline('feature-extraction', MODEL_ID, { quantized: true });
    console.log(`[EmbeddingEngine] ${MODEL_ID} ready (${DIMENSIONS}-d, quantized ONNX, on-device).`);
    return extractor;
  })().catch(err => {
    loadError = err;
    loadPromise = null;
    console.warn(`[EmbeddingEngine] Model unavailable, lexical fallback active: ${err.message}`);
    return null;
  });

  return loadPromise;
}

/** Embed a single string → Float32Array (L2-normalised, mean pooled). */
async function embed(text) {
  const model = await loadModel();
  if (!model) return null;
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Float32Array.from(output.data);
}

/** Cosine similarity for two normalised vectors (dot product). */
function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/** Canonical text used to embed an SME capability profile. */
function smeProfileText(sme) {
  return [
    sme.category,
    sme.description,
    (sme.tags || []).join(', ')
  ].filter(Boolean).join('. ');
}

/** Pre-compute and attach `_vector` to every SME in-place. */
async function indexSmes(smes) {
  const model = await loadModel();
  if (!model) return { indexed: 0, ready: false };
  let indexed = 0;
  for (const sme of smes) {
    sme._vector = await embed(smeProfileText(sme));
    indexed++;
  }
  console.log(`[EmbeddingEngine] Indexed ${indexed} SME capability vectors.`);
  return { indexed, ready: true };
}

function getStatus() {
  return {
    ready: !!extractor,
    model: MODEL_ID,
    dimensions: DIMENSIONS,
    runtime: 'onnxruntime (on-device, quantized)',
    error: loadError ? loadError.message : null
  };
}

module.exports = { loadModel, embed, cosine, smeProfileText, indexSmes, getStatus, MODEL_ID, DIMENSIONS };
