/**
 * virtual_list.js — Componente de Virtual Scrolling (Windowing) de Alta Performance
 * RPG-SheetC v2.0 • Vanilla JS puro • Renderiza apenas os cards visíveis no DOM a 60 FPS
 */

class VirtualList {
    /**
     * @param {HTMLElement|string} container Elemento container DOM ou seletor CSS
     * @param {Object} options Configurações de layout e renderização
     */
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        if (!this.container) {
            throw new Error('[VirtualList] Container inválido ou não encontrado no DOM');
        }

        this.options = {
            itemHeight: options.itemHeight || 170, // Altura padrão de um card em pixels
            itemMinWidth: options.itemMinWidth || 270, // Largura mínima para cálculo de colunas no grid
            columns: options.columns || null, // Se definido, fixa o número de colunas
            gap: options.gap !== undefined ? options.gap : 14, // Espaçamento entre cards em px
            bufferRows: options.bufferRows || 2, // Linhas extras acima/abaixo do viewport
            renderItem: options.renderItem || this.defaultCardRenderer.bind(this),
            onAction: options.onAction || null, // Callback para ações internas (equip, roll, etc)
            emptyMessage: options.emptyMessage || 'Nenhum card encontrado',
            emptySubtext: options.emptySubtext || 'Tente ajustar os filtros de busca ou adicionar novos cards ao compêndio.'
        };

        this.items = [];
        this.columns = 1;
        this.viewportHeight = 0;
        this.scrollTop = 0;
        this.totalRows = 0;
        this.rowHeight = this.options.itemHeight + this.options.gap;

        // Controle de animação e renderização
        this.ticking = false;
        this.renderedNodes = new Map(); // Map<index, HTMLElement>
        this.resizeObserver = null;

