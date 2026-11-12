import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../common/ui.jsx';
import { formatINR } from '../../utils/currency.js';
import { num } from '../../utils/formatting.js';
import { milestoneTotal } from '../../utils/validation.js';

export default function MilestoneEditor({ milestones, onChange, finalPrice }) {
  const total = milestoneTotal(milestones);
  const ok = Math.abs(total - 100) < 1e-9;
  const update = (i, v) => onChange(milestones.map((m, idx) => (idx === i ? { ...m, ...v } : m)));
  return (
    <div className="space-y-2">
      {milestones.map((m, i) => (
        <div key={i} className="grid items-center gap-2 sm:grid-cols-12">
          <input className="sm:col-span-6" aria-label={`Milestone ${i + 1} name`} value={m.milestone_name} onChange={(e) => update(i, { milestone_name: e.target.value })} />
          <div className="flex items-center gap-1 sm:col-span-2"><input aria-label={`Milestone ${i + 1} percentage`} type="number" min="0" max="100" value={m.percentage} onChange={(e) => update(i, { percentage: e.target.value })} /><span>%</span></div>
          <span className="tabular-nums text-sm text-gray-600 sm:col-span-3">{formatINR((num(finalPrice) * num(m.percentage)) / 100, 2)}</span>
          <Button variant="ghost" aria-label={`Remove milestone ${i + 1}`} disabled={milestones.length <= 1} onClick={() => onChange(milestones.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={() => onChange([...milestones, { milestone_name: '', percentage: '0' }])}><Plus className="h-4 w-4" /> Add milestone</Button>
        <p role={ok ? undefined : 'alert'} className={`text-sm ${ok ? 'text-green-700' : 'text-red-600'}`}>Total {total}% {ok ? '' : '(must be exactly 100%)'}</p>
      </div>
    </div>
  );
}
