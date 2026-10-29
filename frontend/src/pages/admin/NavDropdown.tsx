import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { AdminTab, NAV_MENUS, TabGroup, tabsOfGroup } from './shared';

// Menu déroulant d'un groupe de la barre desktop (équivalent du bottom sheet mobile).
export const NavDropdown = ({
  group, activeTab, setActiveTab, dangerActive = false,
}: {
  group: TabGroup;
  activeTab: AdminTab;
  setActiveTab: (t: AdminTab) => void;
  // Pastille rouge d'alerte (menu Système uniquement).
  dangerActive?: boolean;
}) => {
  const menu = NAV_MENUS[group]!;
  const tabs = tabsOfGroup(group);
  const [open, setOpen] = useState(false);
  const active = tabs.some((t) => t.id === activeTab);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="relative flex items-stretch">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`relative px-3 lg:px-5 py-2.5 lg:py-3 flex items-center gap-1.5 whitespace-nowrap text-[11px] lg:text-[12px] font-mono font-bold uppercase tracking-[0.08em] lg:tracking-[0.12em] transition-colors ${active || open ? 'text-white' : 'text-white/40 hover:text-white/75'}`}
      >
        <Icon icon={menu.icon} className="w-4 h-4" />
        <span>{menu.label}</span>
        <Icon icon="mdi:chevron-down" className={`w-3 h-3 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
        {dangerActive && <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />}
        {active && <span className="absolute left-0 right-0 bottom-[-1px] h-[2px] bg-amber-400" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute left-0 top-full mt-1 z-50 min-w-[220px] rounded-xl border border-white/10 bg-[#161a24] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] p-1.5 animate-fade-in"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="menuitem"
                onClick={() => { setActiveTab(tab.id); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left font-mono text-[12px] uppercase tracking-[0.1em] transition-colors ${activeTab === tab.id
                  ? 'bg-amber-400/10 text-amber-100'
                  : 'text-white/70 hover:bg-white/[0.05] hover:text-white'
                  }`}
              >
                {tab.icon && <Icon icon={tab.icon} className={`w-4 h-4 ${tab.id === 'danger' ? 'text-rose-300' : ''}`} />}
                <span>{tab.label}</span>
                <span className="ml-auto text-[10px] normal-case tracking-normal text-white/30">{tab.hint}</span>
                {tab.id === 'danger' && dangerActive && <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
