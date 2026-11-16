import type { ReactNode } from 'react';
import type { SimilarityComparison } from '@onskone/shared';
import Button from './Button';
import { useLocale } from '../i18n';
import { getDisplayText } from '../utils/answerHelpers';

/**
 * Popup d'arbitrage d'une similarité (pilier). La carte posée devant le joueur
 * désigné vient d'être révélée fausse, mais elle ressemble à ce qu'il a vraiment
 * écrit, que le pilier a posé devant un autre joueur : la popup cite CE téléphone
 * (celui que la table peut regarder) et affiche toujours le texte à comparer, que
 * le pilier ne voit pas forcément (sa propre carte, partie à distance, téléphone à
 * l'autre bout de la table).
 */
const SimilarityPopover = ({
  comparison,
  leaderId,
  remote,
  cardAnswer,
  isLeader,
  arrow = true,
  onConfirm,
  onDismiss,
}: {
  /** Ce à quoi la carte jugée se compare (cf. getSimilarityComparison). */
  comparison: SimilarityComparison | null;
  leaderId: string;
  /** Partie à distance : pas de téléphones sur la table, on parle de « la carte donnée à ». */
  remote: boolean;
  /** Texte de la carte jugée, quand l'écran du pilier ne l'affiche pas déjà. */
  cardAnswer?: string;
  isLeader: boolean;
  /** Flèche vers la carte au-dessus (false quand la popup prend la place du bouton du pilier). */
  arrow?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) => {
  const { t } = useLocale();
  const s = t.phases.similarity;

  const holder = (name: string) => <span className="text-brand-500">{name}</span>;
  let prompt: ReactNode;
  if (!comparison) {
    prompt = s.fallback;
  } else if (!comparison.holderId) {
    prompt = s.unassigned;
  } else if (comparison.holderId === leaderId) {
    prompt = s.leaderSelf;
  } else if (remote) {
    prompt = <>{s.remotePrefix}{holder(comparison.holderName)}{s.remoteSuffix}</>;
  } else {
    prompt = <>{s.screenPrefix(comparison.holderName)}{holder(comparison.holderName)}{s.screenSuffix}</>;
  }

  const quote = (text: string) => (
    // Court : la popup flotte sous la carte du pilier ; en paysage serré, Oui/Non ne
    // doivent jamais sortir de l'écran (la table attendrait le filet REVEAL).
    <p className="font-display font-bold text-sm md:text-base short-landscape:text-xs text-black text-center break-words line-clamp-2 short-landscape:line-clamp-1 my-1 short-landscape:my-0.5">
      {s.quote(getDisplayText(text))}
    </p>
  );

  return (
    <div className="flex justify-center mt-1.5 md:mt-2 animate-popover-bounce">
      <div className="relative bg-white rounded-lg border-2 md:border-[3px] border-black shadow-[0_4px_12px_rgba(0,0,0,0.15)] px-3 py-2 md:py-2.5 short-landscape:py-1.5 w-64 md:w-72 short-landscape:w-80">
        {arrow && (
          <>
            {/* Flèche vers le haut */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-black" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-[-5px] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-white" />
          </>
        )}

        {cardAnswer && quote(cardAnswer)}
        <p className="text-xs md:text-sm short-landscape:text-[11px] text-gray-800 text-center font-semibold">{prompt}</p>
        {comparison && quote(comparison.comparedAnswer)}

        {isLeader ? (
          <div className="flex justify-center gap-2 mt-1.5">
            <Button
              text={s.yes}
              variant="success"
              size="sm"
              onClick={onConfirm}
            />
            <Button
              text={s.no}
              variant="quit"
              size="sm"
              onClick={onDismiss}
            />
          </div>
        ) : (
          <p className="text-xs md:text-sm text-gray-600 text-center italic">
            {s.waitingLeader}
          </p>
        )}
      </div>
    </div>
  );
};

export default SimilarityPopover;
