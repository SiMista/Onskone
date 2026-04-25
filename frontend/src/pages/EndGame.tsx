import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import socket from '../utils/socket';
import { IPlayer, LeaderboardEntry, RoundData } from '@onskone/shared';
import Button from '../components/Button';
import Avatar from '../components/Avatar';
import Logo from '../components/Logo';
import { getCurrentPlayerFromStorage } from '../utils/playerHelpers';
import { buildShareCard, shareBlob } from '../utils/shareCard';
import { useToast } from '../components/Toast';

interface Tier {
  max: number;
  midPct: number;
  title: string;
  messages: string[];
  color: string;
  icon: string;
}

const TIERS: Tier[] = [
  {
    max: 20, midPct: 10, title: 'C\'est gênant là...', color: '#ff4f4f', icon: 'fluent-emoji-flat:neutral-face',
    messages: [
      'Vous savez dire bonjour, c\'est déjà une belle étape.',
      'Vous partagez le wifi, c\'est déjà une base solide.',
      'Faut peut-être commencer par un café ensemble, non ?',
      'Tranquille, vous apprendrez à vous connaître… un jour.',
    ],
  },
  {
    max: 40, midPct: 30, title: 'Pas encore ça', color: '#ff8c3a', icon: 'fluent-emoji-flat:pinching-hand',
    messages: [
      'Vous savez dire bonjour, c\'est déjà une belle étape.',
      'Les bases sont là, reste juste à construire au-dessus.',
      'Vous avancez, doucement mais sûrement… enfin surtout doucement.',
      'Un apéro ou deux et ça devrait décoller.',
    ],
  },
  {
    max: 60, midPct: 50, title: 'Pas mal, pas mal', color: '#ffc700', icon: 'fluent-emoji-flat:handshake',
    messages: [
      'Un pas de plus et vous êtes une vraie team.',
      'C\'est solide, mais pas encore fusionnel.',
      'Vous vous captez bien, la surprise reste possible.',
      'Pas mal du tout, y\'a clairement de quoi faire.',
    ],
  },
  {
    max: 80, midPct: 70, title: 'Super team', color: '#8bd94d', icon: 'fluent-emoji-flat:sparkles',
    messages: [
      'Vous vous captez presque sans parler, c\'est beau à voir.',
      'Les vibes sont là, la complicité aussi.',
      'Clairement, vous avez vécu des trucs ensemble.',
    ],
  },
  {
    max: 100, midPct: 90, title: 'Inséparables', color: '#30c94d', icon: 'fluent-emoji-flat:people-hugging',
    messages: [
      'À ce stade c\'est plus de l\'amitié, c\'est de la famille.',
      'Chaque moment ensemble devient une anecdote.',
      'Séparés à la naissance, clairement.',
      'Personne ne vous connaît mieux que vous-mêmes.',
    ],
  },
];

const getTierIndex = (pct: number) => {
  const idx = TIERS.findIndex(t => pct <= t.max);
  return idx === -1 ? TIERS.length - 1 : idx;
};
const getVerdict = (pct: number): Tier => TIERS[getTierIndex(pct)];

