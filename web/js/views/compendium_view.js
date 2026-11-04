/**
 * compendium_view.js — Navegador e Gerenciador de Compêndio de Cards (RPG-SheetC v2.0)
 * Integrado com Virtual Scrolling a 60 FPS e Motor de Cards C99 em WebAssembly.
 */

class CompendiumView {
    constructor(engine, router, logToConsole = console.log) {
        this.engine = engine;
        this.router = router;
        this.log = logToConsole;

        this.containerId = 'compendium-container';
        this.virtualList = null;

        this.currentFilterType = null; // null = Todos
        this.searchQuery = '';
        this.onlyEquipped = false;

        // Assina alterações no motor C
        if (this.engine && typeof this.engine.onChange === 'function') {
            this.engine.onChange((reason) => {
                if (reason !== 'virtual_scroll_internal') {
                    this.updateCardsList();
                }
            });
        }
    }

    /**
     * Inicializa a view no container DOM
     * @param {string} containerId
     */
    init(containerId = 'compendium-container') {
        this.containerId = containerId;
        const container = document.getElementById(this.containerId);
        if (!container) return;

        // Se o deck estiver vazio, carrega o compêndio padrão de aventura
        if (this.engine && this.engine.getCardCount() === 0) {
            this.seedStarterCards();
        }

        this.renderStructure(container);
        this.initVirtualList();
        this.setupEventListeners();
        this.updateCardsList();
    }

    /* =========================================================================
     * 1. Renderização da Estrutura Visual
     * ========================================================================= */

    renderStructure(container) {
        container.innerHTML = `
            <div class="compendium-view-container">
                <!-- Barra de Cabeçalho do Compêndio -->
                <div class="compendium-header-bar">
                    <div class="compendium-title-group">
                        <h2>🎴 Compêndio de Cards & Regras</h2>
                        <p>Navegue, pesquise e equipe cards de atributos, perícias, itens e magias gerenciados pelo motor C.</p>
                    </div>
                    <div class="compendium-header-actions">
                        <button type="button" id="btn-compendium-new-card" class="btn btn-primary" title="Criar um novo card personalizado">
                            ➕ Novo Card
                        </button>
                        <button type="button" id="btn-compendium-import" class="btn" title="Importar arquivo .cardpack JSON">
                            📦 Importar Pacote
                        </button>
                        <button type="button" id="btn-compendium-export" class="btn" title="Exportar compêndio completo como .cardpack">
                            📥 Exportar (.cardpack)
                        </button>
                        <button type="button" id="btn-compendium-benchmark" class="btn" title="Gera 1.000 cards para testar a rolagem a 60 FPS">
                            ⚡ Testar 1.000 Cards
                        </button>
                        <input type="file" id="compendium-file-input" accept=".cardpack,.json,.sheetc" style="display: none;">
                    </div>
                </div>

                <!-- Barra de Ferramentas de Busca e Filtros -->
                <div class="compendium-toolbar">
                    <div class="compendium-search-row">
                        <div class="compendium-search-box">
                            <span class="compendium-search-icon">🔍</span>
                            <input type="text" id="compendium-search-input" class="compendium-search-input" placeholder="Buscar por nome, @chave ou efeito..." value="${this.searchQuery}">
                        </div>

                        <label class="compendium-status-toggle">
                            <input type="checkbox" id="compendium-only-equipped" ${this.onlyEquipped ? 'checked' : ''}>
                            <span>Apenas Equipados / Ativos</span>
                        </label>

                        <div id="compendium-counter-badge" class="badge" style="font-size: 0.8rem; background: rgba(255,255,255,0.06); padding: 6px 12px; border-radius: 9999px;">
                            Carregando cards...
                        </div>
                    </div>

                    <!-- Pílulas de Filtro por Categoria de Card -->
                    <div class="compendium-filters-row" id="compendium-type-filters">
                        <!-- Renderizado dinamicamente -->
                    </div>
                </div>

                <!-- Container do Virtual Scroll -->
                <div id="compendium-virtual-scroll-target" style="height: 540px; width: 100%;"></div>
            </div>
        `;

        this.renderFilterPills();
    }

