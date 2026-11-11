import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { LuCheck, LuGrab, LuPointer, LuTimer } from 'react-icons/lu';
import { GAME_CONSTANTS } from '@onskone/shared';
import type { GameMode, GameSpeed, IPlayer } from '@onskone/shared';
import Avatar from '../Avatar';
import Checkbox from '../Checkbox';
import GameSpeedSlider from '../GameSpeedSlider';
import HelpBubble from '../HelpBubble';
import HostOnlyHint from '../HostOnlyHint';
import PremiumName from '../PremiumName';
import { useScrollMask } from '../../hooks/useScrollMask';
import SeatCircle from './SeatCircle';
import { useToast } from '../Toast';
import type { Dictionary } from '../../i18n/dictionary';

interface PrepareGameProps {
  isHost: boolean;
  hostName: string;
  gameMode: GameMode | null;
  /** Joueurs dans l'ordre des places (sens du jeu). */
  players: IPlayer[];
  currentPlayerId?: string;
  excludedLeaderIds: string[];
  onExcludedLeadersChange: (next: string[]) => void;
  onReorderSeats: (seatIds: string[]) => void;
  guessMyAnswerMode: boolean;
  onGuessMyAnswerModeChange: (next: boolean) => void;
  gameSpeed: GameSpeed;
  onGameSpeedChange: (next: GameSpeed) => void;
  roundCount: number;
  estimatedMinutes: number;
  t: Dictionary;
}

/**
 * Écran « Préparer la partie », entre « Démarrer » et le lancement : toute la
 * table le suit en direct (les non-hôtes en lecture seule).
 * - Manches en tête, qui flottent au-dessus du contenu qui défile (1 manche par pilier).
 * - Sur place : « Qui est assis où ? », le cercle des places (ordre du reveal) et
 *   les piliers à (dés)activer. À distance : la liste des piliers à cocher.
 * - Options : durée des manches et mode « Devine ma réponse ».
 * Le bouton de lancement reste dans la rangée d'actions du salon.
 */
