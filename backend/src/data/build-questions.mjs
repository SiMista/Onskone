/* eslint-disable */
// Reads the Excel file in this folder and rebuilds questions_fr.json + questions_en.json.
// Usage (from repo root or backend/):
//   node backend/src/data/build-questions.mjs
//   node src/data/build-questions.mjs
// Par défaut : l'unique .xlsx de ce dossier. Optionnel : passer un autre nom de fichier en argv[2].
//
// Feuille lue : "Questions" uniquement (colonnes Question / Le Tip ! / Thème / Sujet côté FR,
// puis Question Anglais / The Tip! / Theme / Sujet côté EN). Les autres feuilles (Nombre,
// Noms Themes, brouillons…) sont ignorées : catégorie, libellé et description d'un thème
// viennent de themes.json, qui fait déjà foi en jeu (questionsRepository.ts).

import XLSX from 'xlsx';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const findXlsx = () => {
  // ~$… (Excel) et .~lock… (LibreOffice) : fichiers de verrou d'un classeur ouvert.
  const found = readdirSync(__dirname).filter((f) => f.endsWith('.xlsx') && !f.startsWith('~$') && !f.startsWith('.'));
  if (found.length !== 1) {
    throw new Error(`Attendu exactement un .xlsx dans ${__dirname}, trouvé : ${JSON.stringify(found)}. Passe le nom en argument.`);
  }
  return found[0];
};
const xlsxName = process.argv[2] || findXlsx();
const xlsxPath = join(__dirname, xlsxName);
const outFr = join(__dirname, 'questions_fr.json');
const outEn = join(__dirname, 'questions_en.json');

const wb = XLSX.readFile(xlsxPath);
const themesMeta = JSON.parse(readFileSync(join(__dirname, 'themes.json'), 'utf8'));

// ---- Normalisation pour réconcilier les variantes (accents, emoji, casse, ponctuation)
const stripEmoji = (s) =>
  s.replace(/[\p{Extended_Pictographic}‍️]/gu, '');
const normalize = (s) =>
  stripEmoji(String(s ?? ''))
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 &]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// Texte affiché (question, tip) : espaces superflus retirés, apostrophes courbes ramenées
// à l'apostrophe droite utilisée par le reste du deck (copier-coller depuis Word/Docs).
const cleanText = (s) =>
  String(s ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/ {2,}/g, ' ')
    .trim();

// ---- Thème de l'Excel -> code stable de themes.json.
// Un thème est reconnu par ses libellés FR/EN de themes.json (accents, emoji, casse et
// ponctuation ignorés), ou par un des alias ci-dessous : anciens noms encore présents dans
// de vieux Excel. Renommer un thème = changer son libellé dans themes.json (le code ne
// bouge pas, les sélections des salons survivent).
// Thème inconnu = le script s'arrête AVANT d'écrire : mieux vaut planter que perdre
// des questions en silence.
const THEME_ALIASES = {
  FAMILY: ['FAMILLE & AMIS'],
  HOT_TAKES: ['TES OPINIONS'],
  FEELINGS: ['ÉMOTIONS & BIEN-ÊTRE'],
  TRAVEL: ['VOYAGES & SORTIE'],
  RECEIPTS: ['THE RECEIPTS'],
  WYD: ['WYD?'],
};
const codeByName = {};
const registerName = (name, code) => {
  const n = normalize(name);
  if (codeByName[n] && codeByName[n] !== code) {
    throw new Error(`Nom de thème ambigu "${name}" : ${codeByName[n]} et ${code}`);
  }
  codeByName[n] = code;
};
for (const [code, meta] of Object.entries(themesMeta)) {
  for (const label of Object.values(meta.labels)) registerName(label, code);
}
for (const [code, names] of Object.entries(THEME_ALIASES)) {
  if (!themesMeta[code]) throw new Error(`Alias pour un code absent de themes.json : ${code}`);
  for (const name of names) registerName(name, code);
}

// ---- Feuille "Questions"
const qSheet = wb.Sheets['Questions'];
if (!qSheet) throw new Error(`Feuille "Questions" introuvable dans ${xlsxName}`);
const qRows = XLSX.utils.sheet_to_json(qSheet, { header: 1, defval: '' });
const header = qRows[0].map((h) => String(h ?? '').trim().toLowerCase());

// Repère les colonnes FR et EN. Les libellés sont dupliqués (Question, Thème, Sujet du
// côté FR et Question Anglais, Theme, Sujet côté EN) : on prend la première occurrence
// pour FR et la suivante pour EN. Le tip de chaque langue est entre sa question et son thème.
const findCols = () => {
  const isTheme = (h) => h === 'thème' || h === 'theme';
  const isTip = (h) => /\btips?\b/.test(h);
  const idxQuestionFr = header.indexOf('question');
  const idxQuestionEn = header.findIndex((h, k) => k > idxQuestionFr && h.startsWith('question'));
  const idxThemeFr = header.findIndex(isTheme);
  const idxThemeEn = header.findIndex((h, k) => k > idxThemeFr && isTheme(h));
  const idxSubjectFr = header.findIndex((h) => h.startsWith('sujet'));
  const idxSubjectEn = header.findIndex((h, k) => k > idxSubjectFr && h.startsWith('sujet'));
  const idxTipFr = header.findIndex((h, k) => k > idxQuestionFr && k < idxQuestionEn && isTip(h));
  const idxTipEn = header.findIndex((h, k) => k > idxQuestionEn && isTip(h));
  return { idxQuestionFr, idxQuestionEn, idxThemeFr, idxThemeEn, idxSubjectFr, idxSubjectEn, idxTipFr, idxTipEn };
};
const cols = findCols();
for (const [k, v] of Object.entries(cols)) {
  // Colonnes de tip facultatives (-1 = pas de tip dans cette langue).
  if (v < 0 && !k.startsWith('idxTip')) throw new Error(`Colonne introuvable: ${k}. header=${JSON.stringify(qRows[0])}`);
}

