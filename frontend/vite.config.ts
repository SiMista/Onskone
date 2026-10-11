import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
// Source de verite UNIQUE de la version (partagee avec le build Android via scripts/release-aab).
import { getVersionName } from '../scripts/app-version.mjs'

// Build : version incalculable (clone shallow, pas de git...) -> echec bruyant, on ne
// livre jamais une fausse version. Dev : repli, pour pouvoir coder sans git.
const resolveAppVersion = (command: 'build' | 'serve'): string => {
    if (command === 'build') return getVersionName()
    try {
        return getVersionName()
    } catch (err) {
        console.warn(`[vite] ${err instanceof Error ? err.message : String(err)} -> version "0.0.0-dev"`)
        return '0.0.0-dev'
    }
}

// /version.json = version du bundle SERVI (meme valeur que __APP_VERSION__). Lu par le
// client web avant de se declarer bloque (ce qu'un rechargement lui donnerait, cf.
// src/utils/versionGate.ts) et par le backend comme "version deployee" (cf.
// backend/src/utils/appVersion.ts). Build : fichier emis ; dev : middleware.
const versionJson = (version: string): Plugin => ({
    name: 'onskone-version-json',
    configureServer(server) {
        server.middlewares.use('/version.json', (_req, res) => {
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'no-store')
            res.end(JSON.stringify({ version }))
        })
    },
    generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) })
    },
})

export default defineConfig(({ command }) => {
    const appVersion = resolveAppVersion(command)
    return {
        // Base des assets :
        // - natif (Capacitor) : relatif './' obligatoire (page servie depuis le
        //   filesystem de l'app, pas la racine d'un domaine) ;
        // - web : absolu '/' obligatoire, sinon les routes a 2+ segments chargees a
        //   froid (ex /join/<code>, /lobby/<code>) resolvent les assets en relatif
        //   (/join/assets/...) -> 404 -> index.html -> erreur MIME module script.
        // Les scripts de build mobile posent CAPACITOR_BUILD=1 (cf release-aab / build-mobile / codemagic).
        base: process.env.CAPACITOR_BUILD ? './' : '/',
        define: {
            __APP_VERSION__: JSON.stringify(appVersion),
        },
        plugins: [
            react(),
            tailwindcss(),
            versionJson(appVersion),
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
    }
})