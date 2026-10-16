import { Icon } from '@iconify/react';
import { DecksCatalogWithMeta, SelectedDecks } from '@onskone/shared';
import type { GameSpeed } from '@onskone/shared';
import { getSoftCategoryColor } from '../../constants/game';
import { STICKER_FILTER } from '../../constants/icons';
import type { Dictionary } from '../../i18n/dictionary';

interface LobbySettingsPanelProps {
  isHost: boolean;
  hostName: string;
  /** Résumé des options de jeu (mode · rythme · manches · durée estimée). */
  guessMyAnswerMode: boolean;
  gameSpeed: GameSpeed;
  roundCount: number;
  estimatedMinutes: number;
  onOpenOptions: () => void;
  selectedDecks: SelectedDecks;
  decksCatalogMeta: DecksCatalogWithMeta;
  totalThemesSelected: number;
  onOpenThemePicker: () => void;
  t: Dictionary;
}

// Titre de section : petit surtitre tracké, volontairement plus discret que les
// titres de ligne (gras) pour ne pas confondre "section" et "réglage".
const SECTION_TITLE = 'm-0 px-1 font-display text-xs font-bold uppercase tracking-[0.08em] text-black/60';

/**
 * Panneau de réglages du lobby (onglet "Réglages") : bandeau "hôte uniquement"
 * pour les non-hôtes, puis deux sections titrées, chacune un bloc crème sur le
 * panneau blanc :
 * - Partie : la ligne "Options de jeu" qui résume et ouvre les règles (mode
 *   "Devine ma réponse", rythme, piliers) ;
 * - Thèmes : le contenu. Hauteur variable, donc en dernier pour que le résumé des
 *   options reste visible.
 * Divulgation progressive : ce qui définit la partie reste visible, le réglage fin
 * se replie. Les contrôles sont désactivés (lecture seule) pour les non-hôtes ; les
 * options restent consultables.
 */
const LobbySettingsPanel = ({
  isHost,
  hostName,
  guessMyAnswerMode,
  gameSpeed,
  roundCount,
  estimatedMinutes,
  onOpenOptions,
  selectedDecks,
  decksCatalogMeta,
  totalThemesSelected,
  onOpenThemePicker,
  t,
}: LobbySettingsPanelProps) => {
  return (
    <div className="flex flex-col gap-5">
      {!isHost && (
        <div className="flex justify-center pt-4 pb-1">
          <div className="relative rotate-[-1.2deg] hover:rotate-0 transition-transform duration-300 ease-out">
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cream-kraft card-paper rounded-lg stack-shadow-sm">
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
      {/* Section Partie - un bloc, la ligne "Options de jeu" (mode, rythme, piliers). */}
      <section className="flex flex-col gap-1.5">
        <h3 className={SECTION_TITLE}>{t.lobby.gameSection}</h3>
        <div className="rounded-2xl border-[2.5px] border-black bg-cream-settings stack-shadow-sm overflow-hidden">
          {/* Options de jeu : réglages fins repliés dans un bottom sheet. La ligne affiche
              leur état courant, pour qu'un réglage replié ne soit jamais un réglage oublié.
              Feedback de ligne (fond) et non de carte (translate) : la ligne vit dans le bloc. */}
          <button
            type="button"
            onClick={onOpenOptions}
            aria-haspopup="dialog"
            className="group w-full flex items-center gap-3 p-3 text-left cursor-pointer transition-colors duration-200 hover:bg-black/[0.03] active:bg-black/[0.06]"
          >
            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="font-display text-sm md:text-base font-bold uppercase tracking-tight text-black leading-none">
                {t.lobby.options.title}
              </span>
              {/* Pas de truncate : avec le mode en tête, le résumé passe à la ligne
                  sur petit écran plutôt que de couper le nombre de manches. */}
              <span className="font-display text-xs font-bold tabular-nums text-black/60 leading-snug">
                {t.lobby.options.summary(
                  guessMyAnswerMode ? t.lobby.guessMyAnswer.label : t.lobby.options.classicMode,
                  gameSpeed === 'fast' ? t.lobby.gameSpeed.fast : t.lobby.gameSpeed.normal,
                  roundCount,
                  estimatedMinutes,
                )}
              </span>
            </span>
            <Icon icon="lucide:chevron-right" width={18} height={18} aria-hidden className="shrink-0 text-black/75 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        </div>
      </section>

      {/* Section Thèmes - titre + bloc crème (compteur top-left, Modifier top-right, chips). */}
      <section className="flex flex-col gap-1.5">
        <h3 className={SECTION_TITLE}>{t.lobby.themes}</h3>
        <button
          type="button"
          onClick={onOpenThemePicker}
          aria-label={isHost ? t.themePicker.modify : t.themePicker.view}
          className="group w-full flex flex-col gap-2 p-3 rounded-2xl border-[2.5px] border-black bg-cream-settings stack-shadow-sm text-left cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-[1px] active:[box-shadow:none!important]"
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
      </section>
    </div>
  );
};

export default LobbySettingsPanel;
