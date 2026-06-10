/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/tests/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  // Backend imports use explicit .js extensions (NodeNext/ESM). ts-jest runs in CJS,
  // so map "./x.js" -> "./x" and resolve @onskone/shared from its TS source.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@onskone/shared$': '<rootDir>/../shared/src/index.ts',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        isolatedModules: true,
        tsconfig: {
          module: 'CommonJS',
          moduleResolution: 'node',
          esModuleInterop: true,
          allowJs: true,
          composite: false,
          verbatimModuleSyntax: false,
        },
      },
    ],
  },
};
