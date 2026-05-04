// Reads the Excel file in this folder and rebuilds questions.json.
// Usage (from repo root or backend/):
//   node backend/src/data/build-questions.mjs
//   node src/data/build-questions.mjs
// Optional: pass a different xlsx filename as argv[2].

import XLSX from 'xlsx';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const xlsxName = process.argv[2] || 'Onskoné_Questions_Structurées_2604.xlsx';
const xlsxPath = join(__dirname, xlsxName);
const outPath = join(__dirname, 'questions.json');

const wb = XLSX.readFile(xlsxPath);

const nombreRows = XLSX.utils.sheet_to_json(wb.Sheets['Nombre'], { header: 1, defval: '' });
const themeToCategory = {};
for (let i = 1; i < nombreRows.length; i++) {
  const theme = String(nombreRows[i][0] ?? '').trim();
  const category = String(nombreRows[i][1] ?? '').trim();
  if (theme && category) themeToCategory[theme] = category;
}

const qSheet = wb.Sheets['Questions'];
const qRows = XLSX.utils.sheet_to_json(qSheet, { header: 1, defval: '' });
const header = qRows[0].map((h) => String(h ?? '').trim().toLowerCase());
const colQuestion = header.indexOf('question');
const colTheme = header.findIndex((h) => h.startsWith('thème') || h === 'theme');
const colSubject = header.findIndex((h) => h.startsWith('sujet'));
if (colQuestion < 0 || colTheme < 0 || colSubject < 0) {
  throw new Error(`Missing column. header=${JSON.stringify(qRows[0])}`);
}

const out = {};
const missingTheme = new Set();
let kept = 0;
let skipped = 0;

for (let i = 1; i < qRows.length; i++) {
  const row = qRows[i];
  const question = String(row[colQuestion] ?? '').trim();
  const theme = String(row[colTheme] ?? '').trim();
  const subject = String(row[colSubject] ?? '').trim();
  if (!question || !theme || !subject) { skipped++; continue; }
  const category = themeToCategory[theme];
  if (!category) { missingTheme.add(theme); skipped++; continue; }

  if (!out[category]) out[category] = {};
  if (!out[category][theme]) out[category][theme] = [];
  let entry = out[category][theme].find((e) => e.subject === subject);
  if (!entry) {
    entry = { subject, questions: [] };
    out[category][theme].push(entry);
  }
  if (!entry.questions.includes(question)) entry.questions.push(question);
  kept++;
}

writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');

const totals = Object.entries(out).map(([cat, themes]) => {
  const themeCount = Object.keys(themes).length;
  const qCount = Object.values(themes).reduce(
    (s, subjects) => s + subjects.reduce((ss, e) => ss + e.questions.length, 0), 0,
  );
  return `  ${cat}: ${themeCount} thèmes, ${qCount} questions`;
}).join('\n');

console.log(`✓ Wrote ${outPath}`);
console.log(`  kept ${kept} questions, skipped ${skipped} rows`);
console.log(totals);
if (missingTheme.size) console.log('  ⚠ themes without category:', [...missingTheme]);
