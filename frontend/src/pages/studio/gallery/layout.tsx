// Primitives de mise en page partagées par les sections de la galerie de composants.
// Palette sombre du dev tooling (isolée, hors design system) — cf. CLAUDE.md.

export const Section = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.03] to-white/[0.01] p-5">
    <header className="mb-4 flex items-baseline justify-between gap-3 border-b border-white/[0.05] pb-2.5">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-amber-200/90">{title}</h2>
      {subtitle && <span className="font-mono text-[10px] text-white/35">{subtitle}</span>}
    </header>
    {children}
  </section>
);

export const Tile = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-2.5">
    <span className="font-mono text-[10px] uppercase tracking-wider text-white/35">{label}</span>
    <div className="rounded-xl border border-white/[0.06] bg-[#1a1d28] p-4 flex items-center justify-center min-h-[90px]">
      {children}
    </div>
  </div>
);

export const CompactTile = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <span className="font-mono text-[9px] uppercase tracking-wider text-white/35 truncate">{label}</span>
    <div className="rounded-lg border border-white/[0.06] bg-[#1a1d28] px-2 py-2 flex items-center justify-center min-h-[52px]">
      {children}
    </div>
  </div>
);
