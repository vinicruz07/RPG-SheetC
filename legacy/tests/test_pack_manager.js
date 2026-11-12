/**
 * test_pack_manager.js — Testes Automatizados do Gerenciador de Data Packs Comunitários (RPG-SheetC v2.0)
 * Valida download, exportação e importação com 1 clique de pacotes neutros SRD no motor C.
 */

const fs = require('fs');
const assert = require('assert');

// Mock leve do ambiente DOM para Node.js
class MockElement {
    constructor(tagName = 'div') {
        this.tagName = tagName.toUpperCase();
        this.classList = new Set();
        this.style = {};
        this.children = [];
        this.parentNode = null;
        this.listeners = {};
        this._innerHTML = '';
        this.value = '';
        this.disabled = false;
        this.dataset = {};
        this.id = '';
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set innerHTML(val) {
        this._innerHTML = val || '';
        this.children = [];
    }

    get textContent() {
        return this._textContent || '';
    }

    set textContent(val) {
        this._textContent = val;
    }

    addEventListener(event, fn) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(fn);
    }

    removeEventListener(event, fn) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(f => f !== fn);
        }
    }

    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
    }

    remove() {
        if (this.parentNode) {
            this.parentNode.children = this.parentNode.children.filter(c => c !== this);
            this.parentNode = null;
        }
    }

    querySelector(sel) {
        const res = this.querySelectorAll(sel);
        return res.length > 0 ? res[0] : null;
    }

    querySelectorAll(sel) {
        const list = [];
        const check = (node) => {
            const trimmed = sel.trim();
            if (trimmed.startsWith('#') && node.id === trimmed.slice(1)) {
                list.push(node);
            } else if (trimmed.startsWith('.') && node.classList.has(trimmed.slice(1))) {
                list.push(node);
            } else if (node.tagName && node.tagName.toLowerCase() === trimmed.toLowerCase()) {
                list.push(node);
            }
            if (node.children) {
                node.children.forEach(check);
            }
        };
        check(this);
        return list;
    }
}

const domElements = new Map();
global.document = {
    createElement: (tag) => new MockElement(tag),
    getElementById: (id) => {
        if (!domElements.has(id)) {
            const el = new MockElement('div');
            el.id = id;
            domElements.set(id, el);
        }
        return domElements.get(id);
    },
    body: new MockElement('body'),
    querySelector: (sel) => {
        if (sel.startsWith('#')) return global.document.getElementById(sel.slice(1));
        return new MockElement('div');
    },
    querySelectorAll: () => []
};

global.window = {
    addEventListener: () => {},
    removeEventListener: () => {}
};
global.alert = () => {};
global.Blob = class { constructor(parts) { this.parts = parts; } };
global.URL = { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} };

const { SheetCWasm, CARD_TYPES, CARD_TYPE_META } = require('../web/js/wasm_loader.js');
const { PackManager, SRD_BASIC_PACK } = require('../web/js/services/pack_manager.js');

global.window.CARD_TYPES = CARD_TYPES;
global.window.CARD_TYPE_META = CARD_TYPE_META;

