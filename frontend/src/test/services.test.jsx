import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/api.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  errorMessage: (e) => e.userMessage || e.message,
  TOKEN_KEY: 'fps_token',
}));
import api from '../services/api.js';
import { estimateService } from '../services/estimateService.js';
import { ToastProvider } from '../components/common/Toast.jsx';
import PreviousEstimates from '../pages/PreviousEstimates.jsx';

const rows = [
  { id: 1, estimate_number: 'EST-2026-0001', project_name: 'Acme site', client_name: 'Acme', status: 'Draft', final_client_price: '39884.00', quotation_number: null, created_at: '2026-11-01T10:00:00', updated_at: '2026-11-02T10:00:00' },
];

beforeEach(() => { vi.clearAllMocks(); });

describe('estimateService', () => {
  it('requests PDFs as blobs from the right endpoint and triggers a download', async () => {
    api.get.mockResolvedValue({ data: new Blob(['%PDF']) });
    URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await estimateService.download(7, 'client', 'q.pdf');
    expect(api.get).toHaveBeenCalledWith('/estimates/7/pdf/client', { responseType: 'blob' });
    expect(click).toHaveBeenCalled();
  });
  it('passes search and status filters to the API', async () => {
    api.get.mockResolvedValue({ data: [] });
    await estimateService.list({ q: 'acme', status: 'Sent' });
    expect(api.get).toHaveBeenCalledWith('/estimates', { params: { q: 'acme', status: 'Sent' } });
  });
});

describe('PreviousEstimates', () => {
  const view = () => render(<MemoryRouter><ToastProvider><PreviousEstimates /></ToastProvider></MemoryRouter>);

  it('loads and shows saved estimates', async () => {
    api.get.mockResolvedValue({ data: rows });
    view();
    expect(await screen.findByText('Acme site')).toBeInTheDocument();
    expect(screen.getByText('EST-2026-0001')).toBeInTheDocument();
  });
  it('shows an error with retry when the server is unreachable', async () => {
    api.get.mockRejectedValueOnce({ userMessage: 'Cannot reach the server.' }).mockResolvedValue({ data: rows });
    view();
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server.');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Acme site')).toBeInTheDocument();
  });
  it('shows an empty state', async () => {
    api.get.mockResolvedValue({ data: [] });
    view();
    expect(await screen.findByText('No estimates found')).toBeInTheDocument();
  });
  it('searches by text', async () => {
    api.get.mockResolvedValue({ data: rows });
    view();
    await screen.findByText('Acme site');
    await userEvent.type(screen.getByLabelText('Search estimates'), 'acme');
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/estimates', { params: { q: 'acme', status: undefined } }));
  });
});
