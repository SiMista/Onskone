import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import socket from '../utils/socket';
import { IPlayer, LeaderboardEntry, IRound } from '@onskone/shared';
import Logo from '../components/Logo';
import { TIERS, ONSKONE_INDEX, type Tier } from '../constants/tiers';
import { getCurrentPlayerFromStorage } from '../utils/playerHelpers';
import { studioStorage } from '../utils/studioStorage';
import { buildShareCard, shareBlob } from '../utils/shareCard';
import { useToast } from '../components/Toast';
import ReportTrigger from '../components/ReportTrigger';
import { recordGameEnd, computeTeamPct } from '../utils/playerStats';
import { useLocale } from '../i18n';
import VerdictRing from '../components/endgame/VerdictRing';
import ShareSection from '../components/endgame/ShareSection';
import ScoreLeaderboard from '../components/endgame/ScoreLeaderboard';

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
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Cleanup global : clear tous les setTimeout collectés (reveal staggers +
  // achievement toasts) au unmount pour éviter les setState après démontage.
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(id => clearTimeout(id));
      timeoutsRef.current = [];
    };
  }, []);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [rounds, setRounds] = useState<IRound[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<IPlayer | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [displayPct, setDisplayPct] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [onskoneRevealed, setOnskoneRevealed] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const preparedBlobRef = useRef<Blob | null>(null);
  const showToast = useToast();
  const { t, locale } = useLocale();

  // Pour chaque joueur, retrouver le round où il a été pilier (sa question)
  const roundByLeaderId = useMemo(() => {
    const map = new Map<string, IRound>();
    rounds.forEach(r => {
      const id = r.leader?.id;
      if (id && !map.has(id)) map.set(id, r);
    });
    return map;
  }, [rounds]);

  const playerNameById = useMemo(() => {
    const map = new Map<string, string>();
    leaderboard.forEach(e => map.set(e.player.id, e.player.name));
    return map;
  }, [leaderboard]);

  useEffect(() => {
    if (!lobbyCode) navigate('/');
  }, [lobbyCode, navigate]);

  useEffect(() => {
    const parsedPlayer = getCurrentPlayerFromStorage();
    if (parsedPlayer) setCurrentPlayer(parsedPlayer);

    // On ne prend en compte que la première réception : si un joueur quitte
    // ensuite, le serveur peut ré-émettre un gameEnded mis à jour, mais on veut
    // que le classement reste figé tel qu'affiché à la fin de la partie.
    const onGameEnded = (data: { leaderboard: LeaderboardEntry[]; rounds: IRound[] }) => {
      setLeaderboard(prev => (prev.length ? prev : data.leaderboard));
      setRounds(prev => (prev.length ? prev : data.rounds || []));
    };
    socket.on('gameEnded', onGameEnded);

    if (lobbyCode) {
      socket.emit('getGameResults', { lobbyCode: lobbyCode! });
    }

    return () => {
      socket.off('gameEnded', onGameEnded);
      if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [lobbyCode]);

  // % de connaissance d'équipe, aligné sur le scoring backend (voir computeTeamPct).
  const pct = useMemo(() => computeTeamPct(leaderboard, rounds), [leaderboard, rounds]);

  const verdict = useMemo(() => getVerdict(pct), [pct]);
  const verdictIdx = useMemo(() => getTierIndex(pct), [pct]);
  const verdictTexts = t.endGame.tiers[verdictIdx];
  // Sélection déterministe basée sur lobbyCode + pct + nb de rounds pour que
  // tous les clients de la même partie voient le même message.
  const verdictMessage = useMemo(() => {
    const seed = `${lobbyCode ?? ''}|${pct}|${rounds.length}`;
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    const idx = Math.abs(h) % verdictTexts.messages.length;
    return verdictTexts.messages[idx];
  }, [verdictTexts, lobbyCode, pct, rounds.length]);
  const liveVerdict = useMemo(() => {
    if (onskoneRevealed) return TIERS[ONSKONE_INDEX];
    const idx = Math.min(ONSKONE_INDEX - 1, getTierIndex(displayPct));
    return TIERS[idx];
  }, [displayPct, onskoneRevealed]);

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
      if (pct >= 100) {
        // Score parfait : ease-in-out cubique → démarrage lent, atterrissage doux sur 100.
        // Pas de dip : on finit franchement, le climax est gardé pour le pop d'Onskoné.
        const easeInOutCubic = (t: number) =>
          t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        return clamp(easeInOutCubic(progress) * 100);
      }
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
        timeoutsRef.current.push(setTimeout(() => setShowLeaderboard(true), 900));
        if (pct === 100) {
          timeoutsRef.current.push(setTimeout(() => setOnskoneRevealed(true), 600));
          timeoutsRef.current.push(setTimeout(() => setShowConfetti(true), 600));
          confettiTimeoutRef.current = setTimeout(() => setShowConfetti(false), 7600);
        } else if (pct > 80) {
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

  // Enregistre les stats joueur dès qu'on a leaderboard + rounds + currentPlayer.
  // Idempotent côté util (guard par lobbyCode), mais on garde un ref pour éviter
  // de relancer les toasts d'achievement en cas de re-render.
  const statsRecordedRef = useRef(false);
  useEffect(() => {
    if (statsRecordedRef.current) return;
    if (!lobbyCode || !currentPlayer || !leaderboard.length || !rounds.length) return;
    statsRecordedRef.current = true;

    const me = leaderboard.find(e => e.player.id === currentPlayer.id);
    const myScore = me?.score ?? 0;
    const myLeaderRounds = rounds.filter(r => r.leader?.id === currentPlayer.id);
    const roundsAsLeader = myLeaderRounds.length;
    const correctGuessesAsLeader = myLeaderRounds.reduce(
      (sum, r) => sum + (r.scores?.[currentPlayer.id] || 0),
      0
    );
    // Rang strict : 1er = pas d'autre joueur strictement au-dessus en score.
    const maxScore = leaderboard.reduce((m, e) => Math.max(m, e.score), 0);
    const finishRank = myScore === maxScore ? 1 : 2;

    const unlocked = recordGameEnd({
      lobbyCode,
      playerScore: myScore,
      teamPct: pct,
      roundsAsLeader,
      correctGuessesAsLeader,
      roundsPlayed: rounds.length,
      finishRank,
    });

    unlocked.forEach((ach, idx) => {
      timeoutsRef.current.push(setTimeout(() => {
        const meta = t.achievements[ach.id];
        showToast(t.endGame.toasts.achievementUnlocked(meta?.title ?? ach.id), 'achievement', 4500);
      }, 2000 + idx * 1200));
    });
  }, [lobbyCode, currentPlayer, leaderboard, rounds, pct, showToast, t]);

  const handleBackToLobby = () => {
    if (lobbyCode) navigate(`/lobby/${lobbyCode}`);
  };

  const handleBackToHome = () => {
    if (lobbyCode && currentPlayer) {
      socket.emit('leaveLobby', { lobbyCode, currentPlayerId: currentPlayer.id });
    }
    studioStorage.removeItem('currentPlayer');
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
      verdictTitle: verdictTexts.title,
      verdictMessage: verdictMessage,
      color: verdict.color,
      tierEmoji: verdict.emoji,
      topPlayers: leaderboard.slice(0, 3).map(e => ({
        name: e.player.name,
        score: e.score,
        avatarId: e.player.avatarId,
      })),
      texts: t.shareCard,
      locale,
    })
      .then(blob => { if (!cancelled) preparedBlobRef.current = blob; })
      .catch(err => console.error('buildShareCard failed', err));
    return () => { cancelled = true; };
  }, [revealed, leaderboard, pct, verdict, verdictTexts, verdictMessage, t, locale]);

  const handleShare = async () => {
    if (isSharing) return;
    const blob = preparedBlobRef.current;
    if (!blob) {
      showToast(t.endGame.toasts.imagePreparing, 'info');
      return;
    }
    const text = `${verdictTexts.title} - ${pct}% · ${verdictMessage}`;
    setIsSharing(true);
    try {
      const result = await shareBlob(blob, text);
      if (result === 'copied') showToast(t.endGame.toasts.imageCopied, 'success');
      else if (result === 'failed') showToast(t.endGame.toasts.shareUnsupported, 'warning');
    } catch (err) {
      console.error('Share failed', err);
      showToast(t.endGame.toasts.shareFailed, 'error');
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

  return (
    <div className="h-full p-3 md:p-6 relative overflow-hidden flex flex-col items-center justify-center safe-pt">
      {/* Logo desktop uniquement - positionné absolu pour ne pas perturber le centrage vertical.
          tablet: (pas md:) pour l'exclure des téléphones en paysage (largeur >768px mais hauteur basse). */}
      <div className="hidden tablet:flex absolute top-0 left-0 right-0 justify-center pointer-events-none z-20">
        <Logo size="small" />
      </div>
      <div
        className="pointer-events-none fixed inset-0 z-10 transition-opacity duration-1000"
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

      <div className="h-full max-h-[820px] desktop-short:max-h-none min-h-0 max-w-3xl mx-auto w-full overflow-y-auto overscroll-contain no-scrollbar relative z-20">
        <VerdictRing
          displayPct={displayPct}
          liveVerdict={liveVerdict}
          verdictMessage={verdictMessage}
          revealed={revealed}
          onskoneRevealed={onskoneRevealed}
          getTierIndex={getTierIndex}
        />

        <ShareSection
          revealed={revealed}
          isSharing={isSharing}
          onShare={handleShare}
          onPlayAgain={handleBackToLobby}
          onQuit={handleBackToHome}
        />

        <ScoreLeaderboard
          leaderboard={leaderboard}
          currentPlayer={currentPlayer}
          roundByLeaderId={roundByLeaderId}
          playerNameById={playerNameById}
          showLeaderboard={showLeaderboard}
        />
      </div>

      <div
        className={`shrink-0 relative z-20 w-full text-center pt-2 pb-2 text-white/60 text-[10px] md:text-xs safe-pb transition-all duration-500 ${showLeaderboard ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
      >
        <ReportTrigger variant="footer" label={t.endGame.reportLabel} />
      </div>

      <style>{`
        @keyframes fall {
          to { transform: translateY(100vh) rotate(360deg); }
        }
        .animate-fall {
          animation: fall linear infinite;
        }
        .popover-anim {
          transform-origin: bottom right;
          transition: opacity 200ms ease-out, transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .popover-anim[data-state="closed"] {
          opacity: 0;
          transform: scale(0.7) translateY(8px);
          pointer-events: none;
        }
        .popover-anim[data-state="open"] {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
        .popover-notch {
          position: absolute;
          right: 14px;
          bottom: -8px;
          width: 14px;
          height: 14px;
          background: white;
          border-right: 2.5px solid black;
          border-bottom: 2.5px solid black;
          transform: rotate(45deg);
          border-bottom-right-radius: 3px;
        }
      `}</style>
    </div>
  );
};

export default EndGame;
