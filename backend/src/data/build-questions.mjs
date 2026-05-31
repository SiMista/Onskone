// Reads the Excel file in this folder and rebuilds questions_fr.json + questions_en.json.
// Usage (from repo root or backend/):
//   node backend/src/data/build-questions.mjs
//   node src/data/build-questions.mjs
// Optional: pass a different xlsx filename as argv[2].

import XLSX from 'xlsx';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const xlsxName = process.argv[2] || 'Onskoné_2405.xlsx';
const xlsxPath = join(__dirname, xlsxName);
const outFr = join(__dirname, 'questions_fr.json');
const outEn = join(__dirname, 'questions_en.json');

const wb = XLSX.readFile(xlsxPath);

// ---- Normalisation pour réconcilier les variantes (accents, emoji, casse)
const stripEmoji = (s) =>
  s.replace(/[\p{Extended_Pictographic}‍️]/gu, '');
const normalize = (s) =>
  stripEmoji(String(s ?? ''))
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 &]/gi, '')
    .trim()
    .toLowerCase();

// Synonymes bidirectionnels pour les variantes FR qui apparaissent
// différemment selon la feuille (Nombre vs Noms Themes vs Questions).
const synonymGroups = [
  ['MES OPINIONS', 'TES OPINIONS'],
  ['FAMILLE & AMIS', 'AMIS & FAMILLE'],
].map(g => g.map(normalize));
const aliasesOf = (n) => {
  const group = synonymGroups.find(g => g.includes(n));
  return group ? group : [n];
};
const pickFirst = (lookup, n) => {
  for (const k of aliasesOf(n)) {
    const v = lookup[k];
    if (v !== undefined) return v;
  }
  return undefined;
};

// ---- Feuille "Nombre" : thème FR -> catégorie
const nombreRows = XLSX.utils.sheet_to_json(wb.Sheets['Nombre'], { header: 1, defval: '' });
const themeFrToCategory = {};
for (let i = 1; i < nombreRows.length; i++) {
  const theme = String(nombreRows[i][0] ?? '').trim();
  const category = String(nombreRows[i][1] ?? '').trim();
  if (theme && category) themeFrToCategory[normalize(theme)] = category;
}

// ---- Feuille "Noms Themes" : 3 lignes par thème
//   [nom FR (avec emoji), nom EN]
//   [description FR, description EN]
//   ["→", ""]
const nomsRows = XLSX.utils.sheet_to_json(wb.Sheets['Noms Themes'], { header: 1, defval: '' });
const themeMeta = {
  fr: {}, // normalizedFr -> { display, description }
  en: {}, // normalizedEn -> { display, description }
};
const frToEn = {}; // normalizedFr -> normalizedEn
let i = 0;
while (i < nomsRows.length) {
  const nameRow = nomsRows[i];
  const descRow = nomsRows[i + 1] ?? [];
  const nameFrRaw = String(nameRow?.[0] ?? '').trim();
  const nameEnRaw = String(nameRow?.[1] ?? '').trim();
  if (!nameFrRaw && !nameEnRaw) { i++; continue; }
  const descFr = String(descRow?.[0] ?? '').trim();
  const descEn = String(descRow?.[1] ?? '').trim();
  const nFr = normalize(nameFrRaw);
  const nEn = normalize(nameEnRaw);
  if (nFr) themeMeta.fr[nFr] = { display: stripEmoji(nameFrRaw).trim(), description: descFr };
  if (nEn) themeMeta.en[nEn] = { display: stripEmoji(nameEnRaw).trim(), description: descEn };
  if (nFr && nEn) frToEn[nFr] = nEn;
  // avance jusqu'au séparateur "→" puis +1
  let j = i + 1;
  while (j < nomsRows.length && String(nomsRows[j]?.[0] ?? '').trim() !== '→') j++;
  i = j + 1;
}

// ---- Feuille "Questions"
const qSheet = wb.Sheets['Questions'];
const qRows = XLSX.utils.sheet_to_json(qSheet, { header: 1, defval: '' });
const header = qRows[0].map((h) => String(h ?? '').trim().toLowerCase());

