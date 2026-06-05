import { LuCheck } from 'react-icons/lu';

interface CheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

const Checkbox = ({ checked, onChange, label, description, disabled = false }: CheckboxProps) => {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`group flex items-start gap-3 w-full text-left transition-transform duration-150 active:scale-[0.98] ${
        disabled ? 'opacity-65 pointer-events-none' : 'cursor-pointer'
      }`}
    >
      <span
        aria-hidden
        className={`relative shrink-0 mt-0.5 w-7 h-7 md:w-8 md:h-8 rounded-md border-[2.5px] border-black stack-shadow-sm texture-paper transition-colors duration-200 ${
          checked ? 'bg-warning-500' : 'bg-cream-settings'
        }`}
      >
        <LuCheck
          size={20}
          strokeWidth={3.5}
          className={`absolute inset-0 m-auto text-black transition-all duration-200 ${
            checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
          }`}
        />
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-display text-sm md:text-base font-bold uppercase tracking-tight text-black leading-none">
          {label}
        </div>
        {description && (
          <div className="font-sans text-[11px] text-gray-600 leading-snug mt-1">
            {description}
          </div>
        )}
      </div>
    </button>
  );
};

export default Checkbox;
