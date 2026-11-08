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
            } else if (attrName === 'style') {
                attrVal.split(';').forEach(rule => {
                    const [k, v] = rule.split(':').map(s => s && s.trim());
                    if (k && v) el.style[k] = v;
                });
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

    // 10. Rolagem rápida de Atributo em Modo In-Game
    sheetView.setMode('play');
    assert.strictEqual(sheetView.sheetMode, 'play', 'Modo deve retornar para In-Game');
    const attrModFor = sheetView.container.querySelectorAll('.sheet-attr-mod').find(m => m.dataset.attrKey === 'for');
    assert(attrModFor, 'Modificador de Força deve existir');
    attrModFor.trigger('click');
    assert(logs.some(l => l.msg.includes('Força') || l.msg.includes('Rolagem')), 'Deve registrar rolagem de atributo no log');
    console.log('  [OK] Rolagem rápida de atributo no Modo In-Game acionada e registrada');

    // 11. Retorno para a Galeria de Personagens (Roster) a partir da Ficha
    const btnBackRoster = sheetView.container.querySelector('#btn-sheet-back-to-roster');
    assert(btnBackRoster, 'Botão de voltar à galeria deve existir no topo da ficha');
    btnBackRoster.trigger('click');
    assert.strictEqual(sheetView.showingRoster, true, 'Flag showingRoster deve ser ativada');
    assert(sheetView.container.innerHTML.includes('sheet-roster-mount-point'), 'Deve renderizar tela da galeria com mount point');
    console.log('  [OK] Retorno para a Galeria de Personagens a partir da Ficha validado');

    // 12. Retomada da Ficha Ativa a partir da Galeria
    sheetView.showingRoster = false;
    sheetView.render();
    assert.strictEqual(sheetView.showingRoster, false);
    assert(sheetView.container.innerHTML.includes('Kallan Ironfist'), 'Deve restaurar ficha ativa no DOM');
    console.log('  [OK] Reabertura da Ficha Ativa a partir da Galeria validada');

    // 13. Passo 11.2: Presença dos botões de adicionar cards no Modo Editar
    sheetView.setMode('edit');
    assert.strictEqual(sheetView.sheetMode, 'edit');
    const btnAddItem = sheetView.container.querySelector('#btn-add-item-modal');
    const btnAddSpell = sheetView.container.querySelector('#btn-add-spell-modal');
    assert(btnAddItem, 'Botão #btn-add-item-modal deve estar visível no Modo Editar');
    assert(btnAddSpell, 'Botão #btn-add-spell-modal deve estar visível no Modo Editar');
    console.log('  [OK] Passo 11.2: Botões de adicionar Item e Magia validados no Modo Editar');

    // 14. Passo 11.2: Abertura do Modal de Busca para Equipamentos
    sheetView.openCardPicker('equipment');
    assert.strictEqual(sheetView.pickerTargetMode, 'equipment');
    const pickerOverlay = global.document.getElementById('modal-sheet-add-card-overlay');
    assert(pickerOverlay, 'Overlay do picker deve existir no DOM');
    assert.strictEqual(pickerOverlay.style.display, 'flex', 'Overlay do picker deve estar visível');
    console.log('  [OK] Passo 11.2: Abertura do Modal de Busca para Equipamentos validada');

    // 15. Passo 11.2: Adição de Card de Equipamento à Mochila via Picker
    const cardCountBeforeEquip = engine.getCardCount();
    const mockWeapon = {
        key: 'machado_guerra',
        name: 'Machado de Guerra Anão',
        type: CARD_TYPES.EQUIPMENT,
        desc: 'Poderosa arma de duas mãos de forja anã.',
        formula: '1d12 + (@for - 10) / 2',
        modifiers: []
    };
    sheetView.addCardFromPicker(mockWeapon);
    assert.strictEqual(engine.getCardCount(), cardCountBeforeEquip + 1, 'Card deve ter sido adicionado à memória C');
    const addedWeapon = engine.getCardByKey('machado_guerra');
    assert(addedWeapon, 'Card machado_guerra deve ser recuperável no C');
    assert.strictEqual(addedWeapon.equipped, false, 'Card adicionado deve iniciar desequipado na mochila');
    console.log('  [OK] Passo 11.2: Card adicionado à mochila desequipado e recalculado no C');

    // 16. Passo 11.2: Abertura do Modal de Busca para Magias e Adição ao Grimório
    sheetView.openCardPicker('spells');
    assert.strictEqual(sheetView.pickerTargetMode, 'spells');
    const cardCountBeforeSpell = engine.getCardCount();
    const mockSpell = {
        key: 'toque_chocante',
        name: 'Toque Chocante',
        type: CARD_TYPES.SPELL,
        desc: 'Descarga elétrica de contato.',
        cost_resource: 'pm',
        cost_value: 1,
        formula: '2d8 + 2'
    };
    sheetView.addCardFromPicker(mockSpell);
    assert.strictEqual(engine.getCardCount(), cardCountBeforeSpell + 1);
    const addedSpell = engine.getCardByKey('toque_chocante');
    assert(addedSpell, 'Card de magia deve existir no motor C');
    assert.strictEqual(addedSpell.equipped, false, 'Magia adicionada deve iniciar no grimório não preparada');
    console.log('  [OK] Passo 11.2: Magia adicionada ao grimório e sincronizada no C');

    // 17. Passo 11.2: Fechamento do Modal e Re-renderização da Ficha
    sheetView.closeCardPicker();
    const currentOverlay = global.document.getElementById('modal-sheet-add-card-overlay');
    assert(currentOverlay, 'Overlay do picker deve existir no DOM');
    assert.strictEqual(currentOverlay.style.display, 'none', 'Overlay deve estar oculto após fechar');
    assert(sheetView.container.innerHTML.includes('Machado de Guerra Anão'), 'Mochila deve exibir novo item na ficha');
    assert(sheetView.container.innerHTML.includes('Toque Chocante'), 'Grimório deve exibir nova magia na ficha');
    console.log('  [OK] Passo 11.2: Fechamento do modal e re-renderização com novos cards validados');

    // 18. Passo 11.5: Validação do Sistema de Busca e Filtragem por Categorias no Picker
    sheetView.openCardPicker('equipment');
    sheetView.getAvailableCompendiumCards = () => [
        { key: 'espada_longa', name: 'Espada Longa', type: CARD_TYPES.EQUIPMENT, formula: '1d8 + @for' },
        { key: 'arco_curto', name: 'Arco Curto', type: CARD_TYPES.EQUIPMENT, formula: '1d6' },
        { key: 'armadura_couro', name: 'Armadura de Couro', type: CARD_TYPES.EQUIPMENT, mods: [{ target: 'defesa', val: 2 }] },
        { key: 'pocao_cura', name: 'Poção de Cura', type: CARD_TYPES.EQUIPMENT, desc: 'Restaura vida.' }
    ];

    // Busca textual
    sheetView.pickerSearchQuery = 'arco';
    sheetView.pickerCategoryFilter = null;
    let filteredCards = sheetView.getAvailablePickerCards();
    assert.strictEqual(filteredCards.length, 1, 'Busca por "arco" deve retornar 1 card');
    assert.strictEqual(filteredCards[0].key, 'arco_curto');

    // Filtro por categoria "weapons"
    sheetView.pickerSearchQuery = '';
    sheetView.pickerCategoryFilter = 'weapons';
    filteredCards = sheetView.getAvailablePickerCards();
    assert(filteredCards.some(c => c.key === 'espada_longa'), 'Filtro de armas deve incluir espada_longa');
    assert(filteredCards.some(c => c.key === 'arco_curto'), 'Filtro de armas deve incluir arco_curto');
    assert(!filteredCards.some(c => c.key === 'armadura_couro'), 'Filtro de armas não deve incluir armaduras');

    // Filtro por categoria "armors"
    sheetView.pickerCategoryFilter = 'armors';
    filteredCards = sheetView.getAvailablePickerCards();
    assert(filteredCards.some(c => c.key === 'armadura_couro'), 'Filtro de armaduras deve incluir armadura_couro');
    assert(!filteredCards.some(c => c.key === 'espada_longa'), 'Filtro de armaduras não deve incluir armas');

    sheetView.closeCardPicker();
    console.log('  [OK] Passo 11.5: Filtragem textual e por categorias do modal de busca validadas com sucesso');

    // 19. Validação da Aba de Habilidades Orientada a CardPack (ui_layout.editor_tabs) e Obrigatoriedade
    // Mock do cardpack ativo com ui_layout e categorias
    sheetView._activeCardPack = {
        id: 't20_pack',
        system_name: 'Tormenta 20',
        ui_layout: {
            default_tab: 'overview',
            editor_tabs: [
                { id: 'overview', name: 'Visão Geral', icon: '📜' },
                {
                    id: 'abilities',
                    name: 'Habilidades',
                    icon: '⚡',
                    categories: [
                        { id: 'class', name: 'Habilidades de Classe', category: 'class_ability', icon: '⚔️' },
                        { id: 'race', name: 'Habilidades & Traços de Raça', category: 'race_trait', icon: '🧬' },
                        { id: 'origin', name: 'Poderes de Origem', category: 'origin_power', icon: '📜' },
                        { id: 'deity', name: 'Poderes Concedidos / Divindade', category: 'deity_power', icon: '🕊️' }
                    ]
                },
                { id: 'equipment', name: 'Equipamento', icon: '🎒' },
                { id: 'spells', name: 'Magias', icon: '✨' },
                { id: 'skills', name: 'Perícias', icon: '🎯' }
            ]
        },
        cards: [
            { key: 'guerreiro_ataque_esp', name: 'Ataque Especial', category: 'class_ability', is_mandatory: 1 },
            { key: 'humano_versatil', name: 'Versatilidade Humana', category: 'race_trait', is_mandatory: 1 }
        ]
    };

    // Adiciona uma habilidade obrigatória (ex: Ataque Especial do Guerreiro) e uma traço racial obrigatório
    engine.addCard({
        key: 'guerreiro_ataque_esp',
        name: 'Ataque Especial',
        type: CARD_TYPES.ABILITY,
        desc: 'Gasta 1 PM para +4 no ataque ou dano.',
        category: 'class_ability',
        is_mandatory: 1,
        equipped: true
    });
    engine.addCard({
        key: 'humano_versatil',
        name: 'Versatilidade Humana',
        type: CARD_TYPES.TRAIT,
        desc: 'Treinado em perícias extras.',
        category: 'race_trait',
        is_mandatory: 1,
        equipped: true
    });

    sheetView.setMode('edit');
    assert(sheetView.container.innerHTML.includes('sheet-editor-tabs-bar'), 'Barra de abas dinâmicas do editor deve estar presente');
    assert(sheetView.container.innerHTML.includes('data-editor-tab="abilities"'), 'Aba de Habilidades deve ser renderizada a partir do layout');

    // Troca para a aba de Habilidades
    sheetView.activeEditorTab = 'abilities';
    sheetView.render();
    assert(sheetView.container.innerHTML.includes('sheet-abilities-tab-view'), 'Container da aba de habilidades deve estar renderizado');
    assert(sheetView.container.innerHTML.includes('Habilidades de Classe'), 'Seção de Classe deve estar presente');
    assert(sheetView.container.innerHTML.includes('Ataque Especial'), 'Ataque Especial obrigatório deve ser listado');
    assert(sheetView.container.innerHTML.includes('Versatilidade Humana'), 'Versatilidade Humana deve ser listada');
    assert(sheetView.container.innerHTML.includes('🔒 Obrigatória'), 'Badge de habilidade obrigatória deve estar visível');

    // Testa abertura do picker no modo habilidades
    sheetView.openCardPicker('abilities');
    assert.strictEqual(sheetView.pickerTargetMode, 'abilities');
    sheetView.getAvailableCompendiumCards = () => [
        { key: 'guerreiro_golpe_pessoal', name: 'Golpe Pessoal', type: CARD_TYPES.ABILITY, category: 'class_ability', desc: 'Golpe customizado.' },
        { key: 'origem_vitalidade', name: 'Vitalidade das Fadas', type: CARD_TYPES.ABILITY, category: 'origin_power', desc: '+1 PV por nível.' },
        { key: 'arma_machado', name: 'Machado', type: CARD_TYPES.EQUIPMENT, desc: 'Arma.' }
    ];

    // No modo abilities, armas não devem aparecer
    let pickerAbilities = sheetView.getAvailablePickerCards();
    assert(pickerAbilities.some(c => c.key === 'guerreiro_golpe_pessoal'), 'Golpe Pessoal deve aparecer no picker');
    assert(pickerAbilities.some(c => c.key === 'origem_vitalidade'), 'Vitalidade deve aparecer no picker');
    assert(!pickerAbilities.some(c => c.key === 'arma_machado'), 'Equipamentos não devem aparecer no picker de habilidades');

    // Filtro de categoria no picker
    sheetView.pickerCategoryFilter = 'origin_power';
    pickerAbilities = sheetView.getAvailablePickerCards();
    assert.strictEqual(pickerAbilities.length, 1);
    assert.strictEqual(pickerAbilities[0].key, 'origem_vitalidade');

    // Adiciona poder opcional via picker
    sheetView.addCardFromPicker(pickerAbilities[0]);
    const addedPower = engine.getCardByKey('origem_vitalidade');
    assert(addedPower, 'Poder de origem deve ter sido adicionado');
    assert.strictEqual(addedPower.equipped, true, 'Habilidade adicionada pelo picker deve estar equipada');

    sheetView.closeCardPicker();
    console.log('  [OK] Validação da Aba de Habilidades, layout dinâmico e habilidades obrigatórias concluída com 100% de sucesso!');

    console.log('\n=== Todos os testes do SheetView passaram com 100% de sucesso! ===');
}

runTests().catch(err => {
    console.error('Falha nos testes do SheetView:', err);
    process.exit(1);
});
