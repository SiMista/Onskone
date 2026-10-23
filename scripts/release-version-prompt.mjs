// Question posée par release-aab.* avant de builder : quelle version store publier ?
// Affiche la VERSION actuelle puis laisse choisir :
//   Entrée        garder la version actuelle
//   p / m / M     monter patch / minor / major
//   X.Y.Z         saisir une version précise
// Si elle change : écrit VERSION, puis (après confirmation) commit + push, car la
// version est lue dans HEAD et Codemagic (iOS) build depuis origin.
// Sans terminal interactif (CI, pipe) : ne pose aucune question, garde la version.
import { createInterface } from 'node:readline/promises'
import { execFileSync } from 'node:child_process'
import { readVersionFile, writeVersionFile, nextVersion, REPO_ROOT } from './version-file.mjs'

const git = (...args) => execFileSync('git', args, { cwd: REPO_ROOT, stdio: 'inherit' })

if (!process.stdin.isTTY) process.exit(0)

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = async (q) => (await rl.question(q)).trim()

try {
  const current = readVersionFile()
  console.log('')
  console.log(`Version actuelle : ${current}`)
  console.log(`  [Entrée] garder ${current}`)
  console.log(`  [p] patch -> ${nextVersion(current, 'patch')}   [m] minor -> ${nextVersion(current, 'minor')}   [M] major -> ${nextVersion(current, 'major')}`)
  console.log('  ou tape directement une version (ex: 1.4.2)')

  let next = current
  for (;;) {
    const answer = await ask('Version à publier ? ')
    if (answer === '') break
    try {
      next = nextVersion(current, { p: 'patch', m: 'minor', M: 'major' }[answer] ?? answer)
      break
    } catch (err) {
      console.log(`  ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (next === current) {
    console.log(`On garde ${current}.`)
  } else {
    const ok = (await ask(`Passer ${current} -> ${next}, commit + push "Release ${next}" ? (O/n) `)).toLowerCase()
    if (ok === 'n' || ok === 'non') {
      console.log(`Annulé, on garde ${current}.`)
    } else {
      writeVersionFile(next)
      git('add', 'VERSION')
      git('commit', '-m', `Release ${next}`)
      git('push')
      console.log(`Version ${next} commitée et poussée.`)
    }
  }
} catch (err) {
  console.error(`[release-version] ${err instanceof Error ? err.message : String(err)}`)
  process.exitCode = 1
} finally {
  rl.close()
}
