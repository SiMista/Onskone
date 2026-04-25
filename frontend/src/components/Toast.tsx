import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { Icon } from '@iconify/react';
import { LuX } from 'react-icons/lu';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLE: Record<ToastVariant, { bg: string; icon: string }> = {
  info:    { bg: '#E7F5FF', icon: 'fluent-emoji-flat:information' },
  success: { bg: '#E6F8E6', icon: 'fluent-emoji-flat:check-mark-button' },
  warning: { bg: '#FFF3C4', icon: 'fluent-emoji-flat:warning' },
  error:   { bg: '#FFE2E2', icon: 'fluent-emoji-flat:cross-mark' },
};

const EXIT_DURATION = 280; // ms — doit matcher .animate-toast-out

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [exitingIds, setExitingIds] = useState<Set<number>>(new Set());
  const idRef = useRef(0);
  const timeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const removeTimeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    // Annule le timer auto-dismiss
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
    // Évite de relancer l'exit si déjà en cours
    if (removeTimeoutsRef.current.has(id)) return;

    // Démarre l'animation de sortie
    setExitingIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    // Retire le toast une fois l'anim terminée
    const removeTimeout = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      setExitingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      removeTimeoutsRef.current.delete(id);
    }, EXIT_DURATION);
    removeTimeoutsRef.current.set(id, removeTimeout);
  }, []);

  const showToast = useCallback((message: string, variant: ToastVariant = 'info', duration = 3500) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, variant, duration }]);
    const timeout = setTimeout(() => dismiss(id), duration);
    timeoutsRef.current.set(id, timeout);
  }, [dismiss]);

  useEffect(() => {
    const autoMap = timeoutsRef.current;
    const removeMap = removeTimeoutsRef.current;
    return () => {
      autoMap.forEach(clearTimeout);
      autoMap.clear();
      removeMap.forEach(clearTimeout);
      removeMap.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed top-12 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 px-3 w-full max-w-md pointer-events-none"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {toasts.map(t => {
          const style = VARIANT_STYLE[t.variant];
          const isExiting = exitingIds.has(t.id);
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto w-full flex items-center gap-2.5 px-3 py-2.5 border-[2.5px] border-black rounded-xl stack-shadow-sm texture-paper ${isExiting ? 'animate-toast-out' : 'animate-toast-drop'}`}
              style={{ backgroundColor: style.bg }}
            >
              <Icon icon={style.icon} width={22} height={22} aria-hidden className="shrink-0" />
              <p className="flex-1 text-sm font-display font-bold text-gray-900 m-0 leading-tight">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="shrink-0 w-7 h-7 flex items-center justify-center active:scale-95 transition-transform text-gray-600 cursor-pointer"
                aria-label="Fermer"
              >
                <LuX size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx.showToast;
};
