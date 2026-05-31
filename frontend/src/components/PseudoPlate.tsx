import { ChangeEvent, KeyboardEvent } from 'react';
import { useLocale } from '../i18n';

interface PseudoPlateProps {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  maxLength?: number;
  onSubmit?: () => void;
}

const PseudoPlate = ({
  value,
  onChange,
  placeholder,
  maxLength = 20,
  onSubmit,
}: PseudoPlateProps) => {
  const { t } = useLocale();
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit?.();
    }
  };

  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder ?? t.common.pseudoPlaceholder}
      maxLength={maxLength}
      enterKeyHint="go"
      className="w-full text-center font-display text-lg md:text-xl text-gray-900 bg-[#f9f4ee] border-[2.5px] border-black rounded-lg px-4 py-2.5 outline-none stack-shadow-sm placeholder:text-gray-400 focus:bg-[#fff8ec] transition-colors"
    />
  );
};

export default PseudoPlate;
