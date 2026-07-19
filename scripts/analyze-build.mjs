import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = process.cwd();
const dist = join(root, 'dist');
if (!existsSync(dist)) {
  throw new Error('dist is missing. Run pnpm build before bundle analysis.');
}

/** @param {string} directory */
function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(absolute) : [absolute];
  });
}

const files = filesUnder(dist)
  .sort()
  .map((absolute) => {
    const contents = readFileSync(absolute);
    return {
      file: relative(dist, absolute).replaceAll('\\', '/'),
      bytes: statSync(absolute).size,
      gzipBytes: gzipSync(contents, { level: 9 }).byteLength,
    };
  });
const sum = (extension, field) =>
  files
    .filter((entry) => extname(entry.file) === extension)
    .reduce((total, entry) => total + entry[field], 0);
const totals = {
  htmlBytes: sum('.html', 'bytes'),
  javascriptBytes: sum('.js', 'bytes'),
  javascriptGzipBytes: sum('.js', 'gzipBytes'),
  cssBytes: sum('.css', 'bytes'),
  cssGzipBytes: sum('.css', 'gzipBytes'),
  totalBytes: files.reduce((total, entry) => total + entry.bytes, 0),
  totalGzipBytes: files.reduce((total, entry) => total + entry.gzipBytes, 0),
};
const budgets = {
  htmlBytes: 10_000,
  javascriptGzipBytes: 150_000,
  cssGzipBytes: 30_000,
  totalGzipBytes: 250_000,
};
const failures = Object.entries(budgets)
  .filter(([key, maximum]) => totals[key] > maximum)
  .map(
    ([key, maximum]) =>
      key + ' is ' + totals[key] + ' bytes; budget is ' + maximum + ' bytes.',
  );
const generatedAt = new Date().toISOString();
const payload = {
  schemaVersion: 1,
  generatedAt,
  buildTarget: 'es2022',
  files,
  totals,
  budgets,
  passed: failures.length === 0,
  failures,
};
const lines = [
  '# M7 production bundle baseline',
  '',
  '**Generated**: ' + generatedAt,
  '**Build target**: es2022',
  '**Budget result**: ' + (payload.passed ? 'pass' : 'fail'),
  '',
  '## Assets',
  '',
  '| File | Raw bytes | Gzip bytes |',
  '|---|---:|---:|',
  ...files.map(
    (entry) =>
      '| ' + entry.file + ' | ' + entry.bytes + ' | ' + entry.gzipBytes + ' |',
  ),
  '',
  '## Initial bundle budgets',
  '',
  '| Budget | Actual | Maximum | Result |',
  '|---|---:|---:|:---:|',
  ...Object.entries(budgets).map(
    ([key, maximum]) =>
      '| ' +
      key +
      ' | ' +
      totals[key] +
      ' | ' +
      maximum +
      ' | ' +
      (totals[key] <= maximum ? 'pass' : 'fail') +
      ' |',
  ),
  '',
  'The bundle budget is a deterministic release guard, not an LCP measurement. Physical LCP must be observed in a supported browser and remains a separate release gate.',
  '',
].join('\n');

if (process.argv.includes('--write')) {
  writeFileSync(
    join(root, 'reports', 'bundle-baseline.json'),
    JSON.stringify(payload, null, 2) + '\n',
  );
  writeFileSync(join(root, 'reports', 'bundle-baseline.md'), lines);
}
process.stdout.write(lines);
if (process.argv.includes('--assert') && failures.length > 0) {
  process.stderr.write(
    'Bundle budgets failed:\n' +
      failures.map((failure) => '- ' + failure).join('\n') +
      '\n',
  );
  process.exitCode = 1;
}
