import { ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { LuCopy, LuLink, LuShare2 } from 'react-icons/lu';
import BottomSheet from './BottomSheet';
import { LobbyCodeDisplay } from './LobbyCode';
import { useLocale } from '../i18n';
import { buildInviteUrl } from '../constants/game';
import type { GameMode } from '@onskone/shared';

/**
 * Petite bulle d'action (icône au-dessus, label dessous). Conserve l'identité
 * sticker du jeu (border noir, texture papier, stack-shadow + press qui aplatit).
 */
const ActionBubble = ({
  icon,
  label,
  bg,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  bg: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`group flex flex-col items-center justify-center gap-1 w-24 py-2.5 rounded-2xl border-[2.5px] border-black texture-paper stack-shadow-sm text-black cursor-pointer ${bg} hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:[box-shadow:none!important] transition-all duration-[300ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]`}
  >
    <span className="relative z-10 flex flex-col items-center gap-1">
      {icon}
      <span className="text-[11px] font-display font-bold uppercase tracking-tight leading-tight text-center">
        {label}
      </span>
    </span>
  </button>
);

interface ShareInviteSheetProps {
  isOpen: boolean;
  onClose: () => void;
  lobbyCode: string;
  gameMode: GameMode | null;
  onCopyCode: () => void;
  onCopyLink: () => void;
  onShare: () => void;
}

/**
 * Bottom sheet d'invitation : code du salon + copie rapide, puis copie du lien
 * et partage OS. Branchée sur les actions granulaires de useShareInvite.
 */
const ShareInviteSheet = ({
  isOpen,
  onClose,
  lobbyCode,
  gameMode,
  onCopyCode,
  onCopyLink,
  onShare,
}: ShareInviteSheetProps) => {
  const { t } = useLocale();

  // QR : seulement en mode local (joueurs autour de la table scannent l'écran
  // de l'hôte). Encode le lien d'invitation /join/<code> (App/Universal Links).
  const showQr = gameMode === 'local' && !!lobbyCode;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={t.lobby.shareInvite.sheetTitle}>
      <div className="flex flex-col gap-4">
        {showQr && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-gray-500 italic text-center m-0">
              {t.lobby.shareInvite.scanHint}
            </p>
            <div className="bg-white border-[2.5px] border-black rounded-xl p-3 stack-shadow-sm">
              <QRCodeSVG
                value={buildInviteUrl(lobbyCode)}
                size={160}
                level="M"
                aria-label={t.lobby.shareInvite.qrLabel}
              />
            </div>
          </div>
        )}

        {/* Bloc code + copie rapide */}
        <div>
          <span className="block text-display-xs text-gray-500 mb-1.5">
            {t.lobby.shareInvite.codeLabel}
          </span>
          <LobbyCodeDisplay
            value={lobbyCode}
            onClick={onCopyCode}
            ariaLabel={t.lobby.shareInvite.codeLabel}
            className="w-full"
            trailing={<LuCopy size={18} strokeWidth={2.2} className="ml-1 text-gray-500" />}
          />
        </div>

        {/* Section liens : bulles compactes (icône au-dessus du label), une
            couleur par action pour les distinguer. */}
        <div className="flex flex-row items-stretch justify-center gap-12 pt-1">
          <ActionBubble
            icon={<LuLink size={24} strokeWidth={2.5} />}
            label={t.lobby.shareInvite.copyLink}
            bg="bg-brand-500"
            onClick={onCopyLink}
          />
          <ActionBubble
            icon={<LuShare2 size={24} strokeWidth={2.5} />}
            label={t.lobby.shareInvite.share}
            bg="bg-warning-500"
            onClick={onShare}
          />
        </div>
      </div>
    </BottomSheet>
  );
};

export default ShareInviteSheet;
