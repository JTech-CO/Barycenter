import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const deploymentBase = '/Barycenter/';
const dist = join(root, 'dist');
const required = ['index.html', '_headers', '_redirects'];
const failures = [];
for (const file of required) {
  const absolute = join(dist, file);
  if (!existsSync(absolute) || statSync(absolute).size === 0) {
    failures.push(file + ' is missing or empty.');
  }
}

if (failures.length === 0) {
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((value) => value.includes('/assets/'));
  if (references.length < 2) {
    failures.push('index.html must reference JavaScript and CSS assets.');
  }
  for (const reference of references) {
    if (!reference.startsWith(deploymentBase + 'assets/')) {
      failures.push('Asset is outside the GitHub Pages base: ' + reference);
      continue;
    }
    const file = reference.slice(deploymentBase.length);
    if (!existsSync(join(dist, file))) {
      failures.push('Referenced asset is missing: ' + reference);
    }
  }
  const headers = readFileSync(join(dist, '_headers'), 'utf8');
  if (!headers.includes('max-age=31536000') || !headers.includes('no-cache')) {
    failures.push('Static cache policy is incomplete.');
  }
  const redirects = readFileSync(join(dist, '_redirects'), 'utf8');
  if (!redirects.includes('/index.html 200')) {
    failures.push('Static fallback redirect is incomplete.');
  }
}

if (failures.length > 0) {
  process.stderr.write(
    'Static artifact verification failed:\n' +
      failures.map((failure) => '- ' + failure).join('\n') +
      '\n',
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    'Static artifact verified: entry assets resolve, immutable asset caching is present, and SPA fallback is configured.\n',
  );
}
