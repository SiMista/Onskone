/// <reference types="vite/client" />

/** Numéro de release store (fichier VERSION, X.Y.Z) : le seul comparé par la maj forcée. */
declare const __APP_VERSION__: string;
/** Build = nb de commits : pour l'affichage et le support, jamais comparé. */
declare const __APP_BUILD__: string;