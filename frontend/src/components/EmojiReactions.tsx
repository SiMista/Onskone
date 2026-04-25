import { useCallback, useEffect, useRef, useState } from 'react';
import socket from '../utils/socket';
import { useSocketEvent } from '../hooks';

const EMOJIS = ['👍', '🔥', '😂', '❤️', '🤡'] as const;
type Emoji = (typeof EMOJIS)[number];

interface FloatingEmoji {
    id: string;
    emoji: string;
    playerName: string;
    ex: number;   // offset horizontal de départ (px)
    dx: number;   // offset horizontal final (px)
    rot: number;  // rotation (deg)
}

interface EmojiReactionsProps {
    lobbyCode: string;
}

const LOCAL_COOLDOWN_MS = 400;
const MAX_FLOATING = 30; // cap pour éviter la saturation visuelle

const EmojiReactions: React.FC<EmojiReactionsProps> = ({ lobbyCode }) => {
    const [floating, setFloating] = useState<FloatingEmoji[]>([]);
    const lastSendRef = useRef(0);

    const spawn = useCallback((emoji: string, playerName: string, idHint?: string) => {
        const id = idHint ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const ex = (Math.random() - 0.5) * 40;
        const dx = ex + (Math.random() - 0.5) * 120;
        const rot = (Math.random() - 0.5) * 30;
        setFloating(prev => {
            const next = [...prev, { id, emoji, playerName, ex, dx, rot }];
            return next.length > MAX_FLOATING ? next.slice(next.length - MAX_FLOATING) : next;
        });
        // Auto-cleanup après la durée d'anim
        window.setTimeout(() => {
            setFloating(prev => prev.filter(f => f.id !== id));
        }, 2800);
    }, []);

    const handleLobbyReaction = useCallback(
        (data: { id: string; playerId: string; playerName: string; emoji: string }) => {
            spawn(data.emoji, data.playerName, data.id);
        },
        [spawn]
    );

    useSocketEvent('lobbyReaction', handleLobbyReaction, [handleLobbyReaction]);

    const sendReaction = (emoji: Emoji) => {
        const now = Date.now();
        if (now - lastSendRef.current < LOCAL_COOLDOWN_MS) return;
        lastSendRef.current = now;
        socket.emit('sendLobbyReaction', { lobbyCode, emoji });
        // Feedback haptique si dispo (mobile)
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try { navigator.vibrate?.(8); } catch { /* no-op */ }
        }
    };

    // Cleanup sur démontage
    useEffect(() => () => setFloating([]), []);

    return (
        <>
            {/* Overlay flottant (full viewport, ne bloque pas les clics) */}
            <div
                className="pointer-events-none fixed inset-x-0 bottom-[10.5rem] md:bottom-24 z-40 flex justify-center"
                aria-hidden
            >
                <div className="relative w-0 h-0">
                    {floating.map(f => (
                        <div
                            key={f.id}
                            className="absolute left-0 top-0 -translate-x-1/2 animate-emoji-float"
                            style={
                                {
                                    '--ex': `${f.ex}px`,
                                    '--dx': `${f.dx}px`,
                                    '--rot': `${f.rot}deg`,
                                } as React.CSSProperties
                            }
                        >
                            <div className="relative flex flex-col items-center gap-1">
                                <span className="text-4xl drop-shadow-[0_2px_0_rgba(0,0,0,0.25)]">{f.emoji}</span>
                                <span className="text-[10px] font-display font-bold text-white bg-black/70 px-1.5 py-0.5 rounded-full whitespace-nowrap border border-black">
                                    {f.playerName}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Barre d'emojis (docked bas). Sur mobile, remontée au-dessus de la sticky action bar (~72px). */}
            <div
                className="fixed left-1/2 -translate-x-1/2 z-40 bottom-[calc(env(safe-area-inset-bottom,_0px)+76px)] md:bottom-[calc(env(safe-area-inset-bottom,_0px)+8px)]"
            >
                <div className="flex items-center gap-1 bg-white/95 backdrop-blur-sm border-[2.5px] border-black rounded-full stack-shadow-sm px-2 py-1.5">
                    {EMOJIS.map(e => (
                        <button
                            key={e}
                            type="button"
                            onClick={() => sendReaction(e)}
                            aria-label={`Envoyer ${e}`}
                            className="text-xl md:text-2xl px-1.5 py-0.5 rounded-full active:scale-90 hover:bg-black/5 transition-transform cursor-pointer select-none"
                        >
                            {e}
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
};

export default EmojiReactions;
