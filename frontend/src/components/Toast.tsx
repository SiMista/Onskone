import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { Icon } from '@iconify/react';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error' | 'achievement';

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

interface VariantStyle {
  bg: string;
  icon: string;
  /** Si vrai, applique un contour noir et un drop-shadow sur l'emoji (look "succès"). */
  iconOutlined?: boolean;
}

const VARIANT_STYLE: Record<ToastVariant, VariantStyle> = {
  info: { bg: '#E7F5FF', icon: 'fluent-emoji-flat:information' },
  success: { bg: '#E6F8E6', icon: 'fluent-emoji-flat:check-mark-button' },
  warning: { bg: '#FFF3C4', icon: 'fluent-emoji-flat:warning' },
  error: { bg: '#FFE2E2', icon: 'fluent-emoji-flat:cross-mark' },
  // Même dégradé que les achievements débloqués dans la modale "Mes succès".
  achievement: {
    bg: 'linear-gradient(to bottom right, var(--color-warning-300), var(--color-warning-orange))',
    icon: 'fluent-emoji-flat:trophy',
    iconOutlined: true,
  },
};

const OUTLINE_FILTER =
  'drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(1px 2px 0 rgba(0,0,0,0.35))';

const EXIT_DURATION = 280; // ms - doit matcher .animate-toast-out

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
          const isGradient = style.bg.startsWith('linear-gradient');
          return (
            <div
              key={t.id}
              role="status"
              className={`relative pointer-events-auto w-full flex items-center gap-2.5 px-3 py-2.5 border-[2.5px] border-black rounded-xl stack-shadow-sm texture-paper overflow-hidden ${isExiting ? 'animate-toast-out' : 'animate-toast-drop'}`}
              style={isGradient ? { backgroundImage: style.bg } : { backgroundColor: style.bg }}
            >
              <Icon
                icon={style.icon}
                width={style.iconOutlined ? 26 : 22}
                height={style.iconOutlined ? 26 : 22}
                aria-hidden
                className="shrink-0"
                style={style.iconOutlined ? { filter: OUTLINE_FILTER } : undefined}
              />
              <p className="flex-1 text-sm font-display font-bold text-gray-900 m-0 leading-tight">{t.message}</p>
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
