import { animate } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { formatINR } from '../../utils/currency.js';

export default function AnimatedNumber({ value, decimals = 0, className = '' }) {
  const [shown, setShown] = useState(Number(value) || 0);
  const from = useRef(shown);
  useEffect(() => {
    const controls = animate(from.current, Number(value) || 0, { duration: 0.4, ease: 'easeOut', onUpdate: (v) => { from.current = v; setShown(v); } });
    return () => controls.stop();
  }, [value]);
  return <span className={className} data-testid="animated-number" data-value={Number(value) || 0}>{formatINR(shown, decimals)}</span>;
}
