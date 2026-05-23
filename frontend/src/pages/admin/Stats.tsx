export const StatsPanel = () => (
  <div className="space-y-4">
    <div className="relative rounded-xl surface-glass p-6 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 11px, rgba(255,255,255,0.5) 11px 12px)',
          maskImage: 'linear-gradient(180deg, black 0%, transparent 90%)',
        }}
      />
      <div className="relative">
        <div className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-sky-200/80 border border-sky-300/40 bg-sky-500/[0.08] rounded px-1.5 py-0.5 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
          analytics
        </div>
        <h2 className="text-[22px] font-semibold tracking-tight text-white mb-1">Trafic & visiteurs</h2>
        <p className="text-[13px] text-white/55 max-w-xl mb-5">
          Le trafic, les visiteurs uniques et les sources sont suivis via Umami (privacy-friendly, sans cookie).
        </p>
        <a
          href="https://stats.onskone.fr/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-mono text-[12px] font-bold uppercase tracking-wider bg-gradient-to-br from-sky-300 to-sky-500 text-black shadow-[0_2px_0_0_rgba(0,0,0,0.4),0_0_20px_rgba(125,211,240,0.35)] hover:shadow-[0_2px_0_0_rgba(0,0,0,0.4),0_0_28px_rgba(125,211,240,0.55)] hover:-translate-y-px active:translate-y-0 transition-all"
        >
          → Ouvrir le dashboard Umami
        </a>
      </div>
    </div>

    <div className="rounded-lg surface-glass p-5">
      <div className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-amber-200/80 border border-amber-300/40 bg-amber-500/[0.08] rounded px-1.5 py-0.5 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        bientôt
      </div>
      <p className="text-[13px] text-white/55 max-w-xl">
        Les stats de jeu (parties terminées, durée moyenne, top decks, taux de complétion) arriveront ici plus tard, persistées côté serveur.
      </p>
    </div>
  </div>
);
