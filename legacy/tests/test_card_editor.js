/**
 * test_card_editor.js — Testes Automatizados do Editor Visual de Cards (RPG-SheetC v2.0)
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
        this.checked = false;
        this.dataset = {};
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

    querySelector() {
        return new MockElement('div');
    }

    querySelectorAll() {
        return [];
    }

    closest() {
        return null;
    }
}

const domElements = new Map();
global.document = {
    createElement: (tag) => new MockElement(tag),
    getElementById: (id) => {
        if (!domElements.has(id)) {
            domElements.set(id, new MockElement('div'));
        }
        return domElements.get(id);
    },
    querySelector: () => new MockElement('div'),
    querySelectorAll: () => []
};

global.window = {
    addEventListener: () => {},
    removeEventListener: () => {}
};
global.alert = () => {};
global.confirm = () => true;

const { SheetCWasm, CARD_TYPES, CARD_TYPE_META } = require('../web/js/wasm_loader.js');
const { VirtualList } = require('../web/js/components/virtual_list.js');
const { CardEditorView } = require('../web/js/views/card_editor_view.js');

global.window.VirtualList = VirtualList;
global.window.CARD_TYPES = CARD_TYPES;
global.window.CARD_TYPE_META = CARD_TYPE_META;

async function runTests() {
    console.log('=== Testes Automatizados do CardEditorView (RPG-SheetC v2.0) ===');

    const engine = new SheetCWasm();
    const wasmBytes = fs.readFileSync('./web/dist/sheetc_core.wasm');
    await engine.load(wasmBytes);
    assert(engine.isLoaded);

    engine.initDeck('Guerreiro Teste', 'Sistema Livre');
    engine.addSimpleCard('for', 'Força', CARD_TYPES.ATTRIBUTE, 16);
    engine.addSimpleCard('defesa', 'Defesa', CARD_TYPES.STAT, 10);

    let navigatedView = null;
    const router = {
        navigate: (v) => { navigatedView = v; }
    };

    const logs = [];
    const logFn = (msg, type) => logs.push({ msg, type });

    const editor = new CardEditorView(engine, router, logFn);

    // 1. Inicializa em modo de criação de novo card
    editor.init('editor-container', null);
    assert.strictEqual(editor.isEditingExisting, false);
    assert.strictEqual(editor.cardState.type, CARD_TYPES.EQUIPMENT);
    console.log('  [OK] Inicialização em modo de criação');

    // 2. Aplica modelo pré-definido "weapon" (Arma)
    editor.applyTemplate('weapon');
    assert.strictEqual(editor.cardState.key, 'machado_runico');
    assert.strictEqual(editor.cardState.type, CARD_TYPES.EQUIPMENT);
    assert.strictEqual(editor.cardState.modifiers.length, 1);
    assert.strictEqual(editor.cardState.modifiers[0].target_key, 'for');
    assert.strictEqual(editor.cardState.modifiers[0].value, 1);
    console.log('  [OK] Aplicação de template "weapon" com bônus e fórmulas');

    // 3. Avaliação dinâmica da fórmula no live preview
    const evalFormula = engine.evalExpression(editor.cardState.formula);
    // formula: '(@for - 10) / 2 + 8' com for=16 -> (16 - 10)/2 + 8 = 3 + 8 = 11
    assert.strictEqual(evalFormula, 11);
    console.log(`  [OK] Fórmula avaliada dinamicamente: "${editor.cardState.formula}" = ${evalFormula}`);

    // 4. Salva o card no motor C
    editor.saveCard();
    assert.strictEqual(navigatedView, 'compendium');
    const machado = engine.getCardByKey('machado_runico');
    assert(machado !== null);
    assert.strictEqual(machado.name, 'Machado de Batalha Rúnico');
    assert.strictEqual(machado.equipped, true);

    // Como o machado dá +1 em Força, Força deve ter recalculado para 17!
    const effectiveFor = engine.getEffectiveValue('for');
    assert.strictEqual(effectiveFor, 17);
    console.log(`  [OK] Card salvo no motor C! Força recalculada com modificador: ${effectiveFor}`);

    // 5. Edita o card existente
    navigatedView = null;
    editor.init('editor-container', 'machado_runico');
    assert.strictEqual(editor.isEditingExisting, true);
    assert.strictEqual(editor.cardState.name, 'Machado de Batalha Rúnico');

    // Altera nome e adiciona modificador de Defesa
    editor.cardState.name = 'Machado Sagrado da Luz';
    editor.cardState.modifiers.push({ target_key: 'defesa', value: 3 });
    editor.saveCard();

    const machadoAtualizado = engine.getCardByKey('machado_runico');
    assert.strictEqual(machadoAtualizado.name, 'Machado Sagrado da Luz');
    // Defesa inicial era 10, com +3 do machado deve ser 13!
    const effectiveDef = engine.getEffectiveValue('defesa');
    assert.strictEqual(effectiveDef, 13);
    console.log(`  [OK] Card atualizado in-place no C! Defesa recalculada: ${effectiveDef}`);

    // 6. Exclui o card
    editor.init('editor-container', 'machado_runico');
    editor.deleteCard();
    assert.strictEqual(engine.getCardByKey('machado_runico'), null);
    // Defesa deve voltar para 10 e Força para 16 após remoção!
    assert.strictEqual(engine.getEffectiveValue('defesa'), 10);
    assert.strictEqual(engine.getEffectiveValue('for'), 16);
    console.log('  [OK] Card excluído do motor C e valores base restaurados após recálculo');

    console.log('=== Todos os testes do CardEditorView passaram com 100% de sucesso! ===\n');
}

runTests();