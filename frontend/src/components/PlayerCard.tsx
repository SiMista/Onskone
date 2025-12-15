// src/components/PlayerCard.tsx
import { FaCrown, FaEllipsisV } from "react-icons/fa";
import { useState, useEffect, useRef } from "react";
import Avatar from "./Avatar";

interface PlayerCardProps {
  id: string;
  name: string;
  avatarId: number;
  isHost: boolean;
  isCurrentPlayer: boolean;
  currentPlayerIsHost: boolean;
  isActive?: boolean;
  isFirstPlayer?: boolean;
  onKick?: (id: string) => void;
  onPromote?: (id: string) => void;
}

const PlayerCard: React.FC<PlayerCardProps> = ({
  id,
  name,
  avatarId,
  isHost,
  isCurrentPlayer,
  currentPlayerIsHost,
  isActive = true,
  isFirstPlayer = false,
  onKick,
  onPromote,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fermer le menu quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`flex items-center justify-between py-2 px-[15px] my-2 rounded-[10px] border-2 border-[#ddd] shadow-[0_2px_6px_rgba(0,0,0,0.1)] w-[95%] transition-all duration-300 ${
      isActive
        ? 'bg-[#f9f4ee]'
        : 'bg-gray-200 opacity-50 grayscale'
    }`}>
      {/* Partie gauche → Avatar + nom */}
      <div className="flex items-center gap-2.5">
        <Avatar avatarId={avatarId} name={name} size="md" />
        <span className={isCurrentPlayer ? "font-bold" : "font-normal"}>
          {name} {isCurrentPlayer && "(vous)"}
        </span>
      </div>

      {/* Partie droite → couronne ou menu */}
      <div className="relative">
        {isHost ? (
          <FaCrown color="#fcad11" size={30} />
        ) : currentPlayerIsHost ? (
          <>
            <span
              ref={buttonRef}
              className="cursor-pointer"
              onClick={() => setIsOpen(!isOpen)}
            >
              <FaEllipsisV size={20} />
            </span>
            {isOpen && (
              <div
                ref={menuRef}
                className={`absolute right-0 bg-white border-2 border-dashed border-[#b0b0b0] rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.15)] z-[100] text-right min-w-[160px] overflow-hidden animate-menu-open ${
                  isFirstPlayer ? 'top-full mt-1 origin-top-right' : 'bottom-full mb-1 origin-bottom-right'
                }`}
              >
                <div
                  className="py-3 px-4 cursor-pointer text-[15px] font-semibold text-[#333333] border-b border-[#d0d0d0] transition-[background,transform] duration-200"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#fff8e1";
                    e.currentTarget.style.transform = "scale(1.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                  onClick={() => {
                    setIsOpen(false);
                    onPromote && onPromote(id);
                  }}
                >
                  Promouvoir hôte
                </div>
                <div
                  className="py-3 px-4 cursor-pointer text-[15px] font-semibold text-[#d32f2f] transition-[background,transform] duration-200"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#fce4e4";
                    e.currentTarget.style.transform = "scale(1.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                  onClick={() => {
                    setIsOpen(false);
                    onKick && onKick(id);
                  }}
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
