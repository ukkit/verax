// Ported from casparser (https://github.com/codereverser/casparser), parsers/cams_detailed.py.
// MIT License, Copyright (c) 2020 Sandeep Somasekharan. See NOTICE.
//
// Reads a CAMS / KFintech "Detailed" statement from pdf.js text items. The layout is a fixed grammar of single-line
// anchors (folio, "Opening Unit Balance", the closing footer) around two things that vary: a scheme header that may
// wrap over several lines (header.ts) and transaction rows whose numbers sit in right-aligned columns (columns.ts).
import { classify, giftFolio, maskDescription } from './classify';
import { DATE_CELL_RE, inferColumns, splitRow, type Columns } from './columns';
import { detectSource } from './detect';
import { notAStatement } from './errors';
import { hasSchemeHeader, isTransactionHeaderLine, readSchemeHeader, type SchemeHeader } from './header';
import { dropOverlayDuplicates, toLines } from './layout';
import { fixSigns, reconcile } from './reconcile';
import { maskFolio, parseDate, parseNumber, round } from './text';
import type { Folio, Line, Scheme, Statement, TextItem } from './types';

const AMC_RE = /^(.+?\s+(?:MF|Mutual\s*Fund|Fund\s*House))$/i;
const FOLIO_RE = /Folio\s+No\s*:\s*(\d+(?:\s*\/\s*\d+)?)/i;
const OPEN_BALANCE_RE = /Opening\s+Unit\s+Balance\s*:?\s*([\d,.]+)/i;
const CLOSE_BALANCE_RE = /Closing\s+Unit\s+Balance\s*:?\s*([\d,.]+)/i;
const NAV_RE = /NAV\s+on\s+(\d{2}-[A-Za-z]{3}-\d{4})\s*:\s*INR\s*([\d,.]+)/i;
const VALUATION_RE = /(?:Valuation|Market\s+Value)\s+on\s+(\d{2}-[A-Za-z]{3}-\d{4})\s*:\s*INR\s*([\d,.]+)/i;
const COST_VALUE_RE = /Total\s+Cost\s+Value\s*:?\s*([\d,.]+)/i;
const PERIOD_RE = /(\d{2}-[A-Za-z]{3}-\d{4})\s+To\s+(\d{2}-[A-Za-z]{3}-\d{4})/i;
/** The statement period repeated at the top of every page. It starts with a date but is not a transaction. */
const PERIOD_LINE_RE = /^\d{2}-[A-Za-z]{3}-\d{4}\s+To\s+\d{2}-[A-Za-z]{3}-\d{4}$/i;
/** A description too wide for its column wraps onto the line directly below; this is the largest gap (points) allowed. */
const CONTINUATION_MAX_GAP = 10;

interface FolioDraft {
  amc: string;
  masked: string;
  schemes: Scheme[];
}

const newScheme = (header: SchemeHeader): Scheme => ({
  ...header,
  open: 0,
  close: null,
  closeCalculated: 0,
  valuation: { date: null, nav: null, value: null, cost: null },
  transactions: [],
  reconciled: false,
  warnings: [],
});