        this.initDOM();
        this.bindEvents();
        this.recalculateLayout();
    }

    /* =========================================================================
     * 1. Inicialização do DOM
     * ========================================================================= */

    initDOM() {
        this.container.classList.add('virtual-scroll-container');
        this.container.innerHTML = `
            <div class="virtual-scroll-spacer"></div>
            <div class="virtual-scroll-content"></div>
        `;

        this.spacerEl = this.container.querySelector('.virtual-scroll-spacer');
        this.contentEl = this.container.querySelector('.virtual-scroll-content');
    }

    bindEvents() {
        this.onScrollBound = this.onScroll.bind(this);
        this.container.addEventListener('scroll', this.onScrollBound, { passive: true });

        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => {
                this.recalculateLayout();
            });
            this.resizeObserver.observe(this.container);
        } else if (typeof window !== 'undefined') {
            this.onResizeBound = () => this.recalculateLayout();
            window.addEventListener('resize', this.onResizeBound, { passive: true });
        }

        // Delegação de eventos para ações rápidas nos cards
        this.contentEl.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-card-action]');
            if (btn) {
                e.stopPropagation();
                const action = btn.dataset.cardAction;
                const index = parseInt(btn.dataset.cardIndex, 10);
                const item = this.items[index];
                if (typeof this.options.onAction === 'function') {
                    this.options.onAction(action, item, index, e);
                }
            }
        });
    }

    /* =========================================================================
     * 2. Cálculo de Dimensões e Layout
     * ========================================================================= */

    recalculateLayout() {
        if (!this.container) return;

        const containerWidth = this.container.clientWidth - (this.options.gap * 2);
        this.viewportHeight = this.container.clientHeight || 500;

        // Determina a quantidade de colunas responsivas baseadas na largura
        if (this.options.columns) {
            this.columns = this.options.columns;
        } else {
            this.columns = Math.max(1, Math.floor((containerWidth + this.options.gap) / (this.options.itemMinWidth + this.options.gap)));
        }

        this.rowHeight = this.options.itemHeight + this.options.gap;
        this.totalRows = Math.ceil(this.items.length / this.columns);
        const totalHeight = Math.max(0, this.totalRows * this.rowHeight);

        this.spacerEl.style.height = `${totalHeight}px`;
        this.render();
    }

    /* =========================================================================
     * 3. Ciclo de Scroll e Renderização Virtual (Windowing)
     * ========================================================================= */

    onScroll() {
        if (!this.ticking) {
            if (typeof requestAnimationFrame !== 'undefined') {
                requestAnimationFrame(() => {
                    this.scrollTop = this.container.scrollTop;
                    this.render();
                    this.ticking = false;
                });
            } else {
                this.scrollTop = this.container.scrollTop;
                this.render();
                this.ticking = false;
            }
            this.ticking = true;
        }
    }

    getVisibleRange() {
        if (this.items.length === 0) {
            return { start: 0, end: -1, total: 0, activeDomCount: 0 };
        }

        const startRow = Math.max(0, Math.floor(this.scrollTop / this.rowHeight) - this.options.bufferRows);
        const visibleRowCount = Math.ceil(this.viewportHeight / this.rowHeight);
        const endRow = Math.min(this.totalRows - 1, startRow + visibleRowCount + (this.options.bufferRows * 2));

        const start = startRow * this.columns;
        const end = Math.min(this.items.length - 1, ((endRow + 1) * this.columns) - 1);

        return {
            start,
            end,
            total: this.items.length,
            activeDomCount: this.renderedNodes.size
        };
    }

    render() {
        if (this.items.length === 0) {
            this.renderedNodes.forEach(node => node.remove());
            this.renderedNodes.clear();
            this.contentEl.innerHTML = `
                <div class="virtual-scroll-empty">
                    <div class="virtual-scroll-empty-icon">🎴</div>
                    <div class="virtual-scroll-empty-title">${this.options.emptyMessage}</div>
                    <div class="virtual-scroll-empty-subtext">${this.options.emptySubtext}</div>
                </div>
            `;
            return;
        }

        const emptyEl = this.contentEl.querySelector('.virtual-scroll-empty');
        if (emptyEl) {
            emptyEl.remove();
        }

        const range = this.getVisibleRange();
        const activeIndices = new Set();

        const containerWidth = this.container.clientWidth;
        const totalGaps = (this.columns - 1) * this.options.gap;
        const availableWidth = containerWidth - (this.options.gap * 2);
        const colWidth = Math.floor((availableWidth - totalGaps) / this.columns);

        // Instancia ou posiciona apenas os elementos no range visível
        for (let i = range.start; i <= range.end; i++) {
            activeIndices.add(i);

            const row = Math.floor(i / this.columns);
            const col = i % this.columns;

            const top = row * this.rowHeight;
            const left = col * (colWidth + this.options.gap);

            let node = this.renderedNodes.get(i);

            if (!node) {
                node = document.createElement('div');
                node.className = 'virtual-scroll-item';
                node.style.height = `${this.options.itemHeight}px`;
                node.innerHTML = this.options.renderItem(this.items[i], i);
                this.contentEl.appendChild(node);
                this.renderedNodes.set(i, node);
            }

            node.style.width = `${colWidth}px`;
            node.style.top = `${top}px`;
            node.style.left = `${left}px`;
        }

        // Remove do DOM nós que saíram da janela de visualização
        for (const [index, node] of this.renderedNodes.entries()) {
            if (!activeIndices.has(index)) {
                node.remove();
                this.renderedNodes.delete(index);
            }
        }
    }

    /* =========================================================================
     * 4. Métodos Públicos da API
     * ========================================================================= */

    /**
     * Define ou atualiza os dados da lista (aceita array de cards ou de índices)
     * @param {Array} items
     */
    setData(items = []) {
        this.items = Array.isArray(items) ? items : [];
        // Limpa nós existentes para atualizar com a nova lista
        this.renderedNodes.forEach(node => node.remove());
        this.renderedNodes.clear();
        this.recalculateLayout();
    }

    /**
     * Atualiza um item individual na tela se estiver visível
     * @param {number} index
     * @param {Object} newItemData
     */
    updateItem(index, newItemData) {
        if (index >= 0 && index < this.items.length) {
            this.items[index] = newItemData;
            const node = this.renderedNodes.get(index);
            if (node) {
                node.innerHTML = this.options.renderItem(newItemData, index);
            }
        }
    }

    /**
     * Rola suavemente até o card no índice especificado
     * @param {number} index
     */
    scrollToIndex(index) {
        if (index < 0 || index >= this.items.length) return;
        const row = Math.floor(index / this.columns);
        const targetTop = row * this.rowHeight;
        this.scrollTop = targetTop;
        if (this.container && typeof this.container.scrollTo === 'function') {
            this.container.scrollTo({
                top: targetTop,
                behavior: 'smooth'
            });
        }
        this.render();
    }

    /**
     * Força recálculo completo de layout
     */
    refresh() {
        this.recalculateLayout();
    }

    /**
     * Destrói o componente, cancelando listeners e limpando o DOM
     */
    destroy() {
        if (this.onScrollBound) {
            this.container.removeEventListener('scroll', this.onScrollBound);
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        } else if (this.onResizeBound && typeof window !== 'undefined') {
            window.removeEventListener('resize', this.onResizeBound);
        }
        this.renderedNodes.forEach(node => node.remove());
        this.renderedNodes.clear();
        this.container.innerHTML = '';
    }

    /* =========================================================================
     * 5. Renderizador Padrão de Cards de RPG
     * ========================================================================= */

    defaultCardRenderer(card, index) {
        if (!card) return '';

        const typeLabel = card.typeLabel || 'Card';
        const badgeClass = card.badgeClass || 'badge-attr';
        const typeIcon = card.typeIcon || '🎴';
        const isEquipped = Boolean(card.equipped);
        const isFavorite = Boolean(card.favorite);

        let primaryValueHtml = '';
        if (card.current !== undefined && card.max !== undefined && card.typeKey === 'resource') {
            primaryValueHtml = `
                <div class="rpg-card-values">
                    <span class="rpg-card-primary-val">${card.current}</span>
                    <span class="rpg-card-val-sub">/ ${card.max}</span>
                </div>
            `;
        } else if (card.effective !== undefined) {
            const sign = (card.effective > 0 && card.typeKey === 'attribute') ? '' : '';
            primaryValueHtml = `
                <div class="rpg-card-values">
                    <span class="rpg-card-primary-val">${sign}${card.effective}</span>
                    ${card.base !== card.effective ? `<span class="rpg-card-val-sub">(base ${card.base})</span>` : ''}
                </div>
            `;
        }

        const formulaChip = card.formula ? `
            <span class="card-chip card-chip-formula" title="Fórmula de Cálculo">
                🎲 ${card.formula} ${card.formulaValue !== undefined ? `<strong>= ${card.formulaValue}</strong>` : ''}
            </span>
        ` : '';

        const costChip = (card.costResource && card.costValue) ? `
            <span class="card-chip card-chip-cost" title="Custo de Ativação">
                💧 ${card.costValue} ${card.costResource}
            </span>
        ` : '';

        return `
            <div class="rpg-card ${isEquipped ? 'is-equipped' : ''} ${isFavorite ? 'is-favorite' : ''}" data-card-key="${card.key || ''}">
                <div class="rpg-card-header">
                    <div class="rpg-card-title-group">
                        <span class="rpg-card-icon">${typeIcon}</span>
                        <div style="min-width: 0;">
                            <h3 class="rpg-card-name" title="${card.name || ''}">${card.name || 'Sem Nome'}</h3>
                            <span class="rpg-card-key">@${card.key || 'card'}</span>
                        </div>
                    </div>
                    <div class="rpg-card-badges">
                        <span class="card-type-badge ${badgeClass}">${typeLabel}</span>
                        <button type="button" class="card-status-pill ${isEquipped ? 'active' : ''}" data-card-action="toggle-equip" data-card-index="${index}" title="${isEquipped ? 'Card Ativo/Equipado' : 'Card Inativo'}">
                            <span class="card-status-dot"></span>
                            <span>${isEquipped ? 'Ativo' : 'Off'}</span>
                        </button>
                    </div>
                </div>

                <div class="rpg-card-body">
                    ${card.desc ? `<p class="rpg-card-desc" title="${card.desc}">${card.desc}</p>` : ''}
                    ${primaryValueHtml}
                    <div class="card-chips-row">
                        ${formulaChip}
                        ${costChip}
                    </div>
                </div>

                <div class="rpg-card-footer">
                    <button type="button" class="card-action-btn btn-equip ${isEquipped ? 'active' : ''}" data-card-action="toggle-equip" data-card-index="${index}">
                        ${isEquipped ? '🛡️ Equipado' : '⚔️ Equipar'}
                    </button>
                    ${card.formula ? `
                        <button type="button" class="card-action-btn btn-roll" data-card-action="roll" data-card-index="${index}">
                            🎲 Rolar
                        </button>
                    ` : ''}
                    <button type="button" class="card-action-btn" data-card-action="edit" data-card-index="${index}" title="Editar Card">
                        ✏️
                    </button>
                </div>
            </div>
        `;
    }
}

if (typeof window !== 'undefined') {
    window.VirtualList = VirtualList;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VirtualList };
}
