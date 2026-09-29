// Display formatting for the statement view. Indian grouping, as everywhere in the app.

const units = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export const formatUnits = (value: number): string => units.format(value);
export const formatRupees = (value: number): string => rupees.format(value);

/** "2026-09-17" -> "17 Sept 2026" (whatever the locale prints for the month). */
export const formatDate = (iso: string): string => day.format(new Date(`${iso}T00:00:00Z`));

const signedRupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' });
const percent = new Intl.NumberFormat('en-IN', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' });

/** A rupee amount with an explicit sign, for gains and changes. */
export const formatSignedRupees = (value: number): string => signedRupees.format(value);
/** A fraction as a signed percentage (0.1234 -> "+12.34%"). */
export const formatPercent = (fraction: number): string => percent.format(fraction);
/** "up" or "down" for colouring a gain; nothing for zero. */
export const trend = (value: number): string => (value > 0 ? 'chg up' : value < 0 ? 'chg down' : 'chg');

const compact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 });
/** A short rupee amount for chart axes: ₹1.3L, ₹2.5Cr. */
export const formatCompactRupees = (value: number): string => compact.format(value);