async function runTests() {
    console.log('=== Testes Automatizados do PackManager (RPG-SheetC v2.0) ===');

    const engine = new SheetCWasm();
    const wasmBytes = fs.readFileSync('./web/dist/sheetc_core.wasm');
    await engine.load(wasmBytes);
    assert(engine.isLoaded, 'Motor C deve estar carregado');

    const logs = [];
    const logFn = (msg, type) => logs.push({ msg, type });

    const packManager = new PackManager(engine, logFn);

    // 1. Catálogo de Pacotes Comunitários Disponíveis
    const availablePacks = packManager.getAvailablePacks();
    assert(Array.isArray(availablePacks) && availablePacks.length > 0, 'Deve ter pacotes disponíveis');
    const srdPackMeta = availablePacks[0];
    assert.strictEqual(srdPackMeta.id, 'srd_basic');
    assert(srdPackMeta.name.includes('SRD Básico'));
    assert(srdPackMeta.cardCount >= 40);
    console.log(`  [OK] Catálogo de pacotes comunitários verificado: "${srdPackMeta.name}" (${srdPackMeta.cardCount} cards)`);

    // 2. Validação do arquivo JSON oficial web/data/srd_basic_pack.json
    assert(fs.existsSync('./web/data/srd_basic_pack.json'), 'Arquivo srd_basic_pack.json deve existir');
    const rawFileContent = fs.readFileSync('./web/data/srd_basic_pack.json', 'utf-8');
    const parsedFileJson = JSON.parse(rawFileContent);
    assert.strictEqual(parsedFileJson.system_name, 'Fantasia Aberta d20');
    assert(Array.isArray(parsedFileJson.cards), 'cards deve ser um array');
    assert(parsedFileJson.cards.length >= 40, 'Deve conter pelo menos 40 cards');
    console.log(`  [OK] Arquivo JSON do pacote comunitário validado (${parsedFileJson.cards.length} cards no JSON)`);

    // 3. Critério de Aceite: Importação com 1 clique (1-click community pack import)
    engine.initDeck('Personagem Teste', 'Sistema Neutro');
    assert.strictEqual(engine.getCardCount(), 0, 'Deck deve estar vazio inicialmente');

    const importRes = await packManager.loadCommunityPack('srd_basic', true);
    assert.strictEqual(importRes.success, true, 'Importação com 1 clique deve retornar sucesso');
    assert(importRes.count >= 40, `Deve importar ao menos 40 cards, importou: ${importRes.count}`);
    assert.strictEqual(engine.getCardCount(), importRes.count, 'Contagem no motor C deve coincidir');
    console.log(`  [OK] Critério de Aceite: Pacote comunitário importado com 1 clique (${engine.getCardCount()} cards populados no C)`);

    // 4. Verificação de Integridade dos Cards no Motor C e Recálculo Dinâmico
    const forca = engine.getCardByKey('for');
    assert(forca, 'Card de Força deve existir');
    assert.strictEqual(forca.type, CARD_TYPES.ATTRIBUTE);
    assert.strictEqual(forca.base, 14);

    const pv = engine.getCardByKey('pv');
    assert(pv, 'Card de PV deve existir');
    assert.strictEqual(pv.type, CARD_TYPES.RESOURCE);
    assert.strictEqual(pv.base, 28);

    const armadura = engine.getCardByKey('armadura_couro');
    assert(armadura, 'Card de armadura_couro deve existir');
    assert.strictEqual(armadura.type, CARD_TYPES.EQUIPMENT);
    assert.strictEqual(armadura.equipped, true);

    // Defesa: Base 10 + Armadura Couro (+2) = 12
    const defesa = engine.getEffectiveValue('defesa');
    assert.strictEqual(defesa, 12, `Defesa com armadura_couro equipada deve ser 12, obtido: ${defesa}`);
    console.log(`  [OK] Valores e modificadores do pacote recalculados com precisão no C (Defesa: ${defesa})`);

    // 5. Teste de Exportação do Pacote Ativo (.cardpack)
    const exportResult = packManager.exportPack('meu_compendio_exportado.cardpack');
    assert(exportResult, 'Deve retornar resultado de exportação');
    assert(exportResult.filename.endsWith('.cardpack'));
    assert(exportResult.bytes > 1000, 'Arquivo exportado deve ter conteúdo');
    const reImportTest = JSON.parse(exportResult.content);
    assert(Array.isArray(reImportTest.cards));
    console.log(`  [OK] Exportação de pacote .cardpack gerada com sucesso (${exportResult.bytes} bytes)`);

    // 6. Teste de Importação a partir de Texto JSON e File
    const customPackText = JSON.stringify({
        sheet_name: 'Pacote Extra',
        system_name: 'Custom',
        level: 1,
        cards: [
            { id: 99, type: 5, key: 'machado_runico', name: 'Machado Rúnico', desc: 'Arma mágica lendária.', formula: '2d6 + 5', equipped: 0 }
        ]
    });

    const textImportRes = packManager.importFromText(customPackText, true);
    assert.strictEqual(textImportRes.success, true);
    assert(engine.getCardByKey('machado_runico'), 'Novo card deve ter sido mesclado');
    console.log('  [OK] Importação de pacote arbitrário via texto JSON com merge');

    // 7. Teste de Importação via Mock File
    const mockFile = {
        name: 'teste.cardpack',
        text: async () => JSON.stringify({
            cards: [
                { id: 100, type: 6, key: 'teleporte', name: 'Teleporte Imediato', desc: 'Desloca instantaneamente.', cost_res: 'pm', cost_val: 3 }
            ]
        })
    };

    const fileImportRes = await packManager.importFromFile(mockFile, true);
    assert.strictEqual(fileImportRes.success, true);
    assert(engine.getCardByKey('teleporte'), 'Card do arquivo deve ter sido mesclado');
    console.log('  [OK] Importação assíncrona de arquivo local (File API)');

    // 8. Teste de Integridade e Carregamento do CardPack Completo de Tormenta 20 (Passo 11.5)
    const t20Paths = ['./local_packs/t20_completo.cardpack', './web/data/local/t20_completo.cardpack'];
    const activeT20Path = t20Paths.find(p => fs.existsSync(p));
    if (activeT20Path) {
        console.log(`--- Validando CardPack Unificado de Tormenta 20 (${activeT20Path}) ---`);
        const t20Raw = fs.readFileSync(activeT20Path, 'utf-8');
        const t20Json = JSON.parse(t20Raw);

        assert(t20Json.pack_name.includes('Tormenta 20'), 'Nome do pacote deve referenciar Tormenta 20');
        assert(t20Json.cards && t20Json.cards.length >= 200, `Pacote deve conter mais de 200 cards (encontrados: ${t20Json.cards.length})`);
        assert(t20Json.wizard_schema, 'Pacote deve conter wizard_schema integrado');
        assert.strictEqual(t20Json.wizard_schema.steps.length, 8, 'wizard_schema deve conter exatamente as 8 etapas oficiais');

        // Teste de importação direta no motor C99
        engine.initDeck('Kaelen de Valkaria', 'Tormenta 20');
        const importedT20Count = engine.importCardPack(t20Json, false);
        assert.strictEqual(importedT20Count, t20Json.cards.length, 'Todos os cards de T20 devem ser importados no C');
        engine.recalculate();

        assert.strictEqual(engine.getCardCount(), t20Json.cards.length, 'Contagem total de cards deve bater com o pacote');
        const t20Def = engine.getCardByKey('defesa');
        assert(t20Def !== null, 'Card de Defesa dinâmica deve existir');
        assert.strictEqual(t20Def.effective, 10, 'Defesa base sem modificadores deve ser 10');

        const forcaCard = engine.getCardByKey('for');
        assert(forcaCard !== null, 'Atributo Força deve existir');

        // Exportação do deck de T20 ativo e validação round-trip
        const t20Export = packManager.exportPack('t20_roundtrip.cardpack');
        assert(t20Export && t20Export.bytes > 10000, 'Exportação de T20 deve gerar arquivo completo');
        const parsedT20Export = JSON.parse(t20Export.content);
        assert.strictEqual(parsedT20Export.cards.length, t20Json.cards.length, 'Round-trip de exportação deve preservar todos os cards');
        console.log(`  [OK] Integridade do CardPack T20 Completo (${importedT20Count} cards, 8 etapas oficiais, round-trip O(1)) validada com sucesso!`);
    }

    console.log('\n=== Todos os testes do PackManager passaram com 100% de sucesso! ===');
}

runTests().catch(err => {
    console.error('Falha nos testes do PackManager:', err);
    process.exit(1);
});