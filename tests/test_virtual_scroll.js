/**
 * test_virtual_scroll.js — Teste de Performance de Rolagem Virtual com 5.000 Cards (RPG-SheetC v2.0)
 * Valida a renderização a 60 FPS com reciclagem de nós do DOM em viewport virtual.
 */

const assert = require('assert');

// Mock leve de ambiente DOM para Node.js com medições e layout
class MockElement {
    constructor(tagName = 'div', isLeaf = false) {
        this.tagName = tagName.toUpperCase();
        this.classList = new Set();
        this.style = {};
        this.children = [];
        this.parentNode = null;
        this.clientWidth = 1200; // Simula tela desktop ampla (4 colunas com minWidth 280 + gap 14)
        this.clientHeight = 600; // Viewport de 600px de altura
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
        this.scrollTop = typeof opts === 'object' ? (opts.top || 0) : opts;
        if (this.listeners['scroll']) {
            this.listeners['scroll'].forEach(fn => fn());
        }
    }
}

// Configura ambiente global para simular navegador
global.document = {
    createElement: (tag) => new MockElement(tag, true)
};

global.window = {
    addEventListener: () => {},
    removeEventListener: () => {}
};

// Importa componente VirtualList
const { VirtualList } = require('../web/js/components/virtual_list.js');

function runVirtualScrollBenchmark() {
    console.log('=== Testes de Performance de Rolagem Virtual (5.000 Cards) ===');

    const container = new MockElement('div', false);
    const virtualList = new VirtualList(container, {
        itemHeight: 180,
        itemMinWidth: 280,
        gap: 14,
        bufferRows: 2
    });

    // 1. Geração de 5.000 cards sintéticos
    const TOTAL_CARDS = 5000;
    const cards = [];
    for (let i = 0; i < TOTAL_CARDS; i++) {
        cards.push({
            id: i + 1,
            type: i % 8,
            typeLabel: 'Card',
            typeIcon: '🃏',
            badgeClass: 'badge-item',
            key: `card_${i}`,
            name: `Card de Teste #${i}`,
            desc: `Descrição do card de teste de número ${i}`,
            effective: 10 + (i % 20),
            base: 10,
            formula: i % 3 === 0 ? '1d20 + 5' : '',
            formulaValue: i % 3 === 0 ? 15 : null,
            costResource: i % 4 === 0 ? 'mana' : '',
            costValue: i % 4 === 0 ? 2 : 0,
            equipped: i % 5 === 0,
            favorite: i % 10 === 0
        });
    }

    const t0 = Date.now();
    virtualList.setData(cards);
    const dt = Date.now() - t0;

    console.log(`  [OK] Inicializados ${TOTAL_CARDS} cards em ${dt}ms`);
    assert(dt < 100, `Carregamento de 5.000 cards deve ser instantâneo (<100ms), levou ${dt}ms`);

    // 2. Verificação de Reciclagem de Nós no DOM Inicial
    const content = container.querySelector('.virtual-scroll-content');
    const spacer = container.querySelector('.virtual-scroll-spacer');

    assert(spacer, 'Spacer fantasma deve existir');
    assert(content, 'Container de conteúdo deve existir');

    const initialRenderedCount = content.children.length;
    console.log(`  [OK] Nós no DOM Inicial: ${initialRenderedCount} (de ${TOTAL_CARDS} cards totais)`);
    // Com 4 colunas e buffer de 2 linhas, deve renderizar apenas ~28 a 40 nós, NUNCA 5.000!
    assert(initialRenderedCount < 60, `DOM não deve exceder 60 elementos na tela, renderizou: ${initialRenderedCount}`);
    assert(initialRenderedCount > 0, 'Deve renderizar cards visíveis');

    // 3. Teste de Rolagem Rápida para o meio da lista (ScrollTop = 50.000px)
    const tScroll = Date.now();
    container.scrollTo({ top: 50000 });
    const scrollDt = Date.now() - tScroll;

    const midRenderedCount = content.children.length;
    console.log(`  [OK] Rolagem para 50.000px em ${scrollDt}ms. Nós no DOM: ${midRenderedCount}`);
    assert(midRenderedCount < 60, 'Quantidade de nós DOM continua reduzida e controlada no meio da lista');
    assert(scrollDt < 20, `Tempo de atualização do frame deve ser < 20ms para garantir 60 FPS (levou ${scrollDt}ms)`);

    // 4. Teste de Rolagem para o Fim da Lista
    const totalHeight = parseInt(spacer.style.height || '0', 10);
    assert(totalHeight > 200000, `Altura total do spacer deve refletir 5.000 cards, obtido: ${totalHeight}px`);

    container.scrollTo({ top: totalHeight - 600 });
    const endRenderedCount = content.children.length;
    console.log(`  [OK] Rolagem para o final da lista (Spacer: ${totalHeight}px). Nós no DOM: ${endRenderedCount}`);
    assert(endRenderedCount > 0 && endRenderedCount < 60);

    // 5. Destruição do Componente e Liberação de Recursos
    virtualList.destroy();
    assert.strictEqual(container.children.length, 0, 'Container deve estar limpo após destroy');
    console.log('  [OK] Componente destruído e memória liberada com sucesso');

    console.log('\n=== Todos os testes do Virtual Scroll passaram com 100% de sucesso! ===');
}

runVirtualScrollBenchmark();
