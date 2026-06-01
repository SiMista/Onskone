import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'

// Version dérivée des git tags : MAJOR.MINOR depuis le dernier tag (ex `v1.2`),
// PATCH = nombre de commits depuis ce tag.
const getAppVersion = () => {
    try {
        // dernier tag SemVer (ex: v1.1.0), on en garde MAJOR.MINOR
        const tag = execSync('git describe --tags --abbrev=0').toString().trim()
        const [major, minor] = tag.replace(/^v/, '').split('.')
        // le PATCH = nb de commits depuis le tag (reset à chaque nouveau tag)
        const count = execSync(`git rev-list ${tag}..HEAD --count`).toString().trim()
        return `${major}.${minor}.${count}`
    } catch {
        // pas de tag trouvé (ex: clone shallow) : 0.0.x signale une version non taggée
        const count = execSync('git rev-list --count HEAD').toString().trim()
        return `0.0.${count}`
    }
}

export default defineConfig({
    define: {
        __APP_VERSION__: JSON.stringify(getAppVersion()),
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