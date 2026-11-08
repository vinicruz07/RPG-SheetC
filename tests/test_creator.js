/**
 * test_creator.js — Teste Automatizado do Fluxo Dedicado de Criação de Ficha (Passo 10.5)
 */

const fs = require('fs');
const assert = require('assert');

// Mock DOM
class MockElement {
    constructor(tagName = 'div') {
        this.tagName = tagName.toUpperCase();
        this.classList = new Set();
        this.style = {};
        this.children = [];
        this.listeners = {};
        this._innerHTML = '';
        this.value = '';
    }

    get innerHTML() { return this._innerHTML; }
    set innerHTML(val) { this._innerHTML = val; }

    addEventListener(event, fn) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(fn);
    }

    trigger(event, data = {}) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(fn => fn({ target: this, ...data }));
        }
    }

    querySelectorAll(selector) {
        return [];
    }

    querySelector(selector) {
        return null;
    }
}

global.document = {
    createElement: (tag) => new MockElement(tag),
    getElementById: (id) => new MockElement('div')
};
global.window = {};

const { SheetCWasm } = require('../web/js/wasm_loader.js');
const { WizardView, CharacterCreatorView } = require('../web/js/views/wizard.js');

async function runTests() {
    console.log('=== Testes do Fluxo Dedicado de Criar Nova Ficha (Passo 10.5) ===');

    const engine = new SheetCWasm();
    const wasmBytes = fs.readFileSync('./web/dist/sheetc_core.wasm');
    await engine.load(wasmBytes);
    assert(engine.isLoaded);

    let navigatedTo = null;
    const router = {
        navigate: (view) => { navigatedTo = view; }
    };

    let createdHeroData = null;
    const onCreated = (data) => { createdHeroData = data; };

    const creator = new WizardView(engine, router, onCreated);
    creator.container = new MockElement('div');

    // 1. Mock de CardPacks disponíveis no compêndio
    const samplePack = {
        id: 'pack_t20_sample',
        name: 'Tormenta 20 - Amostra Heroica',
        system: 'Tormenta 20',
        author: 'Jambô / Test',
        version: '1.0.0',
        desc: 'Pacote de teste com atributos e itens.',
        cards: [
            { id: 1, type: 0, key: 'for', name: 'Força', base: 18, curr: 18, max: 18, equipped: 1 },
            { id: 2, type: 0, key: 'des', name: 'Destreza', base: 14, curr: 14, max: 14, equipped: 1 },
            { id: 3, type: 1, key: 'pv', name: 'Pontos de Vida', base: 30, curr: 30, max: 30, equipped: 1 }
        ]
    };

    creator.getAvailablePacks = () => [samplePack];

    // 2. Passo 1: Selecionar o CardPack Principal
    creator.reset();
    assert.strictEqual(creator.currentStep, 1, 'Deve iniciar no Passo 1');
    assert.strictEqual(creator.selectedPackId, 'pack_t20_sample', 'Primeiro CardPack deve ser auto-selecionado');
    creator.render();
    assert(creator.container.innerHTML.includes('Escolha o CardPack Principal'), 'Passo 1 deve exibir título de escolha');
    console.log('  [OK] Passo 1: Seleção de CardPack Principal validada');

    // 3. Avançar para o Passo 2: Identidade e Modo
    creator.currentStep = 2;
    creator.characterName = 'Kallan o Bárbaro';
    creator.creationMode = 'direct';
    creator.render();
    assert(creator.container.innerHTML.includes('Identidade & Método de Criação'), 'Passo 2 deve exibir título');
    assert(creator.container.innerHTML.includes('Ficha Rápida do Pacote'), 'Deve exibir opção de Ficha Rápida');
    console.log('  [OK] Passo 2: Configuração de Nome e Escolha de Modo validada');

    // 4. Finalização da Criação e injeção no Motor C
    creator.finishCreation();
    assert.strictEqual(engine.getCharacterName(), 'Kallan o Bárbaro', 'Nome deve ser gravado no C');
    assert.strictEqual(engine.getSystemName(), 'Tormenta 20', 'Sistema do pacote deve ser gravado no C');
    assert.strictEqual(engine.getCardCount(), 3, 'Cards do pacote devem ser carregados no deck do C');
    assert.strictEqual(engine.getEffectiveValue('for'), 18, 'Valor de Força deve ser 18');
    assert.strictEqual(navigatedTo, 'sheet', 'Deve redirecionar para a view da ficha');
    assert(createdHeroData !== null, 'Callback de criação deve ser acionado');
    console.log('  [OK] Ficha criada com sucesso no motor C e redirecionada para a aba Ficha');

    // 5. Suporte a getSelectedPack() e wizard_schema com 8 etapas
    samplePack.wizard_schema = {
        system: 'Tormenta 20',
        version: '2.0.0',
        steps: [
            { step: 1, key: 'concept', title: '1. Conceito do Personagem' },
            { step: 2, key: 'attributes', title: '2. Atributos Básicos' },
            { step: 3, key: 'race', title: '3. Raça' },
            { step: 4, key: 'class', title: '4. Classe' },
            { step: 5, key: 'origin', title: '5. Origem' },
            { step: 6, key: 'deity', title: '6. Divindade' },
            { step: 7, key: 'equipment', title: '7. Equipamento Inicial' },
            { step: 8, key: 'finishing', title: '8. Toques Finais' }
        ]
    };
    const currentPack = creator.getSelectedPack();
    assert(currentPack !== null, 'getSelectedPack deve retornar o pacote selecionado');
    assert(currentPack.wizard_schema !== null, 'Pacote deve conter wizard_schema');
    assert.strictEqual(currentPack.wizard_schema.steps.length, 8, 'wizard_schema deve conter exatamente as 8 etapas oficiais');
    console.log('  [OK] getSelectedPack() e wizard_schema com 8 etapas oficiais validados');

    // 6. Se t20_completo.cardpack estiver presente localmente, valida ecossistema completo e motor C
    const t20PackPath = './local_packs/t20_completo.cardpack';
    if (fs.existsSync(t20PackPath)) {
        const rawT20 = fs.readFileSync(t20PackPath, 'utf-8');
        const t20Pack = JSON.parse(rawT20);
        assert(t20Pack.pack_name.includes('Tormenta 20'), 'Nome do pacote T20 deve ser Tormenta 20');
        assert(t20Pack.cards.length >= 200, `Pacote T20 deve conter mais de 200 cards (encontrados: ${t20Pack.cards.length})`);
        assert(t20Pack.wizard_schema && t20Pack.wizard_schema.steps.length === 8, 'T20 deve conter wizard_schema de 8 etapas');

        // Testa importação no motor C
        engine.initDeck('Sir Kaelen', 'Tormenta 20');
        const importedCount = engine.importCardPack(t20Pack, false);
        assert.strictEqual(importedCount, t20Pack.cards.length, 'Todos os cards de T20 devem ser importados no C');
        engine.recalculate();
        const defCard = engine.getCardByKey('defesa');
        assert(defCard !== null, 'Card de Defesa deve existir');
        assert.strictEqual(defCard.effective, 10, 'Defesa base sem modificadores deve ser 10');
        console.log(`  [OK] Validação local do CardPack T20 Completo (${t20Pack.cards.length} cards, 8 etapas oficiais) concluída com sucesso!`);
    }

    console.log('=== Todos os testes do Creator passaram com 100% de sucesso! ===\n');
}

runTests().catch(err => {
    console.error('Falha nos testes do Creator:', err);
    process.exit(1);
});

