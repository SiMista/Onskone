import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
// Source de verite UNIQUE de la version (partagee avec le build Android via scripts/release-aab).
import { getVersionName } from '../scripts/app-version.mjs'

export default defineConfig({
    // Base des assets :
    // - natif (Capacitor) : relatif './' obligatoire (page servie depuis le
    //   filesystem de l'app, pas la racine d'un domaine) ;
    // - web : absolu '/' obligatoire, sinon les routes a 2+ segments chargees a
    //   froid (ex /join/<code>, /lobby/<code>) resolvent les assets en relatif
    //   (/join/assets/...) -> 404 -> index.html -> erreur MIME module script.
    // Les scripts de build mobile posent CAPACITOR_BUILD=1 (cf release-aab / build-mobile / codemagic).
    base: process.env.CAPACITOR_BUILD ? './' : '/',
    define: {
        __APP_VERSION__: JSON.stringify(getVersionName()),
    },
    plugins: [
        react(),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    server: {
        port: 3000,
        open: true,
    },
    build: {
        outDir: 'build',
        commonjsOptions: {
            include: [/@onskone\/shared/, /node_modules/],
        },
    },
    optimizeDeps: {
        include: ['@onskone/shared'],
    },
})