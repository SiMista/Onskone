import React from "react";

type CustomButtonProps = {
  text: string;
  backgroundColor?: string;
  textColor?: string;
  onClick?: () => void;
};

const CustomButton: React.FC<CustomButtonProps> = ({
  text = "default text",
  backgroundColor = "yellow",
  textColor = "black",
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
      }}
    >
      {text}
    </button>
  );
};

export default CustomButton;
