import { createContext, useCallback, useContext, useState } from 'react';

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const notify = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x, { id, message, type }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), type === 'error' ? 7000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={notify}>
      {children}
      <div className="fixed right-4 top-4 z-50 space-y-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} role="status" className={`max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg ${t.type === 'error' ? 'bg-red-600 text-white' : 'bg-ink text-white'}`}>{t.message}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