const unknownThemes = new Map(); // nom inconnu -> lignes Excel
const mismatchedRows = []; // thème FR et EN de la même ligne qui ne désignent pas le même code

// Résolution des thèmes ligne par ligne, une seule fois pour les deux langues.
const rowCodes = qRows.map((row, r) => {
  if (r === 0) return null;
  const resolve = (col) => {
    const raw = String(row[col] ?? '').trim();
    if (!raw) return null;
    const code = codeByName[normalize(raw)];
    if (!code) {
      if (!unknownThemes.has(raw)) unknownThemes.set(raw, []);
      unknownThemes.get(raw).push(r + 1);
    }
    return code ?? null;
  };
  const fr = resolve(cols.idxThemeFr);
  const en = resolve(cols.idxThemeEn);
  if (fr && en && fr !== en) mismatchedRows.push(`ligne ${r + 1} : FR=${fr} / EN=${en}`);
  return { fr, en };
});

if (unknownThemes.size || mismatchedRows.length) {
  for (const [name, lines] of unknownThemes) {
    console.error(`! Thème inconnu "${name}" (lignes ${lines.slice(0, 5).join(', ')}${lines.length > 5 ? '…' : ''})`);
  }
  for (const m of mismatchedRows) console.error(`! Thèmes FR/EN incohérents, ${m}`);
  console.error('\nAjoute le nom à THEME_ALIASES (build-questions.mjs) ou corrige le libellé dans themes.json / l\'Excel. Rien n\'a été écrit.');
  process.exit(1);
}

const buildLang = (lang) => {
  const out = {};
  const firstSeenAt = new Map(); // question -> "THÈME / sujet" (doublons inter-sujets)
  const duplicates = [];
  let kept = 0;
  let skipped = 0;
  let tips = 0;

  const qCol = lang === 'fr' ? cols.idxQuestionFr : cols.idxQuestionEn;
  const tipCol = lang === 'fr' ? cols.idxTipFr : cols.idxTipEn;
  const sCol = lang === 'fr' ? cols.idxSubjectFr : cols.idxSubjectEn;

  for (let r = 1; r < qRows.length; r++) {
    const row = qRows[r];
    const question = cleanText(row[qCol]);
    const tip = tipCol < 0 ? '' : cleanText(row[tipCol]);
    const subject = String(row[sCol] ?? '').trim();
    const code = rowCodes[r][lang];
    if (!question || !code || !subject) { skipped++; continue; }

    const meta = themesMeta[code];
    const category = meta.category;
    // Libellé = celui de themes.json : c'est la clé que questionsRepository mappe vers le code.
    const displayTheme = meta.labels[lang];

    if (!out[category]) out[category] = {};
    if (!out[category][displayTheme]) {
      out[category][displayTheme] = { description: meta.descriptions[lang] ?? '', subjects: [] };
    }
    let entry = out[category][displayTheme].subjects.find((e) => e.subject === subject);
    if (!entry) {
      entry = { subject, questions: [] };
      out[category][displayTheme].subjects.push(entry);
    }
    if (entry.questions.includes(question)) continue;

    // Une question est identifiée par son texte en jeu (questions déjà jouées, stats) :
    // deux exemplaires dans la partie sont grisés ensemble. Signalé, pas bloquant.
    const where = `${displayTheme} / ${subject}`;
    if (firstSeenAt.has(question)) duplicates.push(`ligne ${r + 1} "${question}" (déjà dans ${firstSeenAt.get(question)})`);
    else firstSeenAt.set(question, where);

    entry.questions.push(question);
    if (tip) {
      // Tips à part, indexés par le texte de la question : `questions` reste un string[]
      // (format consommé tel quel par le jeu, les stats et l'admin).
      entry.tips = { ...entry.tips, [question]: tip };
      tips++;
    }
    kept++;
  }

  return { out, kept, skipped, tips, duplicates };
};

const summarize = (label, { out, kept, skipped, tips, duplicates }, path) => {
  writeFileSync(path, JSON.stringify(out, null, 2) + '\n', 'utf8');
  const totals = Object.entries(out).map(([cat, themes]) => {
    const themeCount = Object.keys(themes).length;
    const qCount = Object.values(themes).reduce(
      (s, t) => s + t.subjects.reduce((ss, e) => ss + e.questions.length, 0), 0,
    );
    return `  ${cat}: ${themeCount} thèmes, ${qCount} questions`;
  }).join('\n');
  console.log(`\n[${label}] -> ${path}`);
  console.log(`  kept ${kept} questions (${tips} avec tip), skipped ${skipped} rows`);
  console.log(totals);
  for (const d of duplicates) console.log(`  ! doublon : ${d}`);
};

console.log(`Source : ${xlsxName}`);
const fr = buildLang('fr');
const en = buildLang('en');
summarize('FR', fr, outFr);
summarize('EN', en, outEn);
