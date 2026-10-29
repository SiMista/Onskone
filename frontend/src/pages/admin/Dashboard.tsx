import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import type { AdminLobbySummary, MaintenanceState } from '@onskone/shared';
import { useToast } from '../../components/Toast';
import { Ticket, TicketStatus, TicketType, fetchTickets } from '../../utils/ticketsApi';
import { fetchAdminLobbies, fetchMaintenance, fetchVersionGate, type VersionGateState } from '../../utils/adminDataApi';
import { AdminTab, TABS, GROUP_ORDER, NAV_MENUS } from './shared';
import { MobileBottomNav } from './MobileNav';
import { OverviewPanel } from './Overview';
import { TicketsPanel } from './Tickets';
import { LogsPanel } from './Logs';
import { LobbiesPanel } from './Lobbies';
import { DecksPanel } from './Decks';
import { ContentPanel } from './Content';
import { StatsPanel } from './Stats';
import { DangerPanel, RestrictionsBanner, activeRestrictions } from './Danger';
import { NavDropdown } from './NavDropdown';
import { AdminBackdrop, AdminBrand, PAGE_BG } from './ui';

const LOBBY_COUNT_POLL_MS = 5000;
// Maintenance / mise à jour obligatoire changent rarement, mais peuvent l'être depuis un autre appareil.
const DANGER_POLL_MS = 15000;

const countPlaying = (lobbies: AdminLobbySummary[]): number => lobbies.filter((l) => l.phase === 'playing').length;

