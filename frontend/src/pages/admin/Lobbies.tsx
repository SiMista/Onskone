import { useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import type { AdminLobbySummary } from '@onskone/shared';
import { useAdminResource } from '../../hooks';
import { fetchAdminLobbies } from '../../utils/adminDataApi';
import { BADGE, EmptyState, LoadingState, PANEL, SearchField, Strip, badge } from './ui';

const LOBBIES_REFRESH_MS = 5000;

const PHASE_META: Record<AdminLobbySummary['phase'], { label: string; icon: string; pill: string; strip: string }> = {
  lobby: {
    label: 'En attente',
    icon: 'mdi:account-clock-outline',
    pill: 'bg-sky-400/10 border-sky-300/40 text-sky-100',
    strip: 'bg-sky-400',
  },
  playing: {
    label: 'En partie',
    icon: 'mdi:play-circle-outline',
    pill: 'bg-emerald-400/10 border-emerald-300/40 text-emerald-100',
    strip: 'bg-emerald-400',
  },
  ended: {
    label: 'Partie terminée',
    icon: 'mdi:flag-checkered',
    pill: 'bg-white/[0.05] border-white/15 text-white/60',
    strip: 'bg-white/30',
  },
};

const formatAge = (ms: number): string => {
  const diff = Math.max(0, Date.now() - ms);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'à l\'instant';
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
    parts.push(`${category} (${themes.length} thème${themes.length > 1 ? 's' : ''})`);
  }
  if (total === 0) return 'aucun deck choisi';
  return parts.slice(0, 3).join(' · ') + (parts.length > 3 ? ` +${parts.length - 3}` : '');
};

const LobbyCard = ({ lobby }: { lobby: AdminLobbySummary }) => {
  const phase = PHASE_META[lobby.phase];
  return (
    <div className={`relative overflow-hidden ${PANEL} p-3 pl-4`}>
      <Strip color={phase.strip} />
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[14px] font-bold tracking-[0.18em] text-white">{lobby.code}</span>
        <span className={`${BADGE} ${phase.pill}`}>
          <Icon icon={phase.icon} className="w-3.5 h-3.5" aria-hidden />
          {phase.label}
        </span>
        <span className={badge('neutral')}>
          {lobby.gameMode === 'remote' ? 'À distance' : 'Sur place'}
        </span>
        {lobby.guessMyAnswerMode && (
          <span className={badge('violet')}>
            Devine ma réponse
          </span>
        )}
        <span className="ml-auto text-[12px] text-white/55 whitespace-nowrap" title="Dernière activité dans le salon">
          {formatAge(lobby.lastActivity)}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2 text-[13px] text-white/60">
        <span>
          <span className="tabular-nums font-semibold text-white/85">{lobby.activePlayerCount}</span>
          {' '}connecté{lobby.activePlayerCount > 1 ? 's' : ''} sur{' '}
          <span className="tabular-nums font-semibold text-white/85">{lobby.playerCount}</span>
          {' '}joueur{lobby.playerCount > 1 ? 's' : ''}
        </span>
        {lobby.phase === 'playing' && lobby.currentRound !== null && (
          <>
            <span aria-hidden className="text-white/25">·</span>
            <span>
              Manche{' '}
              <span className="tabular-nums font-semibold text-white/85">
                {lobby.currentRound}{lobby.totalRounds ? `/${lobby.totalRounds}` : ''}
              </span>
            </span>
          </>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {lobby.players.map((p, i) => (
          <span
            key={`${p.name}-${i}`}
            className={`${BADGE} ${!p.isActive
              ? 'border-white/[0.06] bg-white/[0.02] text-white/50'
              : p.isHost
                ? 'border-amber-300/30 bg-amber-400/[0.08] text-amber-100/90'
                : 'border-white/15 bg-white/[0.04] text-white/80'
              }`}
            title={`${p.name} · ${p.isHost ? 'hôte, ' : ''}${p.isActive ? 'connecté' : 'déconnecté (garde sa place, peut revenir)'}`}
          >
            <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${p.isActive ? 'bg-emerald-400' : 'bg-white/25'}`} />
            {p.isHost && <Icon icon="mdi:crown" className="w-3 h-3 text-amber-300/90" aria-label="hôte" />}
            <span>{p.name}</span>
            {!p.isActive && <Icon icon="mdi:wifi-off" className="w-3 h-3 text-white/50" aria-label="déconnecté" />}
          </span>
        ))}
      </div>

      <div className="mt-2 text-[12px] text-white/60 truncate" title={summarizeDecks(lobby.selectedDecks)}>
        <span className="text-white/50">Decks : </span>{summarizeDecks(lobby.selectedDecks)}
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
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2">
        <SearchField value={search} onChange={setSearch} placeholder="Chercher un code de salon ou un pseudo" />

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`${badge('neutral')} tabular-nums`}>
            {stats.total} salon{stats.total > 1 ? 's' : ''} · {stats.playing} en partie · {stats.players} joueur{stats.players > 1 ? 's' : ''} connecté{stats.players > 1 ? 's' : ''}
          </span>

          <span className="text-[12px] text-white/50 whitespace-nowrap">
            {lastFetch ? `Mis à jour ${formatAge(lastFetch)}` : 'Chargement…'} · actualisation toutes les 5 s
          </span>
        </div>
      </div>

      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[12px] text-white/55">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Connecté</span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-white/25" />
          <Icon icon="mdi:wifi-off" className="w-3 h-3" aria-hidden />Déconnecté : garde sa place pendant une partie, retiré au bout de 30 s s'il attend dans le salon
        </span>
        <span className="inline-flex items-center gap-1.5"><Icon icon="mdi:crown" className="w-3 h-3 text-amber-300/90" aria-hidden />Hôte du salon</span>
      </div>

      {isLoading && lobbies.length === 0 ? (
        <LoadingState label="Chargement des salons…" />
      ) : filtered.length === 0 ? (
        lobbies.length === 0 ? (
          <EmptyState
            icon="mdi:sofa-outline"
            title="Aucun salon ouvert pour l'instant"
            hint="Les salons apparaissent ici dès qu'un joueur en crée un. La liste se met à jour toute seule."
          />
        ) : (
          <EmptyState
            icon="mdi:magnify"
            title="Aucun salon ne correspond à ta recherche"
            hint="Vérifie le code du salon (6 caractères) ou le pseudo."
          />
        )
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
