import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import readline from 'readline';
import { execSync } from 'child_process';

const ROOT_DIR = path.resolve('.');
const BUILD_DIR = fs.existsSync(path.resolve('build/web')) ? path.resolve('build/web') : path.resolve('build');
const OUT_ZIP = path.resolve('build.zip');
const BUILD_ID = Date.now().toString(36);
const now = new Date();
const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const dateStr = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
const BUILD_TAG = `${dateStr} ${timeStr} (#${BUILD_ID})`;

// Parse CLI arguments: --platform <yandex|crazygames|generic>, --export
function getArg(flag) {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag) return args[i + 1] || true;
    if (args[i].startsWith(flag + '=')) return args[i].split('=')[1];
  }
  return null;
}

function findGodotExe() {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const candidates = [
    path.join(home, 'Downloads', 'Godot_v4.7.2-stable_win64.exe', 'Godot_v4.7.2-stable_win64_console.exe'),
    path.join(home, 'Downloads', 'Godot_v4.7.1-stable_win64.exe', 'Godot_v4.7.1-stable_win64_console.exe'),
    path.join(home, 'Documents', 'godot_v4.6', 'Godot_v4.6-stable_win64_console.exe'),
    'godot'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

async function promptPlatform() {
  const cliPlatform = getArg('--platform') || getArg('-p');
  if (cliPlatform) {
    return ['yandex', 'crazygames', 'generic'].includes(cliPlatform) ? cliPlatform : 'yandex';
  }

  if (!process.stdin.isTTY) {
    return 'yandex';
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\n🎮 Select Target Platform for Build:');
  console.log('  1) Yandex Games  (https://yandex.ru/games/sdk/v2) [Default]');
  console.log('  2) CrazyGames    (https://sdk.crazygames.com/crazygames-sdk-v3.js)');
  console.log('  3) Generic       (Offline / No external SDK)');

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.log('\n⏱️ Timeout reached, defaulting to 1 (Yandex Games).');
      rl.close();
      resolve('yandex');
    }, 4000);

    rl.question('\nEnter choice [1-3] (Default 1): ', (answer) => {
      clearTimeout(timer);
      rl.close();
      const choice = answer.trim();
      if (choice === '2' || choice.toLowerCase() === 'crazygames') resolve('crazygames');
      else if (choice === '3' || choice.toLowerCase() === 'generic') resolve('generic');
      else resolve('yandex');
    });
  });
}

