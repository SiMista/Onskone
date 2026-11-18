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
import howToStep1CardLeft from '../assets/images/home/how-to-play/1-card-left.png';
import howToStep1CardCenter from '../assets/images/home/how-to-play/1-card-center.png';
import howToStep1CardRight from '../assets/images/home/how-to-play/1-card-right.png';
import howToStep2Cloud from '../assets/images/home/how-to-play/2-thought-cloud.png';
import howToStep2BubbleM from '../assets/images/home/how-to-play/2-thought-bubble-m.png';
import howToStep2BubbleS from '../assets/images/home/how-to-play/2-thought-bubble-s.png';
import howToStep2PilierHands from '../assets/images/home/how-to-play/2-pilier-hands.png';
import howToStep3Qmark from '../assets/images/home/how-to-play/3-qmark.png';
import howToStep3PhoneLeft from '../assets/images/home/how-to-play/3-phone-left.png';
import howToStep3PhoneRight from '../assets/images/home/how-to-play/3-phone-right.png';
import howToStep3ScreenLeft from '../assets/images/home/how-to-play/3-screen-left.png';
import howToStep3ScreenRight from '../assets/images/home/how-to-play/3-screen-right.png';
import howToStep4PhoneLeft from '../assets/images/home/how-to-play/4-phone-left.png';
import howToStep4PhoneRight from '../assets/images/home/how-to-play/4-phone-right.png';
import howToStep4ScreenAnswer from '../assets/images/home/how-to-play/4-screen-answer.png';
import howToStep4ScreenAuthor from '../assets/images/home/how-to-play/4-screen-author.png';
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
  howToStep1CardLeft,
  howToStep1CardCenter,
  howToStep1CardRight,
  howToStep2Cloud,
  howToStep2BubbleM,
  howToStep2BubbleS,
  howToStep2PilierHands,
  howToStep3Qmark,
  howToStep3PhoneLeft,
  howToStep3PhoneRight,
  howToStep3ScreenLeft,
  howToStep3ScreenRight,
  howToStep4PhoneLeft,
  howToStep4PhoneRight,
  howToStep4ScreenAnswer,
  howToStep4ScreenAuthor,
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
