export const StatTile = ({
  label, value, hint, accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent: 'amber' | 'sky' | 'violet' | 'emerald' | 'red' | 'white';
}) => {
  const textColor: Record<typeof accent, string> = {
    amber: 'text-amber-300',
    sky: 'text-sky-300',
    violet: 'text-violet-300',
    emerald: 'text-emerald-300',
    red: 'text-red-300',
    white: 'text-white',
  };
  return (
    <div className="rounded-lg surface-glass p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className={`mt-1.5 text-3xl font-semibold tracking-tight tabular-nums ${textColor[accent]}`}>
        {value}
      </p>
      {hint && <p className="mt-1 font-mono text-[11px] text-white/35">{hint}</p>}
    </div>
  );
};
