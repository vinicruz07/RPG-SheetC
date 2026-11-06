/**
 * test_sheet_view.js — Testes Automatizados da Ficha Modular Orientada a Cards (RPG-SheetC v2.0)
 * Verifica recálculo dinâmico em C ao equipar e desequipar cards de armadura, escudo e magia.
 */

const fs = require('fs');
const assert = require('assert');

// Mock leve do ambiente DOM para Node.js com suporte a querySelectorAll sobre innerHTML
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
        this.id = '';
        this._parsedElements = [];
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set innerHTML(val) {
        this._innerHTML = val || '';
        this._parsedElements = parseMockTree(this._innerHTML);
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

    trigger(event, data = {}) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(fn => fn({ target: this, ...data }));
        }
    }

    querySelector(selector) {
        const res = this.querySelectorAll(selector);
        return res.length > 0 ? res[0] : null;
    }

    querySelectorAll(selector) {
        if (!this._parsedElements || this._parsedElements.length === 0) {
            return [];
        }
        return matchElements(this._parsedElements, selector);
    }
}

const domElements = new Map();

function parseMockTree(html) {
    const list = [];
    const tagPattern = /<([a-zA-Z0-9\-]+)([^>]*)>/g;
    let match;
    while ((match = tagPattern.exec(html)) !== null) {
        const tagName = match[1];
        const rawAttrs = match[2];
        const el = new MockElement(tagName);

        const attrPattern = /([a-zA-Z0-9_\-]+)(?:=["']([^"']*)["'])?/g;
        let attrMatch;
        while ((attrMatch = attrPattern.exec(rawAttrs)) !== null) {
            const attrName = attrMatch[1];
            const attrVal = attrMatch[2] ?? '';
            if (attrName === 'id') {
                el.id = attrVal;
                domElements.set(attrVal, el);
            } else if (attrName === 'class') {
                attrVal.split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c));
            } else if (attrName.startsWith('data-')) {
                // converte data-res-key -> resKey, data-card-key -> cardKey
                const dataKey = attrName.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase());
                el.dataset[dataKey] = attrVal;
            } else if (attrName === 'value') {
                el.value = attrVal;
            } else if (attrName === 'checked') {
                el.checked = true;
            }
        }
        list.push(el);
    }
    return list;
}

function matchElements(elements, selector) {
    const trimmed = (selector || '').trim();
    if (trimmed.startsWith('#')) {
        const id = trimmed.slice(1);
        return elements.filter(el => el.id === id);
    }
    if (trimmed.startsWith('.')) {
        // pode ter múltiplas classes separadas por vírgula ou espaço
        const classes = trimmed.split(',').map(s => s.trim().replace(/^\./, ''));
        return elements.filter(el => classes.some(c => el.classList.has(c)));
    }
    return elements.filter(el => el.tagName.toLowerCase() === trimmed.toLowerCase());
}

global.document = {
    createElement: (tag) => new MockElement(tag),
    getElementById: (id) => {
        if (!domElements.has(id)) {
            domElements.set(id, new MockElement('div'));
        }
        return domElements.get(id);
    },
    querySelector: (sel) => {
        if (sel.startsWith('#')) {
            return global.document.getElementById(sel.slice(1));
        }
        return new MockElement('div');
    },
    querySelectorAll: () => []
};

global.window = {
    addEventListener: () => {},
    removeEventListener: () => {}
};
global.alert = () => {};
global.confirm = () => true;

const { SheetCWasm, CARD_TYPES, CARD_TYPE_META } = require('../web/js/wasm_loader.js');
const { SheetView } = require('../web/js/views/sheet_view.js');

global.window.CARD_TYPES = CARD_TYPES;
global.window.CARD_TYPE_META = CARD_TYPE_META;

