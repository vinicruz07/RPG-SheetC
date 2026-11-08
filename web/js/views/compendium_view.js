/**
 * compendium_view.js — Navegador e Gerenciador Hierárquico de CardPacks e Cards (RPG-SheetC v2.0)
 * Centrado em CardPacks carregados pelo usuário, com criação aninhada e integração ao Motor C99.
 */

class CompendiumView {
    constructor(engine, router, logToConsole = console.log) {
        this.engine = engine;
        this.router = router;
        this.log = logToConsole;

        this.containerId = 'compendium-container';
        this.virtualList = null;

        // Controle de estado hierárquico
        this.currentViewMode = 'packs'; // 'packs' (Coleção de CardPacks) | 'cards' (Cards do Pacote Selecionado)
        this.activePackId = null;

        this.currentFilterType = null; // null = Todos
        this.searchQuery = '';
        this.onlyEquipped = false;

        this.inMemoryPacks = [];
        this.STORAGE_KEY = 'rpg_sheetc_cardpacks_v1';

        // Assina alterações no motor C
        if (this.engine && typeof this.engine.onChange === 'function') {
            this.engine.onChange((reason) => {
                if (reason !== 'virtual_scroll_internal') {
                    if (this.currentViewMode === 'cards') {
                        this.updateCardsList();
                    }
                }
            });
        }
    }

    /* =========================================================================
     * 1. Persistência e Gerenciamento de CardPacks
     * ========================================================================= */

