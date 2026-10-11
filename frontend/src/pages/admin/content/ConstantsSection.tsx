import { useState } from 'react';
import { LuMinus, LuPlus } from 'react-icons/lu';
import { GAME_CONSTANTS } from '@onskone/shared';
import { RoundPhase } from '@onskone/shared';
import type { GameSpeed } from '@onskone/shared';
import { getPhaseDuration, estimateGameMinutes, maxGameMinutes } from '../../../constants/game';
import { SectionHeader } from './SectionHeader';
import { PHASE_LABELS_FR } from './shared';

// Vitesses proposées dans le lobby + libellés admin.
const SPEED_LABELS: Partial<Record<GameSpeed, string>> = { fast: 'Rapide', normal: 'Normal' };
// Phases à timer, dans l'ordre de la table de durées (sans le bonus par joueur).
const TIMED_PHASES = Object.keys(GAME_CONSTANTS.TIMERS.normal)
  .filter((k) => k !== 'GUESSING_EXTRA_PER_PLAYER') as RoundPhase[];

// Boutons − / + du simulateur de joueurs (36px, palette sombre de l'admin).
const STEP_BUTTON = 'shrink-0 w-9 h-9 flex items-center justify-center rounded-md border border-white/15 bg-white/[0.06] text-white/80 cursor-pointer transition-colors hover:bg-white/[0.12] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed';

// Vitesse mise en avant sur les cartes de phase ; les autres s'affichent dessous.
const MAIN_SPEED = GAME_CONSTANTS.GAME_SPEED_DEFAULT;
const OTHER_SPEEDS = GAME_CONSTANTS.GAME_SPEEDS.filter((sp) => sp !== MAIN_SPEED);

