# Checking holdings and valuation against a real statement

`tools/valuation-check/` is the milestone 3 acceptance test: it parses your statement, builds the FIFO positions
(`src/domain/`), looks up live NAVs on mfnav.in (`src/valuation/`) and compares the result with the figures the
statement prints itself.

## Run it

In **your own terminal** (the password prompt is hidden and reaches only the child process's environment):

```bash
bash tools/valuation-check/run.sh ~/Downloads/statement.pdf
```

## What it prints

Counts and percentages only. No names, folios, ISINs or rupee amounts, so the output is safe to paste.

| Line | Meaning | Target |
|---|---|---|
| schemes | open, closed and excluded positions; each exclusion reason with its count | few or no exclusions |
| live NAV | how many schemes got a NAV from mfnav.in, how many fell back to the statement's NAV, how many are unvalued | all from mfnav.in |
| cost, FIFO vs statement | our FIFO cost of the units held against the statement's "Total Cost Value" | within 0.1% |
| value at the statement's own NAVs | units held × the NAV the statement printed, against its printed value; checks the units | within 0.1% |
| value at today's live NAVs | the same units at today's NAVs; informational, the dates differ | any |
| portfolio XIRR | headline return including closed positions | plausible |

Only open schemes that print both a value and a cost are compared. A large "cost" delta usually means a scheme whose
history starts before the statement (those are excluded, with the reason shown) or a cost-basis rule that differs from
the registrar's.
