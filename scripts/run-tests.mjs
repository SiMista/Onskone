// Contrôle qualité avant release : types backend + tests front + tests back, avec un
// rendu lisible (spinner, résumé en boîte, détail des échecs) et, en cas d'échec, un
// petit menu interactif dans l'esprit de release-version-prompt.mjs.
//
//   node scripts/run-tests.mjs                 tout lancer
//   node scripts/run-tests.mjs --only front    front | back | types (répétable)
//   node scripts/run-tests.mjs --ci            jamais de question (code retour seul)
//
// Code retour : 0 = tout est vert (ou échec explicitement forcé), 1 = échec / annulé.
// Sans terminal interactif (CI, pipe) : aucune question, code retour seul.
// Le typecheck du front n'est pas ici : `pnpm build:frontend` (tsc && vite build) le fait déjà.
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { REPO_ROOT } from './version-file.mjs'

// --- Rendu -------------------------------------------------------------------
const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY) && !process.argv.includes('--ci')
const useColor = process.stdout.isTTY && !process.env.NO_COLOR
// Les vieilles consoles Windows (cmd/conhost) affichent mal braille et boîtes : repli ASCII.
const fancy = process.platform !== 'win32' || Boolean(process.env.WT_SESSION || process.env.TERM_PROGRAM)

const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s))
const green = paint('32'), red = paint('31'), yellow = paint('33'), cyan = paint('36')
const bold = paint('1'), dim = paint('2')

