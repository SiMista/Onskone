import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { AdminTab, MOBILE_TAB_META, MOBILE_TAB_ORDER, NAV_MENUS, NAV_MENU_ORDER, TabGroup, tabsOfGroup } from './shared';
import { FLOATING, iconBtn } from './ui';

export const MobileBottomNav = ({
  activeTab, setActiveTab, lobbyCount, ticketCount, dangerActive,
}: {
  activeTab: AdminTab;
  setActiveTab: (t: AdminTab) => void;
  lobbyCount: number | null;
  ticketCount: number;
  // Maintenance ou mise à jour obligatoire en cours : pastille rouge sur le slot Système.
  dangerActive: boolean;
}) => {
  const [openMenu, setOpenMenu] = useState<TabGroup | null>(null);

  useEffect(() => {
    if (!openMenu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenMenu(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openMenu]);

  return (
    <>
      <nav
        aria-label="Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl bg-[#0d1018]/92 border-t border-white/10"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-6">
          {MOBILE_TAB_ORDER.map((id) => {
            const meta = MOBILE_TAB_META[id];
            const active = activeTab === id;
            const showLive = id === 'lobbies' && (lobbyCount ?? 0) > 0;
            const showTickets = id === 'tickets' && ticketCount > 0;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                aria-label={meta.label}
                className={`relative min-h-[56px] flex flex-col items-center justify-center gap-1 py-2 px-0.5 transition-colors ${active ? 'text-amber-300' : 'text-white/65 active:text-white'
                  }`}
              >
                <span className="relative">
                  <Icon icon={meta.icon} className="w-[22px] h-[22px]" />
                  {showLive && (
                    <span className="absolute -top-1.5 -right-2.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-400 text-[11px] font-bold leading-none text-[#0a0c12] tabular-nums ring-1 ring-[#0d1018]">
                      {lobbyCount ?? 0}
                    </span>
                  )}
                  {showTickets && (
                    <span className="absolute -top-1.5 -right-2.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-[11px] font-bold leading-none text-[#0a0c12] tabular-nums ring-1 ring-[#0d1018]">
                      {ticketCount}
                    </span>
                  )}
                </span>
                <span className="text-[11px] font-medium leading-none">
                  {meta.label}
                </span>
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-[2px] bg-amber-400 rounded-b-full" />
                )}
              </button>
            );
          })}

          {NAV_MENU_ORDER.map((group) => {
            const menu = NAV_MENUS[group]!;
            const tabs = tabsOfGroup(group);
            const menuActive = tabs.some((t) => t.id === activeTab);
            const isOpen = openMenu === group;
            const showAlert = group === 'system' && dangerActive;
            return (
              <div key={group} className="relative">
                <button
                  onClick={() => setOpenMenu(isOpen ? null : group)}
                  aria-label={menu.label}
                  aria-haspopup="menu"
                  aria-expanded={isOpen}
                  className={`relative w-full h-full min-h-[56px] flex flex-col items-center justify-center gap-1 py-2 px-0.5 transition-colors ${menuActive || isOpen ? 'text-amber-300' : 'text-white/65 active:text-white'
                    }`}
                >
                  <span className="relative">
                    <Icon icon={menu.icon} className="w-[22px] h-[22px]" />
                    {showAlert && (
                      <span className="absolute -top-1 -right-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-1 ring-[#0d1018] animate-pulse" />
                    )}
                  </span>
                  <span className="text-[11px] font-medium leading-none flex items-center gap-0.5">
                    {menu.label}
                    <Icon icon="mdi:chevron-up" className={`w-2.5 h-2.5 opacity-70 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </span>
                  {menuActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-[2px] bg-amber-400 rounded-b-full" />
                  )}
                </button>

                {isOpen && (
                  // Menu ancré au slot (pas de fond assombri, pas de poignée) : un vrai dropdown.
                  <div
                    role="menu"
                    aria-label={menu.label}
                    className={`absolute bottom-full right-0 mb-2.5 z-50 w-[210px] ${FLOATING} p-1.5 animate-fade-in`}
                  >
                    {tabs.map(({ id }) => {
                      const meta = MOBILE_TAB_META[id];
                      const active = activeTab === id;
                      const isDanger = id === 'danger';
                      return (
                        <button
                          key={id}
                          role="menuitem"
                          onClick={() => { setActiveTab(id); setOpenMenu(null); }}
                          className={`w-full min-h-[48px] flex items-center gap-3 px-3 rounded-lg text-left transition-colors ${active
                            ? 'bg-amber-400/10 text-amber-100'
                            : 'text-white/80 active:bg-white/[0.08]'
                            }`}
                        >
                          <Icon icon={meta.icon} className={`w-5 h-5 ${isDanger ? 'text-rose-300' : ''}`} />
                          <span className="text-[14px] font-semibold">{meta.label}</span>
                          {isDanger && dangerActive && (
                            <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] font-medium text-rose-200">
                              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" aria-hidden />
                              Actif
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {/* Caret pointant le slot (centre du slot = 30px du bord droit) */}
                    <span aria-hidden className="absolute -bottom-[5px] right-[24px] w-2.5 h-2.5 rotate-45 bg-[#1f2433] border-r border-b border-white/10" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Capteur de clic extérieur, transparent (pas de scrim : ce n'est pas une modale). */}
      {openMenu && <div className="md:hidden fixed inset-0 z-30" onClick={() => setOpenMenu(null)} />}
    </>
  );
};

// Bottom sheet générique (mobile).
export const BottomSheet = ({
  open, onClose, title, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-0 left-0 right-0 rounded-t-xl border-t border-white/10 bg-[#1f2433] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_-20px_60px_-15px_rgba(0,0,0,0.8)] animate-sheet-up max-h-[85vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="pt-2.5 flex justify-center">
          <span className="w-10 h-1 rounded-full bg-white/15" />
        </div>
        <div className="px-4 pt-2 pb-3 flex items-center justify-between">
          <p className="text-[16px] font-semibold text-white">
            {title}
          </p>
          <button
            type="button"
            onClick={onClose}
            className={iconBtn()}
            aria-label="Fermer"
            title="Fermer"
          >
            <Icon icon="mdi:close" className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto custom-scroll px-4 pb-5 space-y-5">
          {children}
        </div>
      </div>
    </div>
  );
};
