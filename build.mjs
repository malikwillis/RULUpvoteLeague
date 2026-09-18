import { copyFile, mkdir, rm } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const output = new URL('./public/', root);

// Publish only browser assets. Server modules and local league data stay private.
const publicFiles = [
  'index.html',
  'styles.css',
  'app.js',
  'core.js',
  'data.js',
  'lineups.js',
  'schedule.js',
  'schedule-view.js',
  'access.js',
  'account-view.js',
  'draft-capital.js',
  'capital-data.js',
  'trade-core.js',
  'trade-view.js',
  'season-seed.js',
  'history-seed.js'
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all(publicFiles.map(file => copyFile(new URL(file, root), new URL(file, output))));
console.log(`Built ${publicFiles.length} public assets for Vercel.`);
