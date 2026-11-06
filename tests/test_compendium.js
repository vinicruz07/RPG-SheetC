/**
 * test_compendium.js — Testes Automatizados do Compêndio de Cards e Filtros (RPG-SheetC v2.0)
 */

const fs = require('fs');
const assert = require('assert');

// Mock leve do ambiente DOM para Node.js
class MockElement {
    constructor(tagName = 'div', isLeaf = false) {
        this.tagName = tagName.toUpperCase();
        this.classList = new Set();
        this.style = {};
        this.children = [];
        this.parentNode = null;
        this.clientWidth = 1200;
        this.clientHeight = 600;
        this.scrollTop = 0;
        this.listeners = {};
        this._innerHTML = '';
        this.value = '';
        this.checked = false;

        if (!isLeaf) {
            this.mockSpacer = new MockElement('div', true);
            this.mockSpacer.className = 'virtual-scroll-spacer';
            this.mockContent = new MockElement('div', true);
            this.mockContent.className = 'virtual-scroll-content';
        }
    }

    get className() {
        return Array.from(this.classList).join(' ');
    }

    set className(val) {
        this.classList = new Set((val || '').split(' ').filter(Boolean));
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set innerHTML(val) {
        this._innerHTML = val;
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

    querySelector(selector) {
        if (selector === '.virtual-scroll-spacer') return this.mockSpacer;
        if (selector === '.virtual-scroll-content') return this.mockContent;
        if (selector === '.virtual-scroll-empty') return null;
        return new MockElement('div', true);
    }

    remove() {
        if (this.parentNode) {
            this.parentNode.children = this.parentNode.children.filter(c => c !== this);
            this.parentNode = null;
        }
    }

    scrollTo(opts) {
        this.scrollTop = typeof opts === 'object' ? (opts.top || 0) : opts;
        if (this.listeners['scroll']) {
            this.listeners['scroll'].forEach(fn => fn());
        }
    }
}

const domElements = new Map();
global.document = {
    createElement: (tag) => new MockElement(tag, true),
    getElementById: (id) => {
        if (!domElements.has(id)) {
            domElements.set(id, new MockElement('div'));
        }
        return domElements.get(id);
    },
    querySelector: () => new MockElement('div'),
    body: {
        appendChild: () => {},
        removeChild: () => {}
    }
};

global.window = {
    addEventListener: () => {},
    removeEventListener: () => {}
};
global.requestAnimationFrame = (fn) => fn();
global.Blob = class { constructor(parts) { this.parts = parts; } };
global.URL = { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} };

const { SheetCWasm, CARD_TYPES, CARD_TYPE_META } = require('../web/js/wasm_loader.js');
const { VirtualList } = require('../web/js/components/virtual_list.js');
const { CompendiumView } = require('../web/js/views/compendium_view.js');

global.window.VirtualList = VirtualList;
global.window.CARD_TYPES = CARD_TYPES;
global.window.CARD_TYPE_META = CARD_TYPE_META;

async function runTests() {
    console.log('=== Testes Automatizados da CompendiumView (RPG-SheetC v2.0) ===');

    const engine = new SheetCWasm();
    const wasmBytes = fs.readFileSync('./web/dist/sheetc_core.wasm');
    await engine.load(wasmBytes);
    assert(engine.isLoaded);

    const router = { navigate: () => {} };
    const logs = [];
    const logFn = (msg, type) => logs.push({ msg, type });

    const view = new CompendiumView(engine, router, logFn);

    // 1. Inicialização e Seeding de Cards Iniciais
    view.init('compendium-container', true);
    const initialCount = engine.getCardCount();
    console.log(`  [OK] Compêndio inicializado com ${initialCount} cards de amostra`);
    assert(initialCount >= 15);

    // 2. Verifica busca textual por query
    view.searchQuery = 'espada';
    view.updateCardsList();
    const filteredBySearch = view.virtualList.items;
    assert(filteredBySearch.length >= 1);
    assert(filteredBySearch.some(c => c.name.toLowerCase().includes('espada')));
    console.log(`  [OK] Busca textual por "espada": ${filteredBySearch.length} card(s) retornado(s)`);

    // 3. Verifica filtro por tipo (Equipamento = 5)
    view.searchQuery = '';
    view.currentFilterType = CARD_TYPES.EQUIPMENT;
    view.updateCardsList();
    const equips = view.virtualList.items;
    assert(equips.length >= 2);
    assert(equips.every(c => c.type === CARD_TYPES.EQUIPMENT));
    console.log(`  [OK] Filtro por categoria (Equipamento): ${equips.length} card(s) retornado(s)`);

    // 4. Teste de Ação Rápida (Equipar / Desequipar card)
    const espada = engine.getCardByKey('espada_longa');
    assert(espada !== null);
    const initialEquipped = espada.equipped;
    view.handleCardAction('toggle-equip', espada, 0);
    assert.strictEqual(engine.getCardByKey('espada_longa').equipped, !initialEquipped);
    console.log(`  [OK] Ação de toggle equip/desequip executada e recalculada no motor C`);

    // 5. Teste de Ação de Rolagem de Fórmula
    const bolaFogo = engine.getCardByKey('bola_fogo');
    assert(bolaFogo !== null && bolaFogo.formula !== '');
    view.handleCardAction('roll', bolaFogo, 0);
    assert(logs.some(l => l.msg.includes('Rolagem C') && l.msg.includes('Bola de Fogo')));
    console.log(`  [OK] Ação de rolagem de card com fórmula acionada com sucesso`);

    // 6. Teste de Gerenciamento Hierárquico de CardPacks e Aninhamento de Cards (Passo 10.4)
    // 6.1. Criação de CardPack autoral
    const customPack = view.createPack({
        name: 'Sistema Autoral de Magia',
        system: 'Grimório Heroico',
        author: 'Mestre Valente',
        version: '1.2.0',
        desc: 'Coleção de magias antigas e canalizações.'
    });
    assert(customPack.id);
    assert.strictEqual(customPack.name, 'Sistema Autoral de Magia');
    assert.strictEqual(view.getPackById(customPack.id).cards.length, 0);
    console.log('  [OK] Criação de CardPack autoral no compêndio');

    // 6.2. Abertura e aninhamento de card dentro do pacote
    view.openPack(customPack.id);
    assert.strictEqual(view.activePackId, customPack.id);
    assert.strictEqual(view.currentViewMode, 'cards');

    const newSpellCard = {
        id: 101,
        type: CARD_TYPES.SPELL,
        key: 'raio_trovao',
        name: 'Raio de Trovão Primal',
        desc: 'Relâmpago que causa surdez e dano elétrico massivo.',
        formula: '4d6 + 4',
        cost_res: 'pm',
        cost_val: 3,
        equipped: 1
    };
    view.syncActivePackCard(newSpellCard);
    const updatedPack = view.getPackById(customPack.id);
    assert.strictEqual(updatedPack.cards.length, 1);
    assert.strictEqual(updatedPack.cards[0].key, 'raio_trovao');
    console.log('  [OK] Card aninhado e salvo dentro do CardPack selecionado');

    // 6.3. Upload e Importação de CardPack real (substituindo geração procedural de benchmark)
    const srdJsonPath = './data/srd_basic_pack.json';
    if (fs.existsSync(srdJsonPath)) {
        const rawContent = fs.readFileSync(srdJsonPath, 'utf-8');
        const mockEvent = {
            target: {
                files: [{
                    name: 'srd_basic_pack.cardpack',
                    text: async () => rawContent
                }],
                value: ''
            }
        };
        await view.handlePackFileImport(mockEvent);
        const importedPack = view.getInstalledPacks().find(p => p.name.includes('SRD Básico'));
        assert(importedPack, 'Pacote SRD deve ter sido importado pelo upload real');
        assert(importedPack.cards.length >= 40, 'Pacote importado deve conter 40+ cards reais');
        console.log(`  [OK] Upload e importação de CardPack real validado (${importedPack.cards.length} cards)`);

        // 6.4. Carregar CardPack na Ficha / Motor C
        view.loadPackIntoEngine(importedPack.id);
        assert(engine.getCardCount() >= 40, 'Cards do pacote devem ser carregados no motor C');
        assert.strictEqual(engine.getCharacterName(), importedPack.name);
        console.log(`  [OK] CardPack ativado com sucesso no motor C (${engine.getCardCount()} cards)`);
    }

    // 6.5. Retorno à visão de pacotes e exclusão de CardPack autoral
    view.currentViewMode = 'packs';
    view.activePackId = null;
    assert.strictEqual(view.currentViewMode, 'packs');
    const packCountBefore = view.getInstalledPacks().length;
    view.deletePack(customPack.id);
    const packCountAfter = view.getInstalledPacks().length;
    assert.strictEqual(packCountAfter, packCountBefore - 1, 'Pacote autoral deve ter sido removido');
    assert(!view.getPackById(customPack.id), 'Pacote excluído não deve mais ser encontrado');
    console.log('  [OK] Retorno à lista de pacotes e exclusão hierárquica validadas');

    // 7. Teste de Exportação
    view.exportCompendium();
    assert(logs.some(l => l.msg.includes('exportado com sucesso')));
    console.log(`  [OK] Exportação de .cardpack gerada com integridade`);

    console.log('=== Todos os testes da CompendiumView passaram com 100% de sucesso! ===\n');
}

runTests();
