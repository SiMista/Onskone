// Source de verite UNIQUE de la version de l'app (web + Android).
//
// Schema actuel (sans tags git, robuste aux reecritures d'historique) :
//   MAJOR.MINOR  = contenu du fichier `VERSION` a la racine du repo (ex: "1.3").
//                  -> source EXPLICITE et versionnee. Pour bumper : edite VERSION
//                     et commit. C'est le SEUL geste a faire pour passer 1.3 -> 1.4.
//   PATCH        = nb de commits depuis le dernier commit qui a modifie `VERSION`.
//                  -> se remet a 0 automatiquement au bump, et ne depend d'aucun tag
//                     (donc insensible aux amend/force-push/tags orphelins).
//   versionName  = MAJOR.MINOR.PATCH        (ex: "1.3.0", "1.3.7")
//   versionCode  = nb total de commits       (entier toujours croissant, exige par le Play Store)
//
// Pourquoi pas les tags : `git describe` ne voit que les tags ATTEIGNABLES depuis
// HEAD ; un force-push qui orphelinne le commit tague faisait regresser la version
// en silence (1.3 -> 1.2.x). Le fichier VERSION supprime cette dependance.
//
// Pour CHANGER le schema : touche uniquement buildVersionName() / buildVersionCode().
// Les briques git en dessous sont neutres et reutilisables.
//
// Consomme par : frontend/vite.config.ts (import { getVersionName }) et
// scripts/release-aab.* (injecte -PappVersionName / -PappVersionCode dans gradlew).
// build.gradle garde un fallback git autonome (meme logique) pour Android Studio.
//
// CLI : `node scripts/app-version.mjs`        -> versionName
//       `node scripts/app-version.mjs --code` -> versionCode
//       `node scripts/app-version.mjs --json` -> {"marketingVersion","commitsSinceBump","totalCommits","versionName","versionCode"}
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const VERSION_FILE = join(REPO_ROOT, 'VERSION')

// ---------------------------------------------------------------------------
// Briques git (neutres : ne connaissent rien du schema de version)
// Toutes lancees depuis REPO_ROOT -> resultat independant du cwd de l'appelant
// (vite tourne depuis frontend/, la CI depuis la racine, etc.).
// ---------------------------------------------------------------------------

// Sortie git nettoyee, ou '' si la commande echoue (stderr masque). Aucune exception ne fuit.
const git = (cmd) => {
  try {
    return execSync(`git ${cmd}`, { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}

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

// Dernier commit ayant modifie le fichier VERSION (= dernier bump). '' si introuvable
// (fichier pas encore commite, ou clone shallow sans cet historique).
export const getVersionBumpCommit = () => git('log -1 --format=%H -- VERSION')

// "1.3" / "v1.3" -> { major: '1', minor: '3' }. Defaut 0.0 si fichier absent/illisible.
export const readMarketingVersion = () => {
  let raw = ''
  try {
    raw = readFileSync(VERSION_FILE, 'utf8').trim()
  } catch {
    raw = ''
  }
  const [major = '0', minor = '0'] = raw.replace(/^v/, '').split('.')
  return { major: major || '0', minor: minor || '0', raw }
}

// ---------------------------------------------------------------------------
// Schema de version (LE seul endroit a editer pour changer le format)
// ---------------------------------------------------------------------------

const buildVersionName = () => {
  const { major, minor } = readMarketingVersion()
  // PATCH = commits depuis le bump de VERSION ; fallback total commits si le bump
  // est introuvable (garde une valeur deterministe et croissante, jamais de crash).
  const bump = getVersionBumpCommit()
  const patch = bump ? getCommitsSince(bump) : getTotalCommits()
  return `${major}.${minor}.${patch}`
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
  const { raw } = readMarketingVersion()
  const bump = getVersionBumpCommit()
  return {
    marketingVersion: raw || null,
    commitsSinceBump: bump ? getCommitsSince(bump) : getTotalCommits(),
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
