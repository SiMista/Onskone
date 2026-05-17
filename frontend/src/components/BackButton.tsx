import { BsFillCaretLeftFill } from "react-icons/bs";

type BackButtonProps = {
  onClick?: () => void;
  label?: string;
  tone?: "neutral" | "danger";
  className?: string;
  ariaLabel?: string;
};

const BackButton: React.FC<BackButtonProps> = ({
  onClick,
  label = "Retour",
  tone = "neutral",
  className = "",
  ariaLabel,
}) => {
  const isDanger = tone === "danger";

  // Au repos : juste un chevron + texte, ghostés en blanc/75 - quasi-invisible.
  // Au hover : pill subtile qui apparaît (bg + border translucides). Le tone
  // teinte le hover en rouge si destructif.
  const hoverClasses = isDanger
    ? "hover:bg-[#c83030]/30 hover:border-[#c83030]/60 hover:text-white"
    : "hover:bg-white/15 hover:border-white/40 hover:text-white";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      className={`self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border-[1.5px] border-transparent text-white/75 font-display font-bold text-[11px] uppercase tracking-[0.12em] cursor-pointer transition-all duration-200 ease-out hover:-translate-x-0.5 active:translate-x-0 active:translate-y-0.5 ${hoverClasses} ${className}`}
    >
      <BsFillCaretLeftFill size={9} className="opacity-80" />
      <span>{label}</span>
    </button>
  );
};

export default BackButton;