async function main() {
  const platform = await promptPlatform();
  const doExport = getArg('--export') !== null;

  console.log(`\n📦 [2D Web Builder] Building ZIP package for [${platform.toUpperCase()}] (${BUILD_TAG})...\n`);

  // Optional: Auto-export from Godot if requested or if build/web doesn't exist
  if (doExport || !fs.existsSync(BUILD_DIR) || !fs.existsSync(path.join(BUILD_DIR, 'index.js'))) {
    const godotExe = findGodotExe();
    if (godotExe) {
      console.log(`🚀 Exporting Godot project using '${path.basename(godotExe)}'...`);
      fs.mkdirSync(BUILD_DIR, { recursive: true });
      execSync(`"${godotExe}" --headless --export-release "Web" "${path.join(BUILD_DIR, 'index.html')}"`, { stdio: 'inherit' });
      console.log('✅ Godot export complete.\n');
    }
  }

  if (!fs.existsSync(BUILD_DIR)) {
    console.error(`❌ Build directory '${BUILD_DIR}' not found. Please export your project from Godot first.`);
    process.exit(1);
  }

  // 1. Sync web_assets into build/web/
  const webAssetsDir = path.resolve('web_assets');
  if (fs.existsSync(webAssetsDir)) {
    const files = fs.readdirSync(webAssetsDir);
    for (const file of files) {
      if (file.endsWith('.import') || file === '.gdignore') continue;
      fs.copyFileSync(path.join(webAssetsDir, file), path.join(BUILD_DIR, file));
    }
    console.log(`✅ Synced asset(s) from web_assets/ to build output.`);
  }

  // 2. Compress index.wasm -> index.wasm.gz (Level 9) and REMOVE raw wasm to save space in zip!
  const wasmPath = path.join(BUILD_DIR, 'index.wasm');
  const wasmGzPath = path.join(BUILD_DIR, 'index.wasm.gz');
  if (fs.existsSync(wasmPath)) {
    const wasmData = fs.readFileSync(wasmPath);
    const wasmOriginalSize = wasmData.length;
    console.log(`🗜️  Compressing index.wasm (${(wasmOriginalSize / 1024 / 1024).toFixed(1)} MB) into index.wasm.gz (Level 9)...`);
    const gzWasm = zlib.gzipSync(wasmData, { level: 9 });
    fs.writeFileSync(wasmGzPath, gzWasm);
    fs.unlinkSync(wasmPath);
    console.log(`✅ Generated index.wasm.gz: ${(gzWasm.length / 1024 / 1024).toFixed(2)} MB (${Math.round((1 - gzWasm.length / wasmOriginalSize) * 100)}% reduction).`);
  } else if (fs.existsSync(wasmGzPath)) {
    const stat = fs.statSync(wasmGzPath);
    console.log(`✅ Verified index.wasm.gz: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
  }

  // 3. Compress index.pck -> index.pck.gz (Level 9)
  const pckPath = path.join(BUILD_DIR, 'index.pck');
  const pckGzPath = path.join(BUILD_DIR, 'index.pck.gz');
  if (fs.existsSync(pckPath)) {
    const pckData = fs.readFileSync(pckPath);
    const pckOriginalSize = pckData.length;
    console.log(`🗜️  Compressing index.pck into index.pck.gz (Level 9)...`);
    const gzPck = zlib.gzipSync(pckData, { level: 9 });
    fs.writeFileSync(pckGzPath, gzPck);
    fs.unlinkSync(pckPath);
    console.log(`✅ Generated index.pck.gz: ${(gzPck.length / 1024).toFixed(1)} KB.`);
  } else if (fs.existsSync(pckGzPath)) {
    const stat = fs.statSync(pckGzPath);
    console.log(`✅ Verified index.pck.gz: ${(stat.size / 1024).toFixed(1)} KB`);
  }

  // 4. Generate SDK Header based on selected platform
  let platformSdkHeader = '';
  if (platform === 'yandex') {
    platformSdkHeader = '<!-- Yandex Games SDK -->\n\t\t<script src="/sdk.js"></script>';
  } else if (platform === 'crazygames') {
    platformSdkHeader = '<!-- CrazyGames SDK v3 -->\n\t\t<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>';
  } else {
    platformSdkHeader = '<!-- Generic / Offline Mode (No external SDK) -->';
  }

  // 5. Generate build/web/index.html from web_shell/shell.html template
  const customShellPath = path.resolve('web_shell/shell.html');
  const htmlPath = path.join(BUILD_DIR, 'index.html');

  let godotConfig = '{"args":[],"canvasResizePolicy":2,"emscriptenPoolSize":4,"ensureCrossOriginIsolationHeaders":false,"executable":"index","experimentalVK":false,"fileSizes":{"index.pck":56468,"index.wasm":25038415},"focusCanvas":true,"gdextensionLibs":[],"godotPoolSize":2}';

  if (fs.existsSync(htmlPath)) {
    const existingHtml = fs.readFileSync(htmlPath, 'utf8');
    const match = existingHtml.match(/const GODOT_CONFIG = (\{[\s\S]*?\});/) || existingHtml.match(/new Engine\((\{[\s\S]*?\})\)/);
    if (match && match[1]) {
      godotConfig = match[1];
    }
  }

  if (fs.existsSync(customShellPath)) {
    let template = fs.readFileSync(customShellPath, 'utf8');
    template = template.replace(/\$GODOT_PROJECT_NAME/g, '2DWeb');
    template = template.replace(/\$PLATFORM_SDK_HEADER/g, platformSdkHeader);
    template = template.replace(/\$PLATFORM_NAME/g, platform);
    template = template.replace(/\$GODOT_CONFIG/g, godotConfig);
    template = template.replace(/\$GODOT_THREADS_ENABLED/g, 'false');
    template = template.replace(/\$GODOT_HEAD_INCLUDE/g, '');
    template = template.replace(/\$BUILD_TAG/g, BUILD_TAG);
    template = template.replace(/\$BUILD_HASH/g, BUILD_ID);
    template = template.replace(/\$GODOT_URL/g, 'index.js');

    fs.writeFileSync(htmlPath, template, 'utf8');
    console.log(`✅ Generated index.html with [${platform.toUpperCase()}] SDK & Steal an Egg loading screen.`);
  }

  // 6. Create build.zip archive from BUILD_DIR
  console.log('\n🗜️  Archiving build directory into build.zip (Deflate Level 9)...');

  function createZipArchive(sourceDir, zipPath) {
    const crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      crcTable[i] = c;
    }
    function calcCrc32(buf) {
      let crc = 0 ^ (-1);
      for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
      return (crc ^ (-1)) >>> 0;
    }

    function getAllFiles(dir, baseDir = dir) {
      let results = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        if (file === '.gdignore' || file.endsWith('.import')) continue;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results = results.concat(getAllFiles(fullPath, baseDir));
        } else {
          const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
          results.push({ fullPath, relPath });
        }
      }
      return results;
    }

    try {
      const files = getAllFiles(sourceDir);
      const localHeaders = [];
      const centralHeaders = [];
      let offset = 0;

      for (const { fullPath, relPath } of files) {
        const data = fs.readFileSync(fullPath);
        const crc = calcCrc32(data);
        const compressedData = zlib.deflateRawSync(data, { level: 9 });
        const useCompressed = compressedData.length < data.length;
        const finalData = useCompressed ? compressedData : data;
        const compMethod = useCompressed ? 8 : 0;

        const nameBuffer = Buffer.from(relPath, 'utf8');

        // Local header (30 bytes + name)
        const localHdr = Buffer.alloc(30 + nameBuffer.length);
        localHdr.writeUInt32LE(0x04034b50, 0);
        localHdr.writeUInt16LE(20, 4);
        localHdr.writeUInt16LE(0x0800, 6); // UTF-8
        localHdr.writeUInt16LE(compMethod, 8);
        localHdr.writeUInt16LE(0, 10);
        localHdr.writeUInt16LE(0, 12);
        localHdr.writeUInt32LE(crc, 14);
        localHdr.writeUInt32LE(finalData.length, 18);
        localHdr.writeUInt32LE(data.length, 22);
        localHdr.writeUInt16LE(nameBuffer.length, 26);
        localHdr.writeUInt16LE(0, 28);
        nameBuffer.copy(localHdr, 30);

        // Central header (46 bytes + name)
        const centralHdr = Buffer.alloc(46 + nameBuffer.length);
        centralHdr.writeUInt32LE(0x02014b50, 0);
        centralHdr.writeUInt16LE(20, 4);
        centralHdr.writeUInt16LE(20, 6);
        centralHdr.writeUInt16LE(0x0800, 8);
        centralHdr.writeUInt16LE(compMethod, 10);
        centralHdr.writeUInt16LE(0, 12);
        centralHdr.writeUInt16LE(0, 14);
        centralHdr.writeUInt32LE(crc, 16);
        centralHdr.writeUInt32LE(finalData.length, 20);
        centralHdr.writeUInt32LE(data.length, 24);
        centralHdr.writeUInt16LE(nameBuffer.length, 28);
        centralHdr.writeUInt16LE(0, 30);
        centralHdr.writeUInt16LE(0, 32);
        centralHdr.writeUInt16LE(0, 34);
        centralHdr.writeUInt16LE(0, 36);
        centralHdr.writeUInt32LE(0, 38);
        centralHdr.writeUInt32LE(offset, 42);
        nameBuffer.copy(centralHdr, 46);

        localHeaders.push(localHdr, finalData);
        centralHeaders.push(centralHdr);
        offset += localHdr.length + finalData.length;
      }

      const centralDirOffset = offset;
      let centralDirSize = 0;
      for (const ch of centralHeaders) centralDirSize += ch.length;

      const eocd = Buffer.alloc(22);
      eocd.writeUInt32LE(0x06054b50, 0);
      eocd.writeUInt16LE(0, 4);
      eocd.writeUInt16LE(0, 6);
      eocd.writeUInt16LE(files.length, 8);
      eocd.writeUInt16LE(files.length, 10);
      eocd.writeUInt32LE(centralDirSize, 12);
      eocd.writeUInt32LE(centralDirOffset, 16);
      eocd.writeUInt16LE(0, 20);

      const totalBuffer = Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
      fs.writeFileSync(zipPath, totalBuffer);
      console.log(`✅ Successfully created '${zipPath}' (${(totalBuffer.length / 1024 / 1024).toFixed(2)} MB).`);
    } catch (err) {
      console.warn(`⚠️ Built-in zip failed (${err.message}). Using system fallback...`);
      if (process.platform === 'win32') {
        execSync(`powershell -Command "Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${zipPath}' -Force"`, { stdio: 'inherit' });
      } else {
        execSync(`cd "${sourceDir}" && zip -r "${zipPath}" ./*`, { stdio: 'inherit' });
      }
    }
  }

  createZipArchive(BUILD_DIR, OUT_ZIP);
  const zipSize = (fs.statSync(OUT_ZIP).size / 1024 / 1024).toFixed(2);
  console.log(`\n🎉 ГОТОВО! Готовый архив для Яндекс Игр: 'build.zip' (${zipSize} МБ).`);
  console.log(`Файл index.html лежит строго в корне архива, как требует Яндекс.`);
}

main().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
