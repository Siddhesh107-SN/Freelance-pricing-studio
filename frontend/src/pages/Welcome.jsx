import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/common/ui.jsx';
import Hero from '../components/welcome/Hero.jsx';
import { clearLocalDraft, readLocalDraft } from '../context/EstimateContext.jsx';

const fade = (i) => ({ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.1 * i, duration: 0.5 } });

export default function Welcome() {
  const nav = useNavigate();
  const draft = readLocalDraft();
  return (
    <div className="grid items-center gap-10 py-10 md:grid-cols-2 md:py-20">
      <div>
        <motion.h1 {...fade(0)} className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Let's put a price on your next project.</motion.h1>
        <motion.p {...fade(1)} className="mt-4 max-w-md text-lg text-gray-600">Turn client requirements into a clear, confident project estimate.</motion.p>
        <motion.div {...fade(2)} className="mt-8 flex flex-wrap gap-3">
          <Button variant="accent" className="px-6 py-3 text-base" onClick={() => { clearLocalDraft(); nav('/estimate/new', { state: { fresh: true } }); }}>Create New Estimate</Button>
          <Button variant="secondary" className="px-5 py-3" onClick={() => nav('/estimates')}>View Previous Estimates</Button>
          <Button variant="ghost" className="px-5 py-3" onClick={() => nav('/pricing')}>Configure Pricing</Button>
        </motion.div>
        {draft && !draft.id && (
          <motion.button {...fade(3)} onClick={() => nav('/estimate/new')} className="mt-6 text-sm underline">Resume unsaved draft{draft.project?.project_name ? `: ${draft.project.project_name}` : ''}</motion.button>
        )}
        <motion.p {...fade(4)} className="mt-10 text-sm text-gray-500"><button className="underline" onClick={() => nav('/settings')}>Business settings</button></motion.p>
      </div>
      <div className="flex justify-center"><Hero /></div>
    </div>
  );
}
