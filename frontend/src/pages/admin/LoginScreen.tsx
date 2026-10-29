import { useState } from 'react';
import { adminLogin, setAdminToken } from '../../utils/ticketsApi';
import { INPUT_CLS } from './shared';
import { AdminBackdrop, AdminBrand, PAGE_BG, PANEL, btn } from './ui';

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
    <div className={`min-h-screen text-white flex items-center justify-center px-4 relative ${PAGE_BG}`}>
      <AdminBackdrop />

      <form
        onSubmit={handleSubmit}
        className={`relative w-full max-w-sm ${PANEL} p-6 space-y-5`}
      >
        <AdminBrand large />

        <div className="space-y-1">
          <h1 className="text-[22px] font-semibold tracking-tight leading-tight">
            Administration
          </h1>
          <p className="text-[13px] text-white/60">
            Accès réservé à l'équipe Onskoné. Entre le mot de passe admin pour continuer.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="admin-password" className="block text-[13px] font-medium text-white/70">
            Mot de passe
          </label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className={`${INPUT_CLS} w-full min-h-[44px]`}
          />
        </div>

        {error && (
          <div role="alert" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-400/40">
            <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-rose-400" />
            <p className="text-[13px] text-rose-100">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={!password || isLoading}
          className={`${btn('primary')} w-full`}
        >
          {isLoading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
};
