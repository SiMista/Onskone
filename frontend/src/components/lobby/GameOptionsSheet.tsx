import { useRef, useState } from 'react';
import { LuCheck, LuTimer } from 'react-icons/lu';
import type { GameSpeed, IPlayer } from '@onskone/shared';
import BottomSheet from '../BottomSheet';
import GameSpeedSlider from '../GameSpeedSlider';
import Checkbox from '../Checkbox';
import Avatar from '../Avatar';
import PremiumName from '../PremiumName';
import ScrollFade from '../ScrollFade';
import HostOnlyHint from '../HostOnlyHint';
import type { Dictionary } from '../../i18n/dictionary';

interface GameOptionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  isHost: boolean;
  hostName: string;
  guessMyAnswerMode: boolean;
  onGuessMyAnswerModeChange: (next: boolean) => void;
  gameSpeed: GameSpeed;
  onGameSpeedChange: (next: GameSpeed) => void;
  players: IPlayer[];
  currentPlayerId: string | undefined;
  excludedLeaderIds: string[];
  onExcludedLeadersChange: (next: string[]) => void;
  /** Piliers possibles parmi les joueurs actifs = nombre de manches. */
  roundCount: number;
  /** Durée estimée de la partie (rythme × manches × mode), affichée en récap sous les réglages. */
  estimatedMinutes: number;
  t: Dictionary;
}

/**
 * Bottom sheet "Options de jeu" : mode "Devine ma réponse", rythme (Rapide / Normal)
 * et piliers. Les
 * piliers sont une liste à décocher (exclusion) : tout le monde est pilier par
 * défaut, y compris les joueurs qui arrivent, et le nombre de manches en découle.
 * On ne peut pas décocher le dernier pilier possible (il faut au moins 1 manche).
 * Lecture seule pour les non-hôtes. Les changements partent en direct : on
 * referme avec la croix, le fond ou Échap.
 */
