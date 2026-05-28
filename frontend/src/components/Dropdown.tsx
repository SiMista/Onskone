import { useEffect, useRef, useState, ReactNode } from 'react';
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
}

function Dropdown<V extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Sélectionner...',
  disabled = false,
  className = '',
}: DropdownProps<V>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  return (
    <div ref={rootRef} className={`relative w-full ${className}`} style={{ zIndex: 30 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-[12px] border-[2.5px] border-black bg-cream-player texture-paper stack-shadow-sm transition-transform duration-150 active:scale-[0.99] cursor-pointer ${isDisabled ? 'opacity-60 pointer-events-none' : ''}`}
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

      {!isEmpty && (
        <ul
          role="listbox"
          {...(!open ? { inert: '' } : {})}
          className={`list-none p-1 rounded-[12px] border-[2.5px] border-black bg-cream-player texture-paper stack-shadow overflow-y-auto origin-top transition-all duration-200 ease-out ${open ? 'max-h-[30vh] md:max-h-[45vh] opacity-100 scale-y-100 translate-y-0 pointer-events-auto' : 'max-h-0 opacity-0 scale-y-95 -translate-y-1 pointer-events-none'}`}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            margin: 0,
            zIndex: 40,
          }}
        >
          {options.map(option => {
            const isSelected = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={isSelected}>
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
        </ul>
      )}
    </div>
  );
}

export default Dropdown;
