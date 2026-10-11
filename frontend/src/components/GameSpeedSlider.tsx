import { useCallback, useMemo, useRef } from 'react';
import { Icon } from '@iconify/react';
import { GAME_CONSTANTS } from '@onskone/shared';
import type { GameSpeed } from '@onskone/shared';
import { STICKER_FILTER } from '../constants/icons';
import type { Dictionary } from '../i18n/dictionary';

interface GameSpeedSliderProps {
    value: GameSpeed;
    onChange: (value: GameSpeed) => void;
    disabled: boolean;
    /** Tap sur un cran alors que le slider est verrouillé (non-hôte) : secouer le rappel. */
    onBlockedInteract?: () => void;
    t: Dictionary;
}

// Niveaux discrets : vitesses proposées par le contrat partagé (ordre rapide → lent).
const LEVEL_EMOJIS: Partial<Record<GameSpeed, string>> = {
    fast: 'fluent-emoji-flat:rabbit-face',
    normal: 'fluent-emoji-flat:person-walking',
};
const buildLevels = (t: Dictionary) => {
    const labels: Partial<Record<GameSpeed, string>> = {
        fast: t.lobby.gameSpeed.fast,
        normal: t.lobby.gameSpeed.normal,
    };
    return GAME_CONSTANTS.GAME_SPEEDS.map((value) => ({
        value,
        label: labels[value] ?? value,
        emoji: LEVEL_EMOJIS[value] ?? LEVEL_EMOJIS.normal!,
    }));
};

// Index du niveau correspondant à une vitesse. Une vitesse hors slider (debug, en
// DEV) retombe sur la vitesse par défaut.
const levelIndex = (levels: { value: GameSpeed }[], v: GameSpeed) => {
    const i = levels.findIndex((l) => l.value === v);
    return i >= 0 ? i : Math.max(0, levels.findIndex((l) => l.value === GAME_CONSTANTS.GAME_SPEED_DEFAULT));
};

/**
 * Rythme de jeu : interrupteur à crans (un par vitesse, labels dans le rail) dont la
 * pastille jaune glisse sur le niveau choisi, + emoji du niveau à droite. Choix
 * exclusif (radiogroup), flèches du clavier pour changer de niveau. En lecture
 * seule (non-hôte), le groupe reste focusable mais ignore les changements.
 */
const GameSpeedSlider = ({ value, onChange, disabled, onBlockedInteract, t }: GameSpeedSliderProps) => {
    const levels = useMemo(() => buildLevels(t), [t]);
    const lastIdx = levels.length - 1;
    const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const activeIdx = levelIndex(levels, value);

    const select = useCallback((i: number) => {
        if (disabled) {
            onBlockedInteract?.();
            return;
        }
        if (i === activeIdx) return;
        onChange(levels[i].value);
    }, [disabled, onBlockedInteract, activeIdx, onChange, levels]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        const next = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? Math.min(lastIdx, activeIdx + 1)
            : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? Math.max(0, activeIdx - 1)
            : e.key === 'Home' ? 0
            : e.key === 'End' ? lastIdx
            : null;
        if (next === null) return;
        e.preventDefault();
        select(next);
        optionRefs.current[next]?.focus();
    }, [activeIdx, lastIdx, select]);

    return (
        <div className={`flex flex-col gap-3 transition-opacity ${disabled ? 'opacity-70' : ''}`}>
            {/* Titre seul : la durée estimée dépend aussi des piliers, elle vit dans le sheet. */}
            <span className="font-display text-base font-bold uppercase tracking-tight text-black">{t.lobby.gameSpeed.label}</span>

            <div className="flex items-center gap-3">
                {/* Rail à crans : la pastille (largeur d'un cran) glisse en transform. */}
                <div
                    role="radiogroup"
                    aria-label={t.lobby.gameSpeed.label}
                    aria-disabled={disabled}
                    onKeyDown={handleKeyDown}
                    className="relative flex-1 min-w-0 grid p-1 rounded-full border-[2.5px] border-black bg-black/[0.06] [box-shadow:0_2px_0_0_#000]"
                    style={{ gridTemplateColumns: `repeat(${levels.length}, minmax(0, 1fr))` }}
                >
                    <span
                        aria-hidden
                        className="absolute top-1 bottom-1 left-1 rounded-full border-2 border-black bg-warning-500 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                        style={{
                            width: `calc((100% - 0.5rem) / ${levels.length})`,
                            transform: `translateX(${activeIdx * 100}%)`,
                        }}
                    />
                    {levels.map((lvl, i) => {
                        const isActive = i === activeIdx;
                        return (
                            <button
                                key={lvl.value}
                                ref={(el) => { optionRefs.current[i] = el; }}
                                type="button"
                                role="radio"
                                aria-checked={isActive}
                                aria-disabled={disabled}
                                tabIndex={isActive ? 0 : -1}
                                onClick={() => select(i)}
                                className={`relative z-10 min-h-11 px-2 rounded-full font-display text-sm font-bold uppercase tracking-tight leading-none outline-none focus-visible:ring-2 focus-visible:ring-black/40 transition-colors duration-200 ${
                                    isActive ? 'text-black' : 'text-black/45'
                                } ${disabled ? 'cursor-not-allowed' : isActive ? 'cursor-default' : 'cursor-pointer hover:text-black'}`}
                            >
                                {lvl.label}
                            </button>
                        );
                    })}
                </div>

                {/* Emoji du niveau courant : bande de tous les emojis (slot w-14 = 3.5rem) translatée
                    dans une fenêtre. En changeant de niveau, la bande glisse en douceur → l'ancien
                    emoji sort pendant que le nouveau entre. Masque dégradé sur les bords : les emojis
                    se fondent en entrant/sortant au lieu d'être coupés net (effet smooth). */}
                <div
                    className="shrink-0 relative w-14 h-10 overflow-hidden [mask-image:linear-gradient(90deg,transparent_0%,#000_18%,#000_82%,transparent_100%)] [-webkit-mask-image:linear-gradient(90deg,transparent_0%,#000_18%,#000_82%,transparent_100%)]"
                >
                    <div
                        className="flex h-full transition-transform duration-[400ms] ease-[cubic-bezier(0.6,0,0.2,1)]"
                        style={{ transform: `translateX(-${activeIdx * 3.5}rem)` }}
                    >
                        {levels.map((lvl) => (
                            <span key={lvl.value} className="shrink-0 w-14 h-full flex items-center justify-center">
                                <Icon
                                    icon={lvl.emoji}
                                    width={38}
                                    height={38}
                                    aria-hidden
                                    style={{ filter: STICKER_FILTER }}
                                />
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GameSpeedSlider;
