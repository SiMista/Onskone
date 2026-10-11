// Source de verite UNIQUE de la version de l'app (web + Android).
//
// Schema actuel (sans tags git, robuste aux reecritures d'historique) :
//   MAJOR.MINOR  = contenu du fichier `VERSION` a la racine du repo (ex: "1.3"), tel
//                  que COMMITE dans HEAD (pas le working tree : la version est une
//                  fonction du commit ; un bump non commite donnait sinon "1.4.32",
//                  puis "1.4.0" une fois commite -> regression).
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
// EXIGE l'historique git COMPLET : PATCH et versionCode COMPTENT des commits. Sur un
// clone superficiel (--depth), le commit frontiere passe pour un commit racine qui
// "ajoute" VERSION -> PATCH = 0 et versionCode = 1, EN SILENCE (c'est ce qui figeait
// le VPS en "1.3.0"). Dans ce cas (ou sans git / sans VERSION commite), on LEVE une
// erreur claire plutot que d'annoncer une fausse version. Remede : `git fetch --unshallow`.
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
import { dirname, join } from 'node:path'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

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

// "1.3" / "v1.3" -> { major: '1', minor: '3' }, lu dans HEAD. raw = '' si VERSION
// absent de HEAD (jamais commite) ou illisible.
export const readMarketingVersion = () => {
  const raw = git('show HEAD:VERSION')
  const [major = '0', minor = '0'] = raw.replace(/^v/, '').split('.')
  return { major: major || '0', minor: minor || '0', raw }
}

// Garde-fou : leve si l'historique ne permet pas de compter les commits de facon fiable.
// `--is-shallow-repository` repond "true"/"false" dans un depot, rien hors depot / sans git.
export const assertFullHistory = () => {
  const shallow = git('rev-parse --is-shallow-repository')
  if (shallow === 'true') {
    throw new Error('[app-version] clone git superficiel (shallow) : version incalculable. Lance `git fetch --unshallow` avant de builder.')
  }
  if (shallow !== 'false') {
    throw new Error('[app-version] depot git illisible (git absent ou pas un clone) : version incalculable.')
  }
}

// ---------------------------------------------------------------------------
// Schema de version (LE seul endroit a editer pour changer le format)
// ---------------------------------------------------------------------------

const buildVersionName = () => {
  assertFullHistory()
  const { major, minor, raw } = readMarketingVersion()
  if (!raw) throw new Error('[app-version] fichier VERSION absent de HEAD (jamais commite) ou vide.')
  // PATCH = commits depuis le bump de VERSION.
  const bump = getVersionBumpCommit()
  if (!bump) throw new Error('[app-version] fichier VERSION jamais commite : commit-le avant de builder.')
  return `${major}.${minor}.${getCommitsSince(bump)}`
}

// Le Play Store exige un entier strictement croissant : 1 minimum.
const buildVersionCode = () => {
  assertFullHistory()
  return getTotalCommits() || 1
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

export const getVersionName = () => buildVersionName()
export const getVersionCode = () => buildVersionCode()

// Objet complet (debug / affichage / CI).
export const getVersionInfo = () => {
  // En premier : valide le contexte git (leve sinon) avant de lire le reste.
  const versionName = getVersionName()
  return {
    marketingVersion: readMarketingVersion().raw,
    commitsSinceBump: getCommitsSince(getVersionBumpCommit()),
    totalCommits: getTotalCommits(),
    versionName,
    versionCode: getVersionCode(),
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Erreur -> message lisible sur stderr + code 1 (les `$(...)` sous `set -e` s'arretent).
  try {
    const arg = process.argv[2]
    if (arg === '--code') console.log(getVersionCode())
    else if (arg === '--json') console.log(JSON.stringify(getVersionInfo()))
    else console.log(getVersionName())
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}
