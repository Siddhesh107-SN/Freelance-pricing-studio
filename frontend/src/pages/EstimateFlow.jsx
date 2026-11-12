import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import ConfirmDialog from '../components/common/ConfirmDialog.jsx';
import { useToast } from '../components/common/Toast.jsx';
import { ErrorBanner, Spinner } from '../components/common/ui.jsx';
import DevelopmentStep from '../components/development/DevelopmentStep.jsx';
import PriceBar from '../components/estimator/PriceBar.jsx';
import StepHeader from '../components/estimator/StepHeader.jsx';
import ExpenseStep from '../components/expenses/ExpenseStep.jsx';
import FeatureStep from '../components/features/FeatureStep.jsx';
import PricingStep from '../components/pricing/PricingStep.jsx';
import ProjectStep from '../components/project/ProjectStep.jsx';
import ReviewStep from '../components/receipts/ReviewStep.jsx';
import { EstimateProvider, blankState, clearLocalDraft, readLocalDraft } from '../context/EstimateContext.jsx';
import { fromEstimate, toPayload, useEstimate } from '../hooks/useEstimate.js';
import { usePricing } from '../hooks/usePricing.js';
import { errorMessage } from '../services/api.js';
import { estimateService } from '../services/estimateService.js';
import { num } from '../utils/formatting.js';
import { milestonesValid, validateStep } from '../utils/validation.js';

function Flow({ config }) {
  const est = useEstimate();
  const { state } = est;
  const notify = useToast();
  const nav = useNavigate();
  const [errors, setErrors] = useState({});
  const [saveState, setSaveState] = useState('idle');
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const busy = useRef(false);

  const { categories, features, members, settings } = config;
  const catFeatures = useMemo(() => features.filter((f) => f.category_id === state.project.category_id && (f.active || state.selected[f.id])), [features, state.project.category_id, state.selected]);
  const hoursPerDay = num(settings?.extra_defaults?.hours_per_day) || 6;
  const pricing = usePricing(state, features, members, { server: state.step >= 4, hoursPerDay });
  const featureHours = useMemo(() => Object.entries(state.selected).reduce((s, [id, v]) => {
    const f = features.find((x) => String(x.id) === id);
    return s + (f ? num(f.estimated_hours) * v.qty : 0);
  }, 0), [state.selected, features]);

  const save = useCallback(async ({ silent = false } = {}) => {
    if (busy.current) return null;
    if (!milestonesValid(state.milestones)) { setSaveError('Milestone percentages must add up to exactly 100.'); setSaveState('error'); return null; }
    busy.current = true; setSaving(true); setSaveState('saving');
    try {
      const payload = toPayload(state, features);
      const saved = state.id ? await estimateService.update(state.id, payload) : await estimateService.create(payload);
      est.saved(saved);
      setSaveState('saved'); setSaveError(null);
      if (!state.id) clearLocalDraft();
      return saved;
    } catch (e) {
      setSaveState('error'); setSaveError(errorMessage(e));
      if (!silent) notify(errorMessage(e), 'error');
      return null;
    } finally { busy.current = false; setSaving(false); }
  }, [state, features, est, notify]);

  // Autosave once the client and project are named. A failed save keeps the draft in local storage and shows a banner.
  useEffect(() => {
    if (!state.dirty || state.step === 5 || !state.project.project_name.trim() || !state.project.client_name.trim()) return undefined;
    const t = setTimeout(() => save({ silent: true }), 2500);
    return () => clearTimeout(t);
  }, [state, save]);

  useEffect(() => {
    const warn = (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state.dirty]);

  const next = async () => {
    const v = validateStep(state.step, state);
    setErrors(v.errors);
    if (!v.ok) { notify('Fix the highlighted fields to continue.', 'error'); return; }
    if (state.step === 4) { const saved = await save(); if (!saved) return; }
    est.goto(state.step + 1);
    window.scrollTo({ top: 0 });
  };
  const back = () => { setErrors({}); est.goto(Math.max(0, state.step - 1)); };
  const exit = () => (state.dirty ? setConfirmExit(true) : nav('/'));

  const stepProps = { est, errors };
  const views = [
    <ProjectStep key="0" {...stepProps} categories={categories} />,
    <FeatureStep key="1" {...stepProps} features={catFeatures} />,
    <DevelopmentStep key="2" {...stepProps} features={catFeatures} members={members} pricing={pricing.display} featureHours={featureHours} />,
    <ExpenseStep key="3" {...stepProps} />,
    <PricingStep key="4" {...stepProps} pricing={pricing.display} verified={pricing.verified} loading={pricing.loading} serverError={pricing.error} />,
    <ReviewStep key="5" est={est} onSave={() => save()} saving={saving} />,
  ];

  return (
    <div>
      <StepHeader step={state.step} onBack={back} onNext={next} onExit={exit} nextLoading={saving && state.step === 4} saveState={saveState} />
      <div className="mt-4"><ErrorBanner message={saveError && `Draft not saved: ${saveError}`} onRetry={() => save()} /></div>
      <AnimatePresence mode="wait">
        <motion.div key={state.step} className="py-8" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }}>
          {views[state.step]}
        </motion.div>
      </AnimatePresence>
      <PriceBar pricing={pricing.display} />
      <ConfirmDialog open={confirmExit} title="Leave this estimate?" text="Some changes are not saved to the server yet. A copy stays on this device and you can resume it from the home screen."
        confirmLabel="Leave" onCancel={() => setConfirmExit(false)} onConfirm={() => nav('/')} />
    </div>
  );
}

export default function EstimateFlow() {
  const { id } = useParams();
  const location = useLocation();
  const [config, setConfig] = useState(null);
  const [initial, setInitial] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    setConfig(null);
    (async () => {
      try {
        const [categories, features, members, settings] = await Promise.all([estimateService.categories(), estimateService.features({ include_inactive: true }), estimateService.teamMembers(), estimateService.settings()]);
        let start;
        if (id) start = fromEstimate(await estimateService.get(id));
        else {
          const local = location.state?.fresh ? null : readLocalDraft();
          start = local && !local.id ? { ...blankState(), ...local, dirty: true } : blankState();
          const firstActive = members.find((m) => m.active);
          if (!local) {
            const d = settings;
            start.pricing = { ...start.pricing, profit_margin: String(d.default_profit_margin), contingency_pct: String(d.default_contingency), gst_enabled: !!d.default_gst_enabled, gst_rate: String(d.default_gst_rate) };
            const ms = d.extra_defaults?.milestones;
            if (ms?.length) start.milestones = ms.map(([milestone_name, percentage]) => ({ milestone_name, percentage: String(percentage) }));
          }
          if (firstActive) {
            start.dev = start.dev.map((row) => ({ ...row, team_member_id: row.team_member_id ?? firstActive.id }));
          }
        }
        if (alive) { setConfig({ categories, features, members, settings }); setInitial(start); }
      } catch (e) { if (alive) setError(errorMessage(e)); }
    })();
    return () => { alive = false; };
  }, [id, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div className="py-10"><ErrorBanner message={error} onRetry={() => setAttempt((a) => a + 1)} /></div>;
  if (!config) return <Spinner label="Loading estimator" />;
  return <EstimateProvider key={id ?? 'new'} initial={initial}><Flow config={config} /></EstimateProvider>;
}

