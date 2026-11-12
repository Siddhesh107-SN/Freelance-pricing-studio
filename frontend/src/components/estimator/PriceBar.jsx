import AnimatedNumber from './AnimatedNumber.jsx';
import { formatINR } from '../../utils/currency.js';
import { num } from '../../utils/formatting.js';

export default function PriceBar({ pricing }) {
  const evaluable = pricing.profit_evaluable !== false && num(pricing.total_internal_cost) > 0 && pricing.estimated_profit != null;
  const profit = pricing.estimated_profit ?? 0;
  const margin = pricing.profit_margin != null ? num(pricing.profit_margin).toFixed(1) : null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink bg-ink text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-1 px-4 py-3 sm:px-6">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-400">Client price{pricing.gst_amount > 0 ? ' incl. GST' : ''}</p>
          <AnimatedNumber value={pricing.final_client_price} className="text-xl font-semibold tabular-nums" />
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Internal cost</p>
            <span className="tabular-nums">{formatINR(pricing.total_internal_cost)}</span>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Profit</p>
            {evaluable ? (
              <span className={`tabular-nums ${profit < 0 ? 'text-red-400' : 'text-green-400'}`}>
                {formatINR(profit)} ({margin}%)
              </span>
            ) : (
              <span className="tabular-nums text-gray-400">Not evaluated</span>
            )}
          </div>
          <div className="hidden sm:block">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Hours / days</p>
            <span className="tabular-nums">{pricing.total_hours} h / {pricing.estimated_delivery_days} d</span>
          </div>
        </div>
      </div>
    </div>
  );
}
