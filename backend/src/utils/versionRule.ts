import { CLIENT_VERSION_POLICY, isOlderVersion, shouldBlockForUpdate } from '@onskone/shared';

// Le client applique-t-il la règle lui-même ? (handshake.auth.versionPolicy, cf. front
// socket.ts). Accepte le nombre comme la chaîne selon la sérialisation du transport
// (même logique que readHandshakePremium).
export const announcesClientPolicy = (auth: Record<string, unknown> | undefined): boolean => {
  const v = auth?.versionPolicy;
  return v === CLIENT_VERSION_POLICY || v === String(CLIENT_VERSION_POLICY);
};

// Décision du SERVEUR pour un client qui n'applique pas la règle lui-même (build
// antérieure à la vérification store, cf. CLIENT_VERSION_POLICY). Même règle que le
// client (shouldBlockForUpdate), mais le serveur ne bloque que là où il peut PROUVER
// qu'une version plus récente est obtenable :
//   - web : un rechargement sert la version déployée -> obtenable si on est en dessous ;
//   - app native : impossible de savoir ce que propose SON store (review, rollout,
//     hotfix d'une seule plateforme...) -> jamais bloquée, plutôt que bloquée sans issue.
// Module pur (sans DB ni socket) : testé dans tests/versionRule.test.ts.
export const shouldBlockLegacyClient = ({
  appVersion,
  minVersion,
  deployedVersion,
  isNativeApp,
}: {
  appVersion: string;
  minVersion: string;
  deployedVersion: string;
  isNativeApp: boolean;
}): boolean =>
  !isNativeApp && shouldBlockForUpdate(appVersion, minVersion, isOlderVersion(appVersion, deployedVersion));
