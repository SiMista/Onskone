// src/components/PlayerCard.tsx
import { FaCrown, FaEllipsisV, FaUserSlash } from "react-icons/fa";
import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import Avatar from "./Avatar";

const MENU_WIDTH = 184;
const MENU_HEIGHT = 96;
const MARGIN = 6;

interface OptionsMenuProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  preferBottom: boolean;
  onPromote: () => void;
  onKick: () => void;
  innerRef: React.MutableRefObject<HTMLDivElement | null>;
}

const OptionsMenu: React.FC<OptionsMenuProps> = ({ anchorRef, preferBottom, onPromote, onKick, innerRef }) => {
  const [pos, setPos] = useState<{ top: number; left: number; origin: 'top' | 'bottom' } | null>(null);

  useLayoutEffect(() => {
    const compute = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const spaceBelow = vh - rect.bottom;
      const spaceAbove = rect.top;
      const placeBottom = preferBottom
        ? spaceBelow >= MENU_HEIGHT + MARGIN || spaceBelow >= spaceAbove
        : spaceAbove < MENU_HEIGHT + MARGIN && spaceBelow > spaceAbove;

      const top = placeBottom
        ? rect.bottom + MARGIN
        : rect.top - MENU_HEIGHT - MARGIN;

      const spaceLeft = rect.right;
      const spaceRight = vw - rect.left;
      const openRight = spaceLeft < MENU_WIDTH + 8 && spaceRight >= MENU_WIDTH + 8;

      let left = openRight ? rect.left : rect.right - MENU_WIDTH;
      left = Math.max(8, Math.min(left, vw - MENU_WIDTH - 8));

      setPos({ top, left, origin: placeBottom ? 'top' : 'bottom' });
    };

    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [anchorRef, preferBottom]);

  if (!pos) return null;

  return createPortal(
    <div
      ref={innerRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: MENU_WIDTH }}
      className={`z-[1000] rounded-xl bg-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] ring-1 ring-black/5 overflow-hidden animate-menu-open ${
        pos.origin === 'bottom' ? 'origin-bottom' : ''
      }`}
      role="menu"
    >
      <button
        type="button"
        role="menuitem"
        onClick={onPromote}
        className="menu-option w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] font-semibold text-gray-700 hover:bg-[#fff6dd] hover:text-[#b07600]"
      >
        <FaCrown className="menu-icon shrink-0" size={14} color="#fcad11" />
        <span>Promouvoir hôte</span>
      </button>

      <div className="h-px bg-gray-100 mx-2" />

      <button
        type="button"
        role="menuitem"
        onClick={onKick}
        className="menu-option w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] font-semibold text-[#d32f2f] hover:bg-[#fdecec]"
      >
        <FaUserSlash className="menu-icon shrink-0" size={14} />
        <span>Expulser</span>
      </button>
    </div>,
    document.body
  );
};

interface PlayerCardProps {
  id: string;
  name: string;
  avatarId: number;
  isHost: boolean;
  isCurrentPlayer: boolean;
  currentPlayerIsHost: boolean;
  isActive?: boolean;
  isFirstPlayer?: boolean;
  variant?: 'row' | 'square';
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
  variant = 'row',
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

  const currentBorder = isCurrentPlayer ? 'border-[2px] border-[#2b2b2b] ring-2 ring-black/15' : 'border-2 border-[#ddd]';

  if (variant === 'square') {
    return (
      <div className={`relative aspect-square flex flex-col items-center justify-center gap-1 p-2 rounded-[10px] shadow-[0_2px_6px_rgba(0,0,0,0.1)] w-full transition-all duration-300 ${currentBorder} ${
        isActive ? 'bg-cream-player' : 'bg-gray-200'
      }`}>
        {/* Couronne ou menu en haut à droite */}
        <div className="absolute top-1 right-1">
          {isHost ? (
            <FaCrown color="#fcad11" size={18} />
          ) : currentPlayerIsHost ? (
            <>
              <span
                ref={buttonRef}
                className="cursor-pointer inline-flex p-1"
                onClick={() => setIsOpen(!isOpen)}
              >
                <FaEllipsisV size={14} />
              </span>
              {isOpen && (
                <OptionsMenu
                  innerRef={menuRef}
                  anchorRef={buttonRef}
                  preferBottom={isFirstPlayer}
                  onPromote={() => { setIsOpen(false); onPromote && onPromote(id); }}
                  onKick={() => { setIsOpen(false); onKick && onKick(id); }}
                />
              )}
            </>
          ) : null}
        </div>

        <div className={`flex flex-col items-center gap-1 min-w-0 w-full ${!isActive ? 'opacity-50 grayscale' : ''}`}>
          <Avatar avatarId={avatarId} name={name} size="md" />
          <span className={`text-xs text-center truncate w-full px-1 ${isCurrentPlayer ? "font-bold" : "font-normal"}`}>
            {name}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between py-3 px-5 my-2.5 rounded-[12px] shadow-[0_2px_6px_rgba(0,0,0,0.1)] w-full transition-all duration-300 ${currentBorder} ${
      isActive
        ? 'bg-cream-player'
        : 'bg-gray-200'
    }`}>
      {/* Partie gauche → Avatar + nom */}
      <div className={`flex items-center gap-3.5 ${!isActive ? 'opacity-50 grayscale' : ''}`}>
        <Avatar avatarId={avatarId} name={name} size="md" />
        <span className={`text-base md:text-lg ${isCurrentPlayer ? "font-bold" : "font-normal"}`}>
          {name}
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
              <OptionsMenu
                innerRef={menuRef}
                anchorRef={buttonRef}
                preferBottom={isFirstPlayer}
                onPromote={() => { setIsOpen(false); onPromote && onPromote(id); }}
                onKick={() => { setIsOpen(false); onKick && onKick(id); }}
              />
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default PlayerCard;
