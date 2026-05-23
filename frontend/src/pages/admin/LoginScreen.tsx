import { useState } from 'react';
import { adminLogin, setAdminToken } from '../../utils/ticketsApi';
import { INPUT_CLS } from './shared';

export const LoginScreen = ({ onSuccess }: { onSuccess: () => void }) => {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = await adminLogin(password);
      setAdminToken(token);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen text-white flex items-center justify-center px-4 relative"
      style={{
        background:
          'radial-gradient(800px 500px at 50% 10%, rgba(255,199,0,0.06), transparent 60%),' +
          'radial-gradient(700px 500px at 80% 90%, rgba(125,211,240,0.05), transparent 55%),' +
          'linear-gradient(180deg, #12151e 0%, #161a24 100%)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.18]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-xl p-6 space-y-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-[15px] leading-none">▍</span>
          <span className="font-mono text-[14px] text-white/85 lowercase tracking-tight leading-none">onskoné</span>
          <span className="font-mono text-[14px] text-white/25 leading-none">/</span>
          <span className="font-mono text-[14px] font-bold text-amber-200 uppercase tracking-[0.12em] leading-none">admin</span>
        </div>

        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/35">
            authentification requise
          </p>
          <h1 className="text-[22px] font-semibold tracking-tight leading-tight">
            Salle de contrôle
          </h1>
          <p className="text-[12px] text-white/45 font-mono">
            Accès réservé à l'équipe Onskoné.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block font-mono text-[11px] uppercase tracking-wider text-white/40">
            Mot de passe
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoFocus
            className={`${INPUT_CLS} w-full`}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-red-500/10 border border-red-400/30">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <p className="font-mono text-[11px] text-red-200">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={!password || isLoading}
          className="w-full px-5 py-2 rounded-md font-mono text-[11px] font-bold uppercase tracking-wider bg-gradient-to-br from-amber-300 to-amber-500 text-black shadow-[0_2px_0_0_rgba(0,0,0,0.4),0_0_20px_rgba(251,191,36,0.35)] hover:shadow-[0_2px_0_0_rgba(0,0,0,0.4),0_0_28px_rgba(251,191,36,0.55)] hover:-translate-y-px active:translate-y-0 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          {isLoading ? '…' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
};
