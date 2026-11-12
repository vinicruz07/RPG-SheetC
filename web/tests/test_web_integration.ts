/**
 * test_web_integration.ts — Suíte de Testes de Integração End-to-End do Target Web (TypeScript)
 * Valida o bundle compilado (dist/core_engine.js) junto com todas as Views, Componentes e Serviços:
 * - PackManager & SRD_BASIC_PACK (.cardpack com ui_layout, wizards e templates)
 * - CompendiumView (gerenciamento hierárquico de CardPacks e Cards)
 * - WizardView (criação Manual, Ficha Modelo / Template e Assistente Guiado de 6 etapas)
 * - SheetView (Modo In-Game vs Modo Editar, Abas Dinâmicas por .cardpack, Equipar/Desequipar, Cargas/Moedas)
 * - CardEditorView, CharacterStorage, SheetExporter, DiceRollerComponent e VirtualList
 */

import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

console.log('===================================================================');
console.log('🧪 [TESTE DE INTEGRAÇÃO] RPG-SheetC Web Target (TypeScript + UI)');
console.log('===================================================================');

// Mock DOM & Browser Environment para as Views e Serviços
class MockElement {
    id: string;
    tagName: string;
    className: string = '';
    innerHTML: string = '';
    textContent: string = '';
    value: string = '';
    disabled: boolean = false;
    style: Record<string, any> = {};
    dataset: Record<string, string> = {};
    attributes: Record<string, string> = {};
    children: MockElement[] = [];
    offsetParent: any = {};
    scrollTop: number = 0;
    clientHeight: number = 600;
    private listeners: Record<string, Function[]> = {};

    constructor(id = '', tagName = 'DIV') {
        this.id = id;
        this.tagName = tagName;
    }

    setAttribute(k: string, v: string) { this.attributes[k] = v; }
    getAttribute(k: string) { return this.attributes[k] || null; }
    addEventListener(ev: string, fn: Function) {
        if (!this.listeners[ev]) this.listeners[ev] = [];
        this.listeners[ev].push(fn);
    }
    trigger(ev: string, eventObj: any = {}) {
        (this.listeners[ev] || []).forEach(fn => fn(eventObj));
    }
    querySelector(sel: string): any {
        return this.innerHTML ? new MockElement(sel) : null;
    }
    querySelectorAll(_sel: string): any[] { return []; }
    appendChild(child: any) { this.children.push(child); return child; }
    removeChild(_child: any) {}
    remove() {}
    click() { this.trigger('click', { target: this, preventDefault() {}, stopPropagation() {} }); }
    classList = {
        classes: new Set<string>(),
        add(c: string) { this.classes.add(c); },
        remove(c: string) { this.classes.delete(c); },
        toggle(c: string) { if (this.classes.has(c)) this.classes.delete(c); else this.classes.add(c); },
        contains(c: string) { return this.classes.has(c); }
    };
}

const domRegistry = new Map<string, MockElement>();
function getOrCreateEl(id: string): MockElement {
    if (!domRegistry.has(id)) {
        domRegistry.set(id, new MockElement(id));
    }
    return domRegistry.get(id)!;
}

const storageMap = new Map<string, string>();
const mockLocalStorage = {
    getItem(k: string) { return storageMap.has(k) ? storageMap.get(k)! : null; },
    setItem(k: string, v: string) { storageMap.set(k, String(v)); },
    removeItem(k: string) { storageMap.delete(k); },
    clear() { storageMap.clear(); }
};

(globalThis as any).localStorage = mockLocalStorage;
(globalThis as any).document = {
    getElementById(id: string) { return getOrCreateEl(id); },
    createElement(tag: string) { return new MockElement('', tag.toUpperCase()); },
    querySelector(_sel: string) { return null; },
    querySelectorAll(_sel: string) { return []; },
    addEventListener() {},
    body: new MockElement('body', 'BODY')
};
(globalThis as any).window = globalThis;
(globalThis as any).window.localStorage = mockLocalStorage;
(globalThis as any).window.document = (globalThis as any).document;
(globalThis as any).window.addEventListener = () => {};
(globalThis as any).window.removeEventListener = () => {};
(globalThis as any).alert = () => {};
(globalThis as any).confirm = () => true;

// 1. Carrega os artefatos compilados de web/dist/
const { SheetEngine, SheetCWasm, CARD_TYPES } = require(path.join(distDir, 'core_engine.js'));
const { PackManager, SRD_BASIC_PACK } = require(path.join(distDir, 'services/pack_manager.js'));
const { CharacterStorage } = require(path.join(distDir, 'services/storage.js'));
const { SheetExporter } = require(path.join(distDir, 'services/export.js'));
const { VirtualList } = require(path.join(distDir, 'components/virtual_list.js'));
const { DiceRollerComponent } = require(path.join(distDir, 'components/dice_roller.js'));
const { CompendiumView } = require(path.join(distDir, 'views/compendium_view.js'));
const { WizardView } = require(path.join(distDir, 'views/wizard.js'));
const { SheetView } = require(path.join(distDir, 'views/sheet_view.js'));
const { CardEditorView } = require(path.join(distDir, 'views/card_editor_view.js'));