async function runTests() {
    console.log('=== Testes Automatizados da Ficha Modular (SheetView RPG-SheetC v2.0) ===');

    const engine = new SheetCWasm();
    const wasmBytes = fs.readFileSync('./web/dist/sheetc_core.wasm');
    await engine.load(wasmBytes);
    assert(engine.isLoaded, 'Motor C deve estar carregado');

    let navigatedView = null;
    const router = {
        navigate: (v) => { navigatedView = v; }
    };

    const logs = [];
    const logFn = (msg, type) => logs.push({ msg, type });

    const sheetView = new SheetView(engine, router, logFn);

    // 1. Inicialização e Estado Vazio
    engine.initDeck('Kallan Ironfist', 'Tormenta 20');
    sheetView.init('sheet-container');
    assert.strictEqual(engine.getCardCount(), 0);
    assert(sheetView.container.innerHTML.includes('Ficha Modular Vazia'), 'Deve renderizar tela vazia');
    console.log('  [OK] Inicialização e renderização de estado vazio');

    // 2. Carregamento do Kit Inicial
    sheetView.loadStarterDeck();
    assert(engine.getCardCount() > 0, 'Deck deve ter cards após carregar o kit inicial');
    assert.strictEqual(engine.getCharacterName(), 'Kallan Ironfist');
    assert.strictEqual(engine.getSystemName(), 'Tormenta 20');
    console.log(`  [OK] Kit inicial carregado com sucesso (${engine.getCardCount()} cards na memória C)`);

    // 3. Verificação de Atributos, Recursos e Defesa Inicial
    const forca = engine.getCardByKey('for');
    assert.strictEqual(forca.base, 16);
    assert.strictEqual(forca.effective, 16);

    const pv = engine.getCardByKey('pv');
    assert.strictEqual(pv.current, 24);
    assert.strictEqual(pv.max, 24);

    // Defesa: Base 10 + Armadura Couro (+3) = 13 (escudo_pesado e escudo_da_fe estão desequipados)
    let defInitial = engine.getEffectiveValue('defesa');
    assert.strictEqual(defInitial, 13, `Defesa inicial deve ser 13, obtido: ${defInitial}`);
    console.log(`  [OK] Defesa inicial calculada em C: ${defInitial} (10 base + 3 armadura)`);

    // 3.1. Verificação do Passo 10.3: Modos In-Game e Editar
    assert.strictEqual(sheetView.sheetMode, 'play', 'Modo inicial deve ser In-Game (play)');
    assert(sheetView.container.innerHTML.includes('Modo In-Game'), 'Deve conter botão do Modo In-Game');
    assert(sheetView.container.innerHTML.includes('Modo Editar'), 'Deve conter botão do Modo Editar');
    // No modo In-Game, controles de edição (como steppers de atributo) não aparecem
    assert.strictEqual(sheetView.container.querySelectorAll('.btn-attr-minus').length, 0, 'Modo In-Game não deve exibir steppers de atributo');
    console.log('  [OK] Passo 10.3: Modo In-Game limpo validado (sem steppers de edição acidental)');

    // Alterna para o Modo Editar para construir e equipar a ficha
    const btnModeEdit = sheetView.container.querySelector('#btn-mode-edit');
    assert(btnModeEdit, 'Botão #btn-mode-edit deve estar presente no cabeçalho');
    btnModeEdit.trigger('click');
    assert.strictEqual(sheetView.sheetMode, 'edit', 'Modo deve ter mudado para Editar (edit)');
    assert(sheetView.container.querySelectorAll('.btn-attr-minus').length > 0, 'Modo Editar deve exibir steppers de atributo');
    console.log('  [OK] Passo 10.3: Alternância para Modo Editar acionada com sucesso');

    // 4. Critério de Aceite: Equipar Escudo Pesado altera dinamicamente a Defesa via Motor C
    const shieldBefore = engine.getCardByKey('escudo_pesado');
    assert.strictEqual(shieldBefore.equipped, false, 'Escudo deve estar desequipado inicialmente');

    // Simula clique em "Equipar"
    const equipBtns = sheetView.container.querySelectorAll('.btn-equip-card');
    const shieldEquipBtn = equipBtns.find(b => b.dataset.cardKey === 'escudo_pesado');
    assert(shieldEquipBtn, 'Botão de equipar o escudo_pesado deve existir na mochila');

    shieldEquipBtn.trigger('click');

    // Verifica que o motor C recalculou a defesa dinamicamente
    const shieldAfter = engine.getCardByKey('escudo_pesado');
    assert.strictEqual(shieldAfter.equipped, true, 'Escudo agora deve estar equipado');

    const defWithShield = engine.getEffectiveValue('defesa');
    assert.strictEqual(defWithShield, 15, `Defesa deve ter aumentado de 13 para 15 (+2 escudo), obtido: ${defWithShield}`);
    console.log(`  [OK] Critério de Aceite: Equipar escudo alterou Defesa via C de 13 para ${defWithShield}!`);

    // 5. Critério de Aceite: Equipar/Ativar Magia (Escudo da Fé) altera dinamicamente a Defesa via C
    const spellBefore = engine.getCardByKey('escudo_da_fe');
    assert.strictEqual(spellBefore.equipped, false, 'Magia deve estar desativada inicialmente');

    const spellEquipBtn = sheetView.container.querySelectorAll('.btn-equip-card').find(b => b.dataset.cardKey === 'escudo_da_fe');
    assert(spellEquipBtn, 'Botão de ativar a magia escudo_da_fe deve existir');

    spellEquipBtn.trigger('click');

    const defWithSpell = engine.getEffectiveValue('defesa');
    assert.strictEqual(defWithSpell, 17, `Defesa deve ter subido para 17 (+2 magia), obtido: ${defWithSpell}`);
    console.log(`  [OK] Critério de Aceite: Ativar magia aumentou Defesa via C de 15 para ${defWithSpell}!`);

    // 6. Desequipar Escudo e Desativar Magia reduz dinamicamente
    const unequipBtns = sheetView.container.querySelectorAll('.btn-unequip-card');
    const shieldUnequipBtn = unequipBtns.find(b => b.dataset.cardKey === 'escudo_pesado');
    assert(shieldUnequipBtn, 'Botão de desequipar escudo deve existir na seção de equipados');

    shieldUnequipBtn.trigger('click');
    assert.strictEqual(engine.getEffectiveValue('defesa'), 15);

    const spellUnequipBtn = sheetView.container.querySelectorAll('.btn-unequip-card').find(b => b.dataset.cardKey === 'escudo_da_fe');
    spellUnequipBtn.trigger('click');
    assert.strictEqual(engine.getEffectiveValue('defesa'), 13);
    console.log('  [OK] Desequipar itens e magias restaura imediatamente os valores no motor C');

    // 7. Modificação Dinâmica de Recursos via botões da Ficha (-5 PV)
    const dmgBtn = sheetView.container.querySelectorAll('.btn-res-delta').find(b => b.dataset.resKey === 'pv' && b.dataset.delta === '-5');
    assert(dmgBtn, 'Botão -5 de PV deve existir');
    dmgBtn.trigger('click');
    assert.strictEqual(engine.getCurrentValue('pv'), 19, 'PV deve ser 19 após dano de -5');

    const healBtn = sheetView.container.querySelectorAll('.btn-res-delta').find(b => b.dataset.resKey === 'pv' && b.dataset.delta === '1');
    healBtn.trigger('click');
    assert.strictEqual(engine.getCurrentValue('pv'), 20, 'PV deve ser 20 após cura de +1');

    const fullBtn = sheetView.container.querySelectorAll('.btn-res-full').find(b => b.dataset.resKey === 'pv');
    fullBtn.trigger('click');
    assert.strictEqual(engine.getCurrentValue('pv'), 24, 'PV deve voltar para 24 após Total');
    console.log('  [OK] Manipulação de recursos dinâmicos (PV/PM) sincronizada com C');

    // 8. Edição de Atributos Básicos via steppers na Ficha
    const plusBtnFor = sheetView.container.querySelectorAll('.btn-attr-plus').find(b => b.dataset.attrKey === 'for');
    assert(plusBtnFor, 'Botão + de Força deve existir');
    plusBtnFor.trigger('click');
    assert.strictEqual(engine.getEffectiveValue('for'), 17, 'Força deve ter subido de 16 para 17');
    console.log('  [OK] Edição de atributo in-place atualizou memória C para 17');

    // 9. Perícias e Treinamento
    const atletismoBefore = engine.getCardByKey('atletismo');
    assert.strictEqual(atletismoBefore.trained, true);

    const trainCheckbox = sheetView.container.querySelectorAll('.skill-trained-checkbox').find(c => c.dataset.skillKey === 'atletismo');
    assert(trainCheckbox, 'Checkbox de treino de atletismo deve existir');
    trainCheckbox.checked = false;
    trainCheckbox.trigger('change');
    assert.strictEqual(engine.getCardByKey('atletismo').trained, false, 'Treino deve ter sido desmarcado no C');
    console.log('  [OK] Treinamento de perícia alterado reativamente no C');

    console.log('\n=== Todos os testes do SheetView passaram com 100% de sucesso! ===');
}

runTests().catch(err => {
    console.error('Falha nos testes do SheetView:', err);
    process.exit(1);
});
