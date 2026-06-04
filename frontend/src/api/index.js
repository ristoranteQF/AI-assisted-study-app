import { api } from './client.js';

export const UsersAPI = {
  me: () => api.get('/api/users/me').then((r) => r.data),
  update: (data) => api.patch('/api/users/me', data).then((r) => r.data),
  changePassword: (current_password, new_password) =>
    api.post('/api/users/me/password', { current_password, new_password }).then((r) => r.data),
  cancelPendingEmail: () =>
    api.delete('/api/users/me/pending-email').then((r) => r.data),
  deleteAccount: () => api.delete('/api/users/me').then((r) => r.data),
};

export const NotesAPI = {
  list: () => api.get('/api/notes').then((r) => r.data),
  get: (id) => api.get(`/api/notes/${id}`).then((r) => r.data),
  create: (data) => api.post('/api/notes', data).then((r) => r.data),
  upload: (title, file) => {
    const fd = new FormData();
    fd.append('title', title);
    fd.append('file', file);
    return api
      .post('/api/notes/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data);
  },
  update: (id, data) => api.patch(`/api/notes/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/api/notes/${id}`).then((r) => r.data),
};

export const DecksAPI = {
  list: () => api.get('/api/decks').then((r) => r.data),
  get: (id) => api.get(`/api/decks/${id}`).then((r) => r.data),
  create: (data) => api.post('/api/decks', data).then((r) => r.data),
  update: (id, data) => api.patch(`/api/decks/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/api/decks/${id}`).then((r) => r.data),
  cards: (id) => api.get(`/api/decks/${id}/cards`).then((r) => r.data),
  due: (id, limit = 50) => api.get(`/api/decks/${id}/due?limit=${limit}`).then((r) => r.data),
  resetProgress: (id) => api.post(`/api/decks/${id}/reset-progress`).then((r) => r.data),
};

export const FlashcardsAPI = {
  create: (deckId, data) =>
    api.post(`/api/flashcards/decks/${deckId}`, data).then((r) => r.data),
  update: (id, data) => api.patch(`/api/flashcards/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/api/flashcards/${id}`).then((r) => r.data),
  review: (id, quality) =>
    api.post(`/api/flashcards/${id}/review`, { quality }).then((r) => r.data),
};

export const QuizzesAPI = {
  list: () => api.get('/api/quizzes').then((r) => r.data),
  get: (id) => api.get(`/api/quizzes/${id}`).then((r) => r.data),
  create: (data) => api.post('/api/quizzes', data).then((r) => r.data),
  update: (id, data) => api.patch(`/api/quizzes/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/api/quizzes/${id}`).then((r) => r.data),
  submit: (id, answers) =>
    api.post(`/api/quizzes/${id}/submit`, { answers }).then((r) => r.data),
  attempts: (id) => api.get(`/api/quizzes/${id}/attempts`).then((r) => r.data),
};

export const SessionsAPI = {
  list: (limit = 30) => api.get(`/api/sessions?limit=${limit}`).then((r) => r.data),
  start: (data) => api.post('/api/sessions/start', data).then((r) => r.data),
  end: (id, data) => api.post(`/api/sessions/${id}/end`, data).then((r) => r.data),
};

export const AnalyticsAPI = {
  overview: () => api.get('/api/analytics/overview').then((r) => r.data),
};

export const AIAPI = {
  status: () => api.get('/api/ai/status').then((r) => r.data),
  flashcards: (note_id, count = 10, deck_name = null) =>
    api.post('/api/ai/flashcards', { note_id, count, deck_name }).then((r) => r.data),
  summary: (note_id) => api.post('/api/ai/summary', { note_id }).then((r) => r.data),
  quiz: (note_id, count = 8, title = null) =>
    api.post('/api/ai/quiz', { note_id, count, title }).then((r) => r.data),
  insights: (note_id) => api.post('/api/ai/insights', { note_id }).then((r) => r.data),
};
