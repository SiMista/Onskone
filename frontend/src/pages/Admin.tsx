import { useEffect, useState } from 'react';
import { checkAdminAuth, clearAdminToken } from '../utils/ticketsApi';
import { LoginScreen } from './admin/LoginScreen';
import { Dashboard } from './admin/Dashboard';

const Admin = () => {
  const [isAuth, setIsAuth] = useState<boolean | null>(null);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Onskoné - Admin';
    return () => { document.title = prev; };
  }, []);

  useEffect(() => {
    checkAdminAuth().then(setIsAuth);
  }, []);

  const logout = () => {
    clearAdminToken();
    setIsAuth(false);
  };

  if (isAuth === null) {
    return (
      <div
        className="min-h-screen flex items-center justify-center font-mono text-[11px] uppercase tracking-[0.3em] text-white/40"
        style={{ background: 'linear-gradient(180deg, #12151e 0%, #161a24 100%)' }}
      >
        <span className="w-2 h-2 rounded-full bg-amber-400/70 animate-pulse mr-2" />
        chargement…
      </div>
    );
  }
  if (!isAuth) return <LoginScreen onSuccess={() => setIsAuth(true)} />;
  return <Dashboard onLogout={logout} />;
};

export default Admin;
