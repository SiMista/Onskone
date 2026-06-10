// Configuration pm2 du backend Onskoné.
// Le backend tourne via tsx (pas de build). dotenv charge backend/.env (cwd = backend/).
// Lancement : `pm2 start ecosystem.config.cjs` (depuis la racine du repo).
const path = require('path');
const backend = path.join(__dirname, 'backend');

module.exports = {
  apps: [
    {
      name: 'onskone',
      cwd: backend,
      // Binaire tsx du package backend (présent après `pnpm install`).
      script: path.join(backend, 'node_modules/.bin/tsx'),
      args: 'src/index.ts',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        // Les autres variables (PORT, ALLOWED_ORIGINS, ADMIN_PASSWORD,
        // ADMIN_TOKEN_SECRET, ...) viennent de backend/.env via dotenv.
      },
      autorestart: true,
      max_memory_restart: '400M',
      time: true,
    },
  ],
};