const EndGame: React.FC = () => {
  const { lobbyCode } = useParams<{ lobbyCode: string }>();
  const navigate = useNavigate();
  const confettiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<IPlayer | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [displayPct, setDisplayPct] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const preparedBlobRef = useRef<Blob | null>(null);
  const showToast = useToast();

  useEffect(() => {
    if (!lobbyCode) navigate('/');
  }, [lobbyCode, navigate]);

  useEffect(() => {
    const parsedPlayer = getCurrentPlayerFromStorage();
    if (parsedPlayer) setCurrentPlayer(parsedPlayer);

    // On ne prend en compte que la première réception : si un joueur quitte
    // ensuite, le serveur peut ré-émettre un gameEnded mis à jour, mais on veut
    // que le classement reste figé tel qu'affiché à la fin de la partie.
    socket.on('gameEnded', (data: { leaderboard: LeaderboardEntry[]; rounds: RoundData[] }) => {
      setLeaderboard(prev => (prev.length ? prev : data.leaderboard));
      setRounds(prev => (prev.length ? prev : data.rounds || []));
    });

    if (lobbyCode) {
      socket.emit('getGameResults', { lobbyCode: lobbyCode! });
    }

    return () => {
      socket.off('gameEnded');
      if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [lobbyCode]);

  const pct = useMemo(() => {
    if (!leaderboard.length || !rounds.length) return 0;
    const correct = leaderboard.reduce((s, e) => s + e.score, 0);
    const possible = rounds.length * Math.max(1, leaderboard.length - 1);
    const rawPct = possible > 0 ? Math.round((correct / possible) * 100) : 0;
    return Math.max(0, Math.min(100, rawPct));
  }, [leaderboard, rounds]);

  const verdict = useMemo(() => getVerdict(pct), [pct]);
  // Sélection déterministe basée sur lobbyCode + pct + nb de rounds pour que
  // tous les clients de la même partie voient le même message.
  const verdictMessage = useMemo(() => {
    const seed = `${lobbyCode ?? ''}|${pct}|${rounds.length}`;
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    const idx = Math.abs(h) % verdict.messages.length;
    return verdict.messages[idx];
  }, [verdict, lobbyCode, pct, rounds.length]);
  const liveVerdict = useMemo(() => getVerdict(displayPct), [displayPct]);

  useEffect(() => {
    if (!leaderboard.length) return;
    const duration = 8500;
    const start = performance.now();

    // Feinte douce, sans à-coups :
    //  - pct > 50 : on monte jusqu'à pct, petit dip sous pct, puis remonte à pct.
    //  - pct ≤ 50 : on monte au-dessus de pct (peak), puis on redescend lentement à pct.
    const clamp = (v: number) => Math.max(0, Math.min(100, v));
    // Quadratique : accélère/décélère plus doucement que cubique → sensation de
    // vitesse plus constante, plus lente à traverser.
    const easeInOut = (t: number) =>
      t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    const interpolate = (progress: number): number => {
      if (pct > 50) {
        // Amplitude du dip : plus le score est haut, plus il est petit (évite le "bug" à 100).
        const dip = Math.max(3, Math.min(8, (100 - pct) * 0.25 + 3));
        // Montée lente (ease-in-out) sur 70% de la durée, puis dip, puis recovery.
        if (progress < 0.7) {
          return clamp(easeInOut(progress / 0.7) * pct);
        }
        if (progress < 0.88) {
          const u = (progress - 0.7) / 0.18;
          return clamp(pct - dip * easeInOut(u));
        }
        const u = (progress - 0.88) / 0.12;
        return clamp(pct - dip + dip * easeInOut(u));
      }
      // pct ≤ 50 : peak toujours bien au-dessus, descente lente et smooth
      const peak = Math.min(85, pct + Math.max(18, (55 - pct) * 0.8));
      if (progress < 0.55) {
        return clamp(easeInOut(progress / 0.55) * peak);
      }
      const u = (progress - 0.55) / 0.45;
      return clamp(peak + (pct - peak) * easeInOut(u));
    };

    const animate = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      setDisplayPct(Math.round(interpolate(t)));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setRevealed(true);
        setTimeout(() => setShowLeaderboard(true), 900);
        if (pct > 80) {
          setShowConfetti(true);
          confettiTimeoutRef.current = setTimeout(() => setShowConfetti(false), 5000);
        }
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [pct, leaderboard.length]);

  const handleBackToLobby = () => {
    if (lobbyCode) navigate(`/lobby/${lobbyCode}`);
  };

  const handleBackToHome = () => {
    if (lobbyCode && currentPlayer) {
      socket.emit('leaveLobby', { lobbyCode, currentPlayerId: currentPlayer.id });
    }
    localStorage.removeItem('currentPlayer');
    navigate(`/?lobbyCode=${lobbyCode}`);
  };

  // Pré-génère l'image dès que le reveal est fini, pour que le clic sur Partager
  // soit synchrone (sinon les navigateurs refusent share()/clipboard.write()
  // à cause de la perte du "user gesture").
  useEffect(() => {
    if (!revealed || !leaderboard.length) return;
    let cancelled = false;
    buildShareCard({
      pct,
      verdictTitle: verdict.title,
      verdictMessage: verdictMessage,
      color: verdict.color,
      topPlayers: leaderboard.slice(0, 3).map(e => ({
        name: e.player.name,
        score: e.score,
      })),
    })
      .then(blob => { if (!cancelled) preparedBlobRef.current = blob; })
      .catch(err => console.error('buildShareCard failed', err));
    return () => { cancelled = true; };
  }, [revealed, leaderboard, pct, verdict, verdictMessage]);

  const handleShare = async () => {
    if (isSharing) return;
    const blob = preparedBlobRef.current;
    if (!blob) {
      showToast('Image en cours de préparation…', 'info');
      return;
    }
    const text = `${verdict.title} — ${pct}% · ${verdictMessage}`;
    setIsSharing(true);
    try {
      const result = await shareBlob(blob, text);
      if (result === 'copied') showToast('Image copiée ! Colle-la où tu veux', 'success');
      else if (result === 'failed') showToast('Partage non supporté', 'warning');
    } catch (err) {
      console.error('Share failed', err);
      showToast('Oups, partage échoué', 'error');
    } finally {
      setIsSharing(false);
    }
  };

  const confettiItems = useMemo(() => {
    const emojis = [
      'fluent-emoji-flat:party-popper',
      'fluent-emoji-flat:confetti-ball',
      'fluent-emoji-flat:star',
      'fluent-emoji-flat:sparkles',
    ];
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 20,
      delay: Math.random() * 3,
      duration: 2 + Math.random() * 3,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
    }));
  }, []);

  const ringRadius = 110;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (displayPct / 100) * ringCircumference;

  return (
    <div className="min-h-screen p-3 md:p-6 relative overflow-hidden">
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-1000"
        style={{
          background:
            'radial-gradient(circle at 50% 35%, transparent 0%, rgba(0,0,0,0.70) 30%, rgba(0,0,0,1) 70%)',
          opacity: revealed ? 0 : 1,
        }}
        aria-hidden
      />
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none z-50">
          {confettiItems.map((item) => (
            <div
              key={item.id}
              className="absolute animate-fall"
              style={{
                left: `${item.left}%`,
                top: `-${item.top}%`,
                animationDelay: `${item.delay}s`,
                animationDuration: `${item.duration}s`,
              }}
            >
              <Icon icon={item.emoji} className="text-2xl md:text-4xl" width="1em" height="1em" aria-hidden />
            </div>
          ))}
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        <div className="flex justify-center mt-3 md:mt-4 mb-2 md:mb-4">
          <Logo size="small" />
        </div>

        <div className="flex flex-col items-center mb-5 md:mb-8">
          <p className="text-white/80 font-display text-sm md:text-lg uppercase tracking-[0.25em]">
            Vous vous connaissez à
          </p>

          <div className="relative w-[320px] h-[320px] md:w-[380px] md:h-[380px] max-w-full -mt-6 md:-mt-8">
            <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] md:w-[250px] md:h-[250px] -rotate-90 overflow-visible" viewBox="0 0 240 240" style={{ overflow: 'visible' }}>
              <defs>
                <filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
                </filter>
              </defs>
              <circle
                cx="120"
                cy="120"
                r={ringRadius}
                fill="none"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth="18"
              />
              {revealed && (
                <circle
                  cx="120"
                  cy="120"
                  r={ringRadius}
                  fill="none"
                  stroke={liveVerdict.color}
                  strokeWidth="22"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  opacity="0.55"
                  filter="url(#ring-glow)"
                  style={{ transition: 'stroke 0.5s ease' }}
                />
              )}
              <circle
                cx="120"
                cy="120"
                r={ringRadius}
                fill="none"
                stroke={liveVerdict.color}
                strokeWidth="18"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                style={{ transition: 'stroke 0.5s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex items-baseline">
                <span
                  className="font-display font-bold text-white text-6xl md:text-8xl leading-none tabular-nums"
                  style={{ textShadow: '0 2px 14px rgba(0,0,0,0.35)' }}
                >
                  {displayPct}
                </span>
                <span
                  className="font-display font-bold text-4xl md:text-5xl ml-1"
                  style={{ color: liveVerdict.color, transition: 'color 0.5s ease' }}
                >
                  %
                </span>
              </div>
            </div>

            {TIERS.map((tier, idx) => {
              const currentIdx = displayPct <= 0 ? -1 : getTierIndex(displayPct);
              const isActive = idx === currentIdx;
              const isPassed = currentIdx > idx;
              const a = (tier.midPct / 100) * 360 * Math.PI / 180;
              const radius = 40;
              const x = 50 + Math.sin(a) * radius;
              const y = 50 - Math.cos(a) * radius;
              return (
                <div
                  key={tier.title}
                  className="absolute flex flex-col items-center text-center whitespace-nowrap"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: `translate(-50%, -50%) scale(${isActive ? 1.15 : isPassed ? 0.92 : 0.8})`,
                    opacity: isActive ? 1 : isPassed ? 0.7 : 0.28,
                    transition: 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease, filter 0.4s ease',
                    filter: isActive ? `drop-shadow(0 0 10px ${tier.color}) drop-shadow(0 0 4px ${tier.color})` : 'none',
                  }}
                >
                  <Icon
                    icon={tier.icon}
                    className={isActive ? 'text-3xl md:text-4xl' : 'text-lg md:text-xl'}
                    width="1em"
                    height="1em"
                    aria-hidden
                  />
                  <span
                    className={`font-display font-bold mt-0.5 md:mt-1 ${isActive ? 'text-sm md:text-base' : 'text-[10px] md:text-xs'}`}
                    style={{
                      color: isActive || isPassed ? tier.color : 'rgba(255,255,255,0.75)',
                      textShadow: isActive ? '0 1px 3px rgba(0,0,0,0.5)' : 'none',
                      letterSpacing: isActive ? '0.02em' : '0',
                    }}
                  >
                    {tier.title}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            className={`-mt-2 md:-mt-4 text-center px-4 transition-all duration-500 ${
              revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
            }`}
          >
            <p className="text-white text-sm md:text-base font-display italic max-w-md mx-auto">
              « {verdictMessage} »
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 mb-4 md:mb-6">
          <button
            type="button"
            onClick={handleShare}
            disabled={isSharing}
            className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-display transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSharing ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <Icon icon="mdi:share-variant-outline" width="1.1em" height="1.1em" aria-hidden />
            )}
            <span>Partager</span>
          </button>
          <div className="flex flex-row justify-center items-center gap-3 md:gap-6">
            <Button variant="success" size="lg" onClick={handleBackToLobby}>
              Rejouer
            </Button>
            <Button variant="secondary" size="lg" onClick={handleBackToHome}>
              Quitter
            </Button>
          </div>
        </div>

        <div
          className={`bg-white border-[2.5px] border-black rounded-2xl stack-shadow texture-paper p-3 md:p-5 transition-all duration-500 ${showLeaderboard ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <h2 className="text-base md:text-xl font-display font-bold text-gray-900 mb-2 md:mb-3 text-center uppercase tracking-wider m-0">
            Scores individuels
          </h2>
          <div className="space-y-1.5 md:space-y-2">
            {leaderboard.map((entry, index) => {
              const isCurrentPlayer = entry.player.id === currentPlayer?.id;
              const isPodium = index < 3;
              const podiumColors = ['#FFC700', '#C0C0C0', '#CD7F32'];
              return (
                <div
                  key={entry.player.id}
                  className={`flex items-center justify-between p-2 md:p-3 rounded-xl border-[2.5px] border-black animate-player-pop ${isCurrentPlayer ? 'bg-[#FFF3C4] stack-shadow-sm' : 'bg-cream-player'}`}
                  style={{ animationDelay: `${(showLeaderboard ? 0 : 99999) + index * 80}ms` }}
                >
                  <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <span
                      className="flex items-center justify-center text-sm md:text-base w-7 h-7 md:w-9 md:h-9 flex-shrink-0 font-display font-bold tabular-nums rounded-full border-2 border-black"
                      style={{
                        backgroundColor: isPodium ? podiumColors[index] : '#ffffff',
                        color: isPodium && index === 0 ? '#000' : '#1f2937',
                      }}
                    >
                      {index + 1}
                    </span>
                    <Avatar avatarId={entry.player.avatarId} name={entry.player.name} size="sm" className="flex-shrink-0 md:hidden" />
                    <Avatar avatarId={entry.player.avatarId} name={entry.player.name} size="md" className="flex-shrink-0 hidden md:block" />
                    <span className="text-sm md:text-lg font-semibold truncate text-gray-900">
                      {entry.player.name}
                    </span>
                  </div>
                  <span className="text-base md:text-xl font-display font-bold flex-shrink-0 ml-2 tabular-nums text-gray-900">
                    {entry.score} pt{entry.score > 1 ? 's' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fall {
          to { transform: translateY(100vh) rotate(360deg); }
        }
        .animate-fall {
          animation: fall linear infinite;
        }
      `}</style>
    </div>
  );
};

export default EndGame;