async function runIntegrationTests() {
    // -----------------------------------------------------------------------
    // 1. Bundle Core Engine & PackManager
    // -----------------------------------------------------------------------
    console.log('\n--> 1. Testando Bundle dist/core_engine.js e PackManager...');
    assert.strictEqual(SheetEngine, SheetCWasm, 'SheetCWasm deve ser alias de SheetEngine');
    const engine = new SheetEngine();
    await engine.load();
    assert.strictEqual(engine.isLoaded, true);

    const packManager = new PackManager(engine, () => {});
    const availablePacks = packManager.getAvailablePacks();
    assert.ok(availablePacks.length >= 1, 'PackManager deve listar o SRD Básico');
    assert.strictEqual(SRD_BASIC_PACK.cards.length, 46, 'SRD_BASIC_PACK deve conter os 46 cards padrão');
    assert.ok(SRD_BASIC_PACK.ui_layout && Array.isArray(SRD_BASIC_PACK.ui_layout.editor_tabs), 'SRD_BASIC_PACK deve possuir ui_layout.editor_tabs');
    assert.strictEqual(SRD_BASIC_PACK.ui_layout.editor_tabs.length, 6, 'SRD_BASIC_PACK deve configurar 6 abas dinâmicas');
    assert.ok(SRD_BASIC_PACK.creation_config && SRD_BASIC_PACK.creation_config.wizards.length === 1, 'SRD_BASIC_PACK deve possuir assistente guiado');
    assert.strictEqual(SRD_BASIC_PACK.creation_config.templates.length, 2, 'SRD_BASIC_PACK deve possuir 2 fichas modelo');
    console.log('    [OK] PackManager e SRD_BASIC_PACK validados com sucesso.');

    // -----------------------------------------------------------------------
    // 2. CompendiumView e Importação de CardPack
    // -----------------------------------------------------------------------
    console.log('\n--> 2. Testando CompendiumView (Gestão de CardPacks)...');
    const router = { currentView: 'home', navigate(v: string) { this.currentView = v; } };
    const compendiumView = new CompendiumView(engine, router, () => {});
    (globalThis as any).window.compendiumView = compendiumView;

    compendiumView.init('compendium-container', false);
    const loadRes = await packManager.loadCommunityPack('srd_basic', false);
    assert.strictEqual(loadRes.success, true);
    assert.strictEqual(loadRes.count, 46);

    const installedPacks = compendiumView.getInstalledPacks();
    assert.strictEqual(installedPacks.length, 1);
    assert.strictEqual(installedPacks[0].name, 'SRD Básico / Fantasia Aberta');
    assert.ok(installedPacks[0].ui_layout, 'O CardPack salvo no Compêndio deve preservar ui_layout');
    assert.ok(installedPacks[0].creation_config, 'O CardPack salvo no Compêndio deve preservar creation_config');
    console.log('    [OK] CompendiumView gerenciando CardPacks com metadados completos.');

    // -----------------------------------------------------------------------
    // 3. WizardView — Criação via Template, Manual e Assistente Guiado
    // -----------------------------------------------------------------------
    console.log('\n--> 3. Testando WizardView (Modos Template, Manual e Assistente Guiado)...');
    const storage = new CharacterStorage();
    (globalThis as any).window.characterStorage = storage;

    const sheetView = new SheetView(engine, router, () => {});
    (globalThis as any).window.sheetView = sheetView;
    sheetView.init('sheet-container');

    let lastCreatedHero: any = null;
    const wizardView = new WizardView(engine, router, (hero: any) => {
        lastCreatedHero = hero;
    });
    (globalThis as any).window.wizardView = wizardView;
    await wizardView.init('wizard-container');

    assert.strictEqual(wizardView.selectedPackId, installedPacks[0].id, 'Wizard deve auto-selecionar o CardPack instalado');

    // 3a. Modo Template (Guerreiro Campeão)
    wizardView.characterName = 'Theron Campeão';
    wizardView.creationMode = 'template';
    wizardView.selectedTemplateId = 'tpl_guerreiro';
    wizardView.finishCreation();

    assert.strictEqual(engine.getCharacterName(), 'Theron Campeão');
    assert.strictEqual(engine.getCardByKey('for').effective, 16);
    assert.strictEqual(engine.getCardByKey('pv').max, 30);
    // Defesa = 10 (base) + 2 (couro) + 2 (escudo pesado) = 14
    assert.strictEqual(engine.getCardByKey('defesa').effective, 14);
    assert.ok(lastCreatedHero && lastCreatedHero.name === 'Theron Campeão');

    // 3b. Modo Assistente Guiado (6 etapas)
    wizardView.reset();
    wizardView.characterName = 'Lyra Arcana';
    wizardView.characterData.name = 'Lyra Arcana';
    wizardView.creationMode = 'guided';
    wizardView.startGuidedWizard();
    assert.strictEqual(wizardView.currentStep, 3);
    assert.strictEqual(wizardView.getActiveSteps().length, 6);

    wizardView.characterData.attributes = { for: 0, des: 2, con: 1, int: 4, sab: 1, car: 0 };
    wizardView.characterData.raceKey = 'graca_elfica';
    wizardView.characterData.classKey = 'arcanista';
    wizardView.characterData.selectedWeapons = ['adaga'];
    wizardView.characterData.selectedArmor = 'armadura_couro';
    wizardView.characterData.selectedShield = 'nenhum';
    wizardView.finishGuidedCreation();

    assert.strictEqual(engine.getCharacterName(), 'Lyra Arcana');
    assert.ok(engine.getCardCount() >= 15, 'Ficha gerada pelo assistente guiado deve possuir atributos, recursos, perícias, raça, classe e equipamentos');
    console.log('    [OK] WizardView validado nos modos Template e Assistente Guiado.');

    // -----------------------------------------------------------------------
    // 4. SheetView — Modos Play/Edit, Abas Dinâmicas e Recálculo Reativo
    // -----------------------------------------------------------------------
    console.log('\n--> 4. Testando SheetView (Play/Edit Modes, Abas Dinâmicas e Equipamentos)...');
    // Carrega o SRD completo na ficha para testar todas as abas
    compendiumView.loadPackIntoEngine(installedPacks[0].id);
    sheetView.showingRoster = false;
    sheetView.setMode('play');
    const playHtml = getOrCreateEl('sheet-container').innerHTML;
    assert.ok(playHtml.includes('sheet-mode-play'), 'Deve renderizar em Modo In-Game (play)');

    sheetView.setMode('edit');
    const editHtml = getOrCreateEl('sheet-container').innerHTML;
    assert.ok(editHtml.includes('sheet-mode-edit'), 'Deve renderizar em Modo Editar (edit)');
    assert.ok(editHtml.includes('Biografia & Notas'), 'Deve exibir as 6 abas dinâmicas configuradas no ui_layout do CardPack');

    // Testa alternância de todas as abas do editor
    for (const tabId of ['overview', 'skills', 'abilities', 'spells', 'equipment', 'biography']) {
        sheetView.activeEditorTab = tabId;
        sheetView.render();
        const tabHtml = getOrCreateEl('sheet-container').innerHTML;
        assert.ok(tabHtml.length > 200, `Aba "${tabId}" deve renderizar conteúdo válido`);
    }

    // Testa equipar Cota de Malha (+5 Defesa) e verificar recálculo na ficha
    const defBefore = engine.getCardByKey('defesa').effective; // 14 (10 + 2 des + 2 couro)
    engine.toggleEquip(engine.getCardByKey('cota_malha').id);
    assert.strictEqual(engine.getCardByKey('defesa').effective, defBefore + 5);
    console.log('    [OK] SheetView (Play/Edit, 6 abas dinâmicas e recálculo de equipamentos) validada.');

    // -----------------------------------------------------------------------
    // 5. CardEditorView, Storage, Export, DiceRoller e VirtualList
    // -----------------------------------------------------------------------
    console.log('\n--> 5. Testando CardEditorView, Storage, Export, DiceRoller e VirtualList...');
    const cardEditor = new CardEditorView(engine, router, () => {});
    cardEditor.init('editor-container');
    assert.ok(getOrCreateEl('editor-container').innerHTML.length > 100, 'CardEditorView deve renderizar formulário');

    const diceRoller = new DiceRollerComponent(engine, () => {});
    diceRoller.init('view-roller');
    diceRoller.renderDedicatedView();
    assert.ok(getOrCreateEl('view-roller').innerHTML.length > 100, 'DiceRollerComponent deve renderizar view dedicada');

    const vList = new VirtualList(getOrCreateEl('vlist-test'), {
        itemHeight: 80,
        renderItem: (item: any) => `<div class="v-item">${item.name}</div>`
    });
    vList.setData(engine.getAllCards());
    assert.ok(getOrCreateEl('vlist-test').innerHTML.length > 0, 'VirtualList deve renderizar janela visível de cards');

    const savedEntry = storage.saveCurrent(engine, 'Herói Persistido', true);
    assert.ok(savedEntry && savedEntry.id, 'CharacterStorage deve salvar a ficha atual');
    assert.ok(storage.getAllSheets().length >= 1, 'CharacterStorage deve listar fichas salvas');

    const exportedRes = SheetExporter.exportToFile(engine);
    assert.strictEqual(exportedRes.data.format, 'RPG-SheetC');
    assert.strictEqual(exportedRes.data.sheet.cards.length, 46);
    console.log('    [OK] CardEditorView, CharacterStorage, SheetExporter, DiceRoller e VirtualList validados.');

    console.log('\n===================================================================');
    console.log('🎉 TODOS OS TESTES DE INTEGRAÇÃO WEB PASSARAM COM 100% DE SUCESSO!');
    console.log('===================================================================');
}

runIntegrationTests().catch((err) => {
    console.error('❌ Falha nos testes de integração:', err);
    process.exit(1);
});
