#!/usr/bin/env bash
# Real-file acceptance check for holdings and valuation, in your own terminal:
#   bash tools/valuation-check/run.sh ~/Downloads/statement.pdf
# Prompts for the password (hidden; it only reaches the child process's environment). Looks up live NAVs on mfnav.in and
# prints counts and percentages only, safe to paste. See docs/valuation-check.md.
set -uo pipefail
cd "$(dirname "$0")"
if [ "$#" -ne 1 ]; then echo "usage: bash tools/valuation-check/run.sh statement.pdf"; exit 1; fi
mkdir -p out
( cd ../.. && npx --yes esbuild tools/valuation-check/check.ts --bundle --platform=node --format=esm --external:pdfjs-dist --outfile=tools/valuation-check/out/check.mjs --log-level=error ) || exit 1
read -r -s -p "Password (hidden, empty if none): " CAS_PW; echo
export CAS_PW
node out/check.mjs "$1"
