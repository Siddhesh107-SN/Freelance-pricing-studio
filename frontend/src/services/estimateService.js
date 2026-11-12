import api from './api.js';

export const estimateService = {
  list: (params) => api.get('/estimates', { params }).then((r) => r.data),
  get: (id) => api.get(`/estimates/${id}`).then((r) => r.data),
  create: (p) => api.post('/estimates', p).then((r) => r.data),
  update: (id, p) => api.put(`/estimates/${id}`, p).then((r) => r.data),
  remove: (id) => api.delete(`/estimates/${id}`),
  duplicate: (id) => api.post(`/estimates/${id}/duplicate`).then((r) => r.data),
  preview: (p) => api.post('/estimates/preview', p).then((r) => r.data),
  pdfBlob: (id, kind) => api.get(`/estimates/${id}/pdf/${kind}`, { responseType: 'blob' }).then((r) => r.data),
  htmlDoc: (id, kind) => api.get(`/estimates/${id}/pdf/${kind}?format=html`).then((r) => r.data),
  async download(id, kind, filename) {
    const blob = await this.pdfBlob(id, kind);
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },
  categories: () => api.get('/categories').then((r) => r.data),
  features: (params) => api.get('/features', { params }).then((r) => r.data),
  teamMembers: () => api.get('/team-members').then((r) => r.data),
  settings: () => api.get('/settings').then((r) => r.data),
};
