import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.onskone.app',
  appName: 'Onskoné?',
  // Vite build (outDir 'build') : c'est ce dossier statique qui est embarqué.
  webDir: 'build',
  // En dev, `cap run android -l --host=<ip>` injecte l'URL du serveur Vite.
  // En build de prod, on ne sert PAS de serveur ici : l'app charge le bundle local.
  plugins: {
    SplashScreen: {
      // Splash AndroidX (icone sur fond, defini dans le theme). Le plugin garde le
      // splash a l'ecran jusqu'a SplashScreen.hide() (appele quand l'app est prete) ;
      // launchAutoHide + launchShowDuration servent de filet de securite. Le splash
      // est tenu le temps de la pub d'ouverture (3,5 s max, cf. utils/ads.ts) : le
      // filet doit rester au-dessus.
      launchAutoHide: true,
      launchShowDuration: 4000,
      backgroundColor: '#4aaad9',
    },
  },
};

export default config;
