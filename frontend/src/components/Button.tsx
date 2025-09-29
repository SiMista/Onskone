import React from "react";

type CustomButtonProps = {
  text: string;
  backgroundColor?: string;
  textColor?: string;
  rotateEffect?: "true" | "false";
  state?: "default" | "disabled";
  onClick?: () => void;
};

const CustomButton: React.FC<CustomButtonProps> = ({
  text = "default text",
  backgroundColor = "yellow",
  textColor = "black",
  rotateEffect = "false",
  state = "default",
  onClick,
}) => {
  const baseStyle: React.CSSProperties = {
    border: "black 3px solid",
    borderRadius: "8px",
    padding: "5px 24px",
    fontSize: "16px",
    fontWeight: "bold",
    backgroundColor,
    color: textColor,
    boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
    transition: "transform 0.3s ease, background-color 0.3s ease",
    cursor: state === "disabled" ? "default" : "pointer",
    opacity: state === "disabled" ? 0.6 : 1,
  };

  return (
    <button
      onClick={state === "disabled" ? undefined : onClick}
      disabled={state === "disabled"}
      style={baseStyle}
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
        if (rotateEffect === "true") {
          target.style.transform = "scale(1.08) rotate(-1deg)";
        }
      }}
      onMouseOut={(e) => {
        if (state === "disabled") return;
        const target = e.currentTarget as HTMLButtonElement;
        target.style.backgroundColor = backgroundColor;
        if (rotateEffect === "true") {
          target.style.transform = "scale(1) rotate(0deg)";
        }
      }}
    >
      {text}
    </button>
  );
};

export default CustomButton;
