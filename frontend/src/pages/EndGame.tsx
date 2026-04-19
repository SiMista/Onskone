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

interface Tier {
  max: number;
  midPct: number;
  title: string;
  message: string;
  color: string;
  icon: string;
}

const TIERS: Tier[] = [
  { max: 20,  midPct: 10, title: 'C\'est gênant là...',      color: '#ff4f4f', icon: 'fluent-emoji-flat:neutral-face',           message: 'Vous partagez le wifi, pas vos vies.' },
  { max: 40,  midPct: 30, title: 'Pas encore ça',  color: '#ff8c3a', icon: 'fluent-emoji-flat:pinching-hand',          message: 'Vous savez vous dire bonjour, et c\'est déjà ça.' },
  { max: 60,  midPct: 50, title: 'Pas mal, pas mal', color: '#ffc700', icon: 'fluent-emoji-flat:handshake',              message: 'Les bases sont là, reste à creuser un peu.' },
  { max: 80,  midPct: 70, title: 'Super team',     color: '#8bd94d', icon: 'fluent-emoji-flat:sparkles',              message: 'Vous vous captez presque sans parler.' },
  { max: 100, midPct: 90, title: 'Inséparables',   color: '#30c94d', icon: 'fluent-emoji-flat:people-hugging',         message: 'À ce stade c\'est plus de l\'amitié, c\'est de la fusion.' },
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
  const [isSharing, setIsSharing] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preparedBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    if (!lobbyCode) navigate('/');
  }, [lobbyCode, navigate]);

  useEffect(() => {
    const parsedPlayer = getCurrentPlayerFromStorage();
    if (parsedPlayer) setCurrentPlayer(parsedPlayer);

    socket.on('gameEnded', (data: { leaderboard: LeaderboardEntry[]; rounds: RoundData[] }) => {
      setLeaderboard(data.leaderboard);
      setRounds(data.rounds || []);
    });

    if (lobbyCode) {
      socket.emit('getGameResults', { lobbyCode: lobbyCode! });
    }

    return () => {
      socket.off('gameEnded');
      if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
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
  const liveVerdict = useMemo(() => getVerdict(displayPct), [displayPct]);

  useEffect(() => {
    if (!leaderboard.length) return;
    const duration = 5500;
    const start = performance.now();

    // Montée globale ease-out + 2 très légères hésitations (petits dips).
    // Ça donne un feel "suspens" sans être brutal.
    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    const clamp = (v: number) => Math.max(0, Math.min(100, v));
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 2.4);

    const dipAt1 = rand(0.35, 0.45);
    const dipAt2 = rand(0.65, 0.78);
    const dipAmp1 = rand(2, 4);
    const dipAmp2 = rand(1.5, 3);

    const dipAround = (t: number, center: number, amp: number) => {
      const width = 0.08;
      const d = Math.abs(t - center);
      if (d > width) return 0;
      return -amp * (1 - d / width) * Math.sin((1 - d / width) * Math.PI);
    };

    const interpolate = (progress: number) => {
      const base = easeOut(progress) * pct;
      const dip = dipAround(progress, dipAt1, dipAmp1) + dipAround(progress, dipAt2, dipAmp2);
      return clamp(base + dip);
    };

    const animate = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      setDisplayPct(Math.round(interpolate(t)));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setRevealed(true);
        if (pct >= 61) {
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
      verdictMessage: verdict.message,
      color: verdict.color,
      topPlayers: leaderboard.slice(0, 3).map(e => ({
        name: e.player.name,
        score: e.score,
      })),
    })
      .then(blob => { if (!cancelled) preparedBlobRef.current = blob; })
      .catch(err => console.error('buildShareCard failed', err));
    return () => { cancelled = true; };
  }, [revealed, leaderboard, pct, verdict]);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setShareToast(msg);
    toastTimeoutRef.current = setTimeout(() => setShareToast(null), 3000);
  };

  const handleShare = async () => {
    if (isSharing) return;
    const blob = preparedBlobRef.current;
    if (!blob) {
      showToast('Image en cours de préparation…');
      return;
    }
    const text = `${verdict.title} — ${pct}% · ${verdict.message}`;
    setIsSharing(true);
    try {
      const result = await shareBlob(blob, text);
      if (result === 'copied') showToast('Image copiée ! Colle-la où tu veux 📋');
      else if (result === 'failed') showToast('Partage non supporté');
    } catch (err) {
      console.error('Share failed', err);
      showToast('Oups, partage échoué');
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
        <div className="flex justify-center mb-2 md:mb-4">
          <Logo size="small" />
        </div>

        <div className="flex flex-col items-center mb-5 md:mb-8">
          <p className="text-white/80 font-display text-sm md:text-lg uppercase tracking-[0.25em] mb-2 md:mb-4">
            Vous vous connaissez à
          </p>

          <div className="relative w-[360px] h-[360px] md:w-[440px] md:h-[440px] max-w-full">
            <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] h-[240px] md:w-[300px] md:h-[300px] -rotate-90" viewBox="0 0 240 240">
              <circle
                cx="120"
                cy="120"
                r={ringRadius}
                fill="none"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth="18"
              />
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
                style={{
                  transition: 'stroke 0.5s ease',
                  filter: revealed ? `drop-shadow(0 0 14px ${liveVerdict.color})` : 'none',
                }}
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
            className={`mt-3 md:mt-4 text-center px-4 transition-all duration-500 ${
              revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
            }`}
          >
            <p className="text-white text-sm md:text-base font-display italic max-w-md mx-auto">
              « {verdict.message} »
            </p>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-lg p-3 md:p-5 mb-4 md:mb-6 border-2 border-white/15">
          <h2 className="text-base md:text-xl font-display font-bold text-white mb-2 md:mb-3 text-center uppercase tracking-wider">
            Scores individuels
          </h2>
          <div className="space-y-1.5 md:space-y-2">
            {leaderboard.map((entry, index) => {
              const isCurrentPlayer = entry.player.id === currentPlayer?.id;
              return (
                <div
                  key={entry.player.id}
                  className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-white/10 animate-player-pop"
                  style={{ animationDelay: `${(revealed ? 0 : 1500) + index * 80}ms` }}
                >
                  <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <span className="text-sm md:text-base w-6 md:w-8 text-center flex-shrink-0 font-bold tabular-nums text-white/70">
                      {index + 1}
                    </span>
                    <Avatar avatarId={entry.player.avatarId} name={entry.player.name} size="sm" className="flex-shrink-0 md:hidden" />
                    <Avatar avatarId={entry.player.avatarId} name={entry.player.name} size="md" className="flex-shrink-0 hidden md:block" />
                    <span className="text-sm md:text-lg font-semibold truncate text-white">
                      {entry.player.name}
                      {isCurrentPlayer && (
                        <span className="ml-2 text-[10px] md:text-xs bg-yellow-400 text-black px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">
                          Vous
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="text-base md:text-xl font-display font-bold flex-shrink-0 ml-2 tabular-nums text-white">
                    {entry.score} pt{entry.score > 1 ? 's' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
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
      </div>

      {shareToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black/80 text-white px-4 py-2 rounded-full text-sm font-display shadow-lg backdrop-blur-sm animate-toast-in">
          {shareToast}
        </div>
      )}

      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-toast-in {
          animation: toast-in 0.3s ease-out;
        }
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
