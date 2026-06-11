import { Capacitor } from '@capacitor/core';

// Résumé lisible de l'appareil pour les tickets : le user-agent brut est
// illisible, on en extrait OS / navigateur / modèle en clair.

const detectOs = (ua: string): string => {
  let m;
  if ((m = ua.match(/Android (\d+(?:\.\d+)?)/))) return `Android ${m[1]}`;
  if (/iPhone|iPad|iPod/.test(ua)) {
    m = ua.match(/OS (\d+[_.]\d+)/);
    return `iOS ${m ? m[1].replace('_', '.') : ''}`.trim();
  }
  if ((m = ua.match(/Mac OS X (\d+[_.]\d+)/))) return `macOS ${m[1].replace('_', '.')}`;
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return '';
};

const detectBrowser = (ua: string): string => {
  let m;
  if ((m = ua.match(/Edg\/(\d+)/))) return `Edge ${m[1]}`;
  if ((m = ua.match(/OPR\/(\d+)/))) return `Opera ${m[1]}`;
  if ((m = ua.match(/SamsungBrowser\/(\d+)/))) return `Samsung Internet ${m[1]}`;
  if ((m = ua.match(/Firefox\/(\d+)/))) return `Firefox ${m[1]}`;
  if ((m = ua.match(/Chrome\/(\d+)/))) return `Chrome ${m[1]}`;
  if (/Safari/.test(ua) && (m = ua.match(/Version\/(\d+)/))) return `Safari ${m[1]}`;
  return '';
};

// Modèle d'appareil : userAgentData (Chromium Android) en priorité, sinon le
// token modèle de l'UA Android (`; Android 14; Pixel 7 Build/...`).
const detectModel = async (ua: string): Promise<string> => {
  try {
    const uaData = (navigator as unknown as {
      userAgentData?: { getHighEntropyValues: (h: string[]) => Promise<{ model?: string }> };
    }).userAgentData;
    if (uaData?.getHighEntropyValues) {
      const { model } = await uaData.getHighEntropyValues(['model']);
      if (model) return model;
    }
  } catch { /* non supporté */ }
  const m = ua.match(/Android [\d.]+; ([^;)]+?)(?: Build\/[^;)]*)?[);]/);
  return m ? m[1].trim() : '';
};

export async function buildDeviceSummary(): Promise<string> {
  const ua = navigator.userAgent;
  const parts: string[] = [];

  const platform = Capacitor.getPlatform();
  if (platform !== 'web') parts.push(`App native (${platform})`);

  const os = detectOs(ua);
  if (os) parts.push(os);

  const browser = detectBrowser(ua);
  if (browser) parts.push(browser);

  const model = await detectModel(ua);
  if (model) parts.push(model);

  return parts.join(' · ');
}
