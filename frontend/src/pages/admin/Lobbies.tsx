import { useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import type { AdminLobbySummary } from '@onskone/shared';
import { useAdminResource } from '../../hooks';
import { fetchAdminLobbies } from '../../utils/adminDataApi';
import { CLUSTER } from './shared';

const LOBBIES_REFRESH_MS = 5000;

const PHASE_META: Record<AdminLobbySummary['phase'], { label: string; pill: string; dot: string }> = {
  lobby: {
    label: 'Salon',
    pill: 'bg-sky-400/10 border-sky-300/40 text-sky-100',
    dot: 'bg-sky-400',
  },
  playing: {
    label: 'En partie',
    pill: 'bg-emerald-400/10 border-emerald-300/40 text-emerald-100',
    dot: 'bg-emerald-400 animate-pulse',
  },
  ended: {
    label: 'Terminé',
    pill: 'bg-white/[0.05] border-white/15 text-white/60',
    dot: 'bg-white/40',
  },
};

const formatAge = (ms: number): string => {
  const diff = Math.max(0, Date.now() - ms);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'maintenant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `il y a ${d}j`;
};

const summarizeDecks = (selectedDecks: AdminLobbySummary['selectedDecks']): string => {
  const parts: string[] = [];
  let total = 0;
  for (const [category, themes] of Object.entries(selectedDecks)) {
    if (!themes || themes.length === 0) continue;
    total += themes.length;
    parts.push(`${category} (${themes.length})`);
  }
  if (total === 0) return 'aucun deck';
  return parts.slice(0, 3).join(' · ') + (parts.length > 3 ? ` +${parts.length - 3}` : '');
};

const LobbyCard = ({ lobby }: { lobby: AdminLobbySummary }) => {
  const phase = PHASE_META[lobby.phase];
  return (
    <div className="relative rounded-lg surface-glass surface-glass-hover transition-colors p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[15px] font-bold tracking-[0.18em] text-white">{lobby.code}</span>
        <span className={`px-1.5 py-0.5 rounded border font-mono text-[11px] uppercase tracking-wider ${phase.pill}`}>
          {phase.label}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-white/40">
          {lobby.gameMode === 'remote' ? 'à distance' : 'local'}
        </span>
        {lobby.guessMyAnswerMode && (
          <span className="px-1.5 py-0.5 rounded border border-violet-300/40 bg-violet-400/[0.08] text-violet-100 font-mono text-[11px] uppercase tracking-wider">
            devine ma réponse
          </span>
        )}
        <span className="ml-auto font-mono text-[11px] text-white/40 whitespace-nowrap">
          {formatAge(lobby.lastActivity)}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2 text-[12px]">
        <span className="font-mono text-[11px] uppercase tracking-wider text-white/35">joueurs</span>
        <span className="font-mono tabular-nums text-white/75">
          {lobby.activePlayerCount}/{lobby.playerCount}
        </span>
        {lobby.phase === 'playing' && lobby.currentRound !== null && (
          <>
            <span className="text-white/15">·</span>
            <span className="font-mono text-[11px] uppercase tracking-wider text-white/35">round</span>
            <span className="font-mono tabular-nums text-white/75">
              {lobby.currentRound}{lobby.totalRounds ? `/${lobby.totalRounds}` : ''}
            </span>
          </>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {lobby.players.map((p, i) => (
          <span
            key={`${p.name}-${i}`}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono text-[11px] ${!p.isActive
              ? 'border-white/[0.06] bg-white/[0.02] text-white/30 line-through'
              : p.isHost
                ? 'border-amber-300/30 bg-amber-400/[0.08] text-amber-100/90'
                : 'border-white/15 bg-white/[0.04] text-white/80'
              }`}
            title={p.isActive ? (p.isHost ? 'hôte' : 'actif') : 'déconnecté'}
          >
            {p.isHost && <Icon icon="mdi:crown" className="w-3 h-3 text-amber-300/90" />}
            <span>{p.name}</span>
          </span>
        ))}
      </div>

      <div className="mt-2 font-mono text-[11px] text-white/40 truncate" title={summarizeDecks(lobby.selectedDecks)}>
        <span className="text-white/25">decks </span>{summarizeDecks(lobby.selectedDecks)}
      </div>
    </div>
  );
};

export const LobbiesPanel = ({ active, refreshKey }: { active: boolean; refreshKey: number }) => {
  const { data, isLoading, lastFetch } = useAdminResource<AdminLobbySummary[]>({
    fetcher: fetchAdminLobbies,
    active,
    refreshMs: LOBBIES_REFRESH_MS,
    refreshKey,
  });
  const lobbies = useMemo(() => data ?? [], [data]);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lobbies;
    return lobbies.filter((l) =>
      l.code.toLowerCase().includes(q) ||
      l.players.some((p) => p.name.toLowerCase().includes(q))
    );
  }, [lobbies, search]);

  const stats = useMemo(() => {
    const playing = lobbies.filter((l) => l.phase === 'playing').length;
    const players = lobbies.reduce((acc, l) => acc + l.activePlayerCount, 0);
    return { total: lobbies.length, playing, players };
  }, [lobbies]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2 md:gap-2.5">
        <div className={`${CLUSTER} w-full md:flex-1 md:min-w-[200px] md:max-w-md`}>
          <Icon icon="mdi:magnify" className="w-4 h-4 text-white/35 ml-0.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="rechercher par code ou pseudo"
            className="flex-1 min-w-0 bg-transparent border-0 outline-0 text-[12px] text-white/85 placeholder:text-white/25 font-mono"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-white/30 hover:text-white text-[12px] px-1"
            >×</button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className={CLUSTER}>
            <span className="font-mono text-[11px] uppercase tracking-wider text-white/40 px-1 whitespace-nowrap">
              {stats.total} salon{stats.total > 1 ? 's' : ''} · {stats.playing} en partie · {stats.players} joueurs
            </span>
          </div>

          <span className="font-mono text-[11px] text-white/30 whitespace-nowrap">
            {lastFetch ? `maj ${formatAge(lastFetch)}` : '…'} · refresh 5s
          </span>
        </div>
      </div>

      {isLoading && lobbies.length === 0 ? (
        <div className="text-center py-20 font-mono text-[11px] uppercase tracking-[0.3em] text-white/30">
          chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/30">
            {lobbies.length === 0 ? 'aucun lobby actif' : 'aucun résultat'}
          </p>
          {lobbies.length === 0 && (
            <p className="text-[12px] text-white/40">Les salons apparaissent ici dès qu'un joueur en crée un.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((lobby) => (
            <LobbyCard key={lobby.code} lobby={lobby} />
          ))}
        </div>
      )}
    </div>
  );
};
