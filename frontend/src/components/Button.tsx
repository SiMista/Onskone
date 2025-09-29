import React from "react";

type CustomButtonProps = {
  text: string;
  backgroundColor?: string;
  textColor?: string;
  rotateEffect?: string;
  onClick?: () => void;
};

const CustomButton: React.FC<CustomButtonProps> = ({
  text = "default text",
  backgroundColor = "yellow",
  textColor = "black",
  rotateEffect = "false",
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      style={{
        border: "black 3px solid",
        borderRadius: "8px",
        padding: "5px 24px",
        cursor: "pointer",
        fontSize: "16px",
        fontWeight: "bold",
        backgroundColor,
        color: textColor,
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        // On hover, slightly darken the background color
        transition: "transform 0.3s ease, background-color 0.3s ease", // transition propre
      }}
      onMouseOver={(e) => {
        const target = e.currentTarget as HTMLButtonElement;
        target.style.backgroundColor =
          backgroundColor === "#FFC700" ? "#e8b80e" : // jaune foncé
            backgroundColor === "#1AAFDA" ? "#1799bf" : // bleu foncé
              backgroundColor === "#30c94d" ? "#25b841" : // vert foncé
                backgroundColor;
        if (rotateEffect === "true")
          target.style.transform = "scale(1.08) rotate(-1deg)"; // grossit + tourne
      }}
      onMouseOut={(e) => {
        const target = e.currentTarget as HTMLButtonElement;
        target.style.backgroundColor = backgroundColor;
        if (rotateEffect === "true")
          target.style.transform = "scale(1) rotate(0deg)"; // reset
      }}
    >
      {text}
    </button>
  );
};

export default CustomButton;
