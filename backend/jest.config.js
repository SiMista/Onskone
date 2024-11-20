module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: '',  // Assurez-vous que Jest utilise le dossier backend comme racine
    transform: {
      '^.+\\.(ts|tsx)$': 'ts-jest',  // Utiliser ts-jest pour transformer les fichiers TypeScript
    },
    testMatch: [
      '**/tests/**/*.test.ts',  // Spécifie où Jest doit chercher les fichiers de test
      '**/?(*.)+(spec|test).ts'
    ],
  };
  