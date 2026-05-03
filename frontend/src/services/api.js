import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

// ── TICKETS ───────────────────────────────────────────────────────
export const getTickets      = ()     => api.get('/tickets/');
export const getTicket       = (id)   => api.get(`/tickets/${id}/`);

// ── CLASSIFICATION ────────────────────────────────────────────────
// Response includes predicted_category, confidence_score,
// all_probabilities, and top_keywords (Feature 1 explainability)
export const classifyTicket  = (payload) =>
  api.post('/classification/classify/', payload);

// ── EMBEDDINGS / SIMILAR ──────────────────────────────────────────
export const getSimilarTickets = (query, top_k = 5) =>
  api.post('/embeddings/similar/', { query, top_k });

// ── CLUSTERING ────────────────────────────────────────────────────
// Response includes has_runbook, knowledge_gap, dominant_domain (Features 2 & 6)
export const getClusters      = ()    => api.get('/clustering/clusters/');
export const getKnowledgeGaps = ()    => api.get('/clustering/gaps/');

// ── KNOWLEDGE — Runbooks ──────────────────────────────────────────
export const getRunbooks         = ()           => api.get('/knowledge/runbooks/');
export const getRunbookVersions  = (clusterId)  => api.get(`/knowledge/runbooks/${clusterId}/versions/`);
export const getRunbookDiff      = (clusterId, v1, v2) => {
  const params = v1 && v2 ? `?v1=${v1}&v2=${v2}` : '';
  return api.get(`/knowledge/runbooks/${clusterId}/diff/${params}`);
};
export const approveRunbook      = (runbookId)  => api.post(`/knowledge/runbooks/${runbookId}/approve/`);

// ── KNOWLEDGE — Postmortems ───────────────────────────────────────
export const getPostmortems      = ()           => api.get('/knowledge/postmortems/');

// ── KNOWLEDGE — Feature 3: Resolution Quality Score ───────────────
export const scoreResolution = (resolution_text, ticket_id = '') =>
  api.post('/knowledge/score-resolution/', { resolution_text, ticket_id });

// ── ANALYTICS — Feature 5: MTTR Prediction ───────────────────────
export const predictMTTR = (payload) =>
  api.post('/analytics/predict-mttr/', payload);

// ── CHAT ──────────────────────────────────────────────────────────
// Response includes retrieval_quality and max_similarity (Feature 2 grounding)
export const sendChatQuery = (query, top_k = 5) =>
  api.post('/chat/query/', { query, top_k });

export default api;