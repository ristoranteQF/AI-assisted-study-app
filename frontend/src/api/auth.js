import { api } from './client.js';

export const AuthAPI = {
  signup: (data) => api.post('/api/auth/signup', data).then((r) => r.data),
  login: (data) => api.post('/api/auth/login', data).then((r) => r.data),
  forgotPassword: (email) =>
    api.post('/api/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (token, new_password) =>
    api.post('/api/auth/reset-password', { token, new_password }).then((r) => r.data),
  verifyEmail: (token) => api.post('/api/auth/verify-email', { token }).then((r) => r.data),
  confirmEmailChange: (token) =>
    api.post('/api/auth/confirm-email-change', { token }).then((r) => r.data),
  resendVerification: (email) =>
    api.post('/api/auth/resend-verification', { email }).then((r) => r.data),
  me: () => api.get('/api/users/me').then((r) => r.data),
};
