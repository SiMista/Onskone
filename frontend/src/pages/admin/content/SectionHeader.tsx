export const SectionHeader = ({ title, hint, count }: { title: string; hint?: string; count?: number }) => (
  <div className="flex items-baseline gap-2.5 mb-3">
    <h2 className="text-[18px] font-semibold tracking-tight text-white">{title}</h2>
    {typeof count === 'number' && (
      <span className="font-mono text-[11px] tabular-nums text-white/40 px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/10">
        {count}
      </span>
    )}
    {hint && (
      <span className="text-[12px] text-white/35 ml-auto italic">
        {hint}
      </span>
    )}
  </div>
);
