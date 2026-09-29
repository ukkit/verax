// Compares the production parser's output with casparser's, and prints a REDACTED report: counts and match flags only.
// No names, folios or amounts are ever printed; mismatched rows appear only as masked shapes.
import { existsSync, readFileSync } from 'node:fs';

const label = process.argv[2];
const oraclePath = `out/${label}.oracle.json`;
const oursPath = `out/${label}.ours.json`;
const out = [];
const log = (line = '') => out.push(line);
log(`=== ${label} ===`);
if (!existsSync(oraclePath) || !existsSync(oursPath)) {
  log(`missing output: oracle=${existsSync(oraclePath)} ours=${existsSync(oursPath)}`);
  console.log(out.join('\n') + '\n');
  process.exit(0);
}
const oracle = JSON.parse(readFileSync(oraclePath, 'utf8'));
const ours = JSON.parse(readFileSync(oursPath, 'utf8'));

const r = (v, places) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? '' : Math.abs(Number(v)).toFixed(places));
const key = (t) => [t.date, r(t.units, 3), r(t.amount, 2), r(t.balance, 3)].join('|');
const near = (a, b, tol = 0.005) => (a === null || a === undefined || a === '') === (b === null || b === undefined || b === '') && (a === null || a === undefined || a === '' || Math.abs(Number(a) - Number(b)) <= tol);
const shape = (t) => `${String(t.description ?? '').split(/\s+/).slice(0, 2).join(' ').replace(/\d/g, '9')} | units:${t.units != null ? 'y' : 'n'} amt:${t.amount != null ? 'y' : 'n'} bal:${t.balance != null ? 'y' : 'n'}`;

const theirs = (oracle.folios ?? []).flatMap((f) => (f.schemes ?? []).map((s) => ({ folio: String(f.folio).split('/')[0].replace(/\D/g, ''), s })));
const mine = ours.folios.flatMap((f) => f.schemes.map((s) => ({ folio: f.folioMasked.replace(/\D/g, ''), s })));

log(`source: ours ${ours.source}, casparser ${oracle.file_type}; period ours ${ours.period ? 'found' : 'missing'}`);
log(`folios: ours ${ours.folios.length}, casparser ${(oracle.folios ?? []).length} | schemes: ours ${mine.length}, casparser ${theirs.length}`);
log(`our unreadable-scheme warnings: ${ours.warnings.length}; casparser parse warnings: ${(oracle.parse_warnings ?? []).length}`);

const count = { matched: 0, missing: 0, extra: 0, txns: 0, typeOk: 0, typeBad: 0, closeOk: 0, closeBad: 0, valOk: 0, valBad: 0, isinOk: 0, isinBad: 0, isinNA: 0, nameOk: 0, nameBad: 0, folioOk: 0, folioBad: 0, flagOk: 0, flagBad: 0 };
const typePairs = {};
const examples = [];
const differing = [];

const pairs = Math.max(theirs.length, mine.length);
for (let i = 0; i < pairs; i++) {
  const o = theirs[i];
  const m = mine[i];
  if (!o || !m) {
    log(`S${i + 1}: present in only one parser`);
    continue;
  }
  (o.folio.slice(-4) === m.folio.slice(-4) ? count.folioOk++ : count.folioBad++);
  (String(o.s.scheme).trim() === m.s.name ? count.nameOk++ : count.nameBad++);
  if (!o.s.isin || !m.s.isin) count.isinNA++;
  else (o.s.isin === m.s.isin ? count.isinOk++ : count.isinBad++);
  (near(o.s.close, m.s.close) ? count.closeOk++ : count.closeBad++);
  const v = o.s.valuation ?? {};
  (near(v.nav, m.s.valuation.nav, 0.00005) && near(v.value, m.s.valuation.value) && near(v.cost, m.s.valuation.cost) ? count.valOk++ : count.valBad++);

  const pool = new Map();
  for (const t of m.s.transactions) pool.set(key(t), [...(pool.get(key(t)) ?? []), t]);
  let missing = 0;
  for (const t of o.s.transactions ?? []) {
    count.txns++;
    const list = pool.get(key(t));
    if (list?.length) {
      const mt = list.pop();
      count.matched++;
      if (mt.type === t.type) count.typeOk++;
      else {
        count.typeBad++;
        const pair = `${mt.type} vs casparser ${t.type}`;
        typePairs[pair] = (typePairs[pair] ?? 0) + 1;
      }
    } else {
      missing++;
      count.missing++;
      if (examples.length < 12) examples.push(`missing from ours: ${shape(t)}`);
    }
  }
  const extra = [...pool.values()].reduce((n, l) => n + l.length, 0);
  count.extra += extra;
  for (const l of pool.values()) for (const t of l) if (examples.length < 12) examples.push(`extra in ours:      ${shape(t)}`);
  if (missing || extra) differing.push(`S${i + 1}: casparser ${(o.s.transactions ?? []).length}, ours ${m.s.transactions.length}, missing ${missing}, extra ${extra}`);
  // Our reconcile flag should agree with whether casparser's own balance check found a problem for this scheme.
  const theirsClean = !(oracle.parse_warnings ?? []).some((w) => String(w).includes(String(o.s.scheme).slice(0, 30)));
  (m.s.reconciled === theirsClean ? count.flagOk++ : count.flagBad++);
}

