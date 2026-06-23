import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { useToast } from '../../components/Toast';
import { Ticket, TicketStatus, TicketType, fetchTickets } from '../../utils/ticketsApi';
import { fetchAdminLobbies } from '../../utils/adminDataApi';
import { AdminTab, TABS, GROUP_ORDER } from './shared';
import { MobileBottomNav } from './MobileNav';
import { OverviewPanel } from './Overview';
import { TicketsPanel } from './Tickets';
import { LobbiesPanel } from './Lobbies';
import { DecksPanel } from './Decks';
import { ContentPanel } from './Content';
import { StatsPanel } from './Stats';
import { VersionGateButton } from './VersionGateButton';

const LOBBY_COUNT_POLL_MS = 5000;

export const Dashboard = ({ onLogout }: { onLogout: () => void }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [lobbyCount, setLobbyCount] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
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
      if (lobbiesData) setLobbyCount(lobbiesData.length);
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

  // Compteur de salons live affiché dans le masthead (poll 5s, silencieux).
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await fetchAdminLobbies();
        if (!cancelled) setLobbyCount(data.length);
      } catch { /* silent */ }
    };
    tick();
    const id = setInterval(tick, LOBBY_COUNT_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Pastille : ne compte que les tickets non résolus.
  const openTicketCount = tickets.filter((t) => t.status !== 'resolved').length;

  const jumpToTickets = useCallback((status?: TicketStatus, type?: TicketType) => {
    setJumpFilter({ status, type });
    setActiveTab('tickets');
  }, []);

  return (
    <div
      className="min-h-screen text-white relative"
      style={{
        background:
          'radial-gradient(1200px 600px at 20% -10%, rgba(255,199,0,0.06), transparent 60%),' +
          'radial-gradient(900px 500px at 100% 0%, rgba(125,211,240,0.05), transparent 55%),' +
          'linear-gradient(180deg, #12151e 0%, #161a24 100%)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.18]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse at top, black 30%, transparent 75%)',
        }}
      />

      {/* Sticky header - masthead éditorial */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#12151e]/85 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-5 pb-2 sm:pb-3">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-[15px] leading-none">▍</span>
            <span className="font-mono text-[13px] sm:text-[14px] text-white/85 lowercase tracking-tight leading-none">
              onskoné
            </span>
            <span className="font-mono text-[13px] sm:text-[14px] text-white/25 leading-none">/</span>
            <span className="font-mono text-[13px] sm:text-[14px] font-bold text-amber-200 uppercase tracking-[0.12em] leading-none">
              admin
            </span>

            <span className="ml-2 sm:ml-3">
              <VersionGateButton />
            </span>

            <button
              onClick={() => setActiveTab('lobbies')}
              className={`ml-auto hidden md:flex cursor-pointer items-center gap-2 px-2.5 py-1 rounded-md border transition-colors font-mono text-[10px] uppercase tracking-[0.22em] ${activeTab === 'lobbies'
                ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-100'
                : 'border-emerald-400/25 bg-emerald-500/[0.04] text-emerald-200 hover:bg-emerald-500/10 hover:border-emerald-400/50'
                }`}
              title="Voir les salons live"
            >
              <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-emerald-400 text-[9px] font-bold leading-none text-[#0a0c12] tabular-nums animate-pulse">
                {lobbyCount ?? 0}
              </span>
              voir salons live
            </button>

            <button
              onClick={load}
              disabled={isLoading}
              className="cursor-pointer ml-auto md:ml-2 w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded-md text-white/45 hover:text-white hover:bg-white/[0.05] transition-colors"
              title="Rafraîchir"
              aria-label="Rafraîchir"
            >
              <Icon icon="mdi:refresh" className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onLogout}
              className="cursor-pointer w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded-md text-white/45 hover:text-white hover:bg-white/[0.05] transition-colors"
              title="Déconnexion"
              aria-label="Déconnexion"
            >
              <Icon icon="mdi:logout" className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="hidden md:block max-w-7xl mx-auto px-6 border-t border-white/[0.06]">
          <div className="flex items-stretch">
            {GROUP_ORDER.map((group) => {
              const groupTabs = TABS.filter((t) => t.group === group && t.id !== 'lobbies');
              if (groupTabs.length === 0) return null;
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
                        className={`relative px-3 lg:px-5 py-2.5 lg:py-3 flex items-center gap-1.5 whitespace-nowrap text-[11px] lg:text-[12px] font-mono font-bold uppercase tracking-[0.08em] lg:tracking-[0.12em] transition-colors ${active
                          ? 'text-white'
                          : 'text-white/40 hover:text-white/75'
                          }`}
                      >
                        {tab.icon && <Icon icon={tab.icon} className="w-4 h-4" />}
                        {tab.label && <span>{tab.label}</span>}
                        {tab.id === 'tickets' && openTicketCount > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-amber-400 text-[9px] font-bold leading-none text-[#0a0c12] tabular-nums">
                            {openTicketCount}
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
        {activeTab === 'lobbies' && (
          <LobbiesPanel active={activeTab === 'lobbies'} refreshKey={refreshKey} />
        )}
        {activeTab === 'decks' && (
          <DecksPanel active={activeTab === 'decks'} />
        )}
        {activeTab === 'content' && (
          <ContentPanel />
        )}
        {activeTab === 'stats' && (
          <StatsPanel />
        )}
      </main>

      <MobileBottomNav activeTab={activeTab} setActiveTab={setActiveTab} lobbyCount={lobbyCount} ticketCount={openTicketCount} />

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
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
        .admin-mini-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 3px;
          background: rgba(255,255,255,0.08);
          border-radius: 999px;
          outline: none;
        }
        .admin-mini-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.55);
          border: none;
          transition: background 0.15s;
        }
        .admin-mini-slider:hover::-webkit-slider-thumb {
          background: rgba(251,191,36,0.9);
        }
        .admin-mini-slider::-moz-range-thumb {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.55);
          border: none;
        }
        .admin-mini-slider:hover::-moz-range-thumb {
          background: rgba(251,191,36,0.9);
        }
        .admin-mini-slider::-moz-range-track {
          height: 3px;
          background: rgba(255,255,255,0.08);
          border-radius: 999px;
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
        @media (prefers-reduced-motion: reduce) {
          .admin-progress-bar { animation: none !important; }
        }
      `}</style>
    </div>
  );
};
