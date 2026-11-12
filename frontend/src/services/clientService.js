import api from './api.js';

export const clientService = {
  list: (q) => api.get('/clients', { params: { q } }).then((r) => r.data),
  create: (b) => api.post('/clients', b).then((r) => r.data),
  update: (id, b) => api.put(`/clients/${id}`, b).then((r) => r.data),
  remove: (id) => api.delete(`/clients/${id}`),
};
