import { motion } from 'framer-motion';

// Decorative: stacked estimate cards with a price tag settling into place.
export default function Hero() {
  return (
    <svg viewBox="0 0 320 240" className="w-full max-w-sm" role="img" aria-label="Illustration of a project estimate taking shape">
      {[0, 1, 2].map((i) => (
        <motion.rect key={i} x={40 + i * 18} y={150 - i * 34} width="200" height="48" rx="10" fill="#fff" stroke="#111827" strokeWidth="1.5"
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * i, type: 'spring', stiffness: 120, damping: 16 }} />
      ))}
      {[0, 1, 2].map((i) => (
        <motion.rect key={`l${i}`} x={58 + i * 18} y={168 - i * 34} width={90 - i * 10} height="6" rx="3" fill="#d6d3cd"
          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} style={{ originX: 0 }} transition={{ delay: 0.5 + 0.15 * i }} />
      ))}
      <motion.g initial={{ opacity: 0, scale: 0.6, rotate: -12 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ delay: 0.9, type: 'spring' }} style={{ originX: '250px', originY: '60px' }}>
        <circle cx="250" cy="60" r="34" fill="#ea580c" />
        <text x="250" y="68" textAnchor="middle" fontSize="26" fontWeight="700" fill="#fff">&#8377;</text>
      </motion.g>
      <motion.path d="M70 60h90M70 80h60" stroke="#111827" strokeWidth="3" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.4, duration: 0.8 }} />
    </svg>
  );
}
