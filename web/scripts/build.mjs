/**
 * build.mjs — Compilador Zero-Dependency para o Target Web (TypeScript -> JavaScript)
 * Usa o stripTypeScriptTypes nativo do Node.js (node:module) para transpilar os arquivos .ts em dist/
 * e empacotar o motor agnóstico (src/core/*.ts) em dist/core_engine.js (compatível com Browser e CommonJS).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const srcDir = path.join(webRoot, 'src');
const distDir = path.join(webRoot, 'dist');

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function stripImportsAndExports(jsCode) {
    return jsCode
        // Remove import type / import { ... } from '...'
        .replace(/^\s*import\s+type\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
        .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
        // Replace export class / export function / export const
        .replace(/^\s*export\s+(class|function|const|let|var)\s+/gm, '$1 ')
        // Remove export { ... }
        .replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, '');
}

console.log('🔨 [Web Build] Compilando Target Web (TypeScript -> JavaScript)...');
ensureDir(distDir);

// 1. Empacota o Core Engine (src/core/*.ts -> dist/core_engine.js)
const coreFiles = [
    'types.ts',
    'dice.ts',
    'formula_eval.ts',
    'api_client.ts',
    'card_engine.ts'
];

let bundledCoreParts = [
    '/**',
    ' * core_engine.js — Bundle Compilado do Motor Agnóstico de Fichas & CardPacks (TypeScript)',
    ' * Gerado automaticamente por web/scripts/build.mjs',
    ' */',
    '(function(globalScope) {',
    '"use strict";'
];

for (const file of coreFiles) {
    const fullPath = path.join(srcDir, 'core', file);
    const tsSource = fs.readFileSync(fullPath, 'utf-8');
    const stripped = stripTypeScriptTypes(tsSource, { mode: 'strip' });
    const cleaned = stripImportsAndExports(stripped);
    bundledCoreParts.push(`\n/* --- Module: core/${file} --- */\n` + cleaned);
}

bundledCoreParts.push(`
    if (typeof window !== 'undefined') {
        window.SheetEngine = SheetEngine;
        window.SheetCWasm = SheetEngine;
        window.DiceEngine = DiceEngine;
        window.evaluateFormula = evaluateFormula;
        window.ServerApiClient = ServerApiClient;
        window.CARD_TYPES = CARD_TYPES;
        window.CARD_TYPE_META = CARD_TYPE_META;
    }
    if (typeof globalScope !== 'undefined') {
        globalScope.SheetEngine = SheetEngine;
        globalScope.SheetCWasm = SheetEngine;
        globalScope.DiceEngine = DiceEngine;
        globalScope.evaluateFormula = evaluateFormula;
        globalScope.ServerApiClient = ServerApiClient;
        globalScope.CARD_TYPES = CARD_TYPES;
        globalScope.CARD_TYPE_META = CARD_TYPE_META;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            SheetEngine,
            SheetCWasm: SheetEngine,
            DiceEngine,
            evaluateFormula,
            ServerApiClient,
            CARD_TYPES,
            CARD_TYPE_META
        };
    }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
`);

const coreBundlePath = path.join(distDir, 'core_engine.js');
fs.writeFileSync(coreBundlePath, bundledCoreParts.join('\n'), 'utf-8');
console.log(`  ✅ Core Engine compilado: dist/core_engine.js (${fs.statSync(coreBundlePath).size} bytes)`);

// 2. Transpila os módulos de services, components, views e app.ts
const subDirs = ['services', 'components', 'views'];
let compiledCount = 1;

for (const sub of subDirs) {
    const inSub = path.join(srcDir, sub);
    const outSub = path.join(distDir, sub);
    ensureDir(outSub);

    const files = fs.readdirSync(inSub).filter(f => f.endsWith('.ts'));
    for (const file of files) {
        const tsPath = path.join(inSub, file);
        const jsFile = file.replace(/\.ts$/, '.js');
        const jsPath = path.join(outSub, jsFile);

        const tsSource = fs.readFileSync(tsPath, 'utf-8');
        const jsOutput = stripTypeScriptTypes(tsSource, { mode: 'strip' });
        fs.writeFileSync(jsPath, jsOutput, 'utf-8');
        compiledCount++;
        console.log(`  ✅ Transpilado: src/${sub}/${file} -> dist/${sub}/${jsFile}`);
    }
}

// 3. Transpila src/app.ts -> dist/app.js
const appTsPath = path.join(srcDir, 'app.ts');
const appJsPath = path.join(distDir, 'app.js');
const appTsSource = fs.readFileSync(appTsPath, 'utf-8');
const appJsOutput = stripTypeScriptTypes(appTsSource, { mode: 'strip' });
fs.writeFileSync(appJsPath, appJsOutput, 'utf-8');
compiledCount++;
console.log(`  ✅ Transpilado: src/app.ts -> dist/app.js`);

// 4. Sincroniza SRD_BASIC_PACK em web/data/srd_basic_pack.json
try {
    const packMgrModule = await import('file://' + path.join(distDir, 'services', 'pack_manager.js').replace(/\\/g, '/'));
    const srdPack = packMgrModule.default?.SRD_BASIC_PACK || packMgrModule.SRD_BASIC_PACK;
    if (srdPack) {
        const dataDir = path.join(webRoot, 'data');
        ensureDir(dataDir);
        fs.writeFileSync(path.join(dataDir, 'srd_basic_pack.json'), JSON.stringify(srdPack, null, 2), 'utf-8');
        console.log(`  ✅ Sincronizado: data/srd_basic_pack.json (${srdPack.cards.length} cards, ui_layout & creation_config ativos)`);
    }
} catch (syncErr) {
    console.warn('  ⚠️ Aviso ao sincronizar srd_basic_pack.json:', syncErr.message);
}

console.log(`🎉 [Web Build] Concluído com sucesso! (${compiledCount} artefatos gerados em web/dist/)`);
