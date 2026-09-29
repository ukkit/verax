#!/usr/bin/env bash
# Real-file acceptance check: parse each statement with the production parser and with casparser, and compare.
#   bash tools/parser-oracle/run.sh ~/Downloads/statement1.pdf [statement2.pdf ...]
# Run it in your own terminal: it prompts for each password (hidden), which only ever reaches the two child processes'
# environment. Only out/report.txt (counts and masked shapes) is meant to be shared; the raw JSON, which holds
# financial data, is deleted after each file unless KEEP=1. See docs/parser-oracle.md.
set -uo pipefail
cd "$(dirname "$0")"
mkdir -p out
: > out/report.txt
if [ "$#" -eq 0 ]; then echo "usage: bash tools/parser-oracle/run.sh file1.pdf [file2.pdf ...]"; exit 1; fi

if [ ! -x .venv/bin/python ]; then
  echo "Setting up casparser (one time): uv venv + pip install casparser"
  uv venv .venv -q && uv pip install -q --python .venv/bin/python casparser || { echo "could not install casparser"; exit 1; }
fi
( cd ../.. && npx --yes esbuild tools/parser-oracle/parse.ts --bundle --platform=node --format=esm --external:pdfjs-dist --outfile=tools/parser-oracle/out/parse.mjs --log-level=error ) || exit 1

for pdf in "$@"; do
  label=$(basename "$pdf" .pdf)
  read -r -s -p "Password for ${label} (hidden, empty if none): " CAS_PW; echo
  export CAS_PW
  { .venv/bin/python oracle.py "$pdf" "out/${label}.oracle.json" 2>&1 | tail -2; } | sed "s/^/[$label] /" | tee -a out/report.txt
  { node out/parse.mjs "$pdf" "out/${label}.ours.json" 2>&1 | tail -2; } | sed "s/^/[$label] /" | tee -a out/report.txt
  unset CAS_PW
  node compare.mjs "$label" | tee -a out/report.txt
  [ "${KEEP:-0}" = "1" ] || rm -f "out/${label}.oracle.json" "out/${label}.ours.json"
done
echo "Report written to: $(pwd)/out/report.txt"
