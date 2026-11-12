import api from './api.js';

export const quotationService = {
  list: () => api.get('/quotations').then((r) => r.data),
  async forEstimate(estimateId, { create = false } = {}) {
    const found = (await this.list()).find((q) => q.estimate_id === estimateId);
    if (found || !create) return found || null;
    return api.post('/quotations', { estimate_id: estimateId }).then((r) => r.data);
  },
  async setStatusForEstimate(estimateId, status) {
    const q = await this.forEstimate(estimateId, { create: true });
    return api.put(`/quotations/${q.id}/status`, { status }).then((r) => r.data);
  },
};
