import { AlertCircle, Loader2 } from 'lucide-react';
import { cloneElement, isValidElement, useId } from 'react';

const VARIANTS = {
  primary: 'bg-ink text-white hover:bg-black disabled:bg-gray-400',
  accent: 'bg-accent text-white hover:bg-accent-dark disabled:bg-gray-400',
  secondary: 'bg-white text-ink border border-line hover:border-ink disabled:text-gray-400',
  ghost: 'text-ink hover:bg-black/5 disabled:text-gray-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-400',
};

export function Button({ variant = 'primary', loading = false, className = '', children, disabled, ...rest }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export const Card = ({ className = '', children, ...rest }) => (
  <div className={`rounded-2xl border border-line bg-white p-5 ${className}`} {...rest}>{children}</div>
);

export function Field({ label, error, hint, children, className = '' }) {
  const id = useId();
  const child = isValidElement(children) && !children.props.id ? cloneElement(children, { id, 'aria-invalid': error ? true : undefined }) : children;
  return (
    <div className={`space-y-1 ${className}`}>
      {label && <label htmlFor={id} className="block">{label}</label>}
      {child}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export const Spinner = ({ label = 'Loading' }) => (
  <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
    <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {label}
  </div>
);

export function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1">{message}</span>
      {onRetry && <button onClick={onRetry} className="font-medium underline">Retry</button>}
    </div>
  );
}

export const EmptyState = ({ title, text, action }) => (
  <div className="rounded-2xl border border-dashed border-line p-10 text-center">
    <p className="font-medium">{title}</p>
    {text && <p className="mt-1 text-sm text-gray-500">{text}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export function Segmented({ value, onChange, options, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-white p-1">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-sm transition ${value === o.value ? 'bg-ink text-white' : 'hover:bg-black/5'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
