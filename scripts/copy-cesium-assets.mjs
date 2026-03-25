import { cpSync, existsSync, mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const cesiumBuild = join(root, 'node_modules', 'cesium', 'Build', 'Cesium');
const dest = join(root, 'public', 'cesiumStatic');

if (!existsSync(cesiumBuild)) {
  console.log('[copy-cesium-assets] cesium package not found, skipping.');
  process.exit(0);
}

mkdirSync(dest, { recursive: true });

const dirs = ['Workers', 'ThirdParty', 'Assets', 'Widgets'];

for (const dir of dirs) {
  const src = join(cesiumBuild, dir);
  const target = join(dest, dir);
  if (existsSync(src)) {
    cpSync(src, target, { recursive: true, force: true });
    console.log(`[copy-cesium-assets] ${dir} → public/cesiumStatic/${dir}`);
  } else {
    console.warn(`[copy-cesium-assets] ${dir} not found in cesium build, skipping.`);
  }
}

console.log('[copy-cesium-assets] Done.');
