import { useState } from 'react';
import { GAME_CONSTANTS } from '@onskone/shared';
import { RoundPhase } from '@onskone/shared';
import { getPhaseDuration, estimateGameMinutes } from '../../../constants/game';
import { SectionHeader } from './SectionHeader';
import { PHASE_LABELS_FR } from './shared';

// Niveaux de vitesse partagés (multiplicateur de temps) + libellés admin.
const SPEED_LABELS = ['Rapide', 'Normal', 'Tranquille'];

export const ConstantsSection = () => {
  const timers = GAME_CONSTANTS.TIMERS;
  // Simulation : vitesse (index du niveau de multiplicateur) + nombre de joueurs.
  const [speedIdx, setSpeedIdx] = useState(
    GAME_CONSTANTS.TIME_MULTIPLIER_LEVELS.indexOf(GAME_CONSTANTS.TIME_MULTIPLIER_DEFAULT),
  );
  const [guessPlayers, setGuessPlayers] = useState(3);
  const [guessMyAnswerMode, setGuessMyAnswerMode] = useState(false);
  const multiplier = GAME_CONSTANTS.TIME_MULTIPLIER_LEVELS[speedIdx];
  // Même calcul que le lobby (constants/game.ts) : durée totale estimée.
  const totalMinutes = estimateGameMinutes(guessPlayers, multiplier, guessMyAnswerMode);
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

          {/* Simulateur : la vitesse et le nombre de joueurs recalculent toutes les
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
                <span className="text-[20px] font-semibold tabular-nums text-white">~{totalMinutes} min</span>
              </div>
            </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] uppercase tracking-[0.14em] text-white/40 font-semibold">
                  Vitesse
                </span>
                <span className="text-[11px] tabular-nums text-white/60">
                  {SPEED_LABELS[speedIdx]} (×{multiplier})
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={GAME_CONSTANTS.TIME_MULTIPLIER_LEVELS.length - 1}
                step={1}
                value={speedIdx}
                onChange={(e) => setSpeedIdx(Number(e.target.value))}
                aria-label="Simuler la vitesse"
                className="admin-mini-slider w-full cursor-pointer"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] uppercase tracking-[0.14em] text-white/40 font-semibold">
                  Joueurs
                </span>
                <span className="text-[11px] tabular-nums text-white/60">
                  {guessPlayers} joueur{guessPlayers > 1 ? 's' : ''}
                </span>
              </div>
              <input
                type="range"
                min={GAME_CONSTANTS.MIN_PLAYERS}
                max={GAME_CONSTANTS.MAX_PLAYERS}
                step={1}
                value={guessPlayers}
                onChange={(e) => setGuessPlayers(Number(e.target.value))}
                aria-label="Simuler le nombre de joueurs"
                className="admin-mini-slider w-full cursor-pointer"
              />
            </div>
          </div>
          </div>

          {/* Durée max (timer) de chaque phase. Les phases substitut ne sont
              affichées qu'en mode "Devine ma réponse", comme dans le total. */}
          <p className="text-[11px] text-white/35 mb-2">
            Durée max par phase (timer). Le total ci-dessus est l'estimation ressentie côté lobby, plus courte (les joueurs répondent avant la fin).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {Object.keys(timers)
              .filter((phase) => guessMyAnswerMode || !phase.startsWith('SUBSTITUTE_'))
              .map((phase) => {
              const seconds = getPhaseDuration(phase as RoundPhase, multiplier, guessPlayers);
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
              { label: 'Relances par carte', value: `${GAME_CONSTANTS.DEFAULT_CARD_RELANCES}` },
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
