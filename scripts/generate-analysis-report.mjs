import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analysisReportToMarkdown,
  buildAnalysisReport,
} from '../src/validation/analysis-report.js';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const reportDirectory = resolve(repositoryRoot, 'reports');
const report = buildAnalysisReport(process.version);

if (!report.allPassed) {
  throw new Error('Analysis report contains a failed M4 gate.');
}

await mkdir(reportDirectory, { recursive: true });
await writeFile(
  resolve(reportDirectory, 'analysis-baseline.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
await writeFile(
  resolve(reportDirectory, 'analysis-baseline.md'),
  analysisReportToMarkdown(report),
  'utf8',
);
