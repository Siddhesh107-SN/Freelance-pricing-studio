import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../common/ui.jsx';

export const STEPS = [
  { title: 'Project details', heading: 'What are we building?' },
  { title: 'Feature selection', heading: 'What does this project need?' },
  { title: 'Development estimation', heading: 'How much work will this take?' },
  { title: 'Additional expenses', heading: 'What else will this project require?' },
  { title: 'Pricing and adjustments', heading: "Let's calculate your final price." },
  { title: 'Review and final receipts', heading: 'Your project estimate is ready.' },
];

export default function StepHeader({ step, onBack, onNext, onExit, nextLoading, saveState }) {
  const pct = Math.round(((step + 1) / STEPS.length) * 100);
  const last = step === STEPS.length - 1;
  return (
    <div className="sticky top-0 z-30 -mx-4 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-gray-500">Step {step + 1} of {STEPS.length} &middot; {STEPS[step].title}</p>
          <p className="text-xs text-gray-500" aria-live="polite">
            {saveState === 'saving' && <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Saving draft</span>}
            {saveState === 'saved' && <span className="inline-flex items-center gap-1 text-green-700"><Check className="h-3 w-3" /> Draft saved</span>}
            {saveState === 'error' && <span className="text-red-600">Not saved yet</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onExit}>Exit</Button>
          <Button variant="secondary" onClick={onBack} disabled={step === 0}><ArrowLeft className="h-4 w-4" /> Back</Button>
          {!last && <Button variant="accent" onClick={onNext} loading={nextLoading}>Continue <ArrowRight className="h-4 w-4" /></Button>}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <motion.div className="h-full bg-accent" initial={false} animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
        </div>
        <span className="w-10 text-right text-xs tabular-nums text-gray-500">{pct}%</span>
      </div>
    </div>
  );
}