log(`transactions: matched ${count.matched} / ${count.txns}, missing ${count.missing}, extra ${count.extra}  => ${count.txns ? ((100 * count.matched) / count.txns).toFixed(2) : 'n/a'}% recall`);
log(`transaction type agrees with casparser: ${count.typeOk} / ${count.matched}` + (count.typeBad ? `  (differs: ${Object.entries(typePairs).map(([k, v]) => `${k} x${v}`).join('; ')})` : ''));
log(`closing unit balance: ok ${count.closeOk}, mismatch ${count.closeBad}`);
log(`valuation line (nav / value / cost): ok ${count.valOk}, mismatch ${count.valBad}`);
log(`ISIN: ok ${count.isinOk}, mismatch ${count.isinBad}, n/a ${count.isinNA} | scheme name equal: ${count.nameOk} / ${count.nameOk + count.nameBad} | folio last-4 equal: ${count.folioOk} / ${count.folioOk + count.folioBad}`);
log(`reconcile flag agrees with casparser's balance check: ${count.flagOk} / ${count.flagOk + count.flagBad}`);
log(`schemes ours marks not reconciled: ${mine.filter((x) => !x.s.reconciled).length}`);

// Privacy check on what the app would hold: nothing identifying may appear anywhere in our output. Long digit runs are
// counted only in text fields (references, account numbers); a large money value in a number field is not an identifier.
const json = JSON.stringify(ours);
const textRuns = new Map();
let numericLong = 0;
const walk = (value, path) => {
  if (typeof value === 'string') {
    for (const m of value.matchAll(/(?<![\d.•])\d{8,}(?![\d.])/g)) {
      const snippet = value.slice(Math.max(0, m.index - 24), m.index + m[0].length + 8).replace(/\d/g, '9');
      const entry = textRuns.get(path) ?? { n: 0, snippets: new Set() };
      entry.n++;
      if (entry.snippets.size < 4) entry.snippets.add(snippet);
      textRuns.set(path, entry);
    }
  } else if (typeof value === 'number') {
    if (/(?<![\d.])\d{8,}(?![\d.])/.test(String(value))) numericLong++;
  } else if (Array.isArray(value)) value.forEach((v) => walk(v, `${path}[]`));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => walk(v, path ? `${path}.${k}` : k));
};
walk(ours, '');
const longDigits = [...textRuns.values()].reduce((n, e) => n + e.n, 0);
const leaks = { pan: (json.match(/\b[A-Z]{5}\d{4}[A-Z]\b/g) ?? []).length, email: (json.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []).length, longDigits };
log(`PII in our output: PAN-shaped ${leaks.pan}, emails ${leaks.email}, 8+ digit runs in text fields ${leaks.longDigits}  ${leaks.pan + leaks.email + leaks.longDigits === 0 ? '(clean)' : '<-- INVESTIGATE'}  (large plain numbers, not identifiers: ${numericLong})`);
if (longDigits) {
  log('where the 8+ digit runs are:');
  for (const [path, entry] of textRuns) log(`  ${path}: ${entry.n}  e.g. ${[...entry.snippets].map((x) => JSON.stringify(x)).join('  ')}`);
}

if (differing.length) {
  log('schemes with differences:');
  differing.slice(0, 20).forEach((d) => log('  ' + d));
}
if (examples.length) {
  log('masked examples (shape only):');
  examples.forEach((e) => log('  ' + e));
}
console.log(out.join('\n') + '\n');
