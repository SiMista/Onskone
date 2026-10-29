import { useEffect, useState } from 'react';
import { checkAdminAuth, clearAdminToken } from '../utils/ticketsApi';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { LoginScreen } from './admin/LoginScreen';
import { Dashboard } from './admin/Dashboard';

const Admin = () => {
  const [isAuth, setIsAuth] = useState<boolean | null>(null);

  useDocumentMeta({ title: 'Onskoné - Admin', robots: 'noindex, nofollow' });

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
        role="status"
        className="min-h-screen flex items-center justify-center text-[13px] text-white/60 bg-[#0d1018]"
      >
        <span className="w-2 h-2 rounded-full bg-amber-400/70 animate-pulse mr-2" />
        Chargement…
      </div>
    );
  }
  if (!isAuth) return <LoginScreen onSuccess={() => setIsAuth(true)} />;
  return <Dashboard onLogout={logout} />;
};

export default Admin;
