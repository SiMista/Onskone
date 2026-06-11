import { useCallback, useEffect, useLayoutEffect, useRef, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';

export interface DropdownOption<V extends string = string> {
  value: V;
  label: ReactNode;
  /** Label affiché dans le bouton quand cette option est sélectionnée. Défaut: `label`. */
  selectedLabel?: ReactNode;
  prefix?: ReactNode;
}

interface DropdownProps<V extends string = string> {
  value: V | '';
  onChange: (value: V) => void;
  options: DropdownOption<V>[];
  placeholder?: ReactNode;
  disabled?: boolean;
  className?: string;
  /**
   * `paper` (défaut) : carte papier autonome (bordure épaisse, grain, ombre).
   * `flat` : champ discret en retrait, pour s'imbriquer dans une carte parente
   * sans empiler deux surfaces papier.
   */
  variant?: 'paper' | 'flat';
}

interface TriggerRect {
  top: number;
  left: number;
  width: number;
  bottom: number;
}

function Dropdown<V extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Sélectionner...',
  disabled = false,
  className = '',
  variant = 'paper',
}: DropdownProps<V>) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<TriggerRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listboxRef = useRef<HTMLUListElement | null>(null);

  const selected = options.find(o => o.value === value);

  const updateRect = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, bottom: r.bottom });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateRect();
  }, [open, updateRect]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => updateRect();
    const onResize = () => updateRect();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, updateRect]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (listboxRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const isEmpty = options.length === 0;
  const isDisabled = disabled || isEmpty;

  // Hauteur dispo entre le bas du trigger et le bas du viewport (avec marge confortable).
  const availableHeight = rect ? Math.max(160, window.innerHeight - rect.bottom - 80) : 280;

  const listbox = open && !isEmpty && rect && createPortal(
    <ul
      ref={listboxRef}
      role="listbox"
      className="list-none p-1 rounded-[12px] border-[2.5px] border-black bg-cream-player texture-paper stack-shadow overflow-y-auto overscroll-contain animate-menu-open"
      style={{
        position: 'fixed',
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
        maxHeight: availableHeight,
        margin: 0,
        zIndex: 100,
      }}
    >
      {options.map((option, idx) => {
        const isSelected = option.value === value;
        return (
          <li key={option.value} role="option" aria-selected={isSelected}>
            {idx > 0 && (
              <div className="mx-2 border-t border-dashed border-black/15" aria-hidden />
            )}
            <button
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] transition-colors duration-150 cursor-pointer ${isSelected ? 'bg-warning-350' : 'hover:bg-black/5'}`}
            >
              {option.prefix}
              <span className="font-display font-semibold text-black truncate flex-1 text-left">
                {option.label}
              </span>
              {isSelected && (
                <Icon icon="lucide:check" width={18} height={18} className="text-black shrink-0" aria-hidden />
              )}
            </button>
          </li>
        );
      })}
    </ul>,
    document.body
  );

  return (
    <div className={`relative w-full ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 transition-transform duration-150 active:scale-[0.99] cursor-pointer ${
          variant === 'flat'
            ? 'rounded-[10px] border-2 border-black/15 bg-white/55'
            : 'rounded-[12px] border-[2.5px] border-black bg-cream-player texture-paper stack-shadow-sm'
        } ${isDisabled ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <span className="flex items-center gap-2.5 min-w-0 flex-1">
          {selected ? (
            <>
              {selected.prefix}
              <span className="font-display font-semibold text-black truncate text-left">
                {selected.selectedLabel ?? selected.label}
              </span>
            </>
          ) : (
            <span className="text-gray-500 italic truncate">{placeholder}</span>
          )}
        </span>
        <Icon
          icon="lucide:chevron-down"
          width={22}
          height={22}
          className={`shrink-0 text-black transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {listbox}
    </div>
  );
}

export default Dropdown;
