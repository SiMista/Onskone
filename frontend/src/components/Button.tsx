import { ReactNode } from "react";

type ButtonVariant = "primary" | "success" | "danger" | "warning" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg" | "xl";

type ButtonProps = {
  children?: ReactNode;
  text?: string; // Backward compatibility
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  isLoading?: boolean;
  isFullWidth?: boolean;
  icon?: ReactNode;
  iconOnly?: boolean;
  rotateEffect?: boolean;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit" | "reset";
  // Legacy props for backward compatibility
  backgroundColor?: string;
  textColor?: string;
  state?: "default" | "disabled";
};

const variantStyles: Record<ButtonVariant, { base: string; hover: string }> = {
  primary: {
    base: "bg-[#1AAFDA] text-black border-black",
    hover: "hover:bg-[#1799bf]",
  },
  success: {
    base: "bg-[#30c94d] text-black border-black",
    hover: "hover:bg-[#25b841]",
  },
  danger: {
    base: "bg-red-500 text-black border-black",
    hover: "hover:bg-red-600",
  },
  warning: {
    base: "bg-[#FFC700] text-black border-black",
    hover: "hover:bg-[#e8b80e]",
  },
  secondary: {
    base: "bg-gray-500 text-black border-black",
    hover: "hover:bg-gray-600",
  },
  ghost: {
    base: "bg-transparent text-gray-600 border-transparent",
    hover: "hover:bg-gray-100 hover:text-gray-800",
  },
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1 text-sm",
  md: "px-6 py-1.5 text-base",
  lg: "px-8 py-2 text-lg",
  xl: "px-8 py-2.5 text-xl",
};

const Button: React.FC<ButtonProps> = ({
  children,
  text,
  variant = "primary",
  size = "md",
  disabled = false,
  isLoading = false,
  isFullWidth = false,
  icon,
  iconOnly = false,
  rotateEffect = false,
  onClick,
  className = "",
  type = "button",
  // Legacy props
  backgroundColor,
  textColor,
  state,
}) => {
  // Handle legacy state prop
  const isDisabled = disabled || state === "disabled" || isLoading;

  // Use legacy colors if provided, otherwise use variant
  const useLegacyStyle = backgroundColor !== undefined;

  const baseClasses = `
    border-[3px] rounded-lg font-bold
    shadow-[0_2px_10px_rgba(0,0,0,0.2)]
    transition-all duration-300 ease-in-out
    ${isFullWidth ? "w-full" : ""}
    ${isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
    ${iconOnly ? "p-2" : sizeStyles[size]}
    ${!useLegacyStyle ? `${variantStyles[variant].base} ${!isDisabled ? variantStyles[variant].hover : ""}` : ""}
    ${rotateEffect && !isDisabled ? "hover:scale-[1.08] hover:rotate-[-0.7deg]" : ""}
    ${!rotateEffect && !isDisabled ? "hover:scale-105" : ""}
    ${className}
  `.trim().replace(/\s+/g, " ");

  const handleMouseOver = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled || !useLegacyStyle) return;
    const target = e.currentTarget;
    // Darken the color on hover
    if (backgroundColor === "#FFC700") {
      target.style.backgroundColor = "#e8b80e";
    } else if (backgroundColor === "#1AAFDA") {
      target.style.backgroundColor = "#1799bf";
    } else if (backgroundColor === "#30c94d") {
      target.style.backgroundColor = "#25b841";
    }
    if (rotateEffect) {
      target.style.transform = "scale(1.08) rotate(-0.7deg)";
    }
  };

  const handleMouseOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled || !useLegacyStyle) return;
    const target = e.currentTarget;
    target.style.backgroundColor = backgroundColor || "";
    if (rotateEffect) {
      target.style.transform = "scale(1) rotate(0deg)";
    }
  };

  const content = (
    <>
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Chargement...
        </span>
      ) : (
        <>
          {icon && <span className={iconOnly ? "" : "mr-2"}>{icon}</span>}
          {!iconOnly && (children || text)}
        </>
      )}
    </>
  );

  return (
    <button
      type={type}
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      className={baseClasses}
      style={useLegacyStyle ? { backgroundColor, color: textColor } : undefined}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
    >
      {content}
    </button>
  );
};

export default Button;
