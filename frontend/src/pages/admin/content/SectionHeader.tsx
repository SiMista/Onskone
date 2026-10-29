import { SectionLabel } from '../ui';

export const SectionHeader = ({ title, hint }: { title: string; hint?: string }) => (
  <SectionLabel right={hint ? <span className="text-[12px] text-white/55">{hint}</span> : undefined}>
    {title}
  </SectionLabel>
);
