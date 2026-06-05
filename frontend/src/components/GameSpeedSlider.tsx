import { useCallback, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { GAME_CONSTANTS } from '@onskone/shared';
import { STICKER_FILTER } from '../constants/icons';
import type { Dictionary } from '../i18n/dictionary';

interface GameSpeedSliderProps {
    value: number;
    onChange: (value: number) => void;
    disabled: boolean;
    /** Estimation en minutes pour un multiplicateur donné (recalculée en live au drag). */
    estimateFor: (multiplier: number) => number;
    t: Dictionary;
}

// Niveaux discrets : valeurs depuis le contrat partagé ; labels/emojis par défaut
// alignés sur l'ordre rapide → lent (tronqués/complétés si le nombre de niveaux change).
const LEVEL_EMOJIS = ['fluent-emoji-flat:rabbit-face', 'fluent-emoji-flat:person-walking', 'fluent-emoji-flat:turtle'];
const buildLevels = (t: Dictionary) => {
    const labels = [t.lobby.gameSpeed.fast, t.lobby.gameSpeed.normal, t.lobby.gameSpeed.slow];
    return GAME_CONSTANTS.TIME_MULTIPLIER_LEVELS.map((value, i) => ({
        value,
        label: labels[i] ?? `×${value}`,
        emoji: LEVEL_EMOJIS[i] ?? LEVEL_EMOJIS[LEVEL_EMOJIS.length - 1],
    }));
};

// Index du niveau le plus proche d'une valeur de multiplicateur.
const nearestIndex = (levels: { value: number }[], v: number) =>
    levels.reduce((best, l, i) => (Math.abs(l.value - v) < Math.abs(levels[best].value - v) ? i : best), 0);

const GameSpeedSlider = ({ value, onChange, disabled, estimateFor, t }: GameSpeedSliderProps) => {
    const levels = useMemo(() => buildLevels(t), [t]);
    const lastIdx = levels.length - 1;
    const trackRef = useRef<HTMLDivElement>(null);
    // Position libre 0..1 pendant le drag ; null = repos (position dérivée de `value`).
    const [dragPos, setDragPos] = useState<number | null>(null);

    // Index du niveau le plus proche d'une position normalisée 0..1.
    const indexFromPos = useCallback((p: number) => Math.round(p * lastIdx), [lastIdx]);

    const valueIdx = nearestIndex(levels, value);
    const restPos = lastIdx === 0 ? 0 : valueIdx / lastIdx;
    const pos = dragPos ?? restPos;
    // Niveau mis en avant : suit le pointeur pendant le drag, sinon le niveau courant.
    const activeIdx = dragPos === null ? valueIdx : indexFromPos(dragPos);
    const active = levels[activeIdx];

    const posFromClientX = useCallback((clientX: number) => {
        const rect = trackRef.current?.getBoundingClientRect();
        if (!rect || rect.width === 0) return 0;
        return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    }, []);

    const commit = useCallback((p: number) => {
        onChange(levels[indexFromPos(p)].value);
    }, [levels, onChange, indexFromPos]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragPos(posFromClientX(e.clientX));
    }, [disabled, posFromClientX]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (disabled || dragPos === null) return;
        setDragPos(posFromClientX(e.clientX));
    }, [disabled, dragPos, posFromClientX]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (disabled || dragPos === null) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        commit(dragPos); // snap au niveau le plus proche
        setDragPos(null);
    }, [disabled, dragPos, commit]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (disabled) return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            onChange(levels[Math.max(0, valueIdx - 1)].value);
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            onChange(levels[Math.min(lastIdx, valueIdx + 1)].value);
        }
    }, [disabled, levels, lastIdx, onChange, valueIdx]);

    return (
        <div className={`flex flex-col gap-3 transition-opacity ${disabled ? 'opacity-70' : ''}`}>
            {/* Titre + estimation (mise à jour en direct selon le niveau survolé). */}
            <div className="flex items-baseline gap-2">
                <span className="font-display text-base font-bold uppercase tracking-tight text-black">{t.lobby.gameSpeed.label}</span>
                <span className="font-display text-xs font-bold tabular-nums text-black/55">
                    {t.lobby.gameSpeed.estimate(estimateFor(active.value))}
                </span>
            </div>

            <div className="flex items-start gap-3">
                {/* px ≈ rayon du thumb : il ne déborde plus la marge aux extrêmes (petits écrans). */}
                <div className="flex-1 min-w-0 flex flex-col gap-2 px-3.5">
                    <div
                        role="slider"
                        tabIndex={disabled ? -1 : 0}
                        aria-label={t.lobby.gameSpeed.label}
                        aria-valuemin={0}
                        aria-valuemax={lastIdx}
                        aria-valuenow={valueIdx}
                        aria-valuetext={levels[valueIdx].label}
                        aria-disabled={disabled}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onKeyDown={handleKeyDown}
                        className={`relative h-10 flex items-center touch-none select-none outline-none ${disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
                    >
                        {/* Rail */}
                        <div ref={trackRef} className="relative w-full h-3.5 rounded-full border-[2.5px] border-black bg-black/[0.06] [box-shadow:0_2px_0_0_#000] overflow-hidden">
                            {/* Remplissage jusqu'au thumb */}
                            <div
                                className={`absolute inset-y-0 left-0 bg-warning-500 ${dragPos === null ? 'transition-[width] duration-200 ease-out' : ''}`}
                                style={{ width: `${pos * 100}%` }}
                            />
                        </div>
                        {/* Ticks uniquement aux extrêmes (pas de trait gris sur le niveau Normal) */}
                        {levels.map((lvl, i) => (
                            i === 0 || i === levels.length - 1 ? (
                                <span
                                    key={lvl.value}
                                    aria-hidden
                                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-[2px] h-2 rounded-full bg-black/25"
                                    style={{ left: `${(i / lastIdx) * 100}%` }}
                                />
                            ) : null
                        ))}
                        {/* Thumb */}
                        <div
                            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full border-[2.5px] border-black bg-white [box-shadow:0_2px_0_0_#000] ${dragPos === null ? 'transition-[left] duration-200 ease-out' : ''}`}
                            style={{ left: `${pos * 100}%` }}
                            aria-hidden
                        />
                    </div>

                    {/* Labels des niveaux : extrêmes ancrés dans le cadre, milieu centré. */}
                    <div className="relative h-4">
                        {levels.map((lvl, i) => {
                            const anchor = i === 0
                                ? 'left-0'
                                : i === levels.length - 1
                                    ? 'right-0'
                                    : 'left-1/2 -translate-x-1/2';
                            return (
                                <span
                                    key={lvl.value}
                                    aria-hidden
                                    className={`absolute top-0 ${anchor} font-display text-[11px] font-bold uppercase tracking-tight leading-none transition-colors duration-200 ${i === activeIdx ? 'text-black' : 'text-black/40'}`}
                                >
                                    {lvl.label}
                                </span>
                            );
                        })}
                    </div>
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
