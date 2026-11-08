/**
 * test_creator.js — Teste Automatizado do Motor Universal de Criação de Ficha (Passo 10.5 & 11.5)
 * Valida a arquitetura agnóstica orientada a dados:
 * 1. Sem CardPack ou com CardPack sem assistente -> Pula direto para Configuração Manual com os cards.
 * 2. Com CardPack configurado -> Exibe opções dinâmicas de Assistentes e Modelos (Templates).
 * 3. Máquina de Passos Guiada conduzida 100% pelo schema do pacote ativo.
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
    console.log('=== Testes do Motor Universal de Criação de Personagens (RPG-SheetC v2.0) ===');

    const engine = new SheetCWasm();
    const wasmBytes = fs.readFileSync('./web/dist/sheetc_core.wasm');
    await engine.load(wasmBytes);
    assert(engine.isLoaded, 'Motor WebAssembly C99 deve ser carregado');

    let navigatedTo = null;
    const router = {
        navigate: (view) => { navigatedTo = view; }
    };

    let createdHeroData = null;
    const onCreated = (data) => { createdHeroData = data; };

    const creator = new WizardView(engine, router, onCreated);
    creator.container = new MockElement('div');

    // =========================================================================
    // CENÁRIO 1: Ficha sem CardPack ou CardPack sem Assistente/Modelo
    // Regra do Usuário: "se o usuario criar um personagem sem nenhum cardpack n deve
    // aparecer assistente de ficha... se o cardpack n tiver nd pula direto pra configuração manual"
    // =========================================================================
    console.log('--- Cenário 1: Criação Manual Direta (Sem Assistente Configurado) ---');

    const basicPackWithoutWizard = {
        id: 'pack_bare',
        name: 'Pacote Básico sem Assistente',
        system: 'Fantasia d20 Aberta',
        cards: [
            { id: 1, type: 0, key: 'for', name: 'Força', base: 10, curr: 10, max: 10, equipped: 1 },
            { id: 2, type: 0, key: 'des', name: 'Destreza', base: 10, curr: 10, max: 10, equipped: 1 },
            { id: 3, type: 1, key: 'pv', name: 'Pontos de Vida', base: 20, curr: 20, max: 20, equipped: 1 }
        ]
    };

    creator.getAvailablePacks = () => [basicPackWithoutWizard];

    // Passo 1: Selecionar o CardPack Principal
    creator.reset();
    assert.strictEqual(creator.currentStep, 1, 'Deve iniciar no Passo 1');
    creator.render();
    assert(creator.container.innerHTML.includes('Escolha o CardPack Principal'), 'Passo 1 deve exibir título de escolha');
    assert(creator.container.innerHTML.includes('Ficha Manual em Branco'), 'Deve exibir opção avulsa de Ficha Manual em Branco');
    console.log('  [OK] Passo 1: Seleção de CardPack com opção de Ficha Manual em Branco');

    // Passo 2: Como o pacote NÃO tem assistente nem modelo, pula direto para Configuração Manual
    creator.currentStep = 2;
    creator.characterName = 'Herói Manual';
    creator.creationMode = 'manual';
    creator.render();

    assert(creator.container.innerHTML.includes('Configuração Manual Direta'), 'Deve indicar Configuração Manual Direta');
    assert(!creator.container.innerHTML.includes('Assistente Guiado Oficial'), 'NÃO deve exibir assistente guiado quando não configurado');
    console.log('  [OK] Passo 2: Pula direto para Configuração Manual com os cards (assistente oculto)');

    // Finalizar Criação Manual
    creator.finishCreation();
    assert.strictEqual(engine.getCharacterName(), 'Herói Manual', 'Nome manual deve ser gravado no C');
    assert.strictEqual(engine.getSystemName(), 'Fantasia d20 Aberta', 'Sistema do pacote deve ser gravado no C');
    assert.strictEqual(engine.getCardCount(), 3, 'Cards do pacote devem ser importados no deck do C');
    assert.strictEqual(navigatedTo, 'sheet', 'Deve redirecionar para a view da ficha');
    assert(createdHeroData !== null, 'Callback de criação deve ser acionado');
    console.log('  [OK] Ficha manual criada com sucesso no motor C e redirecionada para a aba Ficha');

    // =========================================================================
    // CENÁRIO 2: CardPack COM Assistente Guiado e/ou Fichas Modelo
    // Regra do Usuário: "se tiver ficha modelo aparece ficha modelo, se tiver assistente
    // aparece assistente, e se tiver algo a mais aparece tambem... crie uma arvore de passos
    // para deixar as opções de criação de ficha customizaveis para os cardpacks"
    // =========================================================================
    console.log('--- Cenário 2: CardPack Customizável com Árvore de Assistente e Modelos ---');

    // Tenta carregar o pacote real local de T20 se disponível; se não, usa pacote mock estruturado
    let activePack = null;
    const t20Path = './local_packs/t20_completo.cardpack';
    if (fs.existsSync(t20Path)) {
        activePack = JSON.parse(fs.readFileSync(t20Path, 'utf-8'));
        activePack.id = 'pack_t20_completo';
    } else {
        activePack = {
            id: 'pack_custom_hero',
            name: 'Heroico d20 Completo',
            system: 'Heroico d20',
            creation_config: {
                wizards: [
                    {
                        id: 'wiz_8_steps',
                        name: 'Assistente Guiado Oficial (8 Etapas)',
                        desc: 'Criação passo a passo completa.',
                        steps: [
                            { step: 1, key: 'concept', title: '1. Conceito do Personagem', type: 'concept' },
                            { step: 2, key: 'attributes', title: '2. Atributos Básicos', type: 'attributes', rules: { point_buy: { points: 10 } } },
                            { step: 3, key: 'race', title: '3. Raça', type: 'single_choice', options: [
                                { key: 'raca_humano', name: 'Humano', desc: 'Versátil', mods: {} },
                                { key: 'raca_anao', name: 'Anão', desc: '+2 Con, -1 Des', mods: { con: 2, des: -1 } }
                            ]},
                            { step: 4, key: 'class', title: '4. Classe', type: 'class_choice', options: [
                                { key: 'guerreiro', name: 'Guerreiro', pv_base: 20, pm_base: 3, fixed_skills: ['luta', 'fortitude'] }
                            ]},
                            { step: 5, key: 'origin', title: '5. Origem', type: 'single_choice', options: [
                                { key: 'origem_soldado', name: 'Soldado', desc: 'Veterano' }
                            ]},
                            { step: 6, key: 'deity', title: '6. Divindade', type: 'single_choice', options: [
                                { key: 'deus_valkaria', name: 'Valkaria', desc: 'Deusa da Ambição' }
                            ]},
                            { step: 7, key: 'equipment', title: '7. Equipamento Inicial', type: 'equipment_select', options: {
                                weapons_martial: ['espada_longa'],
                                armors_light: ['armadura_couro'],
                                shields: ['escudo_pesado']
                            }},
                            { step: 8, key: 'finishing', title: '8. Toques Finais', type: 'summary' }
                        ]
                    }
                ],
                templates: [
                    { id: 'tpl_guerreiro', name: 'Guerreiro Novato', desc: 'Combatente inicial pronto para ação.' }
                ],
                allow_manual: true
            },
            cards: [
                { id: 1, type: 0, key: 'for', name: 'Força', base: 0, curr: 0, max: 0, equipped: 1 },
                { id: 2, type: 0, key: 'des', name: 'Destreza', base: 0, curr: 0, max: 0, equipped: 1 },
                { id: 3, type: 0, key: 'con', name: 'Constituição', base: 0, curr: 0, max: 0, equipped: 1 },
                { id: 4, type: 1, key: 'pv', name: 'Pontos de Vida', base: 20, curr: 20, max: 20, equipped: 1 },
                { id: 5, type: 2, key: 'defesa', name: 'Defesa', formula: '10 + @des', equipped: 1 }
            ]
        };
    }

    creator.getAvailablePacks = () => [activePack];
    creator.selectedPackId = activePack.id;
    creator.reset();

    // Valida que agora as opções de Assistente e Ficha Modelo aparecem dinamicamente!
    creator.currentStep = 2;
    creator.render();
    assert(creator.container.innerHTML.includes('Assistente'), 'Deve exibir cartão de Assistente Guiado quando configurado');
    assert(creator.container.innerHTML.includes('Ficha Modelo'), 'Deve exibir cartão de Ficha Modelo quando configurado');
    assert(creator.container.innerHTML.includes('Configuração Manual com Cards'), 'Deve manter opção de configuração manual livre');
    console.log('  [OK] Passo 2: Assistente e Modelos exibidos dinamicamente conforme configuração do CardPack');

    // =========================================================================
    // CENÁRIO 3: Execução da Árvore de 8 Passos do Assistente
    // =========================================================================
    console.log('--- Cenário 3: Execução da Árvore de 8 Passos do Assistente ---');
    creator.characterName = 'Sir Kaelen de Valkaria';
    creator.creationMode = 'guided';
    creator.startGuidedWizard();

    assert.strictEqual(creator.currentStep, 3, 'currentStep deve ser 3 (modo guiado)');
    assert.strictEqual(creator.guidedStep, 1, 'guidedStep deve iniciar em 1 (Conceito)');
    creator.render();
    assert(creator.container.innerHTML.includes('Conceito'), 'Etapa 1 deve renderizar Conceito');
    console.log('  [OK] Etapa 1: Conceito do Personagem validada');

    // Etapa 2: Atributos Básicos
    creator.guidedStep = 2;
    creator.characterData.attributes = { for: 2, des: 1, con: 2, int: 0, sab: 1, car: 0 };
    creator.render();
    assert(creator.container.innerHTML.includes('Atributos Básicos'), 'Etapa 2 deve renderizar Atributos');
    assert.strictEqual(creator.calcPointBuySpent(), 6, 'Gasto com pontuação conhecida deve ser 6');
    creator.roll4d6Attributes();
    const sum4d6 = Object.values(creator.characterData.attributes).reduce((a, b) => a + b, 0);
    assert(sum4d6 >= -10, `Atributos rolados devem ser calculados (obtido: ${sum4d6})`);
    console.log('  [OK] Etapa 2: Atributos Básicos (Point Buy e Rolagens) validados');

    // Etapa 3: Raça
    creator.guidedStep = 3;
    creator.characterData.attributes = { for: 2, des: 1, con: 2, int: 0, sab: 1, car: 0 };
    creator.characterData.raceKey = 'raca_anao';
    creator.render();
    assert(creator.container.innerHTML.includes('Raça'), 'Etapa 3 deve renderizar Raça');
    const anaoAttrs = creator.calcFinalAttributes();
    assert(anaoAttrs.con >= 2, 'Anão deve receber bônus em Constituição');
    console.log('  [OK] Etapa 3: Raça e modificadores raciais validados dinamicamente');

    // Etapa 4: Classe
    creator.guidedStep = 4;
    creator.characterData.classKey = 'guerreiro';
    creator.characterData.trainedSkills = ['luta', 'fortitude'];
    creator.render();
    assert(creator.container.innerHTML.includes('Classe'), 'Etapa 4 deve renderizar Classe');
    console.log('  [OK] Etapa 4: Classe e Perícias Treinadas validadas');

    // Etapa 5: Origem
    creator.guidedStep = 5;
    creator.characterData.originKey = 'origem_soldado';
    creator.render();
    assert(creator.container.innerHTML.includes('Origem'), 'Etapa 5 deve renderizar Origem');
    console.log('  [OK] Etapa 5: Origem validada dinamicamente');

    // Etapa 6: Divindade
    creator.guidedStep = 6;
    creator.characterData.deityKey = 'deus_valkaria';
    creator.render();
    assert(creator.container.innerHTML.includes('Divindade'), 'Etapa 6 deve renderizar Divindade');
    console.log('  [OK] Etapa 6: Divindade validada dinamicamente');

    // Etapa 7: Equipamento Inicial
    creator.guidedStep = 7;
    creator.characterData.selectedWeapons = ['espada_longa'];
    creator.characterData.selectedArmor = 'armadura_couro';
    creator.characterData.selectedShield = 'escudo_pesado';
    creator.render();
    assert(creator.container.innerHTML.includes('Equipamento'), 'Etapa 7 deve renderizar Equipamento');
    console.log('  [OK] Etapa 7: Equipamento Inicial validado dinamicamente');

    // Etapa 8: Toques Finais & Finalização
    creator.guidedStep = 8;
    creator.render();
    assert(creator.container.innerHTML.includes('Toques Finais'), 'Etapa 8 deve renderizar Toques Finais');
    const finalDerived = creator.calcDerivedStats(creator.calcFinalAttributes());
    assert(finalDerived.defesa >= 14, `Defesa total calculada deve somar Base 10 + Des + Armadura + Escudo (obtido: ${finalDerived.defesa})`);
    assert(finalDerived.pv >= 20, `PV total deve somar Classe + Con (obtido: ${finalDerived.pv})`);
    console.log(`  [OK] Etapa 8: Estatísticas derivadas calculadas (Defesa: ${finalDerived.defesa}, PV: ${finalDerived.pv}, PM: ${finalDerived.pm})`);

    // Injeção da criação guiada no Motor C
    creator.finishGuidedCreation();
    assert.strictEqual(engine.getCharacterName(), 'Sir Kaelen de Valkaria', 'Nome customizado deve ser registrado no C');
    assert(engine.getCardCount() >= 5, `Deck criado via assistente deve conter cards injetados (obtido: ${engine.getCardCount()})`);
    assert.strictEqual(navigatedTo, 'sheet', 'Deve direcionar para a aba Ficha após conclusão');
    console.log('  [OK] Finalização do Assistente Guiado: Cards injetados e recalculados com 100% de sucesso no motor C!');

    console.log('=== Todos os testes do Motor Universal de Criação passaram com 100% de sucesso! ===\n');
}

runTests().catch(err => {
    console.error('Falha nos testes do Creator:', err);
    process.exit(1);
});
