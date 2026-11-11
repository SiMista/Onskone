import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useLocale } from '../i18n';
import { useToast } from './Toast';
import { onPoorConnection } from '../utils/connectionQuality';

// Outillage : pas de toast joueur.
const EXEMPT_PREFIXES = ['/admin', '/studio'];

/** Toast « ta connexion est instable » quand utils/connectionQuality le décide. */
const ConnectionWarning = () => {
  const { t } = useLocale();
  const showToast = useToast();
  const { pathname } = useLocation();
  const pathRef = useRef(pathname);
  useEffect(() => { pathRef.current = pathname; }, [pathname]);

  useEffect(() => onPoorConnection(() => {
    if (EXEMPT_PREFIXES.some(p => pathRef.current.startsWith(p))) return;
    showToast(t.maintenance.unstableToast, 'warning', 5000);
  }), [showToast, t]);

  return null;
};

export default ConnectionWarning;
