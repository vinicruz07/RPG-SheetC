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
    view.init('compendium-container');
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

    // 6. Teste de Benchmark (1.000 cards inseridos)
    view.currentFilterType = null;
    view.searchQuery = '';
    const countBefore = engine.getCardCount();
    view.generateBenchmarkCards();
    const countAfter = engine.getCardCount();
    assert.strictEqual(countAfter, countBefore + 1000);
    assert(view.virtualList.items.length >= 1000);
    console.log(`  [OK] Benchmark: 1.000 cards inseridos e virtual list atualizada (${countAfter} cards no total)`);

    // 7. Teste de Exportação
    view.exportCompendium();
    assert(logs.some(l => l.msg.includes('Compêndio exportado com sucesso')));
    console.log(`  [OK] Exportação de .cardpack gerada com integridade`);

    console.log('=== Todos os testes da CompendiumView passaram com 100% de sucesso! ===\n');
}

runTests();
