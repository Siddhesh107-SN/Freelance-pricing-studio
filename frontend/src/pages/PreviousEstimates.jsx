import { Copy, Download, FileText, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/common/ConfirmDialog.jsx';
import { useToast } from '../components/common/Toast.jsx';
import { Button, EmptyState, ErrorBanner, Spinner } from '../components/common/ui.jsx';
import { errorMessage } from '../services/api.js';
import { estimateService } from '../services/estimateService.js';
import { quotationService } from '../services/quotationService.js';
import { formatINR } from '../utils/currency.js';
import { formatDate } from '../utils/formatting.js';

const STATUSES = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'];

export default function PreviousEstimates() {
  const nav = useNavigate();
  const notify = useToast();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [toDelete, setToDelete] = useState(null);

  const load = useCallback(() => {
    setError(null);
    estimateService.list({ q: q || undefined, status: status || undefined }).then(setRows).catch((e) => setError(errorMessage(e)));
  }, [q, status]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const act = (fn, ok) => async (...a) => { try { await fn(...a); if (ok) notify(ok); load(); } catch (e) { notify(errorMessage(e), 'error'); } };
  const duplicate = act((id) => estimateService.duplicate(id), 'Estimate duplicated');
  const remove = act((id) => estimateService.remove(id), 'Estimate deleted');
  const setStat = act((id, s) => quotationService.setStatusForEstimate(id, s), 'Status updated');
  const pdf = (e, kind) => act(() => estimateService.download(e.id, kind, `${kind === 'client' ? e.quotation_number || e.estimate_number : `${e.estimate_number}-internal`}.pdf`))();

  return (
    <div className="space-y-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Previous estimates</h1>
        <Button variant="accent" onClick={() => nav('/estimate/new', { state: { fresh: true } })}>Create New Estimate</Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <input aria-label="Search estimates" className="max-w-xs" placeholder="Search by project or number" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Filter by status" className="max-w-[10rem]" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      <ErrorBanner message={error} onRetry={load} />
      {!rows && !error && <Spinner />}
      {rows && !rows.length && <EmptyState title="No estimates found" text={q || status ? 'Try clearing the search or filter.' : 'Your saved estimates will appear here.'} />}
      {rows?.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[860px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="p-3">Number</th><th className="p-3">Project</th><th className="p-3">Client</th><th className="p-3">Created</th><th className="p-3">Updated</th><th className="p-3 text-right">Price</th><th className="p-3">Status</th><th className="p-3" />
            </tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="p-3 font-mono text-xs">{e.estimate_number}</td>
                  <td className="p-3"><button className="font-medium underline-offset-2 hover:underline" onClick={() => nav(`/estimate/${e.id}`)}>{e.project_name}</button></td>
                  <td className="p-3">{e.client_name}</td><td className="p-3">{formatDate(e.created_at)}</td><td className="p-3">{formatDate(e.updated_at)}</td>
                  <td className="p-3 text-right tabular-nums">{formatINR(e.final_client_price)}</td>
                  <td className="p-3"><select aria-label={`Status for ${e.estimate_number}`} value={e.status} onChange={(ev) => setStat(e.id, ev.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></td>
                  <td className="p-3"><div className="flex justify-end gap-1">
                    {e.status === 'Draft' && <Button variant="ghost" aria-label="Edit draft" onClick={() => nav(`/estimate/${e.id}`)}><Pencil className="h-4 w-4" /></Button>}
                    <Button variant="ghost" aria-label="Duplicate" onClick={() => duplicate(e.id)}><Copy className="h-4 w-4" /></Button>
                    <Button variant="ghost" aria-label="Download internal PDF" title="Internal PDF" onClick={() => pdf(e, 'internal')}><FileText className="h-4 w-4" /></Button>
                    <Button variant="ghost" aria-label="Download client quotation" title="Client quotation" onClick={() => pdf(e, 'client')}><Download className="h-4 w-4" /></Button>
                    <Button variant="ghost" aria-label="Delete" onClick={() => setToDelete(e)}><Trash2 className="h-4 w-4" /></Button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog open={!!toDelete} danger title="Delete this estimate?" text={toDelete ? `${toDelete.estimate_number} (${toDelete.project_name}) will be removed from the list.` : ''} confirmLabel="Delete"
        onCancel={() => setToDelete(null)} onConfirm={() => { remove(toDelete.id); setToDelete(null); }} />
    </div>
  );
}
