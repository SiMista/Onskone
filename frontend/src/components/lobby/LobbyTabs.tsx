import { GAME_CONFIG } from '../../constants/game';
import type { Dictionary } from '../../i18n/dictionary';

export type LobbyTabId = 'settings' | 'players';

interface LobbyTabsProps {
  activeTab: LobbyTabId;
  onTabChange: (tab: LobbyTabId) => void;
  activePlayersCount: number;
  t: Dictionary;
}

/**
 * Onglets du lobby : intercalaires cartonnés en éventail, coins asymétriques.
 * Onglet "settings" (warning) à gauche, "players" (brand, avec compteur) à droite.
 */
const LobbyTabs = ({ activeTab, onTabChange, activePlayersCount, t }: LobbyTabsProps) => {
  const tabs = [
    {
      id: 'settings' as const,
      color: 'var(--color-warning-500)',
      label: t.lobby.tabs.settings,
      badge: null,
      outer: 'left' as const,
    },
    {
      id: 'players' as const,
      color: 'var(--color-brand-500)',
      label: t.lobby.tabs.players,
      badge: `${activePlayersCount}/${GAME_CONFIG.MAX_PLAYERS}`,
      outer: 'right' as const,
    },
  ];

  return (
    <div className="shrink-0 flex gap-1 md:gap-1.5 -mb-[2.5px] relative z-10 px-1">
      {tabs.map(tab => {
        const active = activeTab === tab.id;
        // Coin "extérieur" généreusement arrondi (bord du panel),
        // coin "intérieur" (entre les deux tabs) légèrement biseauté.
        const radiusClasses = tab.outer === 'left'
          ? 'rounded-tl-[22px] rounded-tr-md'
          : 'rounded-tr-[22px] rounded-tl-md';
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 relative inline-flex items-center justify-center gap-2 px-3 md:px-4 pt-2 md:pt-2.5 pb-3 md:pb-3.5 bg-white ${radiusClasses} border-[2.5px] border-b-0 border-black cursor-pointer transition-all duration-200 origin-bottom overflow-hidden
            ${active
                ? 'shadow-[3px_-3px_0_0_rgba(0,0,0,0.18)] z-20'
                : 'translate-y-1 hover:translate-y-0 z-10 opacity-90 hover:opacity-100'}
          `}
          >
            {/* Bande accent inférieure colorée - plus haute si actif */}
            <span
              className={`absolute left-0 right-0 bottom-0 pointer-events-none transition-[height] duration-200 ${active ? 'h-2 md:h-2.5' : 'h-1.5'}`}
              style={{ backgroundColor: tab.color }}
              aria-hidden
            />

            <span
              className={`relative font-display font-bold tracking-[0.08em] uppercase text-sm md:text-base ${active ? 'text-black' : 'text-gray-600'
                }`}
            >
              {tab.label}
            </span>

            {tab.badge && (
              <span
                className={`relative shrink-0 font-display text-[11px] md:text-xs font-bold tabular-nums whitespace-nowrap bg-white/80 rounded-full px-2 py-0.5 border border-black/15 ${active ? 'text-black/85' : 'text-black/60'
                  }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default LobbyTabs;
