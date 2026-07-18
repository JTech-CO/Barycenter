import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPhysicsReport,
  physicsReportToMarkdown,
} from '../src/validation/report.js';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const reportDirectory = resolve(repositoryRoot, 'reports');
const report = buildPhysicsReport(process.version);

if (!report.allPassed) {
  throw new Error('Physics report contains a failed M3 gate.');
}

await mkdir(reportDirectory, { recursive: true });
await writeFile(
  resolve(reportDirectory, 'physics-baseline.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
await writeFile(
  resolve(reportDirectory, 'physics-baseline.md'),
  physicsReportToMarkdown(report),
  'utf8',
);
