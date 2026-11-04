/**
 * test_virtual_list.js — Testes Unitários do Virtual Scrolling (Windowing a 60 FPS)
 * RPG-SheetC v2.0 • Validação de Renderização com 5.000 Cards
 */

const assert = require('assert');

// Mock leve de ambiente DOM para Node.js
class MockElement {
    constructor(tagName = 'div', isLeaf = false) {
        this.tagName = tagName.toUpperCase();
        this.classList = new Set();
        this.style = {};
        this.children = [];
        this.parentNode = null;
        this.clientWidth = 1200; // Simula tela desktop ampla (4 colunas)
        this.clientHeight = 600; // Viewport de 600px
        this.scrollTop = 0;
        this.listeners = {};
        this._innerHTML = '';

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
        this.children = [];
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
        return null;
    }

    remove() {
        if (this.parentNode) {
            this.parentNode.children = this.parentNode.children.filter(c => c !== this);
            this.parentNode = null;
        }
    }

    scrollTo(opts) {
        if (typeof opts === 'object') {
            this.scrollTop = opts.top || 0;
        } else {
            this.scrollTop = opts;
        }
        if (this.listeners['scroll']) {
            this.listeners['scroll'].forEach(fn => fn());
        }
    }
}

// Configura globais necessárias
global.document = {
    createElement: (tag) => new MockElement(tag, true),
    querySelector: () => new MockElement('div')
};
global.window = {
    addEventListener: () => {},
    removeEventListener: () => {}
};
global.requestAnimationFrame = (fn) => fn();

const { VirtualList } = require('../web/js/components/virtual_list.js');

function runTests() {
    console.log('=== Testes Unitários de Virtual Scrolling (RPG-SheetC v2.0) ===');

    const container = new MockElement('div');

    let actionFired = null;
    const vlist = new VirtualList(container, {
        itemHeight: 160,
        itemMinWidth: 260,
        gap: 16,
        bufferRows: 2,
        onAction: (action, item, index) => {
            actionFired = { action, item, index };
        }
    });

    assert(vlist != null);
    assert.strictEqual(vlist.columns, 4); // 1200px width / ~276px = 4 colunas

    // 1. Gera 5.000 cards na lista
    const totalCards = 5000;
    const cards = [];
    for (let i = 0; i < totalCards; i++) {
        cards.push({
            id: i + 1,
            key: `card_${i}`,
            name: `Card Fantasia #${i}`,
            typeKey: i % 2 === 0 ? 'attribute' : 'equipment',
            typeLabel: i % 2 === 0 ? 'Atributo' : 'Equipamento',
            typeIcon: i % 2 === 0 ? '💪' : '⚔️',
            badgeClass: i % 2 === 0 ? 'badge-attr' : 'badge-equip',
            desc: `Efeito ou poder lendário do card número ${i}`,
            effective: 10 + (i % 20),
            base: 10,
            formula: i % 3 === 0 ? '@for + 2' : '',
            formulaValue: i % 3 === 0 ? 18 : undefined,
            equipped: i % 5 === 0
        });
    }

    const t0 = Date.now();
    vlist.setData(cards);
    const renderTime = Date.now() - t0;

    // 2. Verifica Windowing: para 5.000 cards, quantos elementos DOM foram criados?
    const rangeInitial = vlist.getVisibleRange();
    console.log(`  [OK] Inicializados ${totalCards} cards em ${renderTime}ms`);
    console.log(`  [OK] Range Visível Inicial: [${rangeInitial.start} .. ${rangeInitial.end}] (Total DOM: ${rangeInitial.activeDomCount})`);

    // Com 600px de altura, rowHeight = 176px (~4 rows visíveis + 4 rows buffer = ~8 rows * 4 colunas = ~32 itens no DOM)
    assert(rangeInitial.activeDomCount > 0);
    assert(rangeInitial.activeDomCount <= 40, `DOM ativo esperado <= 40, obtido: ${rangeInitial.activeDomCount}`);
    assert(rangeInitial.start === 0);
    assert(rangeInitial.end < 40);

    // 3. Testa Rolagem no Meio (ScrollTop = 50.000px)
    container.scrollTo({ top: 50000 });
    const rangeMiddle = vlist.getVisibleRange();
    console.log(`  [OK] Range após scroll para 50.000px: [${rangeMiddle.start} .. ${rangeMiddle.end}] (Total DOM: ${rangeMiddle.activeDomCount})`);

    assert(rangeMiddle.start > 1000);
    assert(rangeMiddle.end > rangeMiddle.start);
    assert(rangeMiddle.activeDomCount <= 40, `DOM ativo no meio esperado <= 40, obtido: ${rangeMiddle.activeDomCount}`);

    // 4. Testa Rolagem no Fim (Scroll para o último card)
    vlist.scrollToIndex(totalCards - 1);
    const rangeBottom = vlist.getVisibleRange();
    console.log(`  [OK] Range no final da lista: [${rangeBottom.start} .. ${rangeBottom.end}] (Total DOM: ${rangeBottom.activeDomCount})`);
    assert.strictEqual(rangeBottom.end, totalCards - 1);
    assert(rangeBottom.activeDomCount <= 40);

    // 5. Atualização individual
    vlist.updateItem(totalCards - 1, {
        ...cards[totalCards - 1],
        name: 'Card Editado Lendário'
    });
    assert.strictEqual(vlist.items[totalCards - 1].name, 'Card Editado Lendário');

    // 6. Destruição limpa
    vlist.destroy();
    assert.strictEqual(vlist.renderedNodes.size, 0);
    console.log('  [OK] Componente destruído e memória liberada com sucesso');

    console.log('=== Todos os testes do Virtual Scrolling passaram com 100% de sucesso! ===\n');
}

runTests();
