import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const tracked = execFileSync('git', ['ls-files', '-z'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean);
const credentialPatterns = [
  /sk-ant-[A-Za-z0-9_-]{16,}/,
  /sk-(?:proj|live|test)-[A-Za-z0-9_-]{16,}/,
  /AIza[0-9A-Za-z_-]{24,}/,
  /AKIA[0-9A-Z]{16}/,
];
const findings = [];

for (const file of tracked) {
  const absolute = join(root, file);
  if (!existsSync(absolute) || statSync(absolute).size > 1_000_000) continue;
  const text = readFileSync(absolute, 'utf8');
  if (credentialPatterns.some((pattern) => pattern.test(text))) {
    findings.push(file + ': tracked credential-like value');
  }
}

/** @param {string} directory @returns {string[]} */
function filesUnder(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(absolute) : [absolute];
  });
}

for (const base of [join(root, 'src'), join(root, 'dist')]) {
  for (const file of filesUnder(base)) {
    const text = readFileSync(file, 'utf8');
    if (
      text.includes('BARYCENTER_AI_API_KEY') ||
      text.includes('BARYCENTER_AI_UPSTREAM_URL') ||
      credentialPatterns.some((pattern) => pattern.test(text))
    ) {
      findings.push(
        relative(root, file) + ': server-only credential boundary leaked',
      );
    }
  }
}

if (findings.length > 0) {
  process.stderr.write(
    'Secret-boundary scan failed:\n' +
      findings.map((finding) => '- ' + finding).join('\n') +
      '\n',
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    'Secret-boundary scan passed: tracked files and client bundle contain 0 credential-like values; server-only environment names are absent from src/dist.\n',
  );
}
