// Origines des apps natives Capacitor : toujours autorisées (web ET prod).
// Android sert la page depuis https://localhost, iOS depuis capacitor://localhost.
// Sert aussi au gate de version pour reconnaître une app native (cf. versionGate.ts).
export const CAPACITOR_ORIGINS = ['capacitor://localhost', 'https://localhost'];

export const isNativeAppOrigin = (origin: string | undefined): boolean =>
  !!origin && CAPACITOR_ORIGINS.includes(origin);
