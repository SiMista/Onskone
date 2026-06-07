import { Icon } from '@iconify/react';
import { DecksCatalogWithMeta, SelectedDecks } from '@onskone/shared';
import Checkbox from '../Checkbox';
import GameSpeedSlider from '../GameSpeedSlider';
import { GAME_CONFIG, getSoftCategoryColor, estimateGameMinutes } from '../../constants/game';
import { STICKER_FILTER } from '../../constants/icons';
import type { Dictionary } from '../../i18n/dictionary';

interface LobbySettingsPanelProps {
  isHost: boolean;
  hostName: string;
  guessMyAnswerMode: boolean;
  onGuessMyAnswerModeChange: (next: boolean) => void;
  timeMultiplier: number;
  onTimeMultiplierChange: (next: number) => void;
  /** Nombre de joueurs actifs, pour estimer la durée de partie. */
  activePlayersCount: number;
  selectedDecks: SelectedDecks;
  decksCatalogMeta: DecksCatalogWithMeta;
  totalThemesSelected: number;
  onOpenThemePicker: () => void;
  t: Dictionary;
}

/**
 * Panneau de réglages du lobby (onglet "Réglages") : bandeau "hôte uniquement"
 * pour les non-hôtes, mode "Devine ma réponse", rythme de jeu, et bloc Thèmes.
 * Les contrôles sont désactivés (lecture seule) pour les non-hôtes.
 */
const LobbySettingsPanel = ({
  isHost,
  hostName,
  guessMyAnswerMode,
  onGuessMyAnswerModeChange,
  timeMultiplier,
  onTimeMultiplierChange,
  activePlayersCount,
  selectedDecks,
  decksCatalogMeta,
  totalThemesSelected,
  onOpenThemePicker,
  t,
}: LobbySettingsPanelProps) => {
  return (
    <div className="flex flex-col gap-4">
      {!isHost && (
        <div className="flex justify-center pt-4 pb-1">
          <div className="relative rotate-[-1.2deg] hover:rotate-0 transition-transform duration-300 ease-out">
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cream-kraft border-[2.5px] border-black rounded-lg stack-shadow-sm texture-paper">
              <span className="font-display text-[13px] tracking-tight text-black leading-snug whitespace-nowrap">
                {t.lobby.settingsHostOnlyPrefix}{' '}
                <span className="relative inline-block font-bold uppercase bg-black text-warning-500 px-1.5 py-0.5 rounded-md">
                  <Icon
                    icon="fluent-emoji-flat:crown"
                    width={20}
                    height={20}
                    aria-hidden
                    className="absolute -top-3.5 left-1/2 -translate-x-1/2"
                    style={{ filter: STICKER_FILTER }}
                  />
                  {hostName && hostName.length > 10 ? `${hostName.slice(0, 10)}…` : hostName}
                </span>{' '}
                {t.lobby.settingsHostOnlySuffix}
              </span>
            </div>
            {/* ruban adhésif par dessus */}
            <span
              aria-hidden
              className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 w-12 h-3.5 bg-warning-500/80 border-[1.5px] border-black/60 rounded-[2px] rotate-[-3deg] [box-shadow:1px_1px_0_0_rgba(0,0,0,0.3)]"
            />
          </div>
        </div>
      )}
      {/* Mode "Devine ma réponse" - décoché = mode Classique */}
      <Checkbox
        checked={guessMyAnswerMode}
        onChange={onGuessMyAnswerModeChange}
        disabled={!isHost}
        label={t.lobby.guessMyAnswer.label}
        description={t.lobby.guessMyAnswer.description}
      />

      <span aria-hidden className="w-full border-t-[1.5px] border-dashed border-black/15" />

      {/* Rythme de jeu : slider 3 niveaux, emoji carousel, section inline. */}
      <GameSpeedSlider
        value={timeMultiplier}
        onChange={onTimeMultiplierChange}
        disabled={!isHost}
        estimateFor={(m) => estimateGameMinutes(
          Math.max(GAME_CONFIG.MIN_PLAYERS, activePlayersCount),
          m,
          guessMyAnswerMode,
        )}
        t={t}
      />

      <span aria-hidden className="w-full border-t-[1.5px] border-dashed border-black/15" />

      {/* Section Thèmes - titre + bloc blanc (compteur top-left, Modifier top-right, chips). */}
      <div className="flex flex-col gap-1.5">
        <span className="font-display text-base font-bold uppercase tracking-tight text-black px-1">
          {t.lobby.themes}
        </span>
        <button
          type="button"
          onClick={onOpenThemePicker}
          aria-label={isHost ? t.themePicker.modify : t.themePicker.view}
          className="group w-full flex flex-col gap-2 p-3 rounded-2xl border-[2.5px] border-black bg-white stack-shadow-sm text-left cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-[1px] active:[box-shadow:none!important]"
        >
          {/* En-tête du bloc : compteur top-left, Modifier/Voir top-right */}
          <span className="flex items-center gap-2 w-full">
            <span className="font-display text-xs font-bold tabular-nums text-black/60 whitespace-nowrap">
              {t.themePicker.counter(totalThemesSelected)}
            </span>
            <span className="flex-1" />
            <span className="shrink-0 inline-flex items-center gap-0.5 font-display text-xs font-bold uppercase tracking-tight text-black/75 group-hover:text-black transition-colors">
              {isHost ? t.themePicker.modify : t.themePicker.view}
              <Icon icon="lucide:chevron-right" width={16} height={16} aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </span>

          {/* Séparateur pointillé */}
          <span aria-hidden className="w-full border-t-[1.5px] border-dashed border-black/15" />

          {/* Chips des thèmes sélectionnés */}
          <span className="flex flex-wrap items-center gap-1.5 min-h-[1.75rem]">
            {totalThemesSelected === 0 ? (
              <span className="font-display text-sm italic text-gray-500 px-1">{t.themePicker.emptyState}</span>
            ) : (
              Object.entries(decksCatalogMeta).flatMap(([cat, infos]) =>
                infos
                  .filter(info => selectedDecks[cat]?.includes(info.code))
                  .map(info => (
                    <span
                      key={info.code}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border-[2px] border-black font-display text-xs font-bold tracking-tight text-black"
                      style={{ backgroundColor: getSoftCategoryColor(cat) }}
                    >
                      <Icon
                        icon={info.emoji}
                        width={14}
                        height={14}
                        aria-hidden
                        style={{ filter: STICKER_FILTER }}
                      />
                      <span>{info.name}</span>
                    </span>
                  ))
              )
            )}
          </span>
        </button>
      </div>
    </div>
  );
};

export default LobbySettingsPanel;
