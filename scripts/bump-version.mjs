// Monte le numéro de release store (fichier `VERSION`, X.Y.Z). À lancer UNE fois par
// nouvelle version publiée (store ou hotfix), pas à chaque commit : le build, lui, monte
// tout seul (nb de commits). Cf. scripts/app-version.mjs.
//
//   pnpm bump            -> patch  (1.3.24 -> 1.3.25)
//   pnpm bump minor      -> minor  (1.3.24 -> 1.4.0)
//   pnpm bump major      -> major  (1.3.24 -> 2.0.0)
//   pnpm bump 1.5.2      -> valeur explicite (doit être > à l'actuelle)
//
// Ne commit rien : édite seulement VERSION et te dit quoi faire ensuite.
// (release-aab pose la question et commit/push lui-même : cf. release-version-prompt.mjs.)
import { readVersionFile, writeVersionFile, nextVersion } from './version-file.mjs'

try {
  const current = readVersionFile()
  const next = nextVersion(current, process.argv[2] ?? 'patch')
  writeVersionFile(next)
  console.log(`Version ${current} -> ${next}`)
  console.log(`Ensuite : git add VERSION && git commit -m "Release ${next}"`)
} catch (err) {
  console.error(`[bump-version] ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
}