const PrepareGame = ({
  isHost,
  hostName,
  gameMode,
  players,
  currentPlayerId,
  excludedLeaderIds,
  onExcludedLeadersChange,
  onReorderSeats,
  guessMyAnswerMode,
  onGuessMyAnswerModeChange,
  gameSpeed,
  onGameSpeedChange,
  roundCount,
  estimatedMinutes,
  t,
}: PrepareGameProps) => {
  const showToast = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollMask(scrollRef);
  const roundsRef = useRef<HTMLDivElement>(null);
  const roundsSpacerRef = useRef<HTMLDivElement>(null);
  // Du contenu passe sous le bloc des manches (on a défilé) : il change d'ombre.
  const [roundsOverContent, setRoundsOverContent] = useState(false);

  // Le bloc des manches flotte au-dessus du scroll (position absolue) : une cale de sa
  // hauteur en tête du scroll garde le contenu dessous au repos. Écriture DOM seule
  // (cf. useScrollMask), resynchronisée si le bloc change de taille (texte qui passe à la ligne).
  useLayoutEffect(() => {
    const block = roundsRef.current;
    const spacer = roundsSpacerRef.current;
    if (!block || !spacer) return;
    const sync = () => { spacer.style.height = `${block.offsetHeight}px`; };
    sync();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
    ro?.observe(block);
    return () => ro?.disconnect();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // ~6 px : le haut de la 1re carte entre dans l'ombre empilée du bloc.
    const onScroll = () => setRoundsOverContent(el.scrollTop > 6);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);
  // Secousse du rappel « seul l'hôte » quand un non-hôte touche une option (cf. sélecteur de thèmes).
  const [hintShake, setHintShake] = useState(0);
  const triggerHintShake = () => setHintShake(n => n + 1);

  const excluded = new Set(excludedLeaderIds);
  const toggleLeader = (playerId: string) => {
    onExcludedLeadersChange(
      excluded.has(playerId)
        ? excludedLeaderIds.filter(id => id !== playerId)
        : [...excludedLeaderIds, playerId],
    );
  };
  const onLastLeader = () => showToast(t.lobby.prepare.lastLeader, 'warning', 3000);
  const shortHost = hostName.length > 10 ? `${hostName.slice(0, 10)}…` : hostName;

  return (
    <div className="min-h-0 flex flex-col gap-2.5 md:gap-3">
      <h2 className="!my-0 text-center text-display-lg text-white text-outline [filter:drop-shadow(0_3px_0_black)] animate-phase-enter">
        {t.lobby.prepare.title}
      </h2>

      <div className="relative min-h-0 flex flex-col">
        {/* Manches : flottent au-dessus de la zone qui défile, toujours visibles pendant qu'on
            règle la table ; le contenu passe dessous. */}
        <div ref={roundsRef} className="absolute inset-x-0 top-0 z-20">
          {/* Ombre « décollée », seulement quand du contenu passe dessous. Elle reste au sol
              (hors du flottement) : l'écart avec la carte respire à chaque montée. Proche et
              légèrement floue, pour la distinguer de la pile franche du repos. */}
          <span
            aria-hidden
            className={`absolute inset-0 rounded-2xl bg-black/30 blur-[3px] translate-x-[4px] translate-y-[8px] -rotate-[1.2deg] pointer-events-none transition-opacity duration-300 ${
              roundsOverContent ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {/* Penché via --rot (float-gentle le garde pendant le flottement), même angle que l'ombre au sol. */}
          <div className="animate-float [--rot:-1.2deg]">
            {/* Au repos : la pile (stack-shadow). Au-dessus du contenu : la carte quitte sa
                pile, il ne reste que sa tranche noire, l'ombre au sol prend le relais. */}
            <div
              className={`flex items-center gap-3.5 px-4 py-2.5 bg-white card-paper rounded-2xl transition-shadow duration-300 animate-card-deal-in ${
                roundsOverContent ? '[box-shadow:3px_3px_0_0_black]' : 'stack-shadow'
              }`}
              aria-live="polite"
            >
              <span key={roundCount} className="font-display font-bold text-[44px] leading-none tabular-nums text-black animate-snap-bounce">
                {roundCount}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-display font-bold text-xl leading-none text-black">{t.lobby.prepare.roundsWord(roundCount)}</span>
                <span className="font-sans text-xs text-gray-600 leading-snug">
                  {t.lobby.prepare.roundsHint}
                  {players.length > GAME_CONSTANTS.DEFAULT_MAX_ROUNDS && isHost && (
                    <>
                      <br />
                      {t.lobby.prepare.roundsCapHint(GAME_CONSTANTS.DEFAULT_MAX_ROUNDS)}
                    </>
                  )}
                </span>
              </span>
              <span key={`m${estimatedMinutes}`} className="ml-auto self-start inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/[0.05] font-display text-[13px] font-bold tabular-nums whitespace-nowrap animate-snap-bounce-strong">
                <LuTimer size={14} strokeWidth={2.5} aria-hidden className="shrink-0" />
                {t.lobby.gameSpeed.estimate(estimatedMinutes)}
              </span>
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="scroll-mask min-h-0 overflow-y-auto overscroll-contain no-scrollbar">
          {/* Cale de la hauteur du bloc des manches (réglée en JS) : au repos, rien dessous. */}
          <div ref={roundsSpacerRef} aria-hidden />
          {/* pt = l'ancien écart bloc ↔ scroll (gap-2.5/3 + pt-1). */}
          <div className="flex flex-col gap-4 pt-3.5 md:pt-4 pb-3 pl-0.5 pr-2">
            {/* Places / piliers */}
            <section className="flex flex-col gap-3 p-3.5 bg-white card-paper rounded-2xl stack-shadow animate-card-deal-in">
              {gameMode === 'local' ? (
                <>
                  <h3 className="!my-0 text-display-md text-black">
                    <span className="marker-highlight" style={{ '--marker-color': 'var(--color-brand-200)' } as CSSProperties}>
                      {t.lobby.prepare.seatsTitle}
                    </span>
                  </h3>
                  {/* !mb-1 : un peu d'air en plus du gap avant les consignes / le cercle. */}
                  <p className="!mt-0 !mb-1 font-sans text-xs text-gray-600 leading-snug">
                    {isHost ? t.lobby.prepare.seatsHintHost : t.lobby.prepare.seatsHintGuest(shortHost)}
                    {!isHost && <span className="block mt-1.5">{t.lobby.prepare.seatsGuestCheck}</span>}
                  </p>
                  {/* Les gestes à part, une ligne chacun avec son icône (verbe en gras) : le
                      « pourquoi » au-dessus se lit une fois, le « comment » est ce que l'hôte
                      revient chercher des yeux. Pas de fond : en pastille, ça passait pour des boutons. */}
                  {isHost && (
                    <ul className="!my-0 !pl-0 list-none flex flex-col items-center gap-1 font-sans text-xs text-gray-700 leading-snug">
                      <li className="flex items-center gap-1.5">
                        <LuGrab size={14} strokeWidth={2.5} aria-hidden className="shrink-0" />
                        <span>{t.lobby.prepare.seatsGestures.drag}</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <LuPointer size={14} strokeWidth={2.5} aria-hidden className="shrink-0" />
                        <span>{t.lobby.prepare.seatsGestures.tap}</span>
                      </li>
                    </ul>
                  )}
                  <SeatCircle
                    players={players}
                    currentPlayerId={currentPlayerId}
                    excludedLeaderIds={excludedLeaderIds}
                    editable={isHost}
                    onReorder={onReorderSeats}
                    onToggleLeader={toggleLeader}
                    onLastLeader={onLastLeader}
                    t={t}
                  />
                </>
              ) : (
                <>
                  <h3 className="!my-0 flex items-baseline gap-2 flex-wrap text-display-md text-black">
                    <span className="marker-highlight">{t.lobby.prepare.leadersTitle}</span>
                    <span className="font-display text-xs font-bold text-black/55">{t.lobby.prepare.playersCount(players.length)}</span>
                  </h3>
                  <p className="!my-0 font-sans text-xs text-gray-600 leading-snug">{t.lobby.prepare.leadersHint}</p>
                  <LeaderList
                    players={players}
                    currentPlayerId={currentPlayerId}
                    excluded={excluded}
                    roundCount={roundCount}
                    isHost={isHost}
                    onToggle={toggleLeader}
                    onBlocked={triggerHintShake}
                    t={t}
                  />
                </>
              )}
            </section>

            {/* Options de la partie */}
            <section className="flex flex-col gap-4 p-3.5 bg-white card-paper rounded-2xl stack-shadow animate-card-deal-in [animation-delay:100ms]">
              {!isHost && (
                <HostOnlyHint text={t.lobby.prepare.hostOnly(shortHost)} shakeKey={hintShake} className="px-1 text-gray-600" />
              )}
              <GameSpeedSlider
                value={gameSpeed}
                onChange={onGameSpeedChange}
                disabled={!isHost}
                onBlockedInteract={triggerHintShake}
                t={t}
              />
              <span aria-hidden className="border-t-[1.5px] border-dashed border-black/15" />
              {/* Case désactivée côté non-hôte (pointer-events coupés) : le tap tombe sur le
                  wrapper, qui secoue le rappel. */}
              <div className="px-1" onClick={isHost ? undefined : triggerHintShake}>
                <Checkbox
                  checked={guessMyAnswerMode}
                  onChange={onGuessMyAnswerModeChange}
                  disabled={!isHost}
                  label={t.lobby.guessMyAnswer.label}
                  description={t.lobby.guessMyAnswer.description}
                  boxSide="right"
                  trailing={<HelpBubble>{t.lobby.guessMyAnswer.help}</HelpBubble>}
                />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

/** À distance : la liste des joueurs, cochés = piliers (décocher = exclure du rôle). */
const LeaderList = ({ players, currentPlayerId, excluded, roundCount, isHost, onToggle, onBlocked, t }: {
  players: IPlayer[];
  currentPlayerId?: string;
  excluded: Set<string>;
  roundCount: number;
  isHost: boolean;
  onToggle: (playerId: string) => void;
  onBlocked: () => void;
  t: Dictionary;
}) => (
  <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
    {players.map((player, i) => {
      const isLeader = !excluded.has(player.id);
      // Dernier pilier possible parmi les actifs : le décocher ne laisserait aucune manche.
      const isLastLeader = isLeader && player.isActive && roundCount <= 1;
      const locked = !isHost || isLastLeader;
      return (
        <li key={player.id} className="animate-player-pop" style={{ animationDelay: `${Math.min(i, 4) * 40}ms` }}>
          <button
            type="button"
            role="checkbox"
            aria-checked={isLeader}
            aria-disabled={locked}
            // aria-disabled (et pas disabled) : le tap doit arriver jusqu'ici pour
            // secouer le rappel côté non-hôte. Le dernier pilier reste juste bloqué.
            onClick={() => {
              if (!isHost) return onBlocked();
              if (!isLastLeader) onToggle(player.id);
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
                <span className="shrink-0 text-xs text-black/45">{t.lobby.prepare.you}</span>
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
);

export default PrepareGame;
