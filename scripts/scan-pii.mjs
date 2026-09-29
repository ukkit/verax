#!/usr/bin/env node
// Fails if the repository contains a PDF, a PAN-shaped number or a real-looking email address.
//   node scripts/scan-pii.mjs            scan tracked + untracked (non-ignored) files
//   node scripts/scan-pii.mjs --staged   scan what is staged for commit (used by the pre-commit hook)
// Findings are printed masked; the full value is never echoed.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { findPii, isBinary, looksLikePdf } from './pii.mjs';

const staged = process.argv.includes('--staged');
const SKIP = new Set(['package-lock.json']);
const MAX_TEXT_BYTES = 1_500_000;

const git = (args, options = {}) => execFileSync('git', args, { maxBuffer: 256 * 1024 * 1024, ...options });
const list = (buffer) => buffer.toString('utf8').split('\0').filter(Boolean);

let files;
try {
  files = staged
    ? list(git(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR']))
    : list(git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']));
} catch {
  console.error('scan-pii: not a git repository (or git is missing); cannot list files.');
  process.exit(2);
}

const read = (file) => (staged ? git(['show', `:${file}`]) : readFileSync(file));

let problems = 0;
const report = (file, message) => {
  problems++;
  console.error(`${file}: ${message}`);
};

for (const file of files) {
  if (SKIP.has(file)) continue;
  let content;
  try {
    content = read(file);
  } catch (error) {
    if (error.code === 'ENOENT') continue; // tracked but deleted in the working tree
    report(file, `could not be read, so it was NOT scanned (${String(error.message).split('\n')[0]})`);
    continue;
  }
  if (extname(file).toLowerCase() === '.pdf' || looksLikePdf(content)) {
    report(file, 'PDF files must not be committed (statements contain personal data)');
    continue;
  }
  if (isBinary(content) || content.length > MAX_TEXT_BYTES) continue;
  for (const hit of findPii(content.toString('utf8'))) {
    report(`${file}:${hit.line}`, `${hit.kind === 'pan' ? 'PAN-shaped value' : 'email address'} (${hit.sample})`);
  }
}

if (problems > 0) {
  console.error(`\nscan-pii: ${problems} problem(s). Remove the data, or use a placeholder such as ABCDE1234F / user@example.com.`);
  process.exit(1);
}
console.log(`scan-pii: ok (${files.length} files checked${staged ? ', staged' : ''})`);
