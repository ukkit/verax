// Small parsing helpers shared by the parser modules.

const MONTHS: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

/** "5,000.00" -> 5000, "(1,234.500)" -> -1234.5, "-12.5" -> -12.5. Null when it is not a number. */
export function parseNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (!s) return null;
  const negative = s.startsWith('(') || s.startsWith('-');
  const digits = s.replace(/^[(-]+/, '').replace(/\)+$/, '').replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(digits)) return null;
  const value = Number(digits);
  return negative ? -value : value;
}

/** "15-Jan-2021", "15 Jan 2021" or "15--Jan--2021" (overlay bleed) -> "2021-01-15". Null when invalid. */
export function parseDate(raw: string): string | null {
  const match = /^(\d{1,2})[-\s]*([A-Za-z]{3})[-\s]*(\d{4})$/.exec(raw.trim().replace(/[-\s]+/g, '-'));
  const month = match?.[2] ? MONTHS[match[2].toLowerCase()] : undefined;
  if (!match?.[1] || !match[3] || !month) return null;
  const day = Number(match[1]);
  if (day < 1 || day > 31) return null;
  return `${match[3]}-${month}-${String(day).padStart(2, '0')}`;
}

/** "12345678901 / 63" -> "••••8901": only the last four digits of the folio number are ever kept. */
export function maskFolio(folio: string): string {
  const digits = folio.split('/')[0]!.replace(/\D/g, '');
  return `••••${digits.slice(-4)}`;
}

export const round = (value: number, places: number): number => Number(value.toFixed(places));
