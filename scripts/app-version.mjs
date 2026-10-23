// Source de verite UNIQUE de la version de l'app (web + Android + iOS).
//
// Deux numeros distincts, qui ne se melangent JAMAIS (comme dans les stores) :
//   versionName = contenu du fichier `VERSION` a la racine du repo (ex: "1.3.24"),
//                 tel que COMMITE dans HEAD (pas le working tree : la version est une
//                 fonction du commit). C'est le numero de RELEASE STORE : on le bumpe
//                 A LA MAIN (edite VERSION + commit) a chaque nouvelle version publiee.
//                 Seul numero compare par la maj forcee (plancher, shared/src/version.ts).
//   versionCode = nb total de commits (entier toujours croissant, exige par les stores ;
//                 sert aussi de "build" affiche dans A propos / tickets, jamais compare).
//
// EXIGE l'historique git COMPLET pour le versionCode : sur un clone superficiel
// (--depth) le compte de commits serait faux EN SILENCE. On LEVE alors une erreur
// claire plutot que d'annoncer un faux build. Remede : `git fetch --unshallow`.
//
// Pour CHANGER le schema : touche uniquement buildVersionName() / buildVersionCode().
//
// Consomme par : frontend/vite.config.ts (getVersionName / getVersionCode),
// backend/src/utils/appVersion.ts, scripts/release-aab.*, scripts/deploy.sh, codemagic.yaml
// (injectent -PappVersionName / -PappVersionCode, agvtool). build.gradle garde un
// fallback git autonome (meme logique) pour Android Studio.
//
// CLI : `node scripts/app-version.mjs`        -> versionName
//       `node scripts/app-version.mjs --code` -> versionCode
//       `node scripts/app-version.mjs --json` -> {"versionName","versionCode"}
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

// Nb total de commits sur HEAD. 0 si indisponible.
export const getTotalCommits = () => {
  const n = parseInt(git('rev-list --count HEAD'), 10)
  return Number.isFinite(n) ? n : 0
}

// Contenu du fichier VERSION tel que commite dans HEAD ('' si absent de HEAD / illisible).
export const readVersionFile = () => git('show HEAD:VERSION').replace(/^v/, '')

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
  const raw = readVersionFile()
  if (!raw) throw new Error('[app-version] fichier VERSION absent de HEAD (jamais commite) ou vide.')
  // X.Y.Z strict : un VERSION a 2 segments (ancien schema) ou mal forme ferait annoncer
  // une fausse version aux stores / a la maj forcee.
  if (!/^\d+\.\d+\.\d+$/.test(raw)) {
    throw new Error(`[app-version] VERSION doit etre au format X.Y.Z (ex: 1.3.24), trouve "${raw}".`)
  }
  return raw
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
export const getVersionInfo = () => ({
  versionName: getVersionName(),
  versionCode: getVersionCode(),
})

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
