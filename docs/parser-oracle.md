# Checking the parser against real statements

`tools/parser-oracle/` is the acceptance test that no synthetic fixture can be: it parses your own statements with the
production parser (`src/parser/`) and with [casparser](https://github.com/codereverser/casparser), and compares them.
casparser is only a development-time reference; it is never shipped.

## Run it

In **your own terminal** (the password prompts are hidden and reach only the two child processes' environment, never
the chat or the repo):

```bash
bash tools/parser-oracle/run.sh ~/Downloads/statement1.pdf ~/Downloads/statement2.pdf
```

The first run sets up casparser in `tools/parser-oracle/.venv` (needs `uv`). For each file it asks for the password
(press Enter if there is none), then writes `tools/parser-oracle/out/report.txt`. The raw JSON, which holds financial
data, is deleted after each file; set `KEEP=1` to keep it.

## What the report contains

Counts and yes/no flags only. Names, folios and amounts are never printed; a mismatched row appears only as a masked
shape such as `Redemption | units:y amt:y bal:y`. It is safe to paste into a chat or an issue.

| Line | Meaning | Target |
|---|---|---|
| transactions matched / recall | rows with the same date, units, amount and balance in both parsers | 100%, 0 missing, 0 extra |
| transaction type agrees | our classification against casparser's | all agree |
| closing unit balance, valuation line | per scheme, within 0.005 | 0 mismatches |
| ISIN, scheme name, folio last four | header fields | all equal (ISIN may be n/a) |
| reconcile flag agrees | our "balances add up" against casparser's own balance warnings | all agree |
| PII in our output | PAN-shaped values, emails, and runs of 8+ digits in text fields (references, account numbers) in what the app would hold; on a hit it lists the field and a digit-masked snippet | `(clean)` |

Result on 2026-09-29, on two real CAMS statements: 1,636 of 1,636 transactions matched with the finished parser (0 missing,
0 extra), every type, closing balance, valuation line, ISIN, scheme name and folio last-four agreed, and the privacy line was
clean once payment references in descriptions were masked. Re-run it whenever the parser changes what text it keeps.

## Notes

- Do not commit anything from `tools/parser-oracle/out/`; it is gitignored, and the repo scan blocks PDFs.
- KFintech-generated statements have not been checked against a real sample yet (the app labels them beta). If you get
  a new KFintech statement with a password you remember, this is the tool to run on it.