const SPINNER = fancy ? ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] : ['|', '/', '-', '\\']
const OK = fancy ? '✔' : '[OK]'
const KO = fancy ? '✖' : '[X]'
const BOX = fancy
  ? { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' }
  : { tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|' }

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
// Les emojis occupent 2 colonnes : sans ça le cadre de droite des boîtes est décalé.
const charWidth = (ch) => { const cp = ch.codePointAt(0); return cp >= 0x1f300 || cp === 0x2728 ? 2 : 1 }
const visibleLength = (s) => [...stripAnsi(s)].reduce((n, ch) => n + charWidth(ch), 0)
const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`

/** Boîte autour de lignes déjà colorées ; `color` peint le cadre. */
const box = (lines, color) => {
  const width = Math.max(...lines.map(visibleLength)) + 2
  const row = (l) => `${color(BOX.v)} ${l}${' '.repeat(width - visibleLength(l) - 1)}${color(BOX.v)}`
  return [
    color(BOX.tl + BOX.h.repeat(width) + BOX.tr),
    ...lines.map(row),
    color(BOX.bl + BOX.h.repeat(width) + BOX.br),
  ].join('\n')
}

const pick = (list) => list[Math.floor(Math.random() * list.length)]
const WIN_LINES = [
  'Propre comme un sou neuf. Tu peux publier sans transpirer.',
  'Zéro rouge. Même ton code est surpris.',
  'Tout passe. Va te chercher un café, tu l\'as mérité.',
  'Vert partout. Les stores n\'ont qu\'à bien se tenir.',
]
const FAIL_LINES = [
  'Aïe. Mieux vaut le voir ici que dans la Play Console.',
  'Ça pue un peu. Heureusement qu\'on a regardé avant de publier.',
  'Un test a râlé : il avait sûrement raison.',
  'Stop. Ce build ne part pas comme ça.',
]

// --- Étapes ------------------------------------------------------------------
const STEPS = [
  {
    id: 'types',
    label: 'Types backend',
    note: 'jamais compilé en dev (tsx), donc rien ne le vérifie ailleurs',
    command: 'pnpm --filter backend exec tsc --noEmit',
    kind: 'tsc',
  },
  {
    id: 'front',
    label: 'Tests front',
    command: (out) => `pnpm --filter frontend exec vitest run --reporter=json --outputFile="${out}"`,
    kind: 'tests',
  },
  {
    id: 'back',
    label: 'Tests back',
    command: (out) => `pnpm --filter backend exec jest --json --outputFile="${out}"`,
    kind: 'tests',
  },
]

const onlyIds = process.argv.flatMap((a, i, all) => (a === '--only' && all[i + 1] ? [all[i + 1]] : []))
const selected = onlyIds.length ? STEPS.filter((s) => onlyIds.includes(s.id)) : STEPS
if (selected.length === 0) {
  console.error(`Étape inconnue. Choix : ${STEPS.map((s) => s.id).join(', ')}`)
  process.exit(1)
}

const run = (step) =>
  new Promise((resolve) => {
    const started = Date.now()
    const outFile = join(tmpdir(), `onskone-${step.id}-${process.pid}.json`)
    const command = typeof step.command === 'function' ? step.command(outFile) : step.command
    const child = spawn(command, { cwd: REPO_ROOT, shell: true, env: { ...process.env, FORCE_COLOR: '0', CI: '1' } })
    let output = ''
    child.stdout.on('data', (d) => { output += d })
    child.stderr.on('data', (d) => { output += d })
    child.on('close', (code) => {
      const result = { step, ok: code === 0, ms: Date.now() - started, output: stripAnsi(output), total: 0, passed: 0, failures: [] }
      try {
        if (step.kind === 'tests' && existsSync(outFile)) {
          const json = JSON.parse(readFileSync(outFile, 'utf8'))
          result.total = json.numTotalTests ?? 0
          result.passed = json.numPassedTests ?? 0
          for (const file of json.testResults ?? []) {
            const failed = (file.assertionResults ?? []).filter((a) => a.status === 'failed')
            for (const a of failed) {
              result.failures.push({ where: relative(REPO_ROOT, file.name), title: a.fullName || a.title, message: firstLines(a.failureMessages?.[0]) })
            }
            // Fichier qui n'a même pas pu être chargé (erreur de syntaxe, import cassé).
            if (file.status === 'failed' && failed.length === 0) {
              result.failures.push({ where: relative(REPO_ROOT, file.name), title: '(suite impossible à charger)', message: firstLines(file.message) })
            }
          }
        } else if (step.kind === 'tsc') {
          for (const line of result.output.split('\n')) {
            if (/error TS\d+/.test(line)) result.failures.push({ where: 'tsc', title: line.trim(), message: '' })
          }
        }
      } catch {
        /* rapport illisible : le détail brut reste dispo via [d] */
      } finally {
        rmSync(outFile, { force: true })
      }
      // Code retour non nul sans aucun échec identifié (crash de l'outil) : on garde la sortie brute.
      if (!result.ok && result.failures.length === 0) {
        result.failures.push({ where: step.label, title: 'La commande a échoué sans rapport exploitable', message: firstLines(result.output, 6) })
      }
      resolve(result)
    })
  })

const firstLines = (text = '', n = 4) =>
  stripAnsi(String(text))
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() && !/^\s+at /.test(l))
    .slice(0, n)
    .join('\n')

/** Lance une étape avec spinner + chrono, puis fige la ligne en ✔ / ✖. */
const runWithSpinner = async (step) => {
  const started = Date.now()
  const live = process.stdout.isTTY
  let frame = 0
  const draw = () => {
    process.stdout.write(`\r\x1b[2K  ${cyan(SPINNER[frame++ % SPINNER.length])} ${step.label} ${dim(seconds(Date.now() - started))}`)
  }
  let timer = null
  if (live) { draw(); timer = setInterval(draw, 80) } else { console.log(`  ... ${step.label}`) }
  const result = await run(step)
  if (timer) { clearInterval(timer); process.stdout.write('\r\x1b[2K') }
  const detail = step.kind === 'tests' && result.total
    ? `${result.passed}/${result.total} tests`
    : (result.ok ? 'aucune erreur' : `${result.failures.length} erreur${result.failures.length > 1 ? 's' : ''}`)
  const mark = result.ok ? green(OK) : red(KO)
  console.log(`  ${mark} ${result.ok ? step.label : bold(red(step.label))}  ${dim(`${detail} · ${seconds(result.ms)}`)}`)
  return result
}

// --- Résumé ------------------------------------------------------------------
const printSummary = (results, totalMs) => {
  const failed = results.filter((r) => !r.ok)
  const tests = results.reduce((n, r) => n + r.total, 0)
  console.log('')
  if (failed.length === 0) {
    const lines = [
      bold(green(`${fancy ? '✨ ' : ''}TOUT EST VERT`)) + dim(`  ·  ${tests} tests  ·  ${seconds(totalMs)}`),
      '',
      ...results.map((r) => `${green(OK)} ${r.step.label.padEnd(14)} ${dim(r.step.kind === 'tests' ? `${r.passed} tests` : 'ok')}`),
    ]
    console.log(box(lines, green))
    console.log(`\n  ${pick(WIN_LINES)}\n`)
    return
  }
  const failCount = results.reduce((n, r) => n + r.failures.length, 0)
  const lines = [
    bold(red(`${fancy ? '💥 ' : ''}${failCount} PROBLÈME${failCount > 1 ? 'S' : ''}`)) + dim(`  ·  ${failed.length} étape${failed.length > 1 ? 's' : ''} en échec  ·  ${seconds(totalMs)}`),
    '',
    ...results.map((r) => `${r.ok ? green(OK) : red(KO)} ${r.step.label.padEnd(14)} ${r.ok ? dim('ok') : red(`${r.failures.length} à corriger`)}`),
  ]
  console.log(box(lines, red))
  for (const r of failed) {
    console.log(`\n  ${bold(red(r.step.label))}`)
    const byFile = new Map()
    for (const f of r.failures) byFile.set(f.where, [...(byFile.get(f.where) ?? []), f])
    for (const [where, list] of byFile) {
      console.log(`  ${yellow(where)}`)
      for (const f of list.slice(0, 8)) {
        console.log(`    ${red(KO)} ${f.title}`)
        if (f.message) console.log(dim(f.message.split('\n').map((l) => `        ${l}`).join('\n')))
      }
      if (list.length > 8) console.log(dim(`    … et ${list.length - 8} de plus`))
    }
  }
  console.log(`\n  ${pick(FAIL_LINES)}\n`)
}

// --- Programme ---------------------------------------------------------------
const runAll = async () => {
  console.log('')
  console.log(`  ${bold(cyan(`${fancy ? '🧪 ' : ''}Contrôle qualité`))} ${dim('avant release')}`)
  console.log('')
  const started = Date.now()
  const results = []
  for (const step of selected) results.push(await runWithSpinner(step))
  const totalMs = Date.now() - started
  printSummary(results, totalMs)
  return results
}

let results = await runAll()
let exitCode = results.every((r) => r.ok) ? 0 : 1

if (exitCode !== 0 && interactive) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    for (;;) {
      console.log(`  ${bold('Que faire ?')}`)
      console.log(`    ${cyan('[r]')} relancer les tests`)
      console.log(`    ${cyan('[d]')} voir la sortie complète des étapes en échec`)
      console.log(`    ${cyan('[f]')} forcer la suite malgré les échecs ${dim('(déconseillé)')}`)
      console.log(`    ${cyan('[Entrée]')} annuler le release`)
      const answer = (await rl.question('  > ')).trim().toLowerCase()
      if (answer === '') break
      if (answer === 'r') {
        results = await runAll()
        if (results.every((r) => r.ok)) { exitCode = 0; break }
      } else if (answer === 'd') {
        for (const r of results.filter((x) => !x.ok)) {
          console.log(`\n${bold(red(`--- ${r.step.label} ---`))}\n${r.output.trim() || '(sortie vide)'}\n`)
        }
      } else if (answer === 'f') {
        const sure = (await rl.question(`  ${yellow('Tape "oui" pour publier avec des tests rouges : ')}`)).trim().toLowerCase()
        if (sure === 'oui') {
          console.log(`  ${yellow('OK, on force. Les tests rouges sont ignorés pour ce release.')}\n`)
          exitCode = 0
          break
        }
        console.log('  Pas confirmé, on ne force pas.\n')
      } else {
        console.log(`  ${dim('Choix inconnu.')}\n`)
      }
    }
  } finally {
    rl.close()
  }
  if (exitCode !== 0) console.log(`  ${red('Release annulé.')} ${dim('Corrige, puis relance.')}\n`)
}

process.exit(exitCode)
