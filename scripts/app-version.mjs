// Source de verite UNIQUE de la version de l'app (web + Android).
//
// Schema actuel :
//   versionName = MAJOR.MINOR du dernier tag SemVer + PATCH = commits depuis ce tag
//                 (ex: tag v1.2 + 11 commits -> "1.2.11")
//   versionCode = nb total de commits (entier toujours croissant, exige par le Play Store)
//
// Pour CHANGER le schema : touche uniquement buildVersionName() / buildVersionCode().
// Les briques git en dessous sont neutres et reutilisables.
//
// Consomme par : frontend/vite.config.ts (import { getVersionName }) et
// scripts/release-aab.* (injecte -PappVersionName / -PappVersionCode dans gradlew).
// build.gradle garde un fallback git autonome pour les builds Android Studio.
//
// CLI : `node scripts/app-version.mjs`        -> versionName
//       `node scripts/app-version.mjs --code` -> versionCode
//       `node scripts/app-version.mjs --json` -> {"tag","commitsSinceTag","totalCommits","versionName","versionCode"}
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Briques git (neutres : ne connaissent rien du schema de version)
// ---------------------------------------------------------------------------

// Sortie git nettoyee, ou '' si la commande echoue (stderr masque). Aucune exception ne fuit.
const git = (cmd) => {
  try {
    return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}

// Dernier tag SemVer accessible depuis HEAD, ex "v1.2". '' si aucun (repo neuf / clone shallow).
export const getLatestTag = () => git('describe --tags --abbrev=0')

// Nb de commits depuis `ref` jusqu'a HEAD. 0 si ref vide ou indisponible.
export const getCommitsSince = (ref) => {
  if (!ref) return 0
  const n = parseInt(git(`rev-list ${ref}..HEAD --count`), 10)
  return Number.isFinite(n) ? n : 0
}

// Nb total de commits sur HEAD. 0 si indisponible.
export const getTotalCommits = () => {
  const n = parseInt(git('rev-list --count HEAD'), 10)
  return Number.isFinite(n) ? n : 0
}

// "v1.2" -> { major: '1', minor: '2' }. Minor defaut '0' si le tag n'a pas de minor.
export const parseTag = (tag) => {
  const [major = '0', minor = '0'] = (tag || '').replace(/^v/, '').split('.')
  return { major: major || '0', minor: minor || '0' }
}

// ---------------------------------------------------------------------------
// Schema de version (LE seul endroit a editer pour changer le format)
// ---------------------------------------------------------------------------

const buildVersionName = () => {
  const tag = getLatestTag()
  if (tag) {
    const { major, minor } = parseTag(tag)
    return `${major}.${minor}.${getCommitsSince(tag)}`
  }
  // Pas de tag : 0.0.x signale explicitement une version non taggee.
  return `0.0.${getTotalCommits()}`
}

// Le Play Store exige un entier strictement croissant : 1 minimum.
const buildVersionCode = () => getTotalCommits() || 1

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

export const getVersionName = () => buildVersionName()
export const getVersionCode = () => buildVersionCode()

// Objet complet (debug / affichage / CI).
export const getVersionInfo = () => {
  const tag = getLatestTag()
  return {
    tag: tag || null,
    commitsSinceTag: getCommitsSince(tag),
    totalCommits: getTotalCommits(),
    versionName: getVersionName(),
    versionCode: getVersionCode(),
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2]
  if (arg === '--code') console.log(getVersionCode())
  else if (arg === '--json') console.log(JSON.stringify(getVersionInfo()))
  else console.log(getVersionName())
}