    getInstalledPacks() {
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                const raw = window.localStorage.getItem(this.STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) return parsed;
                }
            } catch (err) {
                console.warn('[Compendium] Falha ao ler CardPacks do storage:', err);
            }
        }
        return this.inMemoryPacks;
    }

    saveInstalledPacks(packs) {
        this.inMemoryPacks = packs;
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                window.localStorage.setItem(this.STORAGE_KEY, JSON.stringify(packs));
            } catch (err) {
                console.warn('[Compendium] Falha ao salvar CardPacks:', err);
            }
        }
    }

    getPackById(packId) {
        const packs = this.getInstalledPacks();
        return packs.find(p => p.id === packId) || null;
    }

    addOrUpdatePack(pack) {
        const packs = this.getInstalledPacks();
        const idx = packs.findIndex(p => p.id === pack.id);
        if (idx >= 0) {
            packs[idx] = pack;
        } else {
            packs.push(pack);
        }
        this.saveInstalledPacks(packs);
        return pack;
    }

    deletePack(packId) {
        const packs = this.getInstalledPacks().filter(p => p.id !== packId);
        this.saveInstalledPacks(packs);
        if (this.activePackId === packId) {
            this.activePackId = null;
            this.currentViewMode = 'packs';
        }
    }

    createPack({ name, system = 'Sistema Aberto', author = 'Criador', version = '1.0.0', desc = '' }) {
        const id = 'pack_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        const newPack = {
            id,
            name: (name || '').trim() || 'Novo CardPack',
            system: (system || '').trim() || 'Sistema Aberto',
            author: (author || '').trim() || 'Criador',
            version: (version || '').trim() || '1.0.0',
            desc: (desc || '').trim() || 'Pacote de cards customizado.',
            cards: [],
            createdAt: Date.now()
        };
        this.addOrUpdatePack(newPack);
        return newPack;
    }

    /* =========================================================================
     * 2. Inicialização e Renderização da View
     * ========================================================================= */

    init(containerId = 'compendium-container', autoSeed = false) {
        this.containerId = containerId;
        const container = document.getElementById(this.containerId);
        if (!container) return;

        // Se explicitamente solicitado (ex: testes legados), cria o pacote inicial e o abre
        if (autoSeed) {
            this.seedStarterCards();
        }

        this.render();
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        if (this.currentViewMode === 'cards' && this.activePackId) {
            this.renderPackDetails(container);
        } else {
            this.renderPacksList(container);
        }
    }

    /* =========================================================================
     * 3. Visualização Principal: Grade de CardPacks Carregados
     * ========================================================================= */

    renderPacksList(container) {
        const packs = this.getInstalledPacks();

        container.innerHTML = `
            <div class="compendium-view-container">
                <!-- Cabeçalho Principal do Compêndio -->
                <div class="compendium-header-bar">
                    <div class="compendium-title-group">
                        <h2>🎴 Compêndio de CardPacks & Regras</h2>
                        <p>Gerencie seus pacotes de regras, arsenais e magias. Cada ficha utiliza regras definidas por seu CardPack principal.</p>
                    </div>
                    <div class="compendium-header-actions">
                        <button type="button" id="btn-compendium-create-pack" class="btn btn-accent" title="Criar um novo CardPack vazio">
                            ➕ Criar CardPack
                        </button>
                        <button type="button" id="btn-compendium-import-pack" class="btn btn-primary" title="Importar arquivo .cardpack do computador">
                            📦 Importar CardPack
                        </button>
                        <button type="button" id="btn-compendium-community" class="btn" title="Explorar Data Packs abertos da comunidade">
                            🌐 Data Packs
                        </button>
                        <input type="file" id="compendium-pack-file-input" accept=".cardpack,.json" style="display: none;">
                    </div>
                </div>

                <!-- Conteúdo dos CardPacks -->
                ${packs.length === 0 ? `
                    <div class="card cardpacks-empty-state" style="text-align: center; padding: 48px 24px; background: var(--color-surface-card);">
                        <div style="font-size: 3.5rem; margin-bottom: 12px;">📭</div>
                        <h3 style="font-family: var(--font-heading); color: var(--color-gold-primary); margin-bottom: 8px;">
                            Nenhum CardPack Carregado
                        </h3>
                        <p style="color: var(--color-text-muted); max-width: 600px; margin: 0 auto 24px auto; line-height: 1.6;">
                            O Compêndio está completamente limpo. Importe um arquivo <code>.cardpack</code> (como um pacote de regras ou SRD Fantasia), crie seu próprio pacote de regras personalizado ou explore os Data Packs abertos.
                        </p>
                        <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
                            <button type="button" id="btn-empty-import" class="btn btn-primary" style="padding: 10px 22px; font-weight: 700;">
                                📦 Importar CardPack (.cardpack)
                            </button>
                            <button type="button" id="btn-empty-create" class="btn btn-accent" style="padding: 10px 22px; font-weight: 700;">
                                ➕ Criar Novo CardPack
                            </button>
                            <button type="button" id="btn-empty-community" class="btn" style="padding: 10px 20px;">
                                🌐 Explorar Data Packs
                            </button>
                        </div>
                    </div>
                ` : `
                    <div class="cardpacks-collection-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--space-md, 16px);">
                        ${packs.map(p => this.renderPackCard(p)).join('')}
                    </div>
                `}

                <!-- Modal Flutuante para Criação de CardPack -->
                <div id="modal-create-cardpack-overlay" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 9999; align-items: center; justify-content: center; padding: 16px;">
                    <div class="card modal-create-cardpack-box" style="max-width: 520px; width: 100%; background: var(--color-surface-card); border: 1px solid var(--color-border-subtle); box-shadow: var(--shadow-lg); padding: 24px; border-radius: var(--radius-lg);">
                        <h3 style="font-family: var(--font-heading); color: var(--color-gold-primary); margin-top: 0; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                            ➕ Criar Novo CardPack
                        </h3>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            <div>
                                <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--color-text-muted); margin-bottom: 4px;">Nome do Pacote *</label>
                                <input type="text" id="input-new-pack-name" class="sheet-number-field" style="width: 100%; text-align: left; padding: 8px;" placeholder="Ex: Fantasia Medieval - Magias & Poderes">
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <div>
                                    <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--color-text-muted); margin-bottom: 4px;">Sistema de Regras *</label>
                                    <input type="text" id="input-new-pack-system" class="sheet-number-field" style="width: 100%; text-align: left; padding: 8px;" placeholder="Ex: d20 Aberto, Sistema Autoral...">
                                </div>
                                <div>
                                    <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--color-text-muted); margin-bottom: 4px;">Versão</label>
                                    <input type="text" id="input-new-pack-version" class="sheet-number-field" style="width: 100%; text-align: left; padding: 8px;" value="1.0.0">
                                </div>
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--color-text-muted); margin-bottom: 4px;">Autor</label>
                                <input type="text" id="input-new-pack-author" class="sheet-number-field" style="width: 100%; text-align: left; padding: 8px;" placeholder="Seu nome ou comunidade">
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--color-text-muted); margin-bottom: 4px;">Descrição Breve</label>
                                <textarea id="input-new-pack-desc" class="sheet-number-field" style="width: 100%; text-align: left; padding: 8px; height: 70px; resize: vertical;" placeholder="Descreva os cards, regras ou suplemento contido neste pacote..."></textarea>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                            <button type="button" id="btn-cancel-create-pack" class="btn btn-secondary">Cancelar</button>
                            <button type="button" id="btn-confirm-create-pack" class="btn btn-primary">Salvar e Abrir Pacote</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.setupPacksListEvents();
    }

    renderPackCard(pack) {
        const count = pack.cards ? pack.cards.length : 0;
        return `
            <div class="card cardpack-card" data-pack-id="${pack.id}" style="display: flex; flex-direction: column; justify-content: space-between; padding: 18px; border: 1px solid var(--color-border-subtle); transition: all 0.2s ease;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 1.6rem;">📦</span>
                            <h3 style="margin: 0; font-family: var(--font-heading); font-size: 1.15rem; color: var(--color-gold-light);">
                                ${pack.name}
                            </h3>
                        </div>
                        <span class="badge" style="font-size: 0.72rem; background: rgba(212, 163, 115, 0.15); color: var(--color-gold-primary); border: 1px solid rgba(212, 163, 115, 0.3);">
                            🃏 ${count} Cards
                        </span>
                    </div>

                    <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px;">
                        <span class="sheet-meta-pill system-pill" style="font-size: 0.7rem; padding: 2px 8px;">📜 ${pack.system}</span>
                        <span class="sheet-meta-pill race-pill" style="font-size: 0.7rem; padding: 2px 8px;">🔖 v${pack.version || '1.0'}</span>
                        ${pack.author ? `<span class="sheet-meta-pill class-pill" style="font-size: 0.7rem; padding: 2px 8px;">👤 ${pack.author}</span>` : ''}
                    </div>

                    <p style="font-size: 0.82rem; color: var(--color-text-muted); line-height: 1.4; margin: 0 0 16px 0;">
                        ${pack.desc || 'Pacote de regras e cards configurados.'}
                    </p>
                </div>

                <div style="display: flex; gap: 6px; justify-content: flex-end; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; flex-wrap: wrap;">
                    <button type="button" class="btn btn-sm btn-primary btn-open-pack" data-pack-id="${pack.id}" title="Explorar cards e criar novos cards neste pacote">
                        📂 Abrir Pacote
                    </button>
                    <button type="button" class="btn btn-sm btn-accent btn-load-pack-engine" data-pack-id="${pack.id}" title="Carregar todos os cards deste pacote na memória do motor C">
                        ⚡ Carregar na Ficha
                    </button>
                    <button type="button" class="btn btn-sm btn-export-pack" data-pack-id="${pack.id}" title="Baixar arquivo .cardpack JSON">
                        📥
                    </button>
                    <button type="button" class="btn btn-sm btn-delete-pack" data-pack-id="${pack.id}" style="color: #ef4444;" title="Excluir este pacote">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }

    setupPacksListEvents() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        // Abrir modal de criação (vincula botões do header e do estado vazio)
        const createButtons = [
            document.getElementById('btn-compendium-create-pack'),
            document.getElementById('btn-empty-create')
        ].filter(Boolean);
        const overlay = document.getElementById('modal-create-cardpack-overlay');
        createButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (overlay) overlay.style.display = 'flex';
                const nameInp = document.getElementById('input-new-pack-name');
                if (nameInp) nameInp.focus();
            });
        });

        const btnCancelCreate = document.getElementById('btn-cancel-create-pack');
        if (btnCancelCreate && overlay) {
            btnCancelCreate.addEventListener('click', () => {
                overlay.style.display = 'none';
            });
        }

        const btnConfirmCreate = document.getElementById('btn-confirm-create-pack');
        if (btnConfirmCreate && overlay) {
            btnConfirmCreate.addEventListener('click', () => {
                const name = document.getElementById('input-new-pack-name')?.value || '';
                const system = document.getElementById('input-new-pack-system')?.value || '';
                const version = document.getElementById('input-new-pack-version')?.value || '1.0.0';
                const author = document.getElementById('input-new-pack-author')?.value || 'Criador';
                const desc = document.getElementById('input-new-pack-desc')?.value || '';

                if (!name.trim()) {
                    alert('Por favor, informe um nome para o CardPack.');
                    return;
                }

                const newPack = this.createPack({ name, system, version, author, desc });
                overlay.style.display = 'none';
                this.log(`[CardPack] Pacote "${newPack.name}" criado com sucesso!`, 'success');
                this.openPack(newPack.id);
            });
        }

        // Importação de arquivo .cardpack (vincula botões do header e do estado vazio)
        const importButtons = [
            document.getElementById('btn-compendium-import-pack'),
            document.getElementById('btn-empty-import')
        ].filter(Boolean);
        const fileInput = document.getElementById('compendium-pack-file-input');
        importButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (fileInput) fileInput.click();
            });
        });
        if (fileInput) {
            fileInput.onchange = (e) => this.handlePackFileImport(e);
        }

        // Data Packs Comunitários (vincula botões do header e do estado vazio)
        const communityButtons = [
            document.getElementById('btn-compendium-community'),
            document.getElementById('btn-empty-community')
        ].filter(Boolean);
        communityButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.packManager && typeof window.packManager.openPackModal === 'function') {
                    window.packManager.openPackModal(() => {
                        this.render();
                    });
                }
            });
        });

        // Cliques nos cartões de CardPacks
        container.querySelectorAll('.btn-open-pack').forEach(btn => {
            btn.addEventListener('click', () => {
                const packId = btn.dataset.packId;
                if (packId) this.openPack(packId);
            });
        });

        container.querySelectorAll('.btn-load-pack-engine').forEach(btn => {
            btn.addEventListener('click', () => {
                const packId = btn.dataset.packId;
                if (packId) this.loadPackIntoEngine(packId);
            });
        });

        container.querySelectorAll('.btn-export-pack').forEach(btn => {
            btn.addEventListener('click', () => {
                const packId = btn.dataset.packId;
                if (packId) this.exportPackToFile(packId);
            });
        });

        container.querySelectorAll('.btn-delete-pack').forEach(btn => {
            btn.addEventListener('click', () => {
                const packId = btn.dataset.packId;
                const pack = this.getPackById(packId);
                if (pack) {
                    if (confirm(`Deseja realmente excluir o CardPack "${pack.name}"?`)) {
                        this.deletePack(packId);
                        this.log(`[CardPack] Pacote "${pack.name}" excluído.`, 'info');
                        this.render();
                    }
                }
            });
        });
    }

    openPack(packId) {
        this.activePackId = packId;
        this.currentViewMode = 'cards';
        this.searchQuery = '';
        this.currentFilterType = null;
        this.render();
    }

    /* =========================================================================
     * 4. Visualização Interna do CardPack (Cards do Pacote Selecionado)
     * ========================================================================= */

    renderPackDetails(container) {
        const pack = this.getPackById(this.activePackId);
        if (!pack) {
            this.currentViewMode = 'packs';
            this.render();
            return;
        }

        const cards = pack.cards || [];

        container.innerHTML = `
            <div class="compendium-view-container">
                <!-- Barra de Navegação Interna do Pacote -->
                <div class="compendium-header-bar" style="border-left: 4px solid var(--color-gold-primary);">
                    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                        <button type="button" id="btn-pack-back" class="btn btn-secondary" title="Retornar à lista de todos os CardPacks">
                            ⬅️ Voltar aos CardPacks
                        </button>
                        <div>
                            <h2 style="margin: 0; font-family: var(--font-heading); font-size: 1.3rem; color: var(--color-gold-light); display: flex; align-items: center; gap: 8px;">
                                📦 ${pack.name}
                            </h2>
                            <span style="font-size: 0.8rem; color: var(--color-text-muted);">
                                📜 ${pack.system} &bull; v${pack.version || '1.0'} &bull; 🃏 ${cards.length} cards cadastrados
                            </span>
                        </div>
                    </div>

                    <div class="compendium-header-actions">
                        <button type="button" id="btn-pack-new-card" class="btn btn-primary" title="Criar um novo card e aninhá-lo neste CardPack">
                            ➕ Novo Card Neste Pacote
                        </button>
                        <button type="button" id="btn-pack-apply-engine" class="btn btn-accent" title="Carregar todos os cards deste pacote na memória do motor C">
                            ⚡ Carregar na Ficha
                        </button>
                        <button type="button" id="btn-pack-export-current" class="btn" title="Exportar este CardPack como arquivo .cardpack JSON">
                            📥 Exportar (.cardpack)
                        </button>
                    </div>
                </div>

                <!-- Barra de Busca e Filtros Dentro do Pacote -->
                <div class="compendium-toolbar">
                    <div class="compendium-search-row">
                        <div class="compendium-search-box">
                            <span class="compendium-search-icon">🔍</span>
                            <input type="text" id="compendium-search-input" class="compendium-search-input" placeholder="Buscar cards neste pacote por nome, @chave ou fórmula..." value="${this.searchQuery}">
                        </div>

                        <label class="compendium-status-toggle">
                            <input type="checkbox" id="compendium-only-equipped" ${this.onlyEquipped ? 'checked' : ''}>
                            <span>Apenas Equipados / Ativos</span>
                        </label>

                        <div id="compendium-counter-badge" class="badge" style="font-size: 0.8rem; background: rgba(255,255,255,0.06); padding: 6px 12px; border-radius: 9999px;">
                            ${cards.length} cards no pacote
                        </div>
                    </div>

                    <!-- Pílulas de Filtro por Categoria -->
                    <div class="compendium-filters-row" id="compendium-type-filters">
                        <!-- Renderizado dinamicamente -->
                    </div>
                </div>

                <!-- Alvo da Lista Virtual ou Grade dos Cards do Pacote -->
                <div id="compendium-virtual-scroll-target" style="height: 520px; width: 100%;"></div>
            </div>
        `;

        this.renderFilterPillsForPack(cards);
        this.initVirtualListForPack();
        this.setupPackDetailsEvents();
        this.updateCardsList();
    }

    renderFilterPillsForPack(cards) {
        const filtersRow = document.getElementById('compendium-type-filters');
        if (!filtersRow) return;

        const types = window.CARD_TYPES || {
            ATTRIBUTE: 0, RESOURCE: 1, STAT: 2, SKILL: 3, ABILITY: 4, EQUIPMENT: 5, SPELL: 6, TRAIT: 7
        };
        const meta = window.CARD_TYPE_META || {};

        let pillsHtml = `
            <button type="button" class="compendium-filter-pill ${this.currentFilterType === null ? 'active' : ''}" data-filter-type="all">
                <span>🌟 Todos</span>
                <span class="compendium-count-tag">${cards.length}</span>
            </button>
        `;

        for (const [typeKey, typeId] of Object.entries(types)) {
            const count = cards.filter(c => c.type === typeId).length;
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

    initVirtualListForPack() {
        const target = document.getElementById('compendium-virtual-scroll-target');
        if (!target) return;

        if (window.VirtualList) {
            this.virtualList = new window.VirtualList(target, {
                itemHeight: 180,
                itemMinWidth: 280,
                gap: 14,
                bufferRows: 2,
                emptyMessage: 'Nenhum card encontrado neste pacote',
                emptySubtext: 'Clique em "➕ Novo Card Neste Pacote" acima para adicionar o primeiro card.',
                onAction: (action, card, index) => {
                    this.handleCardAction(action, card, index);
                }
            });
        }
    }

    setupPackDetailsEvents() {
        // Voltar à lista de pacotes
        const btnBack = document.getElementById('btn-pack-back');
        if (btnBack) {
            btnBack.addEventListener('click', () => {
                this.currentViewMode = 'packs';
                this.render();
            });
        }

        // Criar card aninhado neste pacote
        const btnNewCard = document.getElementById('btn-pack-new-card');
        if (btnNewCard) {
            btnNewCard.addEventListener('click', () => {
                window.cardEditorTargetPackId = this.activePackId;
                window.cardEditorTargetKey = null;
                if (this.router && typeof this.router.navigate === 'function') {
                    this.router.navigate('editor');
                }
            });
        }

        // Carregar este pacote no motor C
        const btnApply = document.getElementById('btn-pack-apply-engine');
        if (btnApply) {
            btnApply.addEventListener('click', () => {
                this.loadPackIntoEngine(this.activePackId);
            });
        }

        // Exportar este pacote
        const btnExport = document.getElementById('btn-pack-export-current');
        if (btnExport) {
            btnExport.addEventListener('click', () => {
                this.exportPackToFile(this.activePackId);
            });
        }

        // Busca textual
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

        // Filtros por categoria
        const filtersRow = document.getElementById('compendium-type-filters');
        if (filtersRow) {
            filtersRow.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-filter-type]');
                if (btn) {
                    const typeAttr = btn.dataset.filterType;
                    this.currentFilterType = typeAttr === 'all' ? null : parseInt(typeAttr, 10);
                    const pack = this.getPackById(this.activePackId);
                    if (pack) this.renderFilterPillsForPack(pack.cards || []);
                    this.updateCardsList();
                }
            });
        }
    }

    /* =========================================================================
     * 5. Ações nos Cards (Toggle, Rolagem, Edição e Exclusão)
     * ========================================================================= */

    handleCardAction(action, card, index) {
        if (!card) return;

        if (action === 'toggle-equip') {
            const newState = !card.equipped;
            card.equipped = newState ? 1 : 0;
            // Se o motor C possui este card, atualiza no C
            if (this.engine && this.engine.getCardByKey(card.key)) {
                this.engine.setEquipped(card.key, newState);
            }
            this.syncActivePackCard(card);
            this.log(`[CardPack] Card "${card.name}" ${newState ? 'marcado como ativo' : 'desmarcado'}.`, 'info');
            this.updateCardsList();
        } else if (action === 'roll') {
            if (card.formula && this.engine) {
                const val = this.engine.evalExpression(card.formula);
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
            window.cardEditorTargetPackId = this.activePackId;
            window.cardEditorTargetKey = card.key;
            if (this.router && typeof this.router.navigate === 'function') {
                this.router.navigate('editor');
            }
        } else if (action === 'delete') {
            if (confirm(`Remover o card "${card.name}" deste pacote?`)) {
                this.removeCardFromActivePack(card.key);
            }
        }
    }

    syncActivePackCard(updatedCard) {
        if (!this.activePackId) return;
        const pack = this.getPackById(this.activePackId);
        if (!pack || !pack.cards) return;
        const idx = pack.cards.findIndex(c => c.key === updatedCard.key);
        if (idx >= 0) {
            pack.cards[idx] = updatedCard;
        } else {
            pack.cards.push(updatedCard);
        }
        this.addOrUpdatePack(pack);
    }

    removeCardFromActivePack(cardKey) {
        if (!this.activePackId) return;
        const pack = this.getPackById(this.activePackId);
        if (!pack || !pack.cards) return;
        pack.cards = pack.cards.filter(c => c.key !== cardKey);
        this.addOrUpdatePack(pack);
        if (this.engine && this.engine.getCardByKey(cardKey)) {
            this.engine.removeCardByKey(cardKey);
            this.engine.recalculate();
        }
        this.log(`[CardPack] Card "@${cardKey}" removido do pacote "${pack.name}".`, 'info');
        this.render();
    }

    updateCardsList() {
        if (!this.virtualList) return;

        let cards = [];
        if (this.activePackId) {
            const pack = this.getPackById(this.activePackId);
            cards = pack ? (pack.cards || []) : [];
        } else if (this.engine) {
            cards = this.engine.getAllCards();
        }

        // Aplica busca textual
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            cards = cards.filter(c => 
                (c.name && c.name.toLowerCase().includes(q)) ||
                (c.key && c.key.toLowerCase().includes(q)) ||
                (c.desc && c.desc.toLowerCase().includes(q)) ||
                (c.formula && c.formula.toLowerCase().includes(q))
            );
        }

        // Aplica filtro por tipo
        if (this.currentFilterType !== null) {
            cards = cards.filter(c => c.type === this.currentFilterType);
        }

        // Aplica filtro de equipados
        if (this.onlyEquipped) {
            cards = cards.filter(c => c.equipped);
        }

        this.virtualList.setData(cards);

        const counterEl = document.getElementById('compendium-counter-badge');
        if (counterEl) {
            counterEl.textContent = `Exibindo ${cards.length} cards`;
        }
    }

    /* =========================================================================
     * 6. Importação e Exportação de Pacotes (.cardpack)
     * ========================================================================= */

    async handlePackFileImport(event) {
        const file = event.target?.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const parsed = JSON.parse(text);

            const pack = {
                id: 'pack_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                name: parsed.pack_name || parsed.sheet_name || parsed.name || file.name.replace(/\.[^/.]+$/, ''),
                system: parsed.system_name || parsed.system || 'Sistema Aberto',
                author: parsed.author || 'Importado',
                version: parsed.version || '1.0.0',
                desc: parsed.description || parsed.desc || `Importado a partir do arquivo "${file.name}".`,
                cards: Array.isArray(parsed.cards) ? parsed.cards : [],
                wizard_schema: parsed.wizard_schema || null,
                createdAt: Date.now()
            };

            this.addOrUpdatePack(pack);
            this.log(`[Import] CardPack "${pack.name}" importado com sucesso! (${pack.cards.length} cards)`, 'success');
            this.openPack(pack.id);
        } catch (err) {
            this.log(`[Import Erro] Falha ao importar .cardpack: ${err.message}`, 'error');
            alert(`Erro ao ler o arquivo .cardpack: ${err.message}`);
        } finally {
            event.target.value = '';
        }
    }

    exportPackToFile(packId) {
        const pack = this.getPackById(packId);
        if (!pack) {
            this.log('[Export Erro] Pacote não encontrado.', 'error');
            return;
        }

        const packPayload = {
            sheet_name: pack.name,
            system_name: pack.system,
            version: pack.version || '1.0.0',
            author: pack.author || '',
            desc: pack.desc || '',
            cards: pack.cards || []
        };

        const jsonStr = JSON.stringify(packPayload, null, 2);
        const fileName = `${(pack.name || 'cardpack').toLowerCase().replace(/[^a-z0-9]/g, '_')}.cardpack`;

        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        if (document.body && typeof document.body.appendChild === 'function') {
            document.body.appendChild(a);
        }
        if (typeof a.click === 'function') a.click();
        if (document.body && typeof document.body.removeChild === 'function') {
            document.body.removeChild(a);
        }
        setTimeout(() => URL.revokeObjectURL(url), 2000);

        this.log(`[Export] CardPack exportado com sucesso: "${fileName}"`, 'success');
    }

    loadPackIntoEngine(packId) {
        const pack = this.getPackById(packId);
        if (!pack || !this.engine) return;

        if (pack.name) this.engine.setCharacterName(pack.name);
        if (pack.system) this.engine.setSystemName(pack.system);

        const count = this.engine.importCardPack(pack, false); // substitui o deck ativo pelo pacote
        if (count >= 0) {
            this.engine.recalculate();
            this.log(`[Motor C] CardPack "${pack.name}" carregado na ficha ativa! (${count} cards na memória C)`, 'success');
            if (window.sheetView) {
                window.sheetView.showingRoster = false;
                window.sheetView.render();
            }
            if (this.router && typeof this.router.navigate === 'function') {
                this.router.navigate('sheet');
            }
        } else {
            this.log(`[Motor C Erro] Falha ao injetar pacote na memória C (código: ${count}).`, 'error');
        }
    }

    exportCompendium() {
        if (this.activePackId) {
            this.exportPackToFile(this.activePackId);
        } else if (this.engine) {
            const rawJson = this.engine.exportCardPack(true);
            if (!rawJson) return;
            const fileName = `compendio_export_${Date.now()}.cardpack`;
            const blob = new Blob([rawJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            if (document.body && typeof document.body.appendChild === 'function') {
                document.body.appendChild(a);
            }
            if (typeof a.click === 'function') a.click();
            if (document.body && typeof document.body.removeChild === 'function') {
                document.body.removeChild(a);
            }
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            this.log(`[Export] Compêndio exportado com sucesso: "${fileName}"`, 'success');
        }
    }

    /* =========================================================================
     * 7. Fallback e Amostras para Testes
     * ========================================================================= */

    seedStarterCards() {
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

        const pack = {
            id: 'srd_starter_pack',
            name: 'SRD Básico / Fantasia Aberta',
            system: 'Fantasia Aberta d20',
            author: 'Comunidade RPG-SheetC',
            version: '2.0.0',
            desc: 'Kit inicial básico com atributos, recursos, perícias, armas e magias abertas.',
            cards: starterPack,
            createdAt: Date.now()
        };

        this.addOrUpdatePack(pack);
        this.activePackId = pack.id;
        this.currentViewMode = 'cards';

        if (this.engine) {
            this.engine.importCardPack(starterPack, true);
        }
        this.log('[Compêndio] Carregado CardPack inicial de aventura com 15 cards.', 'info');
    }
}

if (typeof window !== 'undefined') {
    window.CompendiumView = CompendiumView;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CompendiumView };
}
