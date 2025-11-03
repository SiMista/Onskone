import React from "react";

type CustomButtonProps = {
  text: string;
  backgroundColor?: string;
  textColor?: string;
  rotateEffect?: boolean;
  state?: "default" | "disabled";
  onClick?: () => void;
};

const CustomButton: React.FC<CustomButtonProps> = ({
  text = "default text",
  backgroundColor = "yellow",
  textColor = "black",
  rotateEffect = false,
  state = "default",
  onClick,
}) => {
  return (
    <button
      onClick={state === "disabled" ? undefined : onClick}
      disabled={state === "disabled"}
      className={`
        border-black border-[3px] rounded-lg px-6 py-1.5 text-base font-bold
        shadow-[0_2px_10px_rgba(0,0,0,0.2)]
        transition-[transform,background-color] duration-300 ease-in-out
        ${state === "disabled" ? "cursor-default opacity-60" : "cursor-pointer"}
      `}
      style={{
        backgroundColor,
        color: textColor,
      }}
      onMouseOver={(e) => {
        if (state === "disabled") return;
        const target = e.currentTarget as HTMLButtonElement;
        target.style.backgroundColor =
          backgroundColor === "#FFC700"
            ? "#e8b80e"
            : backgroundColor === "#1AAFDA"
              ? "#1799bf"
              : backgroundColor === "#30c94d"
                ? "#25b841"
                : backgroundColor;
        if (rotateEffect) {
          target.style.transform = "scale(1.08) rotate(-1deg)";
        }
      }}
      onMouseOut={(e) => {
        if (state === "disabled") return;
        const target = e.currentTarget as HTMLButtonElement;
        target.style.backgroundColor = backgroundColor;
        if (rotateEffect) {
          target.style.transform = "scale(1) rotate(0deg)";
        }
      }}
    >
      {text}
    </button>
  );
};

export default CustomButton;