export const Dashboard = ({ onLogout }: { onLogout: () => void }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [lobbyCount, setLobbyCount] = useState<number | null>(null);
  const [playingCount, setPlayingCount] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  // Restrictions temporaires (bandeau clignotant, pastille rouge sur Système, titre de l'onglet).
  const [maintenance, setMaintenance] = useState<MaintenanceState | null>(null);
  const [gate, setGate] = useState<VersionGateState | null>(null);
  // Filtres transférés au panel Tickets lors d'un jump depuis l'Overview.
  const [jumpFilter, setJumpFilter] = useState<{ status?: TicketStatus; type?: TicketType }>({});
  const showToast = useToast();
  const ranOnce = useRef(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setRefreshKey((k) => k + 1);
    // Délai plancher artificiel: laisse voir l'animation de la barre.
    const minDelay = new Promise((r) => setTimeout(r, 1000));
    try {
      const [ticketsData, lobbiesData] = await Promise.all([
        fetchTickets(),
        fetchAdminLobbies().catch(() => null),
        minDelay,
      ]);
      setTickets(ticketsData);
      if (lobbiesData) {
        setLobbyCount(lobbiesData.length);
        setPlayingCount(countPlaying(lobbiesData));
      }
    } catch (err) {
      await minDelay;
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
      if (err instanceof Error && err.message.includes('Session')) onLogout();
    } finally {
      setIsLoading(false);
    }
  }, [showToast, onLogout]);

  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;
    load();
  }, [load]);

  // Compteur de salons en direct affiché dans le masthead (poll 5s, silencieux).
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await fetchAdminLobbies();
        if (cancelled) return;
        setLobbyCount(data.length);
        setPlayingCount(countPlaying(data));
      } catch { /* silent */ }
    };
    tick();
    const id = setInterval(tick, LOBBY_COUNT_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const [m, g] = await Promise.all([
        fetchMaintenance().catch(() => null),
        fetchVersionGate().catch(() => null),
      ]);
      if (cancelled) return;
      if (m) setMaintenance(m);
      if (g) setGate(g);
    };
    tick();
    const id = setInterval(tick, DANGER_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const restrictions = activeRestrictions(maintenance, gate);
  const dangerActive = restrictions.length > 0;
  const restrictionsTitle = restrictions.join(' · ');

  // Titre de l'onglet du navigateur : la restriction se voit même avec l'admin en arrière-plan.
  useEffect(() => {
    if (!restrictionsTitle) return;
    const prev = document.title;
    document.title = `🔴 ${restrictionsTitle} | ${prev}`;
    return () => { document.title = prev; };
  }, [restrictionsTitle]);

  // Pastille : ne compte que les nouveaux tickets (ni « en cours », ni « pas de fix »).
  const newTicketCount = tickets.filter((t) => t.status === 'new').length;

  const jumpToTickets = useCallback((status?: TicketStatus, type?: TicketType) => {
    setJumpFilter({ status, type });
    setActiveTab('tickets');
  }, []);

  return (
    <div className={`min-h-screen text-white relative ${PAGE_BG}`}>
      <AdminBackdrop />

      {/* Header collant : logo du jeu + navigation */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#0d1018]/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4 pb-2 sm:pb-3">
          <div className="flex items-center gap-2">
            <AdminBrand />

            <button
              onClick={() => setActiveTab('lobbies')}
              className={`ml-auto hidden md:flex cursor-pointer items-center gap-2 px-3 min-h-[32px] rounded-lg border transition-colors text-[13px] font-medium ${activeTab === 'lobbies'
                ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-100'
                : 'border-emerald-400/25 bg-emerald-500/[0.04] text-emerald-200 hover:bg-emerald-500/10 hover:border-emerald-400/50'
                }`}
              title="Voir les salons ouverts en ce moment"
            >
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-400 text-[11px] font-bold leading-none text-[#0a0c12] tabular-nums">
                {lobbyCount ?? 0}
              </span>
              {lobbyCount === 1 ? 'salon en direct' : 'salons en direct'}
            </button>

            <button
              onClick={load}
              disabled={isLoading}
              className="cursor-pointer ml-auto md:ml-2 w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
              title="Rafraîchir les données"
              aria-label="Rafraîchir les données"
            >
              <Icon icon="mdi:refresh" className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onLogout}
              className="cursor-pointer w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
              title="Se déconnecter"
              aria-label="Se déconnecter"
            >
              <Icon icon="mdi:logout" className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="hidden md:block max-w-7xl mx-auto px-6 border-t border-white/[0.06]">
          <div className="flex items-stretch">
            {GROUP_ORDER.map((group) => {
              const groupTabs = TABS.filter((t) => t.group === group && t.id !== 'lobbies');
              if (groupTabs.length === 0) return null;
              if (NAV_MENUS[group]) {
                return (
                  <NavDropdown
                    key={group}
                    group={group}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    dangerActive={group === 'system' && dangerActive}
                  />
                );
              }
              return (
                <div key={group} className="flex items-stretch shrink-0">
                  {groupTabs.map((tab) => {
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        aria-label={tab.ariaLabel ?? tab.label}
                        title={tab.ariaLabel ?? tab.label}
                        className={`cursor-pointer relative px-3 lg:px-4 py-3 flex items-center gap-1.5 whitespace-nowrap text-[13px] lg:text-[14px] font-semibold transition-colors ${active
                          ? 'text-white'
                          : 'text-white/55 hover:text-white/85'
                          }`}
                      >
                        {tab.icon && <Icon icon={tab.icon} className="w-4 h-4" />}
                        {tab.label && <span>{tab.label}</span>}
                        {tab.id === 'tickets' && newTicketCount > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-[11px] font-bold leading-none text-[#0a0c12] tabular-nums" title="nouveaux tickets">
                            {newTicketCount}
                          </span>
                        )}
                        {!tab.enabled && (
                          <span className="w-1 h-1 rounded-full bg-amber-400/80" title="bientôt" />
                        )}
                        {active && (
                          <span className="absolute left-0 right-0 bottom-[-1px] h-[2px] bg-amber-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Pas sur la page Accès joueurs elle-même : son résumé dit déjà la même chose. */}
        {activeTab !== 'danger' && (
          <RestrictionsBanner maintenance={maintenance} gate={gate} onOpen={() => setActiveTab('danger')} />
        )}

        <div
          aria-hidden
          className={`absolute left-0 right-0 bottom-[-1px] h-[2px] overflow-hidden pointer-events-none transition-opacity duration-200 ${isLoading ? 'opacity-100' : 'opacity-0'}`}
        >
          <div className="admin-progress-track absolute inset-0" />
          <div className="admin-progress-bar absolute top-0 bottom-0" />
        </div>
      </div>

      <main className="relative max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24 md:pb-6">
        {activeTab === 'overview' && (
          <OverviewPanel tickets={tickets} onJumpToTickets={jumpToTickets} />
        )}
        {activeTab === 'tickets' && (
          <TicketsPanel
            tickets={tickets}
            isLoading={isLoading}
            onChangeTickets={setTickets}
            initialStatusFilter={jumpFilter.status}
            initialTypeFilter={jumpFilter.type}
          />
        )}
        {activeTab === 'logs' && (
          <LogsPanel active={activeTab === 'logs'} refreshKey={refreshKey} />
        )}
        {activeTab === 'lobbies' && (
          <LobbiesPanel active={activeTab === 'lobbies'} refreshKey={refreshKey} />
        )}
        {activeTab === 'stats' && (
          <StatsPanel active={activeTab === 'stats'} refreshKey={refreshKey} />
        )}
        {activeTab === 'decks' && <DecksPanel active />}
        {activeTab === 'content' && <ContentPanel />}
        {activeTab === 'danger' && (
          <DangerPanel
            playingCount={playingCount}
            onMaintenanceChange={setMaintenance}
            onGateChange={setGate}
          />
        )}
      </main>

      <MobileBottomNav activeTab={activeTab} setActiveTab={setActiveTab} lobbyCount={lobbyCount} ticketCount={newTicketCount} dangerActive={dangerActive} />

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        /* Champs de recherche : on a déjà notre bouton « Effacer », pas de croix native en double. */
        input[type="search"]::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; display: none; }
        @keyframes sheet-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-sheet-up { animation: sheet-up 0.22s cubic-bezier(0.2, 0.8, 0.2, 1); }
        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.08);
          border-radius: 3px;
        }
        .custom-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.18);
        }
        /* Slider du simulateur (Réglages de jeu) : grosse zone de prise (28px de haut,
           toute la hauteur est cliquable), rail 8px rempli jusqu'au curseur via la
           variable --fill posée par le composant, curseur 22px + anneau au focus clavier. */
        .admin-mini-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 28px;
          background: transparent;
          outline: none;
          cursor: pointer;
        }
        .admin-mini-slider::-webkit-slider-runnable-track {
          height: 8px;
          border-radius: 999px;
          background: linear-gradient(to right, rgba(251,191,36,0.85) var(--fill, 0%), rgba(255,255,255,0.1) var(--fill, 0%));
        }
        .admin-mini-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          margin-top: -7px;
          border-radius: 999px;
          background: #fff;
          border: 3px solid rgb(251,191,36);
          box-shadow: 0 1px 4px rgba(0,0,0,0.45);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .admin-mini-slider:hover::-webkit-slider-thumb,
        .admin-mini-slider:active::-webkit-slider-thumb {
          transform: scale(1.12);
        }
        .admin-mini-slider:focus-visible::-webkit-slider-thumb {
          box-shadow: 0 0 0 5px rgba(251,191,36,0.35), 0 1px 4px rgba(0,0,0,0.45);
        }
        .admin-mini-slider::-moz-range-track {
          height: 8px;
          border-radius: 999px;
          background: rgba(255,255,255,0.1);
        }
        .admin-mini-slider::-moz-range-progress {
          height: 8px;
          border-radius: 999px;
          background: rgba(251,191,36,0.85);
        }
        .admin-mini-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 999px;
          background: #fff;
          border: 3px solid rgb(251,191,36);
          box-shadow: 0 1px 4px rgba(0,0,0,0.45);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .admin-mini-slider:hover::-moz-range-thumb,
        .admin-mini-slider:active::-moz-range-thumb {
          transform: scale(1.12);
        }
        .admin-mini-slider:focus-visible::-moz-range-thumb {
          box-shadow: 0 0 0 5px rgba(251,191,36,0.35), 0 1px 4px rgba(0,0,0,0.45);
        }

        /* Fil de progression discret sous le masthead pendant le refresh */
        .admin-progress-track {
          background: rgba(255,255,255,0.04);
        }
        @keyframes admin-progress-slide {
          0%   { transform: translateX(-50%); }
          100% { transform: translateX(250%); }
        }
        .admin-progress-bar {
          width: 30%;
          background: linear-gradient(90deg, transparent, rgba(251,191,36,0.55), transparent);
          animation: admin-progress-slide 1200ms ease-in-out infinite;
        }
        /* Bandeau des restrictions temporaires : clignote pour ne pas oublier de les lever. */
        @keyframes admin-alert-blink {
          0%, 100% { background-color: rgba(244,63,94,0.14); }
          50%      { background-color: rgba(244,63,94,0.34); }
        }
        .admin-alert-blink { animation: admin-alert-blink 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .admin-progress-bar { animation: none !important; }
          .admin-alert-blink { animation: none; background-color: rgba(244,63,94,0.24); }
        }
      `}</style>
    </div>
  );
};
