// src/components/PlayerCard.tsx
import { FaCrown, FaEllipsisV } from "react-icons/fa";
import { useState } from "react";

interface PlayerCardProps {
  id: string;
  name: string;
  isHost: boolean;
  isCurrentPlayer: boolean;
  currentPlayerIsHost: boolean;
  onKick?: (id: string) => void;
  onPromote?: (id: string) => void;
}

const PlayerCard: React.FC<PlayerCardProps> = ({
  id,
  name,
  isHost,
  isCurrentPlayer,
  currentPlayerIsHost,
  onKick,
  onPromote,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 15px",
        margin: "8px 0",
        borderRadius: "10px",
        border: "2px solid #ddd",
        backgroundColor: "rgb(249, 245, 242)",
        boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
        width: "95%",
      }}
    >
      {/* Partie gauche → Avatar + nom */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <img
          src={`https://api.dicebear.com/9.x/micah/svg?scale=150&seed=${name}`} // avatar auto
          alt={name}
          style={{ width: "40px", height: "40px", border: "solid 1px grey", borderRadius: "50%" }}
        />
        <span style={{ fontWeight: isCurrentPlayer ? "bold" : "normal" }}>
          {name} {isCurrentPlayer && "(vous)"}
        </span>
      </div>

      {/* Partie droite → couronne ou menu */}
      <div style={{ position: "relative" }}>
        {isHost ? (
          FaCrown({ color: "fcad11", size: 30 }) as JSX.Element
        ) : currentPlayerIsHost ? (
          <>
            {FaEllipsisV({
              size: 20,
              style: { cursor: "pointer" },
              onClick: () => setIsOpen(!isOpen),
            }) as JSX.Element}
            {isOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  background: "#ffffff",           // blanc
                  border: "2px dashed #b0b0b0",   // gris clair
                  borderRadius: "16px",
                  boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
                  zIndex: 10,
                  textAlign: "right",
                  minWidth: "160px",
                  overflow: "hidden",
                  transform: "scale(1)",
                  transition: "transform 0.2s ease-out",
                }}
              >
                <div
                  style={{
                    padding: "12px 16px",
                    cursor: "pointer",
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "#333333",              // gris très foncé
                    borderBottom: "1px solid #d0d0d0", // gris clair
                    transition: "background 0.2s, transform 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#fff8e1"; // jaune clair
                    e.currentTarget.style.transform = "scale(1.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                  onClick={() => onPromote && onPromote(id)}
                >
                  Promouvoir hôte
                </div>
                <div
                  style={{
                    padding: "12px 16px",
                    cursor: "pointer",
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "#d32f2f",              // rouge
                    transition: "background 0.2s, transform 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#fce4e4"; // rouge très clair au hover
                    e.currentTarget.style.transform = "scale(1.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                  onClick={() => onKick && onKick(id)}
                >
                  Expulser
                </div>
              </div>

            )}
          </>
        ) : null}
      </div>

    </div>
  );
};

export default PlayerCard;

