/**
 * test_core_engine.ts — Suíte de Testes Unitários do Motor de Cards em TypeScript Puro
 */

import assert from 'node:assert';
import {
    CARD_TYPES,
    CARD_TYPE_META,
    SheetEngine,
    cardStringToType,
    cardTypeToString
} from '../src/core/card_engine.ts';

async function runCoreTests(): Promise<void> {
    console.log('=== Suíte de Testes Unitários do Motor de Cards TypeScript (RPG-SheetC Web TS) ===');

    // 1. Conversões de tipos
    assert.strictEqual(cardTypeToString(CARD_TYPES.ATTRIBUTE), 'Atributo');
    assert.strictEqual(cardTypeToString(CARD_TYPES.RESOURCE), 'Recurso');
    assert.strictEqual(cardTypeToString(CARD_TYPES.EQUIPMENT), 'Equipamento');
    assert.strictEqual(cardStringToType('Atributo'), CARD_TYPES.ATTRIBUTE);
    assert.strictEqual(cardStringToType('resource'), CARD_TYPES.RESOURCE);
    assert.strictEqual(cardStringToType('Magia'), CARD_TYPES.SPELL);
    assert.strictEqual(CARD_TYPE_META[CARD_TYPES.ATTRIBUTE].label, 'Atributo');
    console.log('  [OK] Conversões bidirecionais de tipos de card e metadados');

    // 2. Ciclo de vida e CRUD de cards no Deck
    const engine = new SheetEngine();
    await engine.load();
    engine.initDeck('Aventureiro Livre', 'Sistema Generico Aberto');

    assert.strictEqual(engine.getCharacterName(), 'Aventureiro Livre');
    assert.strictEqual(engine.getSystemName(), 'Sistema Generico Aberto');
    assert.strictEqual(engine.getCardCount(), 0);

    const idxFor = engine.addSimpleCard('for', 'Força', CARD_TYPES.ATTRIBUTE, 16);
    const idxVida = engine.addSimpleCard('pv', 'Pontos de Vida', CARD_TYPES.RESOURCE, 30);
    const idxDef = engine.addSimpleCard('defesa', 'Defesa Passiva', CARD_TYPES.STAT, 10);

    assert.strictEqual(idxFor, 0);
    assert.strictEqual(idxVida, 1);
    assert.strictEqual(idxDef, 2);
    assert.strictEqual(engine.getCardCount(), 3);

    // Rejeita chave duplicada no addSimpleCard
    assert.strictEqual(engine.addSimpleCard('for', 'Força 2', CARD_TYPES.ATTRIBUTE, 10), -3);
    assert.strictEqual(engine.getCardCount(), 3);

    // Remoção por chave
    assert.strictEqual(engine.removeCardByKey('for'), true);
    assert.strictEqual(engine.getCardCount(), 2);
    assert.strictEqual(engine.getCardByKey('for'), null);
    console.log('  [OK] Operações de criação, adição, busca e remoção de cards no Deck');

    // 3. Modificadores em cascata e recálculo reativo
    engine.initDeck('Guerreiro com Equipamentos', 'Custom Fantasy');
    engine.addSimpleCard('defesa', 'Defesa', CARD_TYPES.STAT, 10);
    engine.addSimpleCard('for', 'Força', CARD_TYPES.ATTRIBUTE, 12);

    assert.strictEqual(engine.getEffectiveValue('defesa'), 10);
    assert.strictEqual(engine.getEffectiveValue('for'), 12);

    // Equipa Armadura (+6 Defesa) e Escudo (+2 Defesa)
    engine.addCard({
        key: 'armadura_ferro',
        name: 'Armadura de Ferro',
        type: CARD_TYPES.EQUIPMENT,
        equipped: 1,
        mods: [{ target: 'defesa', val: 6 }]
    });
    assert.strictEqual(engine.getEffectiveValue('defesa'), 16);

    engine.addCard({
        key: 'escudo_pesado',
        name: 'Escudo Pesado',
        type: CARD_TYPES.EQUIPMENT,
        equipped: 1,
        mods: [{ target: 'defesa', val: 2 }]
    });
    assert.strictEqual(engine.getEffectiveValue('defesa'), 18);

    // Desequipa escudo -> recalcula para 16
    engine.setEquipped('escudo_pesado', false);
    assert.strictEqual(engine.getEffectiveValue('defesa'), 16);

    // Reequipa escudo -> recalcula para 18
    engine.toggleEquipped('escudo_pesado');
    assert.strictEqual(engine.getEffectiveValue('defesa'), 18);
    console.log('  [OK] Aplicação e recálculo dinâmico de modificadores acumulados de cards');

    // 4. Recursos dinâmicos e clamping de máximo
    engine.initDeck('Mago de Batalha', 'Sistema Aberto');
    engine.addSimpleCard('pm', 'Pontos de Mana', CARD_TYPES.RESOURCE, 20);
    assert.strictEqual(engine.getCurrentValue('pm'), 20);
    assert.strictEqual(engine.getMaxValue('pm'), 20);

    engine.modifyCurrentValue('pm', -7);
    assert.strictEqual(engine.getCurrentValue('pm'), 13);

    engine.modifyCurrentValue('pm', 50); // Clamping em max=20
    assert.strictEqual(engine.getCurrentValue('pm'), 20);

    engine.addCard({
        key: 'anel_mana',
        name: 'Anel do Infinito',
        type: CARD_TYPES.EQUIPMENT,
        equipped: 1,
        mods: [{ target: 'pm', val: 10 }]
    });
    assert.strictEqual(engine.getMaxValue('pm'), 30);
    console.log('  [OK] Manipulação de recursos dinâmicos e controle de limites máximos');

    // 5. Avaliador de Fórmulas e Funções Matemáticas
    engine.initDeck('Arquimago', 'Sistema Aberto');
    engine.setLevel(6);
    engine.setXp(15000);
    engine.addSimpleCard('for', 'Força', CARD_TYPES.ATTRIBUTE, 18);
    engine.addSimpleCard('des', 'Destreza', CARD_TYPES.ATTRIBUTE, 14);
    engine.addSimpleCard('int', 'Inteligência', CARD_TYPES.ATTRIBUTE, 20);

    assert.strictEqual(engine.evalExpression('(@for - 10) / 2'), 4);
    assert.strictEqual(engine.evalExpression('10 + floor(@nivel / 2) + (@int - 10) / 2'), 18);
    assert.strictEqual(engine.evalExpression('max(@for, @des) + min(2, 5)'), 20);
    assert.strictEqual(engine.evalExpression('1d20 + (@des - 10) / 2'), 2); // Termo estático sem rolagem = +2
    console.log('  [OK] Avaliador de expressões matemáticas (@chaves, @nivel, floor/min/max e dados)');

    // 6. Exportação e Importação de .cardpack JSON (replace e merge) e metadados estendidos
    engine.addCard({
        key: 'ataque_especial',
        name: 'Ataque Especial',
        type: CARD_TYPES.ABILITY,
        category: 'class_ability',
        is_mandatory: 1,
        cost_res: 'pm',
        cost_val: 1,
        formula: '1d20 + @for'
    });

    const rawJson = engine.exportCardPack(true) as string;
    assert(typeof rawJson === 'string' && rawJson.includes('ataque_especial'));

    const engine2 = new SheetEngine();
    const countImported = engine2.importCardPack(rawJson, false);
    assert.strictEqual(countImported, 4);
    assert.strictEqual(engine2.getCharacterName(), 'Arquimago');
    assert.strictEqual(engine2.getLevel(), 6);
    const specialCard = engine2.getCardByKey('ataque_especial');
    assert(specialCard !== null);
    assert.strictEqual(specialCard?.category, 'class_ability');
    assert.strictEqual(specialCard?.isMandatory, true);
    console.log('  [OK] Serialização e desserialização .cardpack JSON com preservação de metadados');

    // 7. Motor de Dados Poliédricos Xorshift32
    engine.setDiceSeed(12345);
    for (let i = 0; i < 100; i++) {
        const r = engine.rollDice(2, 6, 3);
        assert.strictEqual(r.rolls.length, 2);
        assert(r.rolls[0] >= 1 && r.rolls[0] <= 6);
        assert(r.rolls[1] >= 1 && r.rolls[1] <= 6);
        assert.strictEqual(r.total, r.subtotal + 3);
    }
    console.log('  [OK] Motor de dados poliédricos Xorshift32 verificado');

    console.log('=== Todos os testes do Core Engine em TypeScript passaram com 100% de sucesso! ===');
}

runCoreTests().catch(err => {
    console.error('Falha nos testes do Core Engine TS:', err);
    process.exit(1);
});