// Repère les colonnes FR et EN. Les libellés sont dupliqués (Question, Thème, Sujet
// du côté FR et Question Anglais, Theme, Sujet côté EN), on prend la première
// occurrence pour FR et la suivante pour EN.
const findCols = () => {
  const idxQuestionFr = header.indexOf('question');
  const idxQuestionEn = header.findIndex((h, k) => k > idxQuestionFr && (h === 'question anglais' || h === 'question (en)' || h.startsWith('question')));
  const idxThemeFr = header.findIndex((h) => h === 'thème' || h === 'theme');
  const idxThemeEn = header.findIndex((h, k) => k > idxThemeFr && (h === 'thème' || h === 'theme'));
  const idxSubjectFr = header.findIndex((h) => h.startsWith('sujet'));
  const idxSubjectEn = header.findIndex((h, k) => k > idxSubjectFr && h.startsWith('sujet'));
  return { idxQuestionFr, idxQuestionEn, idxThemeFr, idxThemeEn, idxSubjectFr, idxSubjectEn };
};
const cols = findCols();
for (const [k, v] of Object.entries(cols)) {
  if (v < 0) throw new Error(`Colonne introuvable: ${k}. header=${JSON.stringify(qRows[0])}`);
}

const buildLang = (lang) => {
  const out = {};
  const missingTheme = new Set();
  let kept = 0;
  let skipped = 0;
  let missingDesc = 0;

  const qCol = lang === 'fr' ? cols.idxQuestionFr : cols.idxQuestionEn;
  const tCol = lang === 'fr' ? cols.idxThemeFr : cols.idxThemeEn;
  const sCol = lang === 'fr' ? cols.idxSubjectFr : cols.idxSubjectEn;

  for (let r = 1; r < qRows.length; r++) {
    const row = qRows[r];
    const question = String(row[qCol] ?? '').trim();
    const themeRaw = String(row[tCol] ?? '').trim();
    const subject = String(row[sCol] ?? '').trim();
    if (!question || !themeRaw || !subject) { skipped++; continue; }

    const nTheme = normalize(themeRaw);
    // catégorie : connue côté FR ; côté EN on passe par le mapping FR→EN
    let category;
    let displayTheme;
    let description;
    if (lang === 'fr') {
      category = pickFirst(themeFrToCategory, nTheme);
      const meta = pickFirst(themeMeta.fr, nTheme);
      displayTheme = meta?.display || themeRaw;
      description = meta?.description ?? '';
    } else {
      // retrouve un FR équivalent à ce thème EN, puis la catégorie
      const frKey = Object.entries(frToEn).find(([, en]) => en === nTheme)?.[0];
      if (frKey) category = pickFirst(themeFrToCategory, frKey);
      const meta = themeMeta.en[nTheme];
      displayTheme = meta?.display || themeRaw;
      description = meta?.description ?? '';
    }
    if (!category) { missingTheme.add(themeRaw); skipped++; continue; }
    if (!description) missingDesc++;

    if (!out[category]) out[category] = {};
    if (!out[category][displayTheme]) {
      out[category][displayTheme] = { description, subjects: [] };
    }
    let entry = out[category][displayTheme].subjects.find((e) => e.subject === subject);
    if (!entry) {
      entry = { subject, questions: [] };
      out[category][displayTheme].subjects.push(entry);
    }
    if (!entry.questions.includes(question)) entry.questions.push(question);
    kept++;
  }

  return { out, kept, skipped, missingTheme, missingDesc };
};

const summarize = (label, { out, kept, skipped, missingTheme, missingDesc }, path) => {
  writeFileSync(path, JSON.stringify(out, null, 2) + '\n', 'utf8');
  const totals = Object.entries(out).map(([cat, themes]) => {
    const themeCount = Object.keys(themes).length;
    const qCount = Object.values(themes).reduce(
      (s, t) => s + t.subjects.reduce((ss, e) => ss + e.questions.length, 0), 0,
    );
    return `  ${cat}: ${themeCount} thèmes, ${qCount} questions`;
  }).join('\n');
  console.log(`\n[${label}] -> ${path}`);
  console.log(`  kept ${kept} questions, skipped ${skipped} rows, ${missingDesc} thèmes sans description`);
  console.log(totals);
  if (missingTheme.size) console.log('  ! thèmes sans catégorie:', [...missingTheme]);
};

const fr = buildLang('fr');
const en = buildLang('en');
summarize('FR', fr, outFr);
summarize('EN', en, outEn);
