// Briques partagées pour lire / calculer / écrire le numéro de release store (fichier
// `VERSION`, X.Y.Z). Utilisées par bump-version.mjs (CLI) et release-version-prompt.mjs
// (question posée par release-aab). Le calcul de la version de build est dans app-version.mjs.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const VERSION_FILE = join(REPO_ROOT, 'VERSION')
export const FORMAT = /^\d+\.\d+\.\d+$/

const parse = (v) => v.split('.').map(Number)

export const isGreater = (a, b) => {
  const [pa, pb] = [parse(a), parse(b)]
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] > pb[i]
  return false
}

/** Version du fichier VERSION (sans "v"). Lève si le format est invalide. */
export const readVersionFile = () => {
  const current = readFileSync(VERSION_FILE, 'utf8').trim().replace(/^v/, '')
  if (!FORMAT.test(current)) throw new Error(`VERSION actuelle invalide : "${current}" (attendu X.Y.Z).`)
  return current
}

export const writeVersionFile = (v) => writeFileSync(VERSION_FILE, `${v}\n`)

/**
 * Version suivante pour `arg` : patch | minor | major | X.Y.Z explicite.
 * Lève si l'argument est inconnu ou si le résultat n'est pas strictement supérieur.
 */
export const nextVersion = (current, arg) => {
  const [major, minor, patch] = parse(current)
  const explicit = arg.replace(/^v/, '')
  let next
  if (arg === 'patch') next = `${major}.${minor}.${patch + 1}`
  else if (arg === 'minor') next = `${major}.${minor + 1}.0`
  else if (arg === 'major') next = `${major + 1}.0.0`
  else if (FORMAT.test(explicit)) next = explicit
  else throw new Error(`Argument inconnu "${arg}" (patch | minor | major | X.Y.Z).`)
  if (!isGreater(next, current)) throw new Error(`${next} n'est pas supérieur à la version actuelle ${current}.`)
  return next
}
