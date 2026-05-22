import axios from 'axios';

const api = axios.create({
  baseURL:         'http://localhost:8000/api',
  withCredentials: true,
  headers:         { 'Content-Type': 'application/json' },
});

function getCookie(name) {
  const val   = `; ${document.cookie}`;
  const parts = val.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

api.interceptors.request.use(config => {
  if (['post','patch','put','delete'].includes(config.method)) {
    const csrf = getCookie('csrftoken');
    if (csrf) config.headers['X-CSRFToken'] = csrf;
  }
  return config;
});

// AUTH
export const loginUser    = (username, password) => api.post('/auth/login/',    { username, password });
export const logoutUser   = ()                   => api.post('/auth/logout/');
export const registerUser = (payload)            => api.post('/auth/register/', payload);
export const getMe        = ()                   => api.get('/auth/me/');
export const getUsers     = ()                   => api.get('/auth/users/');
export const createUser   = (payload)            => api.post('/auth/users/', payload);
export const updateRole   = (userId, role)       => api.patch(`/auth/users/${userId}/role/`, { role });

// TICKETS
export const getTickets   = () => api.get('/tickets/');
export const getTicket    = (id) => api.get(`/tickets/${id}/`);
export const submitTicket = (payload) => api.post('/tickets/', payload);

// CLASSIFICATION
export const classifyTicket = (payload) => api.post('/classification/classify/', payload);

// EMBEDDINGS
export const getSimilarTickets = (query, top_k = 5) => api.post('/embeddings/similar/', { query, top_k });

// CLUSTERING
export const getClusters      = () => api.get('/clustering/clusters/');
export const getKnowledgeGaps = () => api.get('/clustering/gaps/');

// KNOWLEDGE
export const getRunbooks        = ()             => api.get('/knowledge/runbooks/');
export const getRunbookVersions = (clusterId)    => api.get(`/knowledge/runbooks/${clusterId}/versions/`);
export const getRunbookDiff     = (clusterId, v1, v2) => {
  const params = v1 && v2 ? `?v1=${v1}&v2=${v2}` : '';
  return api.get(`/knowledge/runbooks/${clusterId}/diff/${params}`);
};
export const approveRunbook     = (runbookId)    => api.post(`/knowledge/runbooks/${runbookId}/approve/`);
export const getPostmortems     = ()             => api.get('/knowledge/postmortems/');
export const scoreResolution    = (text, id='') => api.post('/knowledge/score-resolution/', { resolution_text: text, ticket_id: id });

// ANALYTICS
export const predictMTTR       = (payload) => api.post('/analytics/predict-mttr/', payload);
export const runModelCommand   = (command) => api.post('/analytics/model-admin/run/', { command });
export const getJobStatus      = (jobId)   => api.get(`/analytics/model-admin/status/${jobId}/`);

// CHAT
export const sendChatQuery = (query, top_k = 5) => api.post('/chat/query/', { query, top_k });

export default api;