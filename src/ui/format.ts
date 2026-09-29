// Display formatting for the statement view. Indian grouping, as everywhere in the app.

const units = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export const formatUnits = (value: number): string => units.format(value);
export const formatRupees = (value: number): string => rupees.format(value);

/** "2026-09-17" -> "17 Sept 2026" (whatever the locale prints for the month). */
export const formatDate = (iso: string): string => day.format(new Date(`${iso}T00:00:00Z`));
