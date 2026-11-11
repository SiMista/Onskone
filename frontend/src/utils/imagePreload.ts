/**
 * Précharge (téléchargement + décodage) les images embarquées affichées « plus tard » :
 * tuto « Comment jouer ? », overlay de la devinette, stickman du reveal, logos (autre
 * langue, image de partage). Sans ça, chaque image ne partait qu'à l'ouverture de son
 * écran et apparaissait en retard, en pleine animation (2 Mo de PNG pour le tuto).
 *
 * Lancé une fois l'appli chargée, quand le navigateur souffle, pour ne pas ralentir le
 * démarrage. Toute image importée par l'appli doit figurer ici (garde-fou :
 * imagePreload.test.ts). Pendant d'iconPreload.ts pour les emojis.
 */
import howToStep1 from '../assets/images/home/1-question_selection.png';
import howToStep2 from '../assets/images/home/2-answering.png';
import howToStep3 from '../assets/images/home/3-guessing.png';
import howToStep4 from '../assets/images/home/4-reveal.png';
import pilierChoosing from '../assets/images/home/questionselection-pilier_choisit.png';
import stickmanShowPhone from '../assets/images/game/stickman-show-phone-cropped.png';
import logoSloganFr from '../assets/logos/logo-slogan-fr.png';
import logoSloganEn from '../assets/logos/logo-slogan-en.png';
import logoFr from '../assets/logos/logo-fr.png';
import logoEn from '../assets/logos/logo-en.png';
import bgQuestionMarks from '../assets/images/bg-question-marks.svg';

// Ordre = priorité : le tuto (ouvrable dès l'accueil), puis ce qui sert en partie, puis le reste.
const PRELOADED_IMAGES: string[] = [
  howToStep1,
  howToStep2,
  howToStep3,
  howToStep4,
  pilierChoosing,
  stickmanShowPhone,
  logoSloganFr,
  logoSloganEn,
  logoFr,
  logoEn,
  bgQuestionMarks,
];

// Références gardées : une image vivante et décodée reste dans le cache mémoire du navigateur.
const kept: HTMLImageElement[] = [];

const preloadAll = (): void => {
  for (const src of PRELOADED_IMAGES) {
    const img = new Image();
    img.src = src;
    // decode() : prête à peindre dès son affichage (pas de frame vide). Échec sans conséquence :
    // l'image se rechargera normalement à l'affichage.
    img.decode?.().catch(() => {});
    kept.push(img);
  }
};

// requestIdleCallback absent sur Safari / WKWebView (iOS) : petit délai à la place.
const whenIdle = (fn: () => void): void => {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(fn, { timeout: 2000 });
  else window.setTimeout(fn, 300);
};

if (typeof window !== 'undefined') {
  if (document.readyState === 'complete') whenIdle(preloadAll);
  else window.addEventListener('load', () => whenIdle(preloadAll), { once: true });
}
