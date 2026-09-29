// Labels of the transaction table header; a line with at least TXN_MIN_HITS of them is the header, not data.
export const TXN_HEADER_LABELS = new Set(['Date', 'Transaction', 'Amount', 'Units', 'Price', 'Unit', 'Balance', 'NAV']);
export const TXN_MIN_HITS = 4;
