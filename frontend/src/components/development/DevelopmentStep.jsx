import { Card, Field } from '../common/ui.jsx';
import { formatINR } from '../../utils/currency.js';
import { calculateHoursPerDevCategory, num } from '../../utils/formatting.js';

export default function DevelopmentStep({ est, features = [], members = [], pricing, featureHours, errors }) {
  const { state, updateDev, set } = est;
  const rate = Object.fromEntries(members.map((m) => [String(m.id), num(m.internal_hourly_rate)]));
  const name = Object.fromEntries(members.map((m) => [String(m.id), m.name]));
  const hours = pricing.hours_by_developer || {};

  const autoFillHours = () => {
    const hoursMap = calculateHoursPerDevCategory(state.selected, state.custom, features, state.project.complexity);
    const firstActive = members.find((m) => m.active);
    const activeId = firstActive ? firstActive.id : null;
    state.dev.forEach((d, i) => {
      const h = hoursMap[d.category] || 0;
      updateDev(i, {
        hours: h > 0 ? String(h) : '',
        team_member_id: d.team_member_id ?? activeId,
      });
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">How much work will this take?</h1>
          <p className="mt-1 text-sm text-gray-600">
            Your selected features add up to about {featureHours.toFixed(1)} hours. Enter the work you expect below. Internal cost is calculated from these allocations only,
            so hours are never counted twice.
          </p>
        </div>
        {featureHours > 0 && (
          <button
            type="button"
            onClick={autoFillHours}
            className="rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-semibold text-ink shadow-sm hover:bg-gray-50"
          >
            Auto-fill hours from features ({featureHours.toFixed(1)} h)
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="p-3">Work category</th><th className="p-3">Hours</th><th className="p-3">Developer</th><th className="p-3">Rate / h</th><th className="p-3">Done in (days)</th><th className="p-3 text-right">Cost</th>
          </tr></thead>
          <tbody>
            {state.dev.map((d, i) => (
              <tr key={d.category} className="border-b border-line last:border-0 align-top">
                <td className="p-3 font-medium">{d.category}{errors[`dev.${i}`] && <p role="alert" className="text-xs font-normal text-red-600">{errors[`dev.${i}`]}</p>}</td>
                <td className="p-3">
                  <input
                    aria-label={`${d.category} hours`}
                    type="number"
                    min="0"
                    value={d.hours}
                    onChange={(e) => {
                      const val = e.target.value;
                      const updates = { hours: val };
                      if (val && num(val) > 0 && !d.team_member_id) {
                        const firstActive = members.find((m) => m.active);
                        if (firstActive) updates.team_member_id = firstActive.id;
                      }
                      updateDev(i, updates);
                    }}
                    className="w-24"
                  />
                </td>
                <td className="p-3">
                  <select aria-label={`${d.category} developer`} value={d.team_member_id ?? ''} onChange={(e) => updateDev(i, { team_member_id: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">Unassigned</option>{members.filter((m) => m.active).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </td>
                <td className="p-3 tabular-nums text-gray-500">{formatINR(rate[String(d.team_member_id)] || 0)}</td>
                <td className="p-3"><input aria-label={`${d.category} completion days`} type="number" min="0" value={d.completion_days} onChange={(e) => updateDev(i, { completion_days: e.target.value })} className="w-20" /></td>
                <td className="p-3 text-right tabular-nums">{formatINR(num(d.hours) * (rate[String(d.team_member_id)] || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card><p className="text-xs text-gray-500">Total hours</p><p className="text-2xl font-semibold tabular-nums">{pricing.total_hours}</p></Card>
        {members.filter((m) => m.active).slice(0, 2).map((m, idx) => (
          <Card key={m.id}><p className="text-xs text-gray-500">{m.name || `Developer ${idx + 1}`} workload</p><p className="text-2xl font-semibold tabular-nums">{hours[String(m.id)] || 0} h</p></Card>
        ))}
        <Card><p className="text-xs text-gray-500">Internal development cost</p><p className="text-2xl font-semibold tabular-nums">{formatINR(pricing.internal_development_cost)}</p></Card>
      </div>

      <Card className="grid items-end gap-4 sm:grid-cols-3">
        <div><p className="text-xs text-gray-500">Estimated working days</p><p className="text-2xl font-semibold tabular-nums">{pricing.auto_delivery_days}</p>
          <p className="text-xs text-gray-500">The busiest developer's hours divided by the daily capacity.</p></div>
        <Field label="Manual timeline override (days)" error={errors.timeline} hint="Leave empty to use the estimate.">
          <input type="number" min="0" value={state.timeline_override_days} onChange={(e) => set('timeline_override_days', e.target.value)} />
        </Field>
        <div><p className="text-xs text-gray-500">Delivery timeline</p><p className="text-2xl font-semibold tabular-nums">{pricing.estimated_delivery_days} days</p>
          <p className="text-xs text-gray-500">About {Math.ceil(pricing.estimated_delivery_days / 5)} weeks.</p></div>
      </Card>
      {Object.keys(name).length === 0 && <p className="text-sm text-red-600">No team members found. Add them on the Pricing page.</p>}
    </div>
  );
}