    renderFilterPills() {
        const filtersRow = document.getElementById('compendium-type-filters');
        if (!filtersRow || !this.engine) return;

        const allCount = this.engine.getCardCount();
        const types = window.CARD_TYPES || {
            ATTRIBUTE: 0, RESOURCE: 1, STAT: 2, SKILL: 3, ABILITY: 4, EQUIPMENT: 5, SPELL: 6, TRAIT: 7
        };
        const meta = window.CARD_TYPE_META || {};

        let pillsHtml = `
            <button type="button" class="compendium-filter-pill ${this.currentFilterType === null ? 'active' : ''}" data-filter-type="all">
                <span>🌟 Todos</span>
                <span class="compendium-count-tag">${allCount}</span>
            </button>
        `;

        for (const [typeKey, typeId] of Object.entries(types)) {
            const count = this.engine.getCardCountByType(typeId);
            const itemMeta = meta[typeId] || { label: typeKey, icon: '🎴' };
            const isActive = this.currentFilterType === typeId;

            pillsHtml += `
                <button type="button" class="compendium-filter-pill ${isActive ? 'active' : ''}" data-filter-type="${typeId}">
                    <span>${itemMeta.icon || '🎴'} ${itemMeta.label}</span>
                    <span class="compendium-count-tag">${count}</span>
                </button>
            `;
        }

        filtersRow.innerHTML = pillsHtml;
    }

    /* =========================================================================
     * 2. Inicialização do Virtual Scroll
     * ========================================================================= */

    initVirtualList() {
        const target = document.getElementById('compendium-virtual-scroll-target');
        if (!target) return;

        this.virtualList = new window.VirtualList(target, {
            itemHeight: 180,
            itemMinWidth: 280,
            gap: 14,
            bufferRows: 2,
            emptyMessage: 'Nenhum card encontrado',
            emptySubtext: 'Tente alterar os termos de busca ou selecionar outra categoria acima.',
            onAction: (action, card, index) => {
                this.handleCardAction(action, card, index);
            }
        });
    }

    /* =========================================================================
     * 3. Manipulação de Eventos e Ações Rápidas
     * ========================================================================= */

