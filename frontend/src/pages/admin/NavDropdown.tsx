import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { AdminTab, NAV_MENUS, TabGroup, tabsOfGroup } from './shared';
import { FLOATING } from './ui';

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
        className={`cursor-pointer relative px-3 lg:px-4 py-3 flex items-center gap-1.5 whitespace-nowrap text-[13px] lg:text-[14px] font-semibold transition-colors ${active || open ? 'text-white' : 'text-white/55 hover:text-white/85'}`}
      >
        <Icon icon={menu.icon} className="w-4 h-4" />
        <span>{menu.label}</span>
        <Icon icon="mdi:chevron-down" className={`w-4 h-4 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`} />
        {dangerActive && <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" title="Restriction active" />}
        {active && <span className="absolute left-0 right-0 bottom-[-1px] h-[2px] bg-amber-400" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className={`absolute left-0 top-full mt-1 z-50 min-w-[300px] ${FLOATING} p-1.5 animate-fade-in`}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="menuitem"
                onClick={() => { setActiveTab(tab.id); setOpen(false); }}
                className={`cursor-pointer w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors ${activeTab === tab.id
                  ? 'bg-amber-400/10 text-amber-100'
                  : 'text-white/70 hover:bg-white/[0.05] hover:text-white'
                  }`}
              >
                {tab.icon && <Icon icon={tab.icon} className={`w-5 h-5 mt-0.5 shrink-0 ${tab.id === 'danger' ? 'text-rose-300' : ''}`} />}
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold">{tab.label}</span>
                  <span className="block text-[12px] text-white/55">{tab.hint}</span>
                </span>
                {tab.id === 'danger' && dangerActive && (
                  <span className="shrink-0 mt-1 inline-flex items-center gap-1.5 text-[12px] font-medium text-rose-200">
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" aria-hidden />
                    Actif
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