const GameOptionsSheet = ({
  isOpen,
  onClose,
  isHost,
  hostName,
  guessMyAnswerMode,
  onGuessMyAnswerModeChange,
  gameSpeed,
  onGameSpeedChange,
  players,
  currentPlayerId,
  excludedLeaderIds,
  onExcludedLeadersChange,
  roundCount,
  estimatedMinutes,
  t,
}: GameOptionsSheetProps) => {
  const listRef = useRef<HTMLUListElement>(null);
  const excluded = new Set(excludedLeaderIds);
  // Secousse du rappel "seul l'hôte" quand un non-hôte touche un réglage (même
  // geste que le sélecteur de thèmes). Compteur : relance l'anim à chaque tap.
  const [hintShake, setHintShake] = useState(0);
  const triggerHintShake = () => setHintShake(n => n + 1);

  const toggleLeader = (playerId: string) => {
    onExcludedLeadersChange(
      excluded.has(playerId)
        ? excludedLeaderIds.filter((id) => id !== playerId)
        : [...excludedLeaderIds, playerId],
    );
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={t.lobby.options.title}>
      {/* Pas de trait entre les sections : le pointillé sous le titre du sheet suffit,
          les titres de section et l'espacement font la séparation. */}
      <div className="flex flex-col gap-5">
        {/* Durée estimée : résultat de la durée des manches ET du nombre de piliers (= manches),
            donc en récap global en tête du sheet plutôt qu'accolée au slider. Info, pas un
            contrôle : jamais grisée. Fond discret plutôt qu'un trait de plus. */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-black/[0.04]">
            <span className="inline-flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-tight text-black/60">
              <LuTimer size={14} strokeWidth={2.5} aria-hidden className="shrink-0" />
              {t.lobby.options.estimateLabel}
            </span>
            <span className="font-display text-sm font-bold tabular-nums text-black" aria-live="polite">
              {t.lobby.gameSpeed.estimate(estimatedMinutes)}
            </span>
          </div>
          <p className="m-0 px-3 font-sans text-[11px] text-gray-600 leading-snug">
            {t.lobby.options.estimateHint}
          </p>
        </div>

        {!isHost && (
          <HostOnlyHint text={t.lobby.options.hostOnly(hostName)} shakeKey={hintShake} className="px-1 text-gray-600" />
        )}

        {/* Mode "Devine ma réponse" (décoché = Classique) : en tête, c'est l'option qui
            change le plus la partie. Case désactivée côté non-hôte (pointer-events
            coupés) : le tap tombe sur le wrapper, qui secoue le rappel. */}
        <div className="px-1" onClick={isHost ? undefined : triggerHintShake}>
          <Checkbox
            checked={guessMyAnswerMode}
            onChange={onGuessMyAnswerModeChange}
            disabled={!isHost}
            label={t.lobby.guessMyAnswer.label}
            description={t.lobby.guessMyAnswer.description}
            boxSide="right"
          />
        </div>

        {/* Durée des manches (vitesse de jeu) : slider à crans. */}
        <GameSpeedSlider
          value={gameSpeed}
          onChange={onGameSpeedChange}
          disabled={!isHost}
          onBlockedInteract={triggerHintShake}
          t={t}
        />

        {/* Piliers : décocher = exclure du rôle de pilier. */}
        <section className="flex flex-col gap-1.5">
          {/* Titre + consigne collés : la consigne explique le titre, elle ne doit pas flotter.
              Non-hôte : grisé comme le slider (dont le titre est grisé avec lui) et les lignes.
              Pas sur toute la section : les lignes ont déjà leur opacity, elle se cumulerait. */}
          <div className={`flex flex-col gap-0.5 px-1 transition-opacity ${!isHost ? 'opacity-70' : ''}`}>
            {/* Nombre de manches collé au titre (pas poussé à droite) : il se lit avec lui. */}
            <div className="flex items-baseline gap-2">
              <h3 className="m-0 font-display text-base font-bold uppercase tracking-tight text-black leading-tight">
                {t.lobby.options.leaders}
              </h3>
              <span className="font-display text-xs font-bold tabular-nums text-black/60" aria-live="polite">
                {t.lobby.options.rounds(roundCount)}
              </span>
            </div>
            <p className="m-0 font-sans text-xs text-gray-600 leading-snug">
              {t.lobby.options.leadersHint}
            </p>
          </div>
          <div className="relative">
            <ul
              ref={listRef}
              className="list-none m-0 p-0 pt-1 pb-2 flex flex-col gap-1.5 max-h-[34dvh] overflow-y-auto overscroll-contain no-scrollbar"
            >
              {players.map((player) => {
                const isLeader = !excluded.has(player.id);
                // Dernier pilier possible parmi les actifs : le décocher ne laisserait aucune manche.
                const isLastLeader = isLeader && player.isActive && roundCount <= 1;
                const locked = !isHost || isLastLeader;
                return (
                  <li key={player.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isLeader}
                      aria-disabled={locked}
                      // aria-disabled (et pas disabled) : le tap doit arriver jusqu'ici pour
                      // secouer le rappel côté non-hôte. Le dernier pilier reste juste bloqué.
                      onClick={() => {
                        if (!isHost) return triggerHintShake();
                        if (!isLastLeader) toggleLeader(player.id);
                      }}
                      className={`w-full min-h-12 flex items-center gap-3 px-2.5 py-1.5 rounded-xl border-2 text-left transition-all duration-200 ${
                        isLeader ? 'bg-cream-player border-black/80' : 'bg-white border-black/15'
                      } ${locked ? 'cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'} ${!isHost ? 'opacity-70' : ''}`}
                    >
                      <Avatar
                        avatarId={player.avatarId}
                        name={player.name}
                        size="sm"
                        premium={player.isPremium}
                        className={`shrink-0 transition-[filter,opacity] duration-200 ${isLeader && player.isActive ? '' : 'opacity-50 grayscale'}`}
                      />
                      <span className="flex-1 min-w-0 flex items-baseline gap-1.5">
                        <PremiumName
                          name={player.name}
                          premium={player.isPremium}
                          className={`text-sm truncate ${isLeader ? 'font-semibold text-black' : 'text-black/45'}`}
                        />
                        {player.id === currentPlayerId && (
                          <span className="shrink-0 text-xs text-black/45">{t.lobby.options.you}</span>
                        )}
                        {!player.isActive && (
                          <span className="shrink-0 text-xs italic text-black/45">{t.common.disconnectedSuffix.trim()}</span>
                        )}
                      </span>
                      {/* Case à cocher : même rendu que <Checkbox> (carton crème / jaune coché). */}
                      <span
                        aria-hidden
                        className={`relative shrink-0 w-7 h-7 rounded-md card-paper stack-shadow-sm transition-colors duration-200 ${
                          isLeader ? 'bg-warning-500' : 'bg-cream-checkbox'
                        }`}
                      >
                        <LuCheck
                          size={20}
                          strokeWidth={3.5}
                          className={`absolute inset-0 m-auto text-black transition-all duration-200 ${
                            isLeader ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                          }`}
                        />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <ScrollFade scrollRef={listRef} />
          </div>
        </section>
      </div>
    </BottomSheet>
  );
};

export default GameOptionsSheet;