function readLines(lines: Line[], columns: Columns | null) {
  // Folio numbers are scoped to a registrar, so two AMCs can share one: key on both.
  const folios = new Map<string, FolioDraft>();
  const warnings: string[] = [];
  let period: Statement['period'] = null;
  let amc: string | null = null;
  let folio: FolioDraft | null = null;
  let scheme: Scheme | null = null;
  let region: string[] = [];
  let regionOpen = false;
  let lastRow = { index: -2, page: 0, y: 0 };

  const abandon = (page: number, where: string) => {
    if (regionOpen && hasSchemeHeader(region)) warnings.push(`A scheme on page ${page} was never closed (${where}) and is missing from the results.`);
    region = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const text = line.text;
    const trimmed = text.trim();

    if (!period) {
      const match = PERIOD_RE.exec(text);
      const from = match?.[1] ? parseDate(match[1]) : null;
      const to = match?.[2] ? parseDate(match[2]) : null;
      if (from && to) period = { from, to };
    }
    if (PERIOD_LINE_RE.test(trimmed)) continue;

    if (AMC_RE.test(trimmed)) {
      abandon(line.page, 'AMC boundary');
      amc = trimmed;
      regionOpen = false;
      continue;
    }

    // A transaction row can mention a folio ("Gifting of units-TO Folio No: ..."), but it starts with a date.
    const folioMatch = text.includes('Folio No') && !DATE_CELL_RE.test(text) ? FOLIO_RE.exec(text) : null;
    if (folioMatch?.[1]) {
      const number = folioMatch[1].replace(/\s+/g, '');
      const key = `${amc ?? 'UNKNOWN'}|${number}`;
      if (!folios.has(key)) folios.set(key, { amc: amc ?? 'UNKNOWN', masked: maskFolio(number), schemes: [] });
      folio = folios.get(key)!;
      scheme = null;
      abandon(line.page, 'folio boundary');
      regionOpen = true;
      continue;
    }

    const opening = OPEN_BALANCE_RE.exec(text);
    if (opening) {
      if (regionOpen) {
        const header = readSchemeHeader(region);
        scheme = header && folio ? newScheme(header) : null;
        if (scheme) folio!.schemes.push(scheme);
        else warnings.push(`A scheme block on page ${line.page} could not be read and was skipped; its transactions are missing from the results.`);
        regionOpen = false;
        region = [];
      }
      if (scheme) {
        scheme.open = parseNumber(opening[1]) ?? 0;
        scheme.closeCalculated = scheme.open;
      }
      continue;
    }

    // The footer belongs to the scheme just closed. "Closing Unit Balance" also opens the region of the next scheme.
    let consumed = false;
    if (scheme) {
      const close = CLOSE_BALANCE_RE.exec(text);
      if (close) {
        scheme.close = parseNumber(close[1]) ?? 0;
        region = [];
        regionOpen = true;
        consumed = true;
      }
      const nav = NAV_RE.exec(text);
      if (nav) {
        scheme.valuation.date = parseDate(nav[1]!);
        scheme.valuation.nav = parseNumber(nav[2]);
        consumed = true;
      }
      const valuation = VALUATION_RE.exec(text);
      if (valuation) {
        scheme.valuation.date = parseDate(valuation[1]!);
        scheme.valuation.value = parseNumber(valuation[2]);
        consumed = true;
      }
      const cost = COST_VALUE_RE.exec(text);
      if (cost) {
        scheme.valuation.cost = parseNumber(cost[1]);
        consumed = true;
      }
    }

    if (regionOpen) {
      if (!consumed && !isTransactionHeaderLine(text)) region.push(text);
      continue;
    }
    if (!scheme) continue;

    const row = splitRow(line, columns);
    const dated = DATE_CELL_RE.exec(row.lead);
    const date = dated?.[1] ? parseDate(dated[1]) : null;

    if (!dated || !date) {
      // A wrapped description: a dateless line with no numbers, directly under the row that emitted the last transaction.
      const previous = scheme.transactions[scheme.transactions.length - 1];
      const bare = row.amount === null && row.units === null && row.price === null && row.balance === null;
      if (previous && bare && row.lead && i === lastRow.index + 1 && line.page === lastRow.page && lastRow.y - line.y <= CONTINUATION_MAX_GAP) {
        // A folio number can wrap ("...Folio No:" / "5544..."), so read it from the joined text before masking.
        const joined = `${previous.description} ${row.lead}`;
        previous.description = maskDescription(joined);
        const { type, dividendRate } = classify(previous.description, previous.units);
        previous.type = type;
        previous.dividendRate = dividendRate;
        previous.giftFolio = type === 'GIFT_IN' || type === 'GIFT_OUT' ? (giftFolio(joined) ?? previous.giftFolio) : null;
        lastRow = { index: i, page: line.page, y: line.y };
      }
      continue;
    }

    const description = row.lead.slice(dated[0].length).trim();
    if (!description) continue;
    // A dated row with no numbers is either an informational marker ("***Registration of Nominee***", kept as MISC so
    // the trail survives) or a stray footnote date such as "Effective from 01-Apr-2019", which is skipped.
    if (row.amount === null && row.units === null && row.balance === null && !description.startsWith('***')) continue;

    // Some older templates omit the per-row price; it is amount / units.
    const nav = row.price ?? (row.amount !== null && row.units !== null && row.units !== 0 ? round(row.amount / row.units, 4) : null);
    const { type, dividendRate } = classify(description, row.units);
    scheme.transactions.push({
      date,
      description: maskDescription(description),
      type,
      amount: row.amount,
      units: row.units,
      nav,
      balance: row.balance,
      dividendRate,
      giftFolio: type === 'GIFT_IN' || type === 'GIFT_OUT' ? giftFolio(description) : null,
    });
    scheme.closeCalculated += row.units ?? 0;
    lastRow = { index: i, page: line.page, y: line.y };
  }
  abandon(lines[lines.length - 1]?.page ?? 0, 'end of document');

  return { period, folios: [...folios.values()], warnings };
}

/** Parses a CAMS / KFintech Detailed statement. Throws ParseError for unsupported or unrecognisable documents. */
export function parseStatement(rawItems: TextItem[]): Statement {
  const items = dropOverlayDuplicates(rawItems);
  const source = detectSource(items);
  const lines = toLines(items);
  const { period, folios, warnings } = readLines(lines, inferColumns(lines));

  const result: Folio[] = folios
    .filter((f) => f.schemes.length > 0)
    .map((f, n) => ({ id: `f${n + 1}`, amc: f.amc, folioMasked: f.masked, schemes: f.schemes }));
  if (result.length === 0) throw notAStatement();

  for (const folio of result) {
    for (const scheme of folio.schemes) {
      fixSigns(scheme);
      scheme.warnings = reconcile(scheme);
      scheme.reconciled = scheme.warnings.length === 0;
    }
  }
  return { source, period, folios: result, warnings };
}