    setupEventListeners() {
        // Busca em tempo real
        const searchInput = document.getElementById('compendium-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.trim();
                this.updateCardsList();
            });
        }

        // Toggle apenas equipados
        const toggleEquipped = document.getElementById('compendium-only-equipped');
        if (toggleEquipped) {
            toggleEquipped.addEventListener('change', (e) => {
                this.onlyEquipped = e.target.checked;
                this.updateCardsList();
            });
        }

        // Delegação de cliques nos filtros por tipo
        const filtersRow = document.getElementById('compendium-type-filters');
        if (filtersRow) {
            filtersRow.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-filter-type]');
                if (btn) {
                    const typeAttr = btn.dataset.filterType;
                    this.currentFilterType = typeAttr === 'all' ? null : parseInt(typeAttr, 10);
                    this.renderFilterPills();
                    this.updateCardsList();
                }
            });
        }

        // Botão Novo Card
        const btnNewCard = document.getElementById('btn-compendium-new-card');
        if (btnNewCard) {
            btnNewCard.addEventListener('click', () => {
                if (this.router && typeof this.router.navigate === 'function') {
                    window.cardEditorTargetKey = null;
                    this.router.navigate('editor');
                }
            });
        }

        // Exportação de pacote .cardpack
        const btnExport = document.getElementById('btn-compendium-export');
        if (btnExport) {
            btnExport.addEventListener('click', () => this.exportCompendium());
        }

        // Importação de pacote .cardpack
        const btnImport = document.getElementById('btn-compendium-import');
        const fileInput = document.getElementById('compendium-file-input');
        if (btnImport && fileInput) {
            btnImport.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => this.handleFileImport(e));
        }

        // Benchmark de 1.000 cards para estressar o Virtual Scroll
        const btnBench = document.getElementById('btn-compendium-benchmark');
        if (btnBench) {
            btnBench.addEventListener('click', () => this.generateBenchmarkCards());
        }
    }

    handleCardAction(action, card, index) {
        if (!card || !this.engine) return;

        if (action === 'toggle-equip') {
            const newState = !card.equipped;
            this.engine.setEquipped(card.key, newState);
            this.log(`[Compêndio] Card "${card.name}" ${newState ? 'equipado/ativado' : 'desequipado/desativado'} na ficha.`, 'info');
            this.updateCardsList();
        } else if (action === 'roll') {
            if (card.formula) {
                const val = this.engine.evalCardFormula(card.index);
                this.log(`[Rolagem C] ${card.name} (${card.formula}): Total = ${val}`, 'success');
                if (window.diceRoller && typeof window.diceRoller.openRollModal === 'function') {
                    window.diceRoller.openRollModal({
                        title: card.name,
                        formula: card.formula,
                        result: val
                    });
                }
            }
        } else if (action === 'edit') {
            this.log(`[Compêndio] Abrindo editor para o card "@${card.key}".`, 'info');
            if (this.router && typeof this.router.navigate === 'function') {
                window.cardEditorTargetKey = card.key;
                this.router.navigate('editor');
            }
        }
    }

    /* =========================================================================
     * 4. Atualização Reativa da Lista e Filtros
     * ========================================================================= */

    updateCardsList() {
        if (!this.engine || !this.virtualList) return;

        const indices = this.engine.queryCardIndices({
            type: this.currentFilterType,
            query: this.searchQuery,
            onlyEquipped: this.onlyEquipped
        });

        const cards = indices.map(idx => this.engine.getCardAt(idx)).filter(Boolean);
        this.virtualList.setData(cards);

        // Atualiza contadores
        const counterEl = document.getElementById('compendium-counter-badge');
        if (counterEl) {
            const total = this.engine.getCardCount();
            counterEl.textContent = `Exibindo ${cards.length} de ${total} cards`;
        }

        this.renderFilterPills();
    }

    /* =========================================================================
     * 5. Importação e Exportação de Pacotes (.cardpack)
     * ========================================================================= */

    exportCompendium() {
        if (!this.engine) return;
        const packJson = this.engine.exportCardPack(true);
        if (!packJson) {
            this.log('[Export] Erro ao serializar compêndio em C.', 'error');
            return;
        }

        const systemName = (this.engine.getSystemName() || 'compendio').toLowerCase().replace(/[^a-z0-9]/g, '_');
        const fileName = `${systemName}_pack_${Date.now()}.cardpack`;

        const blob = new Blob([packJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        if (document.body && typeof document.body.appendChild === 'function') {
            document.body.appendChild(a);
        }
        if (typeof a.click === 'function') {
            a.click();
        }
        if (document.body && typeof document.body.removeChild === 'function') {
            document.body.removeChild(a);
        }
        if (typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(url);
        }

        this.log(`[Export] Compêndio exportado com sucesso: "${fileName}"`, 'success');
    }

    async handleFileImport(event) {
        const file = event.target?.files?.[0];
        if (!file || !this.engine) return;

        try {
            const text = await file.text();
            const imported = this.engine.importCardPack(text, true); // modo merge
            if (imported >= 0) {
                this.log(`[Import] Pacote comunitário importado com sucesso! ${imported} cards adicionados/atualizados.`, 'success');
                this.updateCardsList();
            } else {
                this.log(`[Import] Falha ao analisar o arquivo .cardpack (código: ${imported}).`, 'error');
            }
        } catch (err) {
            this.log(`[Import Erro] ${err.message}`, 'error');
        } finally {
            event.target.value = '';
        }
    }

    /* =========================================================================
     * 6. Gerador de Amostras Iniciais e Benchmark
     * ========================================================================= */

    seedStarterCards() {
        if (!this.engine) return;

        const starterPack = [
            { id: 1, type: 0, key: 'for', name: 'Força', desc: 'Poder físico e potência muscular do aventureiro.', base: 16, equipped: 1 },
            { id: 2, type: 0, key: 'des', name: 'Destreza', desc: 'Agilidade, equilíbrio e reflexos rápidos.', base: 14, equipped: 1 },
            { id: 3, type: 0, key: 'con', name: 'Constituição', desc: 'Saúde, vigor e resistência física.', base: 15, equipped: 1 },
            { id: 4, type: 0, key: 'int', name: 'Inteligência', desc: 'Raciocínio lógico, memória e conhecimento arcanum.', base: 12, equipped: 1 },
            { id: 5, type: 0, key: 'sab', name: 'Sabedoria', desc: 'Percepção, intuição e força de vontade.', base: 10, equipped: 1 },
            { id: 6, type: 0, key: 'car', name: 'Carisma', desc: 'Magnetismo pessoal e capacidade de liderança.', base: 13, equipped: 1 },

            { id: 7, type: 1, key: 'pv', name: 'Pontos de Vida', desc: 'Vitalidade atual e capacidade de resistir a ferimentos.', base: 36, curr: 36, max: 36, equipped: 1 },
            { id: 8, type: 1, key: 'pm', name: 'Pontos de Mana', desc: 'Energia mágica mística para conjurar poderes e feitiços.', base: 20, curr: 20, max: 20, equipped: 1 },

            { id: 9, type: 2, key: 'defesa', name: 'Defesa Passiva', desc: 'Dificuldade para acertar o personagem em combate.', base: 10, formula: '10 + (@des - 10) / 2', equipped: 1 },
            { id: 10, type: 3, key: 'luta', name: 'Luta', desc: 'Ataques corpo a corpo com espadas, machados e lanças.', base: 5, formula: '(@for - 10) / 2 + 5', equipped: 1, trained: 1 },
            { id: 11, type: 3, key: 'iniciativa', name: 'Iniciativa', desc: 'Velocidade de reação no início de confrontos.', base: 3, formula: '(@des - 10) / 2', equipped: 1 },

            { id: 12, type: 5, key: 'espada_longa', name: 'Espada Longa Forjada', desc: 'Lâmina de aço reforçado que concede bônus em combate.', formula: '(@for - 10) / 2 + 8', mods: [{ target: 'for', val: 2 }], equipped: 1 },
            { id: 13, type: 5, key: 'cota_malha', name: 'Cota de Malha Élfica', desc: 'Armadura metálica articulada de alta proteção.', mods: [{ target: 'defesa', val: 6 }], equipped: 1 },
            { id: 14, type: 6, key: 'bola_fogo', name: 'Bola de Fogo Arcana', desc: 'Explosão incandescente que consome mana e queima inimigos.', cost_res: 'pm', cost_val: 3, formula: '(@int - 10) / 2 + 20', equipped: 1 },
            { id: 15, type: 4, key: 'furia', name: 'Fúria Bárbara', desc: 'Canaliza ira primal aumentando brutalmente o dano físico.', cost_res: 'pm', cost_val: 2, mods: [{ target: 'for', val: 4 }], equipped: 0 }
        ];

        this.engine.importCardPack(starterPack, true);
        this.log('[Compêndio] Carregado compêndio inicial de aventura com 15 cards.', 'info');
    }

    generateBenchmarkCards() {
        if (!this.engine) return;

        const benchmarkPack = [];
        const types = [0, 1, 2, 3, 4, 5, 6, 7];
        const prefixes = ['Lâmina', 'Escudo', 'Tomo', 'Orbe', 'Anel', 'Benção', 'Maldição', 'Golpe', 'Postura', 'Prece'];

        const startIdx = this.engine.getCardCount();
        for (let i = 0; i < 1000; i++) {
            const id = startIdx + i + 1;
            const t = types[i % types.length];
            const p = prefixes[i % prefixes.length];
            benchmarkPack.push({
                id,
                type: t,
                key: `card_bench_${id}`,
                name: `${p} Lendária #${id}`,
                desc: `Card gerado dinamicamente para teste de virtualização e estresse de rolagem virtual. Índice #${id}`,
                base: 10 + (i % 25),
                formula: i % 2 === 0 ? `@for + ${i % 10}` : '',
                cost_res: i % 3 === 0 ? 'pm' : '',
                cost_val: (i % 5) + 1,
                equipped: i % 4 === 0 ? 1 : 0
            });
        }

        const t0 = Date.now();
        const count = this.engine.importCardPack(benchmarkPack, true);
        const dt = Date.now() - t0;

        this.log(`[Benchmark] ${count} cards gerados e inseridos no motor C em ${dt}ms! Total no deck: ${this.engine.getCardCount()}`, 'success');
        this.updateCardsList();
    }
}

if (typeof window !== 'undefined') {
    window.CompendiumView = CompendiumView;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CompendiumView };
}
