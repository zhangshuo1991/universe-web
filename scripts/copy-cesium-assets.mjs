import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(projectRoot, 'node_modules', 'cesium', 'Build', 'Cesium');
const targetRoot = path.join(projectRoot, 'public', 'cesiumStatic');
const folders = ['Workers', 'ThirdParty', 'Assets', 'Widgets'];

if (!existsSync(sourceRoot)) {
  console.warn('[copy-cesium-assets] Cesium build output not found, skipping.');
  process.exit(0);
}

mkdirSync(targetRoot, { recursive: true });

for (const folder of folders) {
  cpSync(path.join(sourceRoot, folder), path.join(targetRoot, folder), {
    recursive: true,
    force: true
  });
}

console.log('[copy-cesium-assets] Copied Cesium static assets to public/cesiumStatic');
