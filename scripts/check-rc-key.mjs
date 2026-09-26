// Garde-fou de build : vérifie que la clé API publique RevenueCat de la plateforme
// sera bien injectée dans le bundle front (import.meta.env, cf utils/premium.ts).
//
// Sans elle, le build passe, l'app s'installe, le paywall s'affiche… et le SDK
// n'est jamais configuré : « L'achat n'a pas pu aboutir » / « Impossible de
// restaurer » sur CHAQUE bouton, sans aucun indice côté utilisateur. Mieux vaut
// faire échouer le build tout de suite.
//
// Résolution identique à Vite en mode production : variable d'environnement
// d'abord, puis frontend/.env.production.local > .env.local > .env.production > .env.
//
// CLI : node scripts/check-rc-key.mjs android|ios
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PLATFORMS = {
  android: { name: 'VITE_RC_GOOGLE_KEY', prefix: 'goog_', label: 'Google Play' },
  ios: { name: 'VITE_RC_APPLE_KEY', prefix: 'appl_', label: 'App Store' },
}

const platform = process.argv[2]
const spec = PLATFORMS[platform]
if (!spec) {
  console.error(`[rc-key] usage : node scripts/check-rc-key.mjs ${Object.keys(PLATFORMS).join('|')}`)
  process.exit(2)
}

const frontendDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend')
// Ordre de PRIORITÉ décroissante (le premier qui définit la variable gagne).
const envFiles = ['.env.production.local', '.env.local', '.env.production', '.env']

const readFromFile = (file) => {
  const path = join(frontendDir, file)
  if (!existsSync(path)) return undefined
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(new RegExp(`^\\s*${spec.name}\\s*=\\s*(.*)\\s*$`))
    if (m) return m[1].replace(/^["']|["']$/g, '').trim()
  }
  return undefined
}

let value = process.env[spec.name]?.trim()
let source = value ? 'variable d\'environnement' : undefined
if (!value) {
  for (const file of envFiles) {
    const v = readFromFile(file)
    if (v) { value = v; source = `frontend/${file}`; break }
  }
}

if (!value) {
  console.error(`
[rc-key] ERREUR : ${spec.name} est vide. Build annulé.
         Sans cette clé, les achats ${spec.label} sont morts dans l'app
         (« L'achat n'a pas pu aboutir » sur chaque bouton).

         Où la trouver : RevenueCat > Project settings > Apps > app ${spec.label}
         > clé API publique (commence par "${spec.prefix}").

         Build local : crée frontend/.env.production.local (ignoré par git) avec
             ${spec.name}=${spec.prefix}xxxxxxxxxxxxxxxx
         Codemagic   : ajoute ${spec.name} dans le groupe de variables importé
                       par le workflow (cf "groups:" dans codemagic.yaml).
`)
  process.exit(1)
}

if (!value.startsWith(spec.prefix)) {
  console.error(`
[rc-key] ERREUR : ${spec.name} (source : ${source}) ne commence pas par "${spec.prefix}".
         C'est probablement la clé de l'autre plateforme, ou une clé secrète.
         Il faut la clé API PUBLIQUE de l'app ${spec.label} dans RevenueCat.
`)
  process.exit(1)
}

console.log(`[rc-key]   ${spec.name} OK (${spec.prefix}…${value.slice(-4)}, source : ${source})`)