export const ConstantsSection = () => {
  // Simulation : nombre de joueurs + mode. Toutes les vitesses sont affichées côte à côte.
  const [guessPlayers, setGuessPlayers] = useState(3);
  const [guessMyAnswerMode, setGuessMyAnswerMode] = useState(false);
  // Même calcul que le lobby (constants/game.ts) : durée totale estimée + plafond
  // si tous les timers vont au bout. Simulateur : 1 manche par joueur (aucun exclu).
  const estimates = GAME_CONSTANTS.GAME_SPEEDS.map((sp) => ({
    speed: sp,
    total: estimateGameMinutes(guessPlayers, guessPlayers, sp, guessMyAnswerMode),
    max: maxGameMinutes(guessPlayers, guessPlayers, sp, guessMyAnswerMode),
  }));
  const toMinSec = (s: number): string | null => {
    if (s < 60) return null;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r === 0 ? `${m} min` : `${m} min ${r} s`;
  };
  return (
    <div>
      <SectionHeader title="Réglages de jeu" />
      <p className="text-[13px] text-white/55 mb-4 max-w-2xl">
        Les durées de chaque phase et les limites appliquées aux parties.
      </p>

      <div className="space-y-4">
        <div>
          <p className="text-[12px] uppercase tracking-[0.18em] text-white/40 mb-2 font-semibold">
            Durée de chaque phase
          </p>

          {/* Simulateur : le nombre de joueurs et le mode recalculent toutes les
              durées affichées en direct (mêmes constantes que le lobby). */}
          <div className="rounded-lg surface-glass p-3 mb-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <span className="text-[12px] uppercase tracking-[0.18em] text-white/40 font-semibold">
                Estimation d'une partie
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setGuessMyAnswerMode((v) => !v)}
                  aria-pressed={guessMyAnswerMode}
                  className={`px-2.5 py-1 rounded-md border font-mono text-[11px] tracking-wider transition-colors ${guessMyAnswerMode
                    ? 'bg-white/[0.08] border-white/15 text-white'
                    : 'bg-transparent border-white/[0.06] text-white/45 hover:text-white/85 hover:border-white/15'
                    }`}
                  title="Mode Devine ma réponse (ajoute les phases pilier)"
                >
                  Devine ma réponse
                </button>
                <span className="flex flex-col items-end gap-0.5">
                  {estimates.map(({ speed, total, max }) => (
                    <span key={speed} className="flex items-baseline gap-2">
                      <span className="text-[11px] uppercase tracking-[0.14em] text-white/40 font-semibold">
                        {SPEED_LABELS[speed] ?? speed}
                      </span>
                      <span className="text-[18px] font-semibold tabular-nums text-white">~{total} min</span>
                      <span
                        className="text-[12px] tabular-nums text-white/40"
                        title="Tous les timers vont au bout (révélation comptée 20 s, elle n'a pas de timer)"
                      >
                        max {max} min
                      </span>
                    </span>
                  ))}
                </span>
              </div>
            </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] uppercase tracking-[0.14em] text-white/40 font-semibold">
                Joueurs
              </span>
              <span className="text-[13px] font-semibold tabular-nums text-white/80">
                {guessPlayers} joueur{guessPlayers > 1 ? 's' : ''}
              </span>
            </div>
            {/* − / + pour régler joueur par joueur sans glisser ; le slider garde les flèches clavier. */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setGuessPlayers((n) => Math.max(GAME_CONSTANTS.MIN_PLAYERS, n - 1))}
                disabled={guessPlayers <= GAME_CONSTANTS.MIN_PLAYERS}
                aria-label="Un joueur de moins"
                className={STEP_BUTTON}
              >
                <LuMinus aria-hidden size={16} strokeWidth={2.5} />
              </button>
              <input
                type="range"
                min={GAME_CONSTANTS.MIN_PLAYERS}
                max={GAME_CONSTANTS.MAX_PLAYERS}
                step={1}
                value={guessPlayers}
                onChange={(e) => setGuessPlayers(Number(e.target.value))}
                aria-label="Simuler le nombre de joueurs"
                aria-valuetext={`${guessPlayers} joueurs`}
                className="admin-mini-slider flex-1 min-w-0"
                style={{ '--fill': `${((guessPlayers - GAME_CONSTANTS.MIN_PLAYERS) / (GAME_CONSTANTS.MAX_PLAYERS - GAME_CONSTANTS.MIN_PLAYERS)) * 100}%` } as React.CSSProperties}
              />
              <button
                type="button"
                onClick={() => setGuessPlayers((n) => Math.min(GAME_CONSTANTS.MAX_PLAYERS, n + 1))}
                disabled={guessPlayers >= GAME_CONSTANTS.MAX_PLAYERS}
                aria-label="Un joueur de plus"
                className={STEP_BUTTON}
              >
                <LuPlus aria-hidden size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
          </div>

          {/* Durée max (timer) de chaque phase. Les phases substitut ne sont
              affichées qu'en mode "Devine ma réponse", comme dans le total. */}
          <p className="text-[11px] text-white/35 mb-2">
            Durée max par phase (timer) en Normal, le Rapide en dessous. Le total ci-dessus est l'estimation ressentie côté lobby, plus courte (les joueurs répondent avant la fin).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {TIMED_PHASES
              .filter((phase) => guessMyAnswerMode || !phase.startsWith('SUBSTITUTE_'))
              .map((phase) => {
              const seconds = getPhaseDuration(phase, MAIN_SPEED, guessPlayers);
              return (
                <div
                  key={phase}
                  className="rounded-lg surface-glass p-3"
                >
                  <p className="text-[12px] text-white/55">
                    {PHASE_LABELS_FR[phase] ?? phase}
                  </p>
                  <p className="mt-1 text-[20px] font-semibold tabular-nums text-white">
                    {seconds} secondes
                    {toMinSec(seconds) && (
                      <span className="ml-2 text-[13px] font-normal text-white/40">
                        ({toMinSec(seconds)})
                      </span>
                    )}
                  </p>
                  {OTHER_SPEEDS.map((sp) => {
                    const other = getPhaseDuration(phase, sp, guessPlayers);
                    return (
                      <p key={sp} className="mt-0.5 text-[12px] tabular-nums text-white/45">
                        {SPEED_LABELS[sp] ?? sp} : {other} s
                        {toMinSec(other) && ` (${toMinSec(other)})`}
                      </p>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-[12px] uppercase tracking-[0.18em] text-white/40 mb-2 font-semibold">
            Limites
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {[
              { label: 'Nombre de joueurs', value: `${GAME_CONSTANTS.MIN_PLAYERS} à ${GAME_CONSTANTS.MAX_PLAYERS}` },
              { label: 'Longueur du pseudo', value: `${GAME_CONSTANTS.MIN_NAME_LENGTH} à ${GAME_CONSTANTS.MAX_NAME_LENGTH} caractères` },
              { label: 'Longueur d\'une réponse', value: `${GAME_CONSTANTS.MAX_ANSWER_LENGTH} caractères max` },
              { label: 'Avatars disponibles', value: `${GAME_CONSTANTS.AVATAR_COUNT}` },
              { label: 'Longueur du code de salon', value: `${GAME_CONSTANTS.LOBBY_CODE_LENGTH} caractères` },
            ].map((row) => (
              <div
                key={row.label}
                className="rounded-lg surface-glass p-3"
              >
                <p className="text-[12px] text-white/55">
                  {row.label}
                </p>
                <p className="mt-1 text-[16px] font-semibold tabular-nums text-white">
                  {row.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
