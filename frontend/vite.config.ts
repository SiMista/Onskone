import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'

const getAppVersion = () => {
    try {
        const count = execSync('git rev-list --count HEAD').toString().trim()
        return `1.0.${count}`
    } catch {
        return '1.0.0'
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