/**
 * sheet_view.js — Painel Modular Orientado a Cards Aplicados (RPG-SheetC v2.0)
 * Integrado 100% ao Motor C99 (WebAssembly) via SheetCWasm
 */

class SheetView {
    constructor(engine, router, logger) {
        this.engine = engine;
        this.router = router;
        this.logger = logger || console.log;

        this.container = null;
        this.skillFilter = '';
        this.skillFilterOnlyTrained = false;
        this.showingRoster = false; // Controle de exibição da galeria vs ficha ativa
        this.sheetMode = 'play'; // 'play' (In-Game / Jogar) | 'edit' (Editar / Construir)
        this.activeEditorTab = 'overview'; // Tab ativa do editor configurada dinamicamente pelo CardPack
        this._activeCardPack = null; // Cache do CardPack ativo com ui_layout
        this._cardMetaMap = new Map(); // Mapa de metadados estendidos (category, is_mandatory) dos cards

        // Estado do Modal de Busca e Adição de Cards à Ficha (Mochila / Grimório / Habilidades)
        this.pickerTargetMode = 'equipment'; // 'equipment', 'spells' ou 'abilities'
        this.pickerSearchQuery = '';
        this.pickerCategoryFilter = null;
        this.pickerSelectedPackId = 'all';

        // Inscrição reativa para atualizar a ficha sempre que o deck no C for modificado
        if (this.engine && typeof this.engine.onChange === 'function') {
            this.engine.onChange((reason) => {
                if (this.container && (this.container.offsetParent !== null || typeof window === 'undefined')) {
                    this.render();
                }
            });
        }
    }

    /**
     * Retorna o CardPack ativo associado ao sistema da ficha atual (ou primeiro pacote instalado)
     */
    getActiveCardPack() {
        if (this._activeCardPack && this._activeCardPack.ui_layout) {
            return this._activeCardPack;
        }

        let packs = [];
        if (typeof window !== 'undefined' && window.compendiumView && typeof window.compendiumView.getInstalledPacks === 'function') {
            packs = window.compendiumView.getInstalledPacks();
        } else if (typeof localStorage !== 'undefined') {
            try {
                const raw = localStorage.getItem('compendium_packs_v2');
                if (raw) packs = JSON.parse(raw);
            } catch (e) {}
        }

        const currentSys = (this.engine?.getSystemName?.() || '').toLowerCase();
        if (packs && packs.length > 0) {
            if (currentSys) {
                const match = packs.find(p => {
                    const sName = (p.system || p.system_name || p.name || '').toLowerCase();
                    return sName.includes(currentSys) || currentSys.includes(sName);
                });
                if (match) {
                    this._activeCardPack = match;
                    return match;
                }
            }
            this._activeCardPack = packs[0];
            return packs[0];
        }
        return null;
    }

    /**
     * Define o CardPack ativo manualmente
     */
    setActiveCardPack(pack) {
        if (pack) {
            this._activeCardPack = pack;
        }
    }

    /**
     * Inicializa a view da ficha
     */
    init(containerId = 'sheet-container') {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            this.container = document.getElementById('view-sheet');
        }
        if (!this.container) return;

        // Auto-carrega metadados do CardPack local se ainda não estiver em cache
        if (typeof fetch !== 'undefined' && (!this._activeCardPack || !this._activeCardPack.ui_layout)) {
            fetch('./data/local/t20_completo.cardpack')
                .then(r => r.ok ? r.json() : null)
                .then(pack => {
                    if (pack) {
                        this._activeCardPack = pack;
                        if (typeof window !== 'undefined' && window.compendiumView && typeof window.compendiumView.addOrUpdatePack === 'function') {
                            window.compendiumView.addOrUpdatePack(pack);
                        }
                        if (this.container && this.container.innerHTML) {
                            this.render();
                        }
                    }
                })
                .catch(() => {});
        }

        this.render();
    }

    /**
     * Formata modificador com sinal positivo/negativo
     */
    formatMod(mod) {
        return mod >= 0 ? `+${mod}` : `${mod}`;
    }

    /**
     * Alterna entre o modo In-Game ('play') e o modo Editar ('edit')
     */
    setMode(mode) {
        if (mode === 'play' || mode === 'edit') {
            this.sheetMode = mode;
            this.render();
        }
    }

    /**
     * Renderiza o painel modular completo da ficha ou a galeria de personagens
     */
    render() {
        if (!this.container || !this.engine || !this.engine.isLoaded) return;

        const name = this.engine.getCharacterName() || 'Novo Herói';
        const system = this.engine.getSystemName() || 'Sistema Aberto';
        const level = this.engine.getLevel() || 1;
        const xp = this.engine.getXp() || 0;
        const cardCount = this.engine.getCardCount();

        // Se o usuário pediu a galeria ou se não há ficha carregada no C:
        if (this.showingRoster || cardCount === 0) {
            this.renderRosterView();
            return;
        }

        // 1. Coleta de Cards Categorizados do Motor C
        const CARD_TYPES = (typeof window !== 'undefined' && window.CARD_TYPES) ? window.CARD_TYPES : {
            ATTRIBUTE: 0, RESOURCE: 1, STAT: 2, SKILL: 3, ABILITY: 4, EQUIPMENT: 5, SPELL: 6, TRAIT: 7
        };

        const resourceCards = this.engine.getAllCards(c => c.type === CARD_TYPES.RESOURCE);
        const statCards = this.engine.getAllCards(c => c.type === CARD_TYPES.STAT);
        const attributeCards = this.engine.getAllCards(c => c.type === CARD_TYPES.ATTRIBUTE);
        const equippedEquipment = this.engine.getAllCards(c => c.type === CARD_TYPES.EQUIPMENT && c.equipped);
        const inventoryEquipment = this.engine.getAllCards(c => c.type === CARD_TYPES.EQUIPMENT && !c.equipped);
        const activeSpellsAbilities = this.engine.getAllCards(c => (c.type === CARD_TYPES.SPELL || c.type === CARD_TYPES.ABILITY || c.type === CARD_TYPES.TRAIT) && c.equipped);
        const availableSpellsAbilities = this.engine.getAllCards(c => (c.type === CARD_TYPES.SPELL || c.type === CARD_TYPES.ABILITY || c.type === CARD_TYPES.TRAIT) && !c.equipped);
        const skillCards = this.engine.getAllCards(c => c.type === CARD_TYPES.SKILL);
        const isPlayMode = this.sheetMode === 'play';
        const pack = this.getActiveCardPack();
        const editorTabs = pack?.ui_layout?.editor_tabs || [
            { id: 'overview', name: 'Visão Geral', icon: '📜' },
            { id: 'abilities', name: 'Habilidades', icon: '⚡' },
            { id: 'equipment', name: 'Equipamento & Mochila', icon: '🎒' },
            { id: 'spells', name: 'Magias & Grimório', icon: '✨' },
            { id: 'skills', name: 'Perícias', icon: '🎯' }
        ];

        if (!this.activeEditorTab && pack?.ui_layout?.default_tab) {
            this.activeEditorTab = pack.ui_layout.default_tab;
        }

        this.container.innerHTML = `
            <div class="sheet-main-layout ${isPlayMode ? 'sheet-mode-play' : 'sheet-mode-edit'}">
                <!-- Barra Superior de Navegação / Modos / Retorno à Galeria -->
                <div class="sheet-top-navigation-bar">
                    <button type="button" id="btn-sheet-back-to-roster" class="btn btn-secondary" title="Voltar à Galeria de Personagens">
                        ⬅️ Trocar / Ver Todos os Personagens
                    </button>

                    <div class="sheet-mode-switcher" role="group" aria-label="Modo de Visualização">
                        <button type="button" id="btn-mode-play" class="btn btn-sm ${isPlayMode ? 'btn-primary active-mode' : 'btn-secondary'}" title="Modo focado em jogar: rolagens rápidas, PV/PM e combate ágil">
                            🎮 Modo In-Game
                        </button>
                        <button type="button" id="btn-mode-edit" class="btn btn-sm ${!isPlayMode ? 'btn-primary active-mode' : 'btn-secondary'}" title="Modo focado em construção: equipar itens, steppers, fórmulas e gerenciar cards">
                            🛠️ Modo Editar
                        </button>
                    </div>

                    <span class="sheet-active-status-tag">
                        ⚔️ ${name} &bull; <strong style="color: ${isPlayMode ? '#4ade80' : 'var(--color-gold-primary)'};">${isPlayMode ? '🎮 Em Jogo' : '🛠️ Editando'}</strong>
                    </span>
                </div>

                <!-- Cabeçalho Principal da Ficha -->
                ${isPlayMode ? `
                    <section class="card sheet-header-card sheet-header-play">
                        <div class="sheet-header-top">
                            <div class="sheet-identity-group">
                                <h2 style="font-family: var(--font-heading); font-size: 1.6rem; color: var(--color-gold-light); margin: 0; display: flex; align-items: center; gap: 8px;">
                                    ⚔️ ${name}
                                </h2>
                                <div style="font-size: 0.85rem; color: var(--color-text-muted); margin-top: 2px;">
                                    Nível ${level} &bull; ${xp} XP &bull; 📜 ${system}
                                </div>
                            </div>
                            <div class="sheet-badges-group">
                                <span class="sheet-meta-pill race-pill">🃏 ${cardCount} Cards Ativos</span>
                                <span class="sheet-meta-pill class-pill">⚔️ ${equippedEquipment.length} Equipados</span>
                                <button type="button" id="btn-switch-to-edit-quick" class="btn btn-sm" style="font-size: 0.78rem;" title="Mudar para Modo Editar">
                                    ✏️ Editar Ficha
                                </button>
                            </div>
                        </div>

                        <div class="sheet-level-xp-row" style="justify-content: flex-end;">
                            <div class="sheet-header-actions">
                                <button type="button" id="btn-sheet-save" class="btn btn-primary" title="Salvar no Navegador">
                                    💾 Salvar Ficha
                                </button>
                                <button type="button" id="btn-sheet-print-pdf" class="btn" title="Imprimir / Salvar como PDF">
                                    🖨️ PDF
                                </button>
                                <button type="button" id="btn-sheet-open-dice" class="btn btn-accent" title="Abrir Rolador de Dados Rápido">
                                    🎲 Rolar Dados
                                </button>
                            </div>
                        </div>
                    </section>
                ` : `
                    <section class="card sheet-header-card sheet-header-edit">
                        <div class="sheet-header-top">
                            <div class="sheet-identity-group">
                                <label class="sheet-field-label">Nome do Personagem (Edição In-Place)</label>
                                <input type="text" id="sheet-name-input" class="sheet-name-field" value="${name}" maxlength="30" placeholder="Nome do Herói">
                            </div>
                            <div class="sheet-badges-group">
                                <span class="sheet-meta-pill race-pill">🃏 ${cardCount} Cards Ativos</span>
                                <span class="sheet-meta-pill class-pill">⚔️ ${equippedEquipment.length} Equipados</span>
                                <span class="sheet-meta-pill system-pill">📜 ${system}</span>
                            </div>
                        </div>

                        <div class="sheet-level-xp-row">
                            <div class="sheet-stepper-control">
                                <span class="sheet-field-label">Nível</span>
                                <div class="stepper-box">
                                    <button type="button" id="btn-lvl-down" class="btn-stepper" title="Diminuir Nível">-</button>
                                    <span class="stepper-value" id="sheet-level-val">${level}</span>
                                    <button type="button" id="btn-lvl-up" class="btn-stepper" title="Aumentar Nível">+</button>
                                </div>
                            </div>

                            <div class="sheet-xp-control">
                                <label class="sheet-field-label" for="sheet-xp-input">Experiência (XP)</label>
                                <input type="number" id="sheet-xp-input" class="sheet-number-field" value="${xp}" min="0" step="100">
                            </div>

                            <div class="sheet-header-actions">
                                <button type="button" id="btn-sheet-community-packs" class="btn btn-accent" title="Explorar e importar Data Packs comunitários com 1 clique">
                                    📦 Data Packs
                                </button>
                                <button type="button" id="btn-sheet-save" class="btn btn-primary" title="Salvar no Navegador">
                                    💾 Salvar
                                </button>
                                <button type="button" id="btn-sheet-export-file" class="btn" title="Exportar Deck (.cardpack JSON)">
                                    📥 Exportar
                                </button>
                                <button type="button" id="btn-sheet-import-file" class="btn" title="Importar Pacote (.cardpack JSON)">
                                    📤 Importar
                                </button>
                                <button type="button" id="btn-sheet-print-pdf" class="btn" title="Imprimir / Salvar como PDF">
                                    🖨️ PDF
                                </button>
                                <button type="button" id="btn-sheet-manage-saved" class="btn" title="Gerenciar Fichas">
                                    📜 Fichas
                                </button>
                                <button type="button" id="btn-sheet-open-compendium" class="btn btn-accent" title="Abrir Compêndio e Adicionar Novos Cards">
                                    🗂️ Compêndio
                                </button>
                                <button type="button" id="btn-sheet-create-card" class="btn" title="Criar Novo Card Personalizado">
                                    ➕ Criar Card
                                </button>
                            </div>
                        </div>
                    </section>
                `}

                ${!isPlayMode ? `
                    <!-- Barra de Abas do Modo Editar Configuradas Dinamicamente pelo CardPack -->
                    <div class="sheet-editor-tabs-bar">
                        ${editorTabs.map(t => `
                            <button type="button" class="btn btn-editor-tab ${this.activeEditorTab === t.id ? 'active' : ''}" data-editor-tab="${t.id}">
                                <span class="tab-icon">${t.icon || '📄'}</span>
                                <span class="tab-title">${t.name}</span>
                            </button>
                        `).join('')}
                    </div>
                ` : ''}

                <div class="dashboard-grid sheet-grid-columns">
                    <!-- Coluna Principal (Recursos, Stats, Atributos, Equipamentos, Habilidades, Perícias) -->
                    <main class="sheet-column-main" style="display: flex; flex-direction: column; gap: var(--space-lg);">
                        ${this.renderMainColumnContent(isPlayMode, pack, {
                            resourceCards,
                            statCards,
                            attributeCards,
                            equippedEquipment,
                            inventoryEquipment,
                            activeSpellsAbilities,
                            availableSpellsAbilities,
                            skillCards
                        })}
                    </main>

                    <!-- Coluna Lateral (Logs e Testes do Motor C) -->
                    <aside class="sheet-column-side">
                        ${isPlayMode ? `
                            <section class="card">
                                <div class="card-header">
                                    <span class="card-title">🎲 Rolagem Rápida de Dados</span>
                                </div>
                                <div class="action-group" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
                                    <button class="btn btn-sm btn-quick-dice" data-d="4">1d4</button>
                                    <button class="btn btn-sm btn-quick-dice" data-d="6">1d6</button>
                                    <button class="btn btn-sm btn-quick-dice" data-d="8">1d8</button>
                                    <button class="btn btn-sm btn-quick-dice" data-d="10">1d10</button>
                                    <button class="btn btn-sm btn-quick-dice" data-d="12">1d12</button>
                                    <button class="btn btn-sm btn-quick-dice" data-d="100">1d100</button>
                                </div>
                                <div style="margin-top: 10px;">
                                    <button id="btn-test-d20" class="btn btn-primary" style="width: 100%; font-weight: 800;">
                                        🎲 Rolar 1d20 Puro
                                    </button>
                                </div>
                            </section>
                        ` : `
                            <section class="card">
                                <div class="card-header">
                                    <span class="card-title">Ações Rápidas de Teste</span>
                                </div>
                                <div class="action-group">
                                    <button id="btn-test-d20" class="btn btn-primary">🎲 Rolar 1d20</button>
                                    <button id="btn-test-complex" class="btn">🎲 Rolar 3d6+5</button>
                                    <button id="btn-dump-json" class="btn">📄 Visualizar JSON do C</button>
                                    <button id="btn-reload-starter" class="btn" title="Carrega um kit inicial com atributos, equipamentos e perícias">
                                        ✨ Kit Inicial
                                    </button>
                                </div>
                            </section>
                        `}

                        <section class="card">
                            <div class="card-header">
                                <span class="card-title">Console de Execução WASM</span>
                            </div>
                            <div id="console-output" class="console-container">
                                <div class="log-entry log-info">[Motor C] Pronto para executar comandos. Deck ativo com ${cardCount} cards.</div>
                            </div>
                        </section>
                    </aside>
                </div>

                <!-- Modal de Busca e Adição de Cards à Ficha (Mochila / Grimório) -->
                ${!isPlayMode ? this.renderCardPickerModal() : ''}
            </div>
        `;

        this.setupHeaderEventListeners();
        this.setupEventListeners();
    }

    /**
     * Renderiza o conteúdo da coluna principal de acordo com o modo (In-Game vs Editor) e a aba ativa configurada
     */
    renderMainColumnContent(isPlayMode, pack, data) {
        const {
            resourceCards,
            statCards,
            attributeCards,
            equippedEquipment,
            inventoryEquipment,
            activeSpellsAbilities,
            availableSpellsAbilities,
            skillCards
        } = data;

        // No Modo In-Game: Dashboard ágil consolidado com todas as seções operacionais
        if (isPlayMode) {
            return `
                ${this.renderResourcesSection(resourceCards, statCards)}
                ${this.renderAttributesSection(attributeCards, true)}
                ${this.renderEquipmentSection(equippedEquipment, inventoryEquipment, true)}
                ${this.renderSpellsSection(activeSpellsAbilities, availableSpellsAbilities, true)}
                ${this.renderSkillsSection(skillCards, true)}
            `;
        }

        // No Modo Editar: Navegação orientada pelas abas do CardPack
        const tab = this.activeEditorTab || 'overview';
        if (tab === 'abilities') {
            return this.renderAbilitiesTab(pack);
        } else if (tab === 'equipment') {
            return this.renderEquipmentSection(equippedEquipment, inventoryEquipment, false);
        } else if (tab === 'spells') {
            return this.renderSpellsSection(activeSpellsAbilities, availableSpellsAbilities, false);
        } else if (tab === 'skills') {
            return this.renderSkillsSection(skillCards, false);
        } else {
            // 'overview' ou padrão: Visão geral completa para construção
            return `
                ${this.renderResourcesSection(resourceCards, statCards)}
                ${this.renderAttributesSection(attributeCards, false)}
                ${this.renderEquipmentSection(equippedEquipment, inventoryEquipment, false)}
                ${this.renderSpellsSection(activeSpellsAbilities, availableSpellsAbilities, false)}
                ${this.renderSkillsSection(skillCards, false)}
            `;
        }
    }

    renderResourcesSection(resourceCards, statCards) {
        return `
            <section class="card sheet-resources-card">
                <div class="card-header" style="margin-bottom: var(--space-md);">
                    <div>
                        <span class="card-title">Recursos de Combate & Estatísticas</span>
                        <span class="card-subtitle-small">Recalculados automaticamente na memória C</span>
                    </div>
                </div>

                ${resourceCards.length > 0 ? `
                    <div class="sheet-combat-meters" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-md); margin-bottom: var(--space-lg);">
                        ${resourceCards.map(rc => {
                            const cur = rc.current;
                            const max = rc.max > 0 ? rc.max : 1;
                            const pct = Math.min(100, Math.max(0, (cur / max) * 100));
                            const isMana = rc.key.includes('pm') || rc.key.includes('mana') || rc.key.includes('mp');
                            const icon = isMana ? '✨' : '❤️';
                            return `
                                <div class="resource-block ${isMana ? 'pm-block' : 'pv-block'}" data-res-key="${rc.key}">
                                    <div class="resource-block-header">
                                        <span class="res-label">${icon} ${rc.name} (${rc.key.toUpperCase()})</span>
                                        <div class="res-inputs">
                                            <input type="number" class="res-num-input res-cur-input" data-res-key="${rc.key}" value="${cur}" min="0" max="${max}">
                                            <span class="res-sep">/</span>
                                            <span class="res-max">${max}</span>
                                        </div>
                                    </div>
                                    <div class="res-progress-track">
                                        <div class="res-progress-fill ${isMana ? 'pm-fill' : 'pv-fill'}" style="width: ${pct}%;"></div>
                                    </div>
                                    <div class="res-quick-buttons">
                                        <button type="button" class="btn-res-delta btn-quick-dmg" data-res-key="${rc.key}" data-delta="-5">-5</button>
                                        <button type="button" class="btn-res-delta btn-quick-dmg" data-res-key="${rc.key}" data-delta="-1">-1</button>
                                        <button type="button" class="btn-res-delta btn-quick-heal" data-res-key="${rc.key}" data-delta="1">+1</button>
                                        <button type="button" class="btn-res-delta btn-quick-heal" data-res-key="${rc.key}" data-delta="5">+5</button>
                                        <button type="button" class="btn-res-full btn-quick-action" data-res-key="${rc.key}" data-max="${max}" title="Recuperar Total">Total</button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : ''}

                ${statCards.length > 0 ? `
                    <div class="sheet-stats-container" style="display: flex; gap: var(--space-md); flex-wrap: wrap;">
                        ${statCards.map(sc => `
                            <div class="defense-breakdown-card" style="flex: 1; min-width: 240px;" data-stat-key="${sc.key}">
                                <div class="defense-main-badge">
                                    <span class="def-badge-label">${sc.name}</span>
                                    <div class="def-badge-val" id="stat-val-${sc.key}">${sc.effective}</div>
                                </div>
                                <div class="defense-calc-items">
                                    <div class="def-calc-item">
                                        <span class="calc-label">Base</span>
                                        <span class="calc-val">${sc.base}</span>
                                    </div>
                                    ${sc.formula ? `
                                        <span class="calc-op">•</span>
                                        <div class="def-calc-item">
                                            <span class="calc-label">Fórmula</span>
                                            <span class="calc-val" style="font-size: 0.82rem; font-family: var(--font-mono); color: #67e8f9;">${sc.formula}</span>
                                        </div>
                                    ` : ''}
                                    ${sc.effective !== sc.base ? `
                                        <span class="calc-op">=</span>
                                        <div class="def-calc-item">
                                            <span class="calc-label">Bônus Cards</span>
                                            <span class="calc-val" style="color: #4ade80;">${this.formatMod(sc.effective - sc.base)}</span>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </section>
        `;
    }

    renderAttributesSection(attributeCards, isPlayMode) {
        if (!attributeCards || attributeCards.length === 0) return '';
        return `
            <section class="card sheet-attributes-card">
                <div class="card-header">
                    <span class="card-title">Atributos Básicos</span>
                    <span class="card-subtitle-small">${isPlayMode ? 'Clique no modificador para rolar 1d20 no combate' : 'Modifique a base ou clique no modificador para rolar d20'}</span>
                </div>

                <div class="sheet-attributes-grid ${isPlayMode ? 'sheet-attributes-play' : ''}">
                    ${attributeCards.map(attr => {
                        const eff = attr.effective;
                        const mod = Math.floor((eff - 10) / 2);
                        const hasBonus = eff !== attr.base;
                        return `
                            <div class="sheet-attr-card ${isPlayMode ? 'sheet-attr-play-card' : ''}" data-attr-key="${attr.key}">
                                <div class="sheet-attr-header">
                                    <span class="attr-abbr-tag">${attr.key.toUpperCase()}</span>
                                    <span class="attr-title-text">${attr.name}</span>
                                </div>
                                <div class="sheet-attr-mod ${mod >= 0 ? 'mod-positive' : 'mod-negative'}" 
                                     data-attr-key="${attr.key}" 
                                     data-attr-name="${attr.name}" 
                                     data-attr-mod="${mod}"
                                     title="Clique para rolar 1d20 ${this.formatMod(mod)}"
                                     style="cursor: pointer;">
                                    ${this.formatMod(mod)}
                                </div>
                                ${!isPlayMode ? `
                                    <div class="sheet-attr-input-row">
                                        <button type="button" class="btn-attr-stepper btn-attr-minus" data-attr-key="${attr.key}">-</button>
                                        <input type="number" class="sheet-attr-val-input" data-attr-key="${attr.key}" value="${attr.base}" min="1" max="40">
                                        <button type="button" class="btn-attr-stepper btn-attr-plus" data-attr-key="${attr.key}">+</button>
                                    </div>
                                ` : `
                                    <span style="font-size: 0.8rem; color: var(--color-text-muted); font-weight: 700;">
                                        Valor: <strong style="color: ${hasBonus ? '#4ade80' : 'var(--color-text-main)'}; font-family: var(--font-heading);">${eff}</strong>
                                    </span>
                                `}
                                ${(!isPlayMode && hasBonus) ? `
                                    <span style="font-size: 0.68rem; color: #4ade80; font-weight: 700;">Efetivo: ${eff}</span>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </section>
        `;
    }

    renderEquipmentSection(equippedEquipment, inventoryEquipment, isPlayMode) {
        return `
            <section class="card sheet-equipment-card">
                <div class="card-header">
                    <div>
                        <span class="card-title">Equipamento & Armas</span>
                        <span class="card-subtitle-small">${isPlayMode ? 'Apenas itens em uso (clique em Rolar para atacar ou causar dano)' : 'Itens em uso afetam dinamicamente os valores da ficha'}</span>
                    </div>
                    ${!isPlayMode ? `
                        <button type="button" id="btn-add-item-modal" class="btn btn-sm btn-primary" title="Buscar e adicionar item/equipamento do CardPack à mochila" style="font-size: 0.8rem; font-weight: 700;">
                            ➕ Adicionar Item / Equipamento
                        </button>
                    ` : ''}
                </div>

                <!-- Equipamentos Atualmente Equipados -->
                <div style="margin-bottom: var(--space-md);">
                    <h4 style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-gold-primary); margin-bottom: var(--space-xs);">
                        🛡️ Equipados na Ficha (${equippedEquipment.length})
                    </h4>
                    ${equippedEquipment.length > 0 ? `
                        <div class="sheet-card-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--space-sm);">
                            ${equippedEquipment.map(eq => this.renderMiniCard(eq, true, isPlayMode)).join('')}
                        </div>
                    ` : `
                        <p style="font-size: 0.85rem; color: var(--color-text-dim); margin: 0; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 6px;">
                            Nenhum equipamento equipado no momento. ${isPlayMode ? 'Alterne para o Modo Editar para equipar armas ou armaduras.' : 'Equipe um item do inventário abaixo para aplicar seus bônus.'}
                        </p>
                    `}
                </div>

                <!-- Mochila / Inventário Disponível -->
                ${!isPlayMode ? `
                    <div>
                        <h4 style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-text-muted); margin-bottom: var(--space-xs);">
                            🎒 Mochila / Inventário (${inventoryEquipment.length})
                        </h4>
                        ${inventoryEquipment.length > 0 ? `
                            <div class="sheet-card-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--space-sm);">
                                ${inventoryEquipment.map(eq => this.renderMiniCard(eq, false, false)).join('')}
                            </div>
                        ` : `
                            <div class="sheet-empty-backpack-box" style="padding: 16px; text-align: center; background: rgba(0,0,0,0.2); border: 1px dashed rgba(255,255,255,0.12); border-radius: 8px;">
                                <p style="font-size: 0.85rem; color: var(--color-text-dim); margin: 0 0 10px 0;">
                                    Mochila vazia. Adicione armas, armaduras ou itens para equipar ou guardar.
                                </p>
                                <button type="button" class="btn btn-sm btn-secondary btn-trigger-add-item" style="font-weight: 600;">
                                    ➕ Adicionar Item à Mochila
                                </button>
                            </div>
                        `}
                    </div>
                ` : (inventoryEquipment.length > 0 ? `
                    <details class="in-game-backpack-details">
                        <summary>🎒 Mochila (${inventoryEquipment.length} itens guardados)</summary>
                        <div style="padding-top: 10px; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px;">
                            ${inventoryEquipment.map(eq => `
                                <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; display: flex; justify-content: space-between; align-items: center;">
                                    <span>⚔️ ${eq.name}</span>
                                    <span style="color: var(--color-text-dim); font-size: 0.75rem;">Guardado</span>
                                </div>
                            `).join('')}
                        </div>
                    </details>
                ` : '')}
            </section>
        `;
    }

    renderSpellsSection(activeSpellsAbilities, availableSpellsAbilities, isPlayMode) {
        return `
            <section class="card sheet-spells-abilities-card">
                <div class="card-header">
                    <div>
                        <span class="card-title">Habilidades & Magias</span>
                        <span class="card-subtitle-small">${isPlayMode ? 'Poderes ativos em combate (custo debitado automaticamente)' : 'Cards ativos aplicam bônus ou executam rolagens com custo'}</span>
                    </div>
                    ${!isPlayMode ? `
                        <button type="button" id="btn-add-spell-modal" class="btn btn-sm btn-accent" title="Buscar e adicionar magia ou poder do CardPack ao grimório" style="font-size: 0.8rem; font-weight: 700;">
                            ➕ Adicionar Magia / Poder
                        </button>
                    ` : ''}
                </div>

                <!-- Cards de Habilidade / Magia Ativos / Sustentados -->
                ${activeSpellsAbilities.length > 0 ? `
                    <div style="margin-bottom: var(--space-md);">
                        <h4 style="font-size: 0.85rem; text-transform: uppercase; color: #a78bfa; margin-bottom: var(--space-xs);">
                            ⚡ Ativos / Sustentados (${activeSpellsAbilities.length})
                        </h4>
                        <div class="sheet-card-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--space-sm);">
                            ${activeSpellsAbilities.map(sp => this.renderMiniCard(sp, true, isPlayMode)).join('')}
                        </div>
                    </div>
                ` : (isPlayMode ? `
                    <p style="font-size: 0.82rem; color: var(--color-text-dim); margin-bottom: var(--space-md);">
                        Nenhuma magia ou habilidade ativa no momento.
                    </p>
                ` : '')}

                <!-- Grimório / Habilidades Disponíveis -->
                ${!isPlayMode ? `
                    <div>
                        <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: var(--space-xs);">
                            ✨ Grimório e Talentos (${availableSpellsAbilities.length})
                        </h4>
                        ${availableSpellsAbilities.length > 0 ? `
                            <div class="sheet-card-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--space-sm);">
                                ${availableSpellsAbilities.map(sp => this.renderMiniCard(sp, false, false)).join('')}
                            </div>
                        ` : `
                            <div class="sheet-empty-spells-box" style="padding: 16px; text-align: center; background: rgba(0,0,0,0.2); border: 1px dashed rgba(255,255,255,0.12); border-radius: 8px;">
                                <p style="font-size: 0.85rem; color: var(--color-text-dim); margin: 0 0 10px 0;">
                                    Nenhuma magia ou talento cadastrado no seu grimório.
                                </p>
                                <button type="button" class="btn btn-sm btn-secondary btn-trigger-add-spell" style="font-weight: 600;">
                                    ➕ Adicionar Magia ao Grimório
                                </button>
                            </div>
                        `}
                    </div>
                ` : (availableSpellsAbilities.length > 0 ? `
                    <details class="in-game-backpack-details">
                        <summary>✨ Grimório (${availableSpellsAbilities.length} magias/talentos não preparados)</summary>
                        <div style="padding-top: 10px; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px;">
                            ${availableSpellsAbilities.map(sp => `
                                <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; display: flex; justify-content: space-between; align-items: center;">
                                    <span>✨ ${sp.name}</span>
                                    <span style="color: var(--color-text-dim); font-size: 0.75rem;">Não preparado</span>
                                </div>
                            `).join('')}
                        </div>
                    </details>
                ` : '')}
            </section>
        `;
    }

    renderSkillsSection(skillCards, isPlayMode) {
        return `
            <section class="card sheet-skills-card">
                <div class="card-header">
                    <span class="card-title">Perícias (${skillCards.length})</span>
                    <div class="skills-filter-bar">
                        <input type="text" id="skills-search-input" class="skills-search" placeholder="🔍 Filtrar perícia..." value="${this.skillFilter}">
                        <label class="skills-checkbox-label">
                            <input type="checkbox" id="skills-only-trained" ${this.skillFilterOnlyTrained ? 'checked' : ''}>
                            Somente Treinadas
                        </label>
                    </div>
                </div>

                <div class="skills-table-container">
                    <table class="skills-table">
                        <thead>
                            <tr>
                                <th class="th-train">Treino</th>
                                <th class="th-name">Perícia</th>
                                <th class="th-attr">Referência</th>
                                <th class="th-bonus">Bônus</th>
                                <th class="th-roll">Ação</th>
                            </tr>
                        </thead>
                        <tbody id="skills-table-body">
                            ${this.renderSkillsTableRows(skillCards, isPlayMode)}
                        </tbody>
                    </table>
                </div>
            </section>
        `;
    }

    /**
     * Renderiza a Aba Especial de Habilidades configurada no CardPack
     * Organiza as habilidades em seções (Classe, Raça, Origem, Divindade)
     * e identifica visualmente habilidades obrigatórias de classe/raça.
     */
    renderAbilitiesTab(pack) {
        const CARD_TYPES = (typeof window !== 'undefined' && window.CARD_TYPES) ? window.CARD_TYPES : {
            ATTRIBUTE: 0, RESOURCE: 1, STAT: 2, SKILL: 3, ABILITY: 4, EQUIPMENT: 5, SPELL: 6, TRAIT: 7
        };

        const abilitiesTabConfig = pack?.ui_layout?.editor_tabs?.find(t => t.id === 'abilities');
        const categories = abilitiesTabConfig?.categories || [
            { id: 'class', name: 'Habilidades de Classe', category: 'class_ability', icon: '⚔️', description: 'Habilidades fundamentais e poderes especiais da sua classe de combate.' },
            { id: 'race', name: 'Habilidades & Traços de Raça', category: 'race_trait', icon: '🧬', description: 'Herança física, características fisiológicas e bônus ancestrais da sua espécie.' },
            { id: 'origin', name: 'Poderes de Origem', category: 'origin_power', icon: '📜', description: 'Habilidades, contatos e vantagens herdadas do seu passado pré-aventura.' },
            { id: 'deity', name: 'Poderes Concedidos / Divindade', category: 'deity_power', icon: '🕊️', description: 'Bênçãos divinas outorgadas pelos Deuses Maiores de Arton aos seus devotos.' }
        ];

        // Coleta todos os cards de habilidade/traço do deck C
        const allCards = this.engine.getAllCards();
        const abilityCards = allCards.filter(c => {
            if (c.type === CARD_TYPES.EQUIPMENT || c.type === CARD_TYPES.ATTRIBUTE || 
                c.type === CARD_TYPES.RESOURCE || c.type === CARD_TYPES.STAT || c.type === CARD_TYPES.SKILL) {
                return false;
            }
            return (c.type === CARD_TYPES.ABILITY || c.type === CARD_TYPES.TRAIT || c.category);
        });

        const enrichedCards = abilityCards.map(c => {
            const packCard = pack?.cards?.find(pk => pk.key === c.key);
            const meta = this._cardMetaMap?.get(c.key);
            let cat = c.category || meta?.category || packCard?.category || '';
            if (!cat) {
                if (c.key.startsWith('raca_') || c.key.startsWith('humano_') || c.key.startsWith('anao_') || c.key.startsWith('elfo_') || c.key.startsWith('dahllan_') || c.key.startsWith('goblin_') || c.key.startsWith('lefou_') || c.key.startsWith('minotauro_') || c.key.startsWith('qareen_')) cat = 'race_trait';
                else if (c.key.startsWith('origem_')) cat = 'origin_power';
                else if (c.key.startsWith('deus_')) cat = 'deity_power';
                else cat = 'class_ability';
            }
            const isMandatory = (c.is_mandatory === 1 || c.is_mandatory === true || 
                                 meta?.is_mandatory === 1 || meta?.is_mandatory === true || 
                                 packCard?.is_mandatory === 1 || packCard?.is_mandatory === true);
            return {
                ...c,
                resolvedCategory: cat,
                isMandatory: isMandatory,
                mods: c.modifiers || c.mods || packCard?.mods || []
            };
        });

        return `
            <div class="sheet-abilities-tab-container sheet-abilities-tab-view" style="display: flex; flex-direction: column; gap: var(--space-lg);">
                <!-- Cabeçalho da Aba de Habilidades -->
                <div class="card sheet-abilities-header-card" style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: var(--color-surface-card); border-radius: var(--radius-md); border: 1px solid var(--color-border-subtle); flex-wrap: wrap; gap: 12px;">
                    <div>
                        <h3 style="font-family: var(--font-heading); font-size: 1.25rem; color: var(--color-gold-light); margin: 0; display: flex; align-items: center; gap: 8px;">
                            ⚡ Habilidades, Poderes & Traços
                        </h3>
                        <p style="margin: 4px 0 0 0; font-size: 0.82rem; color: var(--color-text-muted);">
                            Habilidades de classe, traços raciais, poderes de origem e bênçãos do seu personagem.
                        </p>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button type="button" id="btn-open-abilities-picker-all" class="btn btn-primary btn-sm" style="font-weight: 700; padding: 8px 16px;">
                            ➕ Escolher / Adicionar Habilidade
                        </button>
                    </div>
                </div>

                <!-- Seções Dinâmicas Configuradas no CardPack -->
                ${categories.map(cat => {
                    const sectionCards = enrichedCards.filter(c => c.resolvedCategory === cat.category);
                    return `
                        <section class="card sheet-ability-section-card" data-category-id="${cat.id}" style="padding: 16px 20px; background: var(--color-surface-card); border-radius: var(--radius-md); border: 1px solid var(--color-border-subtle);">
                            <div class="sheet-ability-section-header">
                                <div>
                                    <h4 style="font-size: 1.05rem; font-family: var(--font-heading); color: var(--color-gold-primary); margin: 0; display: flex; align-items: center; gap: 8px;">
                                        <span>${cat.icon || '⚡'}</span> ${cat.name}
                                        <span class="sheet-meta-pill" style="font-size: 0.72rem; padding: 2px 8px;">${sectionCards.length} ativas</span>
                                    </h4>
                                    <span style="font-size: 0.78rem; color: var(--color-text-muted);">${cat.description || ''}</span>
                                </div>
                                <button type="button" class="btn btn-sm btn-secondary btn-add-ability-category" data-category="${cat.category}" style="font-size: 0.78rem; font-weight: 600;">
                                    ➕ Adicionar ${cat.name.replace('Habilidades & ', '').replace('Habilidades de ', '').replace('Poderes de ', '')}
                                </button>
                            </div>

                            ${sectionCards.length > 0 ? `
                                <div class="sheet-card-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-sm);">
                                    ${sectionCards.map(c => this.renderAbilityCard(c)).join('')}
                                </div>
                            ` : `
                                <div style="padding: 18px; text-align: center; background: rgba(0,0,0,0.18); border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">
                                    <p style="font-size: 0.85rem; color: var(--color-text-dim); margin: 0 0 10px 0;">
                                        Nenhuma habilidade nesta categoria. Escolha poderes para fortalecer seu herói.
                                    </p>
                                    <button type="button" class="btn btn-sm btn-outline btn-add-ability-category" data-category="${cat.category}" style="font-size: 0.8rem;">
                                        ➕ Escolher ${cat.name}
                                    </button>
                                </div>
                            `}
                        </section>
                    `;
                }).join('')}
            </div>
        `;
    }

    renderAbilityCard(card) {
        const isMandatory = !!card.isMandatory;
        const costVal = card.costValue || card.cost_val || 0;
        const costRes = card.costResource || card.cost_res || '';
        const costHtml = (costRes && costVal > 0) ? `
            <span class="card-chip card-chip-cost">⚡ ${costVal} ${costRes.toUpperCase()}</span>
        ` : '';
        const formulaHtml = card.formula ? `
            <span class="card-chip card-chip-formula">🎲 ${card.formula}</span>
        ` : '';
        const mods = card.mods || card.modifiers || [];
        const modsHtml = mods.map(m => `
            <span class="card-mod-badge" style="background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3);">
                ${this.formatMod(m.value || m.val || 0)} ${(m.target_key || m.target || '').toUpperCase()}
            </span>
        `).join('');

        return `
            <div class="rpg-card sheet-mini-card is-equipped" data-card-key="${card.key}" style="min-height: 110px; background: rgba(0,0,0,0.25); border: 1px solid ${isMandatory ? 'rgba(234, 179, 8, 0.35)' : 'rgba(255,255,255,0.08)'}; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between;">
                <div class="rpg-card-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; gap: 8px;">
                    <strong style="font-size: 0.95rem; color: var(--color-parchment-light);">${card.name}</strong>
                    ${isMandatory ? `
                        <span class="badge-mandatory" title="Habilidade Obrigatória de Classe ou Raça">
                            🔒 Obrigatória
                        </span>
                    ` : `
                        <span class="sheet-meta-pill" style="font-size: 0.68rem; background: rgba(167, 139, 250, 0.15); color: #c4b5fd; border: 1px solid rgba(167, 139, 250, 0.3); white-space: nowrap;">
                            ✨ Opcional
                        </span>
                    `}
                </div>

                <div class="rpg-card-body" style="font-size: 0.78rem; color: var(--color-text-muted); line-height: 1.35; margin-bottom: 8px;">
                    ${card.desc || ''}
                    <div class="card-chips-row" style="margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap;">
                        ${costHtml}
                        ${formulaHtml}
                        ${modsHtml}
                    </div>
                </div>

                <div class="sheet-mini-card-actions" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px; margin-top: 4px;">
                    <div>
                        ${card.formula ? `
                            <button type="button" class="btn btn-sm btn-roll-card" data-card-key="${card.key}" data-card-name="${card.name}" title="Rolar fórmula de habilidade" style="font-size: 0.75rem; padding: 2px 8px;">
                                🎲 Rolar
                            </button>
                        ` : ''}
                    </div>
                    <div>
                        ${isMandatory ? `
                            <span style="font-size: 0.72rem; color: #facc15; font-style: italic; display: flex; align-items: center; gap: 4px;" title="Esta habilidade é parte intrínseca do seu personagem e não pode ser removida.">
                                🔒 Fixa na Ficha
                            </span>
                        ` : `
                            <button type="button" class="btn btn-sm btn-remove-card" data-card-key="${card.key}" title="Remover habilidade opcional" style="color: #f87171; font-size: 0.75rem; padding: 2px 8px;">
                                🗑️ Remover
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Renderiza o HTML de um mini card para as listas de equipamento/magia/habilidade
     */
    renderMiniCard(card, isEquippedSection, isPlayMode = false) {
        const CARD_TYPES = (typeof window !== 'undefined' && window.CARD_TYPES) ? window.CARD_TYPES : {
            ATTRIBUTE: 0, RESOURCE: 1, STAT: 2, SKILL: 3, ABILITY: 4, EQUIPMENT: 5, SPELL: 6, TRAIT: 7
        };

        const isEquip = card.type === CARD_TYPES.EQUIPMENT;
        const icon = card.typeIcon || (isEquip ? '⚔️' : '✨');
        const badgeClass = card.badgeClass || (isEquip ? 'badge-equip' : 'badge-spell');

        const pack = this.getActiveCardPack();
        const packCard = pack?.cards?.find(pk => pk.key === card.key);
        const isMandatory = (card.is_mandatory === 1 || card.is_mandatory === true || packCard?.is_mandatory === 1 || packCard?.is_mandatory === true);

        // Bônus formatados
        const mods = card.modifiers || [];
        const modsHtml = mods.map(m => `
            <span class="card-mod-badge" style="background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3);">
                ${this.formatMod(m.value)} ${m.target_key.toUpperCase()}
            </span>
        `).join('');

        // Custo
        const costHtml = (card.costResource && card.costValue > 0) ? `
            <span class="card-chip card-chip-cost">⚡ ${card.costValue} ${card.costResource.toUpperCase()}</span>
        ` : '';

        // Fórmula
        const formulaHtml = card.formula ? `
            <span class="card-chip card-chip-formula">🎲 ${card.formula}</span>
        ` : '';

        return `
            <div class="rpg-card sheet-mini-card ${isPlayMode ? 'sheet-play-mini-card' : ''} ${card.equipped ? 'is-equipped' : ''}" data-card-key="${card.key}" style="min-height: 110px;">
                <div class="rpg-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 1.1rem;">${icon}</span>
                        <strong style="font-size: 0.9rem; color: var(--color-parchment-light);">${card.name}</strong>
                        ${isMandatory ? `<span class="badge-mandatory" title="Habilidade Obrigatória de Classe ou Raça">🔒 Obrigatória</span>` : ''}
                    </div>
                    <span class="card-type-badge ${badgeClass}" style="font-size: 0.65rem;">${card.typeLabel}</span>
                </div>

                <div class="rpg-card-body" style="font-size: 0.78rem; color: var(--color-text-muted); line-height: 1.3; margin-bottom: 8px;">
                    ${card.desc || ''}
                    <div class="card-chips-row" style="margin-top: 4px;">
                        ${costHtml}
                        ${formulaHtml}
                        ${modsHtml}
                    </div>
                </div>

                <div class="sheet-mini-card-actions" style="display: flex; justify-content: flex-end; gap: 6px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px;">
                    ${card.formula ? `
                        <button type="button" class="btn btn-sm btn-roll-card ${isPlayMode ? 'btn-primary' : ''}" data-card-key="${card.key}" data-card-name="${card.name}" title="Rolar fórmula ou ação" style="${isPlayMode ? 'font-weight: 800; padding: 4px 12px;' : ''}">
                            🎲 ${isPlayMode ? 'Rolar / Usar' : 'Rolar'}
                        </button>
                    ` : ''}

                    ${!isPlayMode ? `
                        ${isMandatory ? `
                            <span style="font-size: 0.72rem; color: #facc15; font-style: italic; display: flex; align-items: center; gap: 4px;" title="Esta habilidade é parte intrínseca do seu personagem e não pode ser removida.">
                                🔒 Fixa
                            </span>
                        ` : `
                            ${isEquippedSection ? `
                                <button type="button" class="btn btn-sm btn-unequip-card" data-card-key="${card.key}" style="color: #f87171; border-color: rgba(239, 68, 68, 0.4);" title="Desequipar este item e recalcular">
                                    ❌ Desequipar
                                </button>
                            ` : `
                                <button type="button" class="btn btn-sm btn-primary btn-equip-card" data-card-key="${card.key}" title="Equipar este item e aplicar bônus no motor C">
                                    ⚔️ Equipar
                                </button>
                            `}

                            <button type="button" class="btn btn-sm btn-remove-card" data-card-key="${card.key}" title="Excluir card da ficha" style="color: var(--color-text-dim);">
                                🗑️
                            </button>
                        `}
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Renderiza as linhas da tabela de perícias
     */
    renderSkillsTableRows(skillCards, isPlayMode = false) {
        const search = (this.skillFilter || '').toLowerCase().trim();
        const onlyTrained = this.skillFilterOnlyTrained;

        let filtered = skillCards;
        if (search) {
            filtered = filtered.filter(s => 
                s.name.toLowerCase().includes(search) || 
                s.key.toLowerCase().includes(search) ||
                (s.formula && s.formula.toLowerCase().includes(search))
            );
        }
        if (onlyTrained) {
            filtered = filtered.filter(s => s.trained);
        }

        if (filtered.length === 0) {
            return `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 20px; color: var(--color-text-dim);">
                        Nenhuma perícia encontrada para os filtros atuais.
                    </td>
                </tr>
            `;
        }

        return filtered.map(s => {
            const bonus = s.formula ? (s.formulaValue ?? s.effective) : s.effective;
            return `
                <tr class="skill-row ${s.trained ? 'skill-trained' : ''}" data-skill-key="${s.key}">
                    <td class="td-train">
                        ${isPlayMode ? `
                            ${s.trained ? '<span title="Treinada (+2)" style="color: #4ade80; font-size: 1.1rem;">⭐</span>' : '<span style="color: var(--color-text-dim);">—</span>'}
                        ` : `
                            <input type="checkbox" class="skill-trained-checkbox" data-skill-key="${s.key}" ${s.trained ? 'checked' : ''} title="Marcar/Desmarcar Treinada (+2 no motor C)">
                        `}
                    </td>
                    <td class="td-name">
                        <strong>${s.name}</strong>
                    </td>
                    <td class="td-attr">
                        <span class="skill-attr-tag">${s.formula || s.key.toUpperCase()}</span>
                    </td>
                    <td class="td-bonus">
                        <span class="skill-bonus-val ${bonus >= 0 ? 'bonus-pos' : 'bonus-neg'}">
                            ${this.formatMod(bonus)}
                        </span>
                    </td>
                    <td class="td-roll">
                        <button type="button" class="btn btn-roll-skill" data-skill-key="${s.key}" data-skill-name="${s.name}" data-skill-bonus="${bonus}" title="Rolar 1d20 + ${bonus}">
                            🎲 Rolar
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Renderiza a Galeria Visual de Personagens (Modo Roster)
     */
    renderRosterView() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="sheet-roster-view-container">
                <div class="systems-section-header" style="margin-bottom: var(--space-md);">
                    <div>
                        <h2 class="systems-section-title">📜 Personagens Salvos no Computador</h2>
                        <p class="systems-section-subtitle">Ficha Modular Vazia &bull; Selecione uma ficha salva para carregar e jogar, ou crie um novo herói:</p>
                    </div>
                </div>
                <div id="sheet-roster-mount-point"></div>
            </div>
        `;

        const mount = document.getElementById('sheet-roster-mount-point');
        if (mount && window.characterStorage) {
            window.characterStorage.renderRosterGallery(mount, this.engine, this.router, {
                onSelect: (sheet) => {
                    this.showingRoster = false;
                    this.render();
                },
                onNew: () => {
                    if (this.router && typeof this.router.navigate === 'function') {
                        this.router.navigate('creator');
                    }
                }
            });
        }
    }

    /**
     * Renderiza o estado vazio quando o deck não possui cards
     */
    renderEmptyDeckState(name, system, level, xp) {
        return `
            <div class="sheet-main-layout">
                <section class="card sheet-header-card">
                    <div class="sheet-header-top">
                        <div class="sheet-identity-group">
                            <label class="sheet-field-label">Nome do Personagem</label>
                            <input type="text" id="sheet-name-input" class="sheet-name-field" value="${name}" maxlength="30">
                        </div>
                        <div class="sheet-badges-group">
                            <span class="sheet-meta-pill race-pill">0 Cards</span>
                            <span class="sheet-meta-pill system-pill">📜 ${system}</span>
                        </div>
                    </div>
                </section>

                <div class="card" style="text-align: center; padding: 48px 24px; background: var(--color-surface-card);">
                    <div style="font-size: 3rem; margin-bottom: 12px;">🃏</div>
                    <h2 style="font-family: var(--font-heading); color: var(--color-gold-primary); margin-bottom: 8px;">
                        Ficha Modular Vazia
                    </h2>
                    <p style="color: var(--color-text-muted); max-width: 600px; margin: 0 auto 24px auto; line-height: 1.6;">
                        Esta ficha ainda não possui cards ativos na memória do motor C. Você pode carregar um kit inicial pronto com atributos d20, recursos e equipamentos, navegar pelo Compêndio ou criar seus próprios cards.
                    </p>
                    <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
                        <button type="button" id="btn-load-starter-empty" class="btn btn-primary" style="padding: 10px 20px; font-weight: 700;">
                            ✨ Carregar Kit Inicial Padrão
                        </button>
                        <button type="button" id="btn-load-srd-empty" class="btn btn-accent" style="padding: 10px 20px; font-weight: 700;">
                            📦 Data Packs (1 Clique)
                        </button>
                        <button type="button" id="btn-open-compendium-empty" class="btn" style="padding: 10px 20px;">
                            🗂️ Abrir Compêndio de Cards
                        </button>
                        <button type="button" id="btn-create-card-empty" class="btn" style="padding: 10px 20px;">
                            ➕ Criar Card Personalizado
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Configura ouvintes de cabeçalho
     */
    setupHeaderEventListeners() {
        // Alternador de Modos (In-Game vs Editar)
        const btnModePlay = document.getElementById('btn-mode-play');
        if (btnModePlay) {
            btnModePlay.addEventListener('click', () => this.setMode('play'));
        }

        const btnModeEdit = document.getElementById('btn-mode-edit');
        if (btnModeEdit) {
            btnModeEdit.addEventListener('click', () => this.setMode('edit'));
        }

        const btnQuickEdit = document.getElementById('btn-switch-to-edit-quick');
        if (btnQuickEdit) {
            btnQuickEdit.addEventListener('click', () => this.setMode('edit'));
        }

        const btnOpenDice = document.getElementById('btn-sheet-open-dice');
        if (btnOpenDice) {
            btnOpenDice.addEventListener('click', () => {
                if (window.diceRoller && typeof window.diceRoller.openDrawer === 'function') {
                    window.diceRoller.openDrawer();
                } else if (this.router && typeof this.router.navigate === 'function') {
                    this.router.navigate('dice');
                }
            });
        }

        // Voltar à Galeria de Personagens
        const btnBackRoster = document.getElementById('btn-sheet-back-to-roster');
        if (btnBackRoster) {
            btnBackRoster.addEventListener('click', () => {
                if (window.characterStorage && this.engine && this.engine.getCardCount() > 0) {
                    window.characterStorage.saveCurrent(this.engine, this.engine.getCharacterName());
                }
                this.showingRoster = true;
                this.render();
            });
        }

        // Nome
        const nameInput = document.getElementById('sheet-name-input');
        if (nameInput) {
            const updateName = () => {
                const newName = nameInput.value.trim();
                if (newName && newName !== this.engine.getCharacterName()) {
                    this.engine.setCharacterName(newName);
                    this.logger(`[C Memory] Nome atualizado para: "${newName}".`, 'info');
                }
            };
            nameInput.addEventListener('change', updateName);
            nameInput.addEventListener('blur', updateName);
        }

        // Nível
        const btnLvlUp = document.getElementById('btn-lvl-up');
        if (btnLvlUp) {
            btnLvlUp.addEventListener('click', () => {
                const cur = this.engine.getLevel();
                if (cur < 20) {
                    this.engine.setLevel(cur + 1);
                    this.logger(`[C Level Up] Nível alterado para ${cur + 1}.`, 'success');
                    this.render();
                }
            });
        }

        const btnLvlDown = document.getElementById('btn-lvl-down');
        if (btnLvlDown) {
            btnLvlDown.addEventListener('click', () => {
                const cur = this.engine.getLevel();
                if (cur > 1) {
                    this.engine.setLevel(cur - 1);
                    this.logger(`[C Level Down] Nível alterado para ${cur - 1}.`, 'info');
                    this.render();
                }
            });
        }

        // XP
        const xpInput = document.getElementById('sheet-xp-input');
        if (xpInput) {
            xpInput.addEventListener('change', (e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 0) {
                    this.engine.setXp(val);
                }
            });
        }

        // Salvar
        const btnSave = document.getElementById('btn-sheet-save');
        if (btnSave) {
            btnSave.addEventListener('click', () => {
                if (window.characterStorage) {
                    try {
                        const saved = window.characterStorage.saveCurrent(this.engine);
                        this.logger(`[Storage] Ficha "${saved.name}" salva com sucesso!`, 'success');
                        btnSave.textContent = '✅ Salvo!';
                        setTimeout(() => { btnSave.textContent = '💾 Salvar'; }, 2000);
                    } catch (err) {
                        this.logger(`[Storage Error] ${err.message}`, 'error');
                    }
                }
            });
        }

        // Exportar
        const btnExport = document.getElementById('btn-sheet-export-file');
        if (btnExport) {
            btnExport.addEventListener('click', () => {
                if (window.CharacterExportService) {
                    try {
                        const { filename } = window.CharacterExportService.exportToFile(this.engine);
                        this.logger(`[Export] Deck exportado para "${filename}".`, 'success');
                    } catch (err) {
                        this.logger(`[Export Error] ${err.message}`, 'error');
                    }
                } else {
                    const rawJson = this.engine.exportCardPack(true);
                    if (rawJson) {
                        const blob = new Blob([rawJson], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${this.engine.getCharacterName() || 'personagem'}.cardpack`;
                        if (typeof a.click === 'function') a.click();
                        URL.revokeObjectURL(url);
                        this.logger(`[Export] Deck exportado com sucesso.`, 'success');
                    }
                }
            });
        }

        // Importar
        const btnImport = document.getElementById('btn-sheet-import-file');
        if (btnImport) {
            btnImport.addEventListener('click', () => {
                if (window.CharacterExportService) {
                    window.CharacterExportService.promptImportFile(this.engine, window.characterStorage, (res) => {
                        if (res.success) {
                            this.logger(`[Import] Ficha importada com sucesso no motor C!`, 'success');
                            this.showingRoster = false;
                            this.render();
                        } else {
                            this.logger(`[Import Error] ${res.error}`, 'error');
                        }
                    });
                }
            });
        }

        // PDF / Imprimir
        const btnPdf = document.getElementById('btn-sheet-print-pdf');
        if (btnPdf) {
            btnPdf.addEventListener('click', () => {
                if (window.CharacterExportService) {
                    window.CharacterExportService.printSheet(this.router);
                } else if (typeof window.print === 'function') {
                    window.print();
                }
            });
        }

        // Minhas Fichas Modal
        const btnManage = document.getElementById('btn-sheet-manage-saved');
        if (btnManage) {
            btnManage.addEventListener('click', () => {
                if (window.characterManagerModal) {
                    window.characterManagerModal.open();
                }
            });
        }

        // Data Packs Comunitários
        const btnPacks = document.getElementById('btn-sheet-community-packs');
        if (btnPacks) {
            btnPacks.addEventListener('click', () => {
                if (window.packManager && typeof window.packManager.openPackModal === 'function') {
                    window.packManager.openPackModal(() => {
                        this.showingRoster = false;
                        this.render();
                    });
                } else if (typeof window.PackManager === 'function') {
                    const pm = new window.PackManager(this.engine, this.logger);
                    pm.openPackModal(() => {
                        this.showingRoster = false;
                        this.render();
                    });
                }
            });
        }

        // Navegação para Compêndio e Editor
        const btnCompendium = document.getElementById('btn-sheet-open-compendium');
        if (btnCompendium) {
            btnCompendium.addEventListener('click', () => {
                if (this.router && typeof this.router.navigate === 'function') {
                    this.router.navigate('compendium');
                }
            });
        }

        const btnCreateCard = document.getElementById('btn-sheet-create-card');
        if (btnCreateCard) {
            btnCreateCard.addEventListener('click', () => {
                if (this.router && typeof this.router.navigate === 'function') {
                    this.router.navigate('editor');
                }
            });
        }
    }

    /**
     * Ouvintes do estado vazio
     */
    setupEmptyStateEventListeners() {
        const btnLoad = document.getElementById('btn-load-starter-empty');
        if (btnLoad) {
            btnLoad.addEventListener('click', () => {
                this.loadStarterDeck();
            });
        }

        const btnSrd = document.getElementById('btn-load-srd-empty');
        if (btnSrd) {
            btnSrd.addEventListener('click', () => {
                if (window.packManager && typeof window.packManager.openPackModal === 'function') {
                    window.packManager.openPackModal(() => {
                        this.showingRoster = false;
                        this.render();
                    });
                } else if (typeof window.PackManager === 'function') {
                    const pm = new window.PackManager(this.engine, this.logger);
                    pm.openPackModal(() => {
                        this.showingRoster = false;
                        this.render();
                    });
                }
            });
        }

        const btnComp = document.getElementById('btn-open-compendium-empty');
        if (btnComp) {
            btnComp.addEventListener('click', () => {
                if (this.router && typeof this.router.navigate === 'function') {
                    this.router.navigate('compendium');
                }
            });
        }

        const btnCreate = document.getElementById('btn-create-card-empty');
        if (btnCreate) {
            btnCreate.addEventListener('click', () => {
                if (this.router && typeof this.router.navigate === 'function') {
                    this.router.navigate('editor');
                }
            });
        }
    }

    /**
     * Configura todos os eventos de cards e controles da ficha
     */
    setupEventListeners() {
        if (!this.container) return;

        // 1. Recursos Dinâmicos (Edição direta e botões rápidos)
        this.container.querySelectorAll('.res-cur-input').forEach(inp => {
            inp.addEventListener('change', (e) => {
                const key = inp.dataset.resKey;
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && key) {
                    this.engine.setCurrentValue(key, val);
                    this.render();
                }
            });
        });

        this.container.querySelectorAll('.btn-res-delta').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.resKey;
                const delta = parseInt(btn.dataset.delta, 10);
                if (key && !isNaN(delta)) {
                    this.engine.modifyCurrentValue(key, delta);
                    this.logger(`[C Recurso] ${key.toUpperCase()}: ${this.formatMod(delta)}. Atual: ${this.engine.getCurrentValue(key)}/${this.engine.getMaxValue(key)}`);
                    this.render();
                }
            });
        });

        this.container.querySelectorAll('.btn-res-full').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.resKey;
                const max = parseInt(btn.dataset.max, 10);
                if (key && !isNaN(max)) {
                    this.engine.setCurrentValue(key, max);
                    this.logger(`[C Recurso] ${key.toUpperCase()} totalmente recuperado (${max})!`, 'success');
                    this.render();
                }
            });
        });

        // 2. Atributos Básicos (Steppers [-] [+], Input direto, Clique no mod para rolar)
        this.container.querySelectorAll('.btn-attr-minus').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.attrKey;
                const card = this.engine.getCardByKey(key);
                if (card && card.base > 1) {
                    this.engine.setBaseValue(key, card.base - 1);
                    this.logger(`[C Atributo] ${key.toUpperCase()} alterado para ${card.base - 1}. Recalculando...`);
                    this.render();
                }
            });
        });

        this.container.querySelectorAll('.btn-attr-plus').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.attrKey;
                const card = this.engine.getCardByKey(key);
                if (card && card.base < 40) {
                    this.engine.setBaseValue(key, card.base + 1);
                    this.logger(`[C Atributo] ${key.toUpperCase()} alterado para ${card.base + 1}. Recalculando...`);
                    this.render();
                }
            });
        });

        this.container.querySelectorAll('.sheet-attr-val-input').forEach(inp => {
            inp.addEventListener('change', (e) => {
                const key = inp.dataset.attrKey;
                let val = parseInt(e.target.value, 10);
                if (isNaN(val)) val = 10;
                if (val < 1) val = 1;
                if (val > 40) val = 40;
                if (key) {
                    this.engine.setBaseValue(key, val);
                    this.logger(`[C Atributo] ${key.toUpperCase()} alterado para ${val}. Recalculando...`);
                    this.render();
                }
            });
        });

        this.container.querySelectorAll('.sheet-attr-mod').forEach(modEl => {
            modEl.addEventListener('click', () => {
                const attrName = modEl.dataset.attrName || 'Atributo';
                const mod = parseInt(modEl.dataset.attrMod, 10) || 0;
                if (window.diceRoller) {
                    window.diceRoller.roll(1, 20, mod, `Teste de Atributo: ${attrName}`);
                    window.diceRoller.openDrawer();
                } else {
                    const res = this.engine.rollDice(1, 20, mod);
                    let tag = res.isCritical ? ' ⭐ CRÍTICO!' : (res.isFumble ? ' 💀 FALHA CRÍTICA!' : '');
                    this.logger(`[C Roll] Teste de ${attrName}: 1d20 (${res.rolls[0]}) ${this.formatMod(mod)} = ${res.total}${tag}`, res.isCritical ? 'success' : (res.isFumble ? 'warn' : 'info'));
                }
            });
        });

        // 3. Equipar e Desequipar Cards (Equipamentos e Magias/Habilidades)
        this.container.querySelectorAll('.btn-equip-card').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.cardKey;
                if (key) {
                    this.engine.setEquipped(key, true);
                    this.logger(`[C Deck] Card "${key}" equipado! Modificadores aplicados no motor C.`, 'success');
                    this.render();
                }
            });
        });

        this.container.querySelectorAll('.btn-unequip-card').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.cardKey;
                if (key) {
                    this.engine.setEquipped(key, false);
                    this.logger(`[C Deck] Card "${key}" desequipado! Modificadores removidos no motor C.`, 'info');
                    this.render();
                }
            });
        });

        this.container.querySelectorAll('.btn-remove-card').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.cardKey;
                if (key) {
                    const card = this.engine.getCardByKey(key);
                    const pack = this.getActiveCardPack();
                    const packCard = pack?.cards?.find(pk => pk.key === key);
                    if (card?.is_mandatory || packCard?.is_mandatory) {
                        alert(`A habilidade "${card?.name || key}" é obrigatória da sua classe/raça e não pode ser removida.`);
                        return;
                    }
                    if (typeof confirm === 'function' && !confirm(`Deseja remover o card "${key}" da ficha?`)) {
                        return;
                    }
                    this.engine.removeCardByKey(key);
                    this.logger(`[C Deck] Card "${key}" excluído da ficha.`, 'info');
                    this.render();
                }
            });
        });

        // 3.1. Abas do Modo Editar (Configuradas pelo CardPack)
        this.container.querySelectorAll('.btn-editor-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.editorTab;
                if (tabId && this.activeEditorTab !== tabId) {
                    this.activeEditorTab = tabId;
                    this.render();
                }
            });
        });

        // 3.2. Abertura do Modal de Habilidades / Categorias na Aba Habilidades
        this.container.querySelectorAll('.btn-add-ability-category').forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.dataset.category;
                this.openCardPicker('abilities', category);
            });
        });

        const btnOpenAbilitiesAll = this.container.querySelector('#btn-open-abilities-picker-all');
        if (btnOpenAbilitiesAll) {
            btnOpenAbilitiesAll.addEventListener('click', () => {
                this.openCardPicker('abilities');
            });
        }

        // 4. Rolar / Ativar Card
        this.container.querySelectorAll('.btn-roll-card').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.cardKey;
                const card = this.engine.getCardByKey(key);
                if (card && card.formula) {
                    // Se tiver custo em recurso, debita
                    if (card.costResource && card.costValue > 0) {
                        const curRes = this.engine.getCurrentValue(card.costResource);
                        if (curRes < card.costValue) {
                            this.logger(`[C Custo] ${card.costResource.toUpperCase()} insuficiente (${curRes}/${card.costValue}) para usar ${card.name}!`, 'warn');
                            return;
                        }
                        this.engine.modifyCurrentValue(card.costResource, -card.costValue);
                    }

                    if (window.diceRoller && typeof window.diceRoller.openRollModal === 'function') {
                        window.diceRoller.openRollModal({
                            title: card.name,
                            formula: card.formula,
                            modifier: 0
                        });
                    } else {
                        const val = this.engine.evalExpression(card.formula);
                        this.logger(`[C Formula] ${card.name}: "${card.formula}" = ${val}`, 'info');
                    }
                    this.render();
                }
            });
        });

        // 5. Perícias (Treino e Rolagem)
        this.container.querySelectorAll('.skill-trained-checkbox').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const key = chk.dataset.skillKey;
                const trained = e.target.checked;
                if (key) {
                    this.engine.setTrained(key, trained);
                    this.logger(`[C Perícia] "${key}" marcada como ${trained ? 'Treinada (+2)' : 'Não Treinada'}.`, 'info');
                    this.render();
                }
            });
        });

        this.container.querySelectorAll('.btn-roll-skill').forEach(btn => {
            btn.addEventListener('click', () => {
                const skillName = btn.dataset.skillName || 'Perícia';
                const bonus = parseInt(btn.dataset.skillBonus, 10) || 0;
                if (window.diceRoller) {
                    window.diceRoller.roll(1, 20, bonus, `Perícia: ${skillName}`);
                    window.diceRoller.openDrawer();
                } else {
                    const res = this.engine.rollDice(1, 20, bonus);
                    let tag = res.isCritical ? ' ⭐ CRÍTICO!' : (res.isFumble ? ' 💀 FALHA CRÍTICA!' : '');
                    this.logger(`[C Roll] Perícia ${skillName}: 1d20 (${res.rolls[0]}) ${this.formatMod(bonus)} = ${res.total}${tag}`, res.isCritical ? 'success' : (res.isFumble ? 'warn' : 'info'));
                }
            });
        });

        // Filtros de Perícias
        const isPlayMode = this.sheetMode === 'play';
        const searchInput = document.getElementById('skills-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.skillFilter = e.target.value;
                const tbody = document.getElementById('skills-table-body');
                if (tbody) {
                    const CARD_TYPES = (typeof window !== 'undefined' && window.CARD_TYPES) ? window.CARD_TYPES : { SKILL: 3 };
                    const skills = this.engine.getAllCards(c => c.type === CARD_TYPES.SKILL);
                    tbody.innerHTML = this.renderSkillsTableRows(skills, isPlayMode);
                    this.setupSkillTableEvents(tbody);
                }
            });
        }

        const trainedCheck = document.getElementById('skills-only-trained');
        if (trainedCheck) {
            trainedCheck.addEventListener('change', (e) => {
                this.skillFilterOnlyTrained = e.target.checked;
                const tbody = document.getElementById('skills-table-body');
                if (tbody) {
                    const CARD_TYPES = (typeof window !== 'undefined' && window.CARD_TYPES) ? window.CARD_TYPES : { SKILL: 3 };
                    const skills = this.engine.getAllCards(c => c.type === CARD_TYPES.SKILL);
                    tbody.innerHTML = this.renderSkillsTableRows(skills, isPlayMode);
                    this.setupSkillTableEvents(tbody);
                }
            });
        }

        // Dados Rápidos no Modo In-Game
        this.container.querySelectorAll('.btn-quick-dice').forEach(btn => {
            btn.addEventListener('click', () => {
                const sides = parseInt(btn.dataset.d, 10) || 6;
                if (window.diceRoller) {
                    window.diceRoller.roll(1, sides, 0, `Rolagem Rápida: 1d${sides}`);
                    window.diceRoller.openDrawer();
                } else {
                    const res = this.engine.rollDice(1, sides, 0);
                    this.logger(`[C Dice Engine] Rolagem 1d${sides}: Resultado = ${res.total}`, 'info');
                }
            });
        });

        // 6. Testes Rápidos e Kit Inicial
        const btnTestD20 = document.getElementById('btn-test-d20');
        if (btnTestD20) {
            btnTestD20.addEventListener('click', () => {
                const res = this.engine.rollDice(1, 20, 0);
                let tag = res.isCritical ? ' (CRÍTICO!)' : (res.isFumble ? ' (FALHA CRÍTICA!)' : '');
                this.logger(`[C Dice Engine] Rolagem 1d20: Resultado = ${res.total}${tag}`, res.isCritical ? 'success' : (res.isFumble ? 'warn' : 'info'));
            });
        }

        const btnTestComplex = document.getElementById('btn-test-complex');
        if (btnTestComplex) {
            btnTestComplex.addEventListener('click', () => {
                const res = this.engine.rollDice(3, 6, 5);
                this.logger(`[C Dice Engine] Rolagem 3d6+5: Dados [${res.rolls.join(', ')}] + 5 = ${res.total}`, 'info');
            });
        }

        const btnDumpJson = document.getElementById('btn-dump-json');
        if (btnDumpJson) {
            btnDumpJson.addEventListener('click', () => {
                const pack = this.engine.exportCardPack(false);
                this.logger(`[C Serializer] Pacote de Cards exportado:\n${JSON.stringify(pack, null, 2)}`, 'info');
            });
        }

        const btnReloadStarter = document.getElementById('btn-reload-starter');
        if (btnReloadStarter) {
            btnReloadStarter.addEventListener('click', () => {
                if (typeof confirm === 'function' && !confirm('Deseja recarregar o Kit Inicial padrão? Os cards atuais serão mesclados/atualizados.')) {
                    return;
                }
                this.loadStarterDeck();
            });
        }

        const btnOpenCompEquip = this.container.querySelector('.btn-open-compendium-equip');
        if (btnOpenCompEquip) {
            btnOpenCompEquip.addEventListener('click', () => {
                if (this.router && typeof this.router.navigate === 'function') {
                    this.router.navigate('compendium');
                }
            });
        }

        // Ouvintes do Modal de Busca e Adição de Cards à Ficha (Mochila / Grimório)
        const btnAddItem = document.getElementById('btn-add-item-modal');
        if (btnAddItem) {
            btnAddItem.addEventListener('click', () => this.openCardPicker('equipment'));
        }
        this.container.querySelectorAll('.btn-trigger-add-item').forEach(btn => {
            btn.addEventListener('click', () => this.openCardPicker('equipment'));
        });

        const btnAddSpell = document.getElementById('btn-add-spell-modal');
        if (btnAddSpell) {
            btnAddSpell.addEventListener('click', () => this.openCardPicker('spells'));
        }
        this.container.querySelectorAll('.btn-trigger-add-spell').forEach(btn => {
            btn.addEventListener('click', () => this.openCardPicker('spells'));
        });

        this.setupCardPickerListeners();
    }

    /**
     * Reconecta ouvintes das linhas da tabela de perícias após filtro dinâmico
     */
    setupSkillTableEvents(tbody) {
        tbody.querySelectorAll('.skill-trained-checkbox').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const key = chk.dataset.skillKey;
                const trained = e.target.checked;
                if (key) {
                    this.engine.setTrained(key, trained);
                    this.render();
                }
            });
        });

        tbody.querySelectorAll('.btn-roll-skill').forEach(btn => {
            btn.addEventListener('click', () => {
                const skillName = btn.dataset.skillName || 'Perícia';
                const bonus = parseInt(btn.dataset.skillBonus, 10) || 0;
                if (window.diceRoller) {
                    window.diceRoller.roll(1, 20, bonus, `Perícia: ${skillName}`);
                    window.diceRoller.openDrawer();
                } else {
                    const res = this.engine.rollDice(1, 20, bonus);
                    let tag = res.isCritical ? ' ⭐ CRÍTICO!' : (res.isFumble ? ' 💀 FALHA CRÍTICA!' : '');
                    this.logger(`[C Roll] Perícia ${skillName}: 1d20 (${res.rolls[0]}) ${this.formatMod(bonus)} = ${res.total}${tag}`, res.isCritical ? 'success' : (res.isFumble ? 'warn' : 'info'));
                }
            });
        });
    }

    /**
     * Carrega um kit inicial clássico de RPG (Guerreiro d20)
     */
    loadStarterDeck() {
        const CARD_TYPES = (typeof window !== 'undefined' && window.CARD_TYPES) ? window.CARD_TYPES : {
            ATTRIBUTE: 0, RESOURCE: 1, STAT: 2, SKILL: 3, ABILITY: 4, EQUIPMENT: 5, SPELL: 6, TRAIT: 7
        };

        const charName = this.engine.getCharacterName() || 'Herói';
        const sysName = this.engine.getSystemName() || 'Agnóstico v2.0';

        this.engine.initDeck(charName, sysName);

        // 6 Atributos d20
        this.engine.addSimpleCard('for', 'Força', CARD_TYPES.ATTRIBUTE, 16);
        this.engine.addSimpleCard('des', 'Destreza', CARD_TYPES.ATTRIBUTE, 14);
        this.engine.addSimpleCard('con', 'Constituição', CARD_TYPES.ATTRIBUTE, 14);
        this.engine.addSimpleCard('int', 'Inteligência', CARD_TYPES.ATTRIBUTE, 10);
        this.engine.addSimpleCard('sab', 'Sabedoria', CARD_TYPES.ATTRIBUTE, 12);
        this.engine.addSimpleCard('car', 'Carisma', CARD_TYPES.ATTRIBUTE, 8);

        // Recursos Dinâmicos
        this.engine.addCard({
            key: 'pv',
            name: 'Pontos de Vida',
            type: CARD_TYPES.RESOURCE,
            base: 24,
            current: 24,
            max: 24,
            desc: 'Vitalidade e vigor físico antes de cair inconsciente.'
        });

        this.engine.addCard({
            key: 'pm',
            name: 'Pontos de Mana',
            type: CARD_TYPES.RESOURCE,
            base: 6,
            current: 6,
            max: 6,
            desc: 'Energia mágica e fôlego para habilidades especiais.'
        });

        // Estatística Derivada (Defesa)
        this.engine.addCard({
            key: 'defesa',
            name: 'Defesa',
            type: CARD_TYPES.STAT,
            base: 10,
            desc: 'Dificuldade para acertar ataques contra você.',
            formula: '10 + (@des - 10) / 2'
        });

        // Equipamento Inicial Equipado (Armadura Batida +3 Defesa)
        this.engine.addCard({
            key: 'armadura_couro',
            name: 'Armadura Batida',
            type: CARD_TYPES.EQUIPMENT,
            desc: 'Couro reforçado com cravos de metal (+3 Defesa).',
            equipped: true,
            modifiers: [{ target_key: 'defesa', value: 3 }]
        });

        // Arma Principal
        this.engine.addCard({
            key: 'espada_longa',
            name: 'Espada Longa',
            type: CARD_TYPES.EQUIPMENT,
            desc: 'Lâmina afiada forjada em aço comum.',
            equipped: true,
            formula: '1d8 + (@for - 10) / 2'
        });

        // Equipamento Reserva na Mochila (Escudo Pesado +2 Defesa)
        this.engine.addCard({
            key: 'escudo_pesado',
            name: 'Escudo Pesado',
            type: CARD_TYPES.EQUIPMENT,
            desc: 'Escudo de madeira reforçado (+2 Defesa quando equipado).',
            equipped: false,
            modifiers: [{ target_key: 'defesa', value: 2 }]
        });

        // Magia / Habilidade que concede bônus de Defesa quando ativa
        this.engine.addCard({
            key: 'escudo_da_fe',
            name: 'Escudo da Fé',
            type: CARD_TYPES.SPELL,
            desc: 'Campo de energia protetora divina que concede +2 na Defesa.',
            cost_resource: 'pm',
            cost_value: 1,
            equipped: false,
            modifiers: [{ target_key: 'defesa', value: 2 }]
        });

        // Habilidade de Ataque
        this.engine.addCard({
            key: 'golpe_poderoso',
            name: 'Golpe Poderoso',
            type: CARD_TYPES.ABILITY,
            desc: 'Golpe devastador que consome fôlego para causar impacto massivo.',
            cost_resource: 'pm',
            cost_value: 1,
            formula: '2d8 + 4'
        });

        // Perícias
        this.engine.addCard({
            key: 'atletismo',
            name: 'Atletismo',
            type: CARD_TYPES.SKILL,
            desc: 'Saltar, correr, escalar e nadar.',
            formula: '(@for - 10) / 2',
            trained: true
        });

        this.engine.addCard({
            key: 'luta',
            name: 'Luta',
            type: CARD_TYPES.SKILL,
            desc: 'Ataques corpo a corpo desarmados e com armas brancas.',
            formula: '(@for - 10) / 2',
            trained: true
        });

        this.engine.addCard({
            key: 'iniciativa',
            name: 'Iniciativa',
            type: CARD_TYPES.SKILL,
            desc: 'Rapidez de reação no início de combates.',
            formula: '(@des - 10) / 2',
            trained: false
        });

        this.engine.addCard({
            key: 'percepcao',
            name: 'Percepção',
            type: CARD_TYPES.SKILL,
            desc: 'Notar perigos, emboscadas e pistas.',
            formula: '(@sab - 10) / 2',
            trained: false
        });

        this.engine.recalculate();
        this.logger('[C Deck] Kit Inicial carregado com sucesso na memória C!', 'success');
        this.showingRoster = false;
        this.render();
    }

    /* =========================================================================
     * Modal de Busca e Adição de Cards à Ficha (Mochila / Grimório) - Passo 11.2
     * ========================================================================= */

    renderCardPickerModal() {
        return `
            <div id="modal-sheet-add-card-overlay" class="sheet-card-picker-overlay" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px); z-index: 9999; align-items: center; justify-content: center; padding: 16px;">
                <div class="card sheet-card-picker-modal" style="max-width: 760px; width: 100%; max-height: 85vh; display: flex; flex-direction: column; background: var(--color-surface-card); border: 1px solid var(--color-border-subtle); box-shadow: var(--shadow-lg); border-radius: var(--radius-lg); overflow: hidden;">
                    <!-- Modal Header -->
                    <div class="sheet-picker-header" style="padding: 16px 20px; border-bottom: 1px solid var(--color-border-subtle); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2);">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span id="sheet-picker-icon" style="font-size: 1.4rem;">🎒</span>
                            <div>
                                <h3 id="sheet-picker-title" style="margin: 0; font-family: var(--font-heading); color: var(--color-gold-primary); font-size: 1.15rem;">
                                    Adicionar Equipamento / Item à Mochila
                                </h3>
                                <p id="sheet-picker-subtitle" style="margin: 2px 0 0 0; font-size: 0.78rem; color: var(--color-text-muted);">
                                    Selecione cards do compêndio para adicionar à sua posse e equipar quando quiser.
                                </p>
                            </div>
                        </div>
                        <button type="button" id="btn-close-sheet-picker" class="btn btn-sm" style="font-size: 1.1rem; padding: 4px 10px;" title="Fechar">✕</button>
                    </div>

                    <!-- Toolbar: Busca e Filtros -->
                    <div class="sheet-picker-toolbar" style="padding: 12px 20px; background: rgba(0,0,0,0.15); border-bottom: 1px solid var(--color-border-subtle); display: flex; flex-direction: column; gap: 10px;">
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <input type="text" id="input-sheet-picker-search" class="search-input" placeholder="🔍 Digite para buscar por nome, bônus ou fórmula..." style="flex: 1; padding: 8px 14px; font-size: 0.88rem;">
                            <select id="select-sheet-picker-source" class="filter-select" style="max-width: 220px; font-size: 0.82rem; padding: 8px 12px;">
                                <option value="all">📦 Todos os CardPacks</option>
                            </select>
                        </div>
                        <div id="sheet-picker-category-filters" style="display: flex; gap: 6px; flex-wrap: wrap;">
                            <!-- Categorias dinâmicas -->
                        </div>
                    </div>

                    <!-- Lista de Cards Disponíveis -->
                    <div id="sheet-picker-results-container" style="flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 8px;">
                        <div style="text-align: center; color: var(--color-text-dim); padding: 30px;">
                            Carregando compêndio...
                        </div>
                    </div>

                    <!-- Modal Footer -->
                    <div class="sheet-picker-footer" style="padding: 12px 20px; border-top: 1px solid var(--color-border-subtle); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2);">
                        <span id="sheet-picker-count-label" style="font-size: 0.8rem; color: var(--color-text-muted);">
                            0 cards encontrados
                        </span>
                        <button type="button" id="btn-done-sheet-picker" class="btn btn-primary btn-sm" style="padding: 6px 18px; font-weight: 700;">
                            Concluir
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    openCardPicker(targetMode = 'equipment', categoryFilter = null) {
        this.pickerTargetMode = targetMode;
        this.pickerSearchQuery = '';
        this.pickerCategoryFilter = categoryFilter || null;

        const overlay = document.getElementById('modal-sheet-add-card-overlay');
        if (!overlay) return;

        overlay.style.display = 'flex';

        // Atualiza textos do cabeçalho
        const iconEl = document.getElementById('sheet-picker-icon');
        const titleEl = document.getElementById('sheet-picker-title');
        const subtitleEl = document.getElementById('sheet-picker-subtitle');

        if (targetMode === 'abilities') {
            if (iconEl) iconEl.textContent = '⚡';
            if (titleEl) titleEl.textContent = 'Escolher Habilidade / Poder da Ficha';
            if (subtitleEl) subtitleEl.textContent = 'Escolha habilidades de classe, traços de raça, poderes de origem ou bênçãos divinas.';
        } else if (targetMode === 'equipment') {
            if (iconEl) iconEl.textContent = '🎒';
            if (titleEl) titleEl.textContent = 'Adicionar Equipamento / Item à Mochila';
            if (subtitleEl) subtitleEl.textContent = 'Escolha armas, armaduras, escudos e itens do seu CardPack para guardar ou equipar.';
        } else {
            if (iconEl) iconEl.textContent = '✨';
            if (titleEl) titleEl.textContent = 'Adicionar Magia ou Poder ao Grimório';
            if (subtitleEl) subtitleEl.textContent = 'Escolha magias arcanas, divinas ou habilidades para incorporar ao seu grimório.';
        }

        // Popula select de CardPacks
        this.populatePickerSources();

        // Popula botões de filtros rápidos de categoria
        this.renderPickerCategoryFilters();

        // Atualiza lista de cards
        this.updateCardPickerResults();

        // Foca no input de busca
        const searchInput = document.getElementById('input-sheet-picker-search');
        if (searchInput) {
            searchInput.value = '';
            if (typeof searchInput.focus === 'function') {
                searchInput.focus();
            }
        }
    }

    closeCardPicker() {
        const overlay = document.getElementById('modal-sheet-add-card-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
        this.render();
    }

    populatePickerSources() {
        const select = document.getElementById('select-sheet-picker-source');
        if (!select) return;

        let packs = [];
        if (window.compendiumView && typeof window.compendiumView.getInstalledPacks === 'function') {
            packs = window.compendiumView.getInstalledPacks();
        } else if (typeof localStorage !== 'undefined') {
            try {
                const raw = localStorage.getItem('compendium_packs_v2');
                if (raw) packs = JSON.parse(raw);
            } catch (e) {}
        }

        select.innerHTML = `<option value="all">📦 Todos os CardPacks (${packs.length || 1})</option>`;
        packs.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `📜 ${p.name} (${p.cards ? p.cards.length : 0})`;
            if (this.pickerSelectedPackId === p.id) opt.selected = true;
            select.appendChild(opt);
        });
    }

    renderPickerCategoryFilters() {
        const container = document.getElementById('sheet-picker-category-filters');
        if (!container) return;

        let categories = [];
        if (this.pickerTargetMode === 'abilities') {
            categories = [
                { id: null, label: 'Todas as Habilidades' },
                { id: 'class_ability', label: '⚔️ Habilidades de Classe' },
                { id: 'race_trait', label: '🧬 Traços de Raça' },
                { id: 'origin_power', label: '📜 Poderes de Origem' },
                { id: 'deity_power', label: '🕊️ Poderes Concedidos' }
            ];
        } else if (this.pickerTargetMode === 'equipment') {
            categories = [
                { id: null, label: 'Todos os Itens' },
                { id: 'weapons', label: '⚔️ Armas & Ataques' },
                { id: 'armors', label: '🛡️ Armaduras & Escudos' },
                { id: 'items', label: '🧪 Itens & Consumíveis' }
            ];
        } else {
            categories = [
                { id: null, label: 'Todos os Poderes' },
                { id: 6, label: '✨ Magias' },
                { id: 4, label: '⚡ Habilidades & Ações' },
                { id: 7, label: '🌟 Talentos & Passivas' }
            ];
        }

        container.innerHTML = categories.map(cat => {
            const isActive = this.pickerCategoryFilter === cat.id;
            return `
                <button type="button" class="sheet-picker-category-pill ${isActive ? 'active' : ''}" data-cat-id="${cat.id === null ? '' : cat.id}">
                    ${cat.label}
                </button>
            `;
        }).join('');

        container.querySelectorAll('.sheet-picker-category-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const catId = btn.dataset.catId;
                this.pickerCategoryFilter = catId === '' ? null : (isNaN(Number(catId)) ? catId : Number(catId));
                this.renderPickerCategoryFilters();
                this.updateCardPickerResults();
            });
        });
    }

    getAvailableCompendiumCards() {
        let packs = [];
        if (window.compendiumView && typeof window.compendiumView.getInstalledPacks === 'function') {
            packs = window.compendiumView.getInstalledPacks();
        } else if (typeof localStorage !== 'undefined') {
            try {
                const raw = localStorage.getItem('compendium_packs_v2');
                if (raw) packs = JSON.parse(raw);
            } catch (e) {}
        }

        let allCards = [];
        if (packs && packs.length > 0) {
            if (this.pickerSelectedPackId && this.pickerSelectedPackId !== 'all') {
                const p = packs.find(pk => pk.id === this.pickerSelectedPackId);
                if (p && Array.isArray(p.cards)) {
                    allCards = [...p.cards];
                }
            } else {
                packs.forEach(p => {
                    if (Array.isArray(p.cards)) {
                        allCards.push(...p.cards);
                    }
                });
            }
        }

        // Se a lista estiver vazia (nenhum cardpack salvo no compêndio ainda), usa os cards do catálogo padrão
        if (allCards.length === 0) {
            allCards = this.getDefaultFallbackCards();
        }

        // Deduplica cards pela chave
        const seen = new Set();
        return allCards.filter(c => {
            if (!c || !c.key) return false;
            if (seen.has(c.key)) return false;
            seen.add(c.key);
            return true;
        });
    }

    getDefaultFallbackCards() {
        const CARD_TYPES = (typeof window !== 'undefined' && window.CARD_TYPES) ? window.CARD_TYPES : {
            ATTRIBUTE: 0, RESOURCE: 1, STAT: 2, SKILL: 3, ABILITY: 4, EQUIPMENT: 5, SPELL: 6, TRAIT: 7
        };
        return [
            // Armas & Equipamentos
            { key: 'espada_longa', name: 'Espada Longa', type: CARD_TYPES.EQUIPMENT, desc: 'Lâmina versátil e equilibrada de aço forjado.', formula: '1d8 + (@for - 10) / 2' },
            { key: 'machado_batalha', name: 'Machado de Batalha', type: CARD_TYPES.EQUIPMENT, desc: 'Arma pesada de corte com grande poder de impacto.', formula: '1d10 + (@for - 10) / 2' },
            { key: 'adaga_furtiva', name: 'Adaga Furtiva', type: CARD_TYPES.EQUIPMENT, desc: 'Lâmina leve perfeita para ataques precisos e furtivos.', formula: '1d4 + (@des - 10) / 2' },
            { key: 'arco_longo', name: 'Arco Longo', type: CARD_TYPES.EQUIPMENT, desc: 'Arma de disparo à distância com excelente alcance.', formula: '1d8 + (@des - 10) / 2' },
            { key: 'armadura_couro', name: 'Armadura de Couro', type: CARD_TYPES.EQUIPMENT, desc: 'Proteção flexível feita de couro curtido (+3 Defesa).', modifiers: [{ target_key: 'defesa', value: 3 }] },
            { key: 'cota_malha', name: 'Cota de Malha Élfica', type: CARD_TYPES.EQUIPMENT, desc: 'Armadura articulada de anéis metálicos (+6 Defesa).', modifiers: [{ target_key: 'defesa', value: 6 }] },
            { key: 'escudo_pesado', name: 'Escudo Pesado', type: CARD_TYPES.EQUIPMENT, desc: 'Grande escudo reforçado com aço (+2 Defesa).', modifiers: [{ target_key: 'defesa', value: 2 }] },
            { key: 'pocao_cura', name: 'Poção de Cura Menor', type: CARD_TYPES.EQUIPMENT, desc: 'Elixir revitalizante que restaura vida instantaneamente.', formula: '2d4 + 2' },
            // Magias & Habilidades
            { key: 'bola_fogo', name: 'Bola de Fogo Arcana', type: CARD_TYPES.SPELL, desc: 'Explosão incandescente que consome mana e queima inimigos.', cost_resource: 'pm', cost_value: 3, formula: '(@int - 10) / 2 + 20' },
            { key: 'escudo_da_fe', name: 'Escudo da Fé', type: CARD_TYPES.SPELL, desc: 'Barreira divina de força mágica que concede +2 na Defesa.', cost_resource: 'pm', cost_value: 1, modifiers: [{ target_key: 'defesa', value: 2 }] },
            { key: 'curar_ferimentos', name: 'Curar Ferimentos', type: CARD_TYPES.SPELL, desc: 'Canalização de energia positiva restaurando PV de aliados.', cost_resource: 'pm', cost_value: 1, formula: '2d8 + 2' },
            { key: 'furia_barbara', name: 'Fúria Bárbara', type: CARD_TYPES.ABILITY, desc: 'Ira primal que aumenta a Força do combatente (+4 FOR).', cost_resource: 'pm', cost_value: 2, modifiers: [{ target_key: 'for', value: 4 }] },
            { key: 'ataque_poderoso', name: 'Ataque Poderoso', type: CARD_TYPES.ABILITY, desc: 'Investida com peso corporal sacrificando precisão por dano massivo.', cost_resource: 'pm', cost_value: 1, formula: '2d8 + 4' },
            { key: 'inspirar_coragem', name: 'Inspirar Coragem', type: CARD_TYPES.ABILITY, desc: 'Palavras de alento e canções heroicas elevando a moral.', cost_resource: 'pm', cost_value: 1 }
        ];
    }

    getAvailablePickerCards() {
        const CARD_TYPES = (typeof window !== 'undefined' && window.CARD_TYPES) ? window.CARD_TYPES : {
            ATTRIBUTE: 0, RESOURCE: 1, STAT: 2, SKILL: 3, ABILITY: 4, EQUIPMENT: 5, SPELL: 6, TRAIT: 7
        };

        const allCards = this.getAvailableCompendiumCards();
        const search = (this.pickerSearchQuery || '').toLowerCase().trim();

        return allCards.filter(card => {
            if (!card || !card.name) return false;

            // Filtro por Target Mode (abilities vs equipment vs spells)
            if (this.pickerTargetMode === 'abilities') {
                const hasAbilityCategory = card.category && ['class_ability', 'race_trait', 'origin_power', 'deity_power'].includes(card.category);
                const isAbilityType = card.type === CARD_TYPES.ABILITY || card.type === CARD_TYPES.TRAIT;
                const isNotOther = card.type !== CARD_TYPES.ATTRIBUTE && card.type !== CARD_TYPES.RESOURCE && 
                                   card.type !== CARD_TYPES.STAT && card.type !== CARD_TYPES.SKILL && 
                                   card.type !== CARD_TYPES.EQUIPMENT;

                if (!((hasAbilityCategory || isAbilityType) && isNotOther)) return false;

                if (this.pickerCategoryFilter) {
                    const cat = card.category || (card.type === CARD_TYPES.TRAIT ? 'race_trait' : 'class_ability');
                    if (cat !== this.pickerCategoryFilter) return false;
                }
            } else if (this.pickerTargetMode === 'equipment') {
                if (card.type !== CARD_TYPES.EQUIPMENT) return false;
                if (this.pickerCategoryFilter === 'weapons') {
                    const isWeapon = card.formula || (card.name && /espada|machado|adaga|arco|martelo|lança|adaga|clava|katana|pistola|mosquete/i.test(card.name));
                    if (!isWeapon) return false;
                } else if (this.pickerCategoryFilter === 'armors') {
                    const hasDef = (card.modifiers || card.mods || []).some(m => (m.target_key || m.target) === 'defesa') || /escudo|couro|malha|armadura|brunea|placas/i.test(card.name);
                    if (!hasDef) return false;
                } else if (this.pickerCategoryFilter === 'items') {
                    const isOther = !(card.formula) && !((card.modifiers || card.mods || []).some(m => (m.target_key || m.target) === 'defesa'));
                    if (!isOther) return false;
                }
            } else {
                // Modo spells/habilidades
                const isSpellLike = (card.type === CARD_TYPES.SPELL || card.type === CARD_TYPES.ABILITY || card.type === CARD_TYPES.TRAIT);
                if (!isSpellLike) return false;
                if (this.pickerCategoryFilter !== null && card.type !== this.pickerCategoryFilter) return false;
            }

            // Filtro por texto de busca
            if (search) {
                const matchName = card.name.toLowerCase().includes(search);
                const matchDesc = (card.desc || '').toLowerCase().includes(search);
                const matchKey = (card.key || '').toLowerCase().includes(search);
                const matchFormula = (card.formula || '').toLowerCase().includes(search);
                if (!matchName && !matchDesc && !matchKey && !matchFormula) return false;
            }

            return true;
        });
    }

    updateCardPickerResults() {
        const container = document.getElementById('sheet-picker-results-container');
        const countLabel = document.getElementById('sheet-picker-count-label');
        if (!container) return;

        const CARD_TYPES = (typeof window !== 'undefined' && window.CARD_TYPES) ? window.CARD_TYPES : {
            ATTRIBUTE: 0, RESOURCE: 1, STAT: 2, SKILL: 3, ABILITY: 4, EQUIPMENT: 5, SPELL: 6, TRAIT: 7
        };

        const allAvailable = this.getAvailableCompendiumCards();
        const filtered = this.getAvailablePickerCards();

        if (countLabel) {
            countLabel.textContent = `${filtered.length} card(s) disponível(is)`;
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: var(--color-text-dim); padding: 36px 16px;">
                    <div style="font-size: 2rem; margin-bottom: 8px;">🔍</div>
                    <p style="margin: 0; font-size: 0.9rem;">Nenhum card encontrado correspondente à busca.</p>
                    <p style="margin: 4px 0 0 0; font-size: 0.78rem;">Tente pesquisar por outros termos ou verifique se o CardPack foi carregado no Compêndio.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(card => {
            const inDeck = this.engine && this.engine.getCardByKey(card.key) !== null;
            const isEquip = card.type === CARD_TYPES.EQUIPMENT;
            const isAbilMode = this.pickerTargetMode === 'abilities';
            const icon = isAbilMode ? '⚡' : (card.type === CARD_TYPES.EQUIPMENT ? '⚔️' : (card.type === CARD_TYPES.SPELL ? '✨' : '⚡'));
            
            // Badges formatadas
            const mods = card.modifiers || card.mods || [];
            const modsHtml = mods.map(m => `
                <span class="card-mod-badge" style="background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); font-size: 0.72rem; padding: 2px 6px; border-radius: 4px;">
                    ${this.formatMod(m.value || m.val)} ${(m.target_key || m.target || '').toUpperCase()}
                </span>
            `).join(' ');

            const costHtml = (card.cost_resource || card.cost_res) ? `
                <span style="font-size: 0.72rem; color: #a78bfa; background: rgba(167, 139, 250, 0.15); border: 1px solid rgba(167, 139, 250, 0.3); padding: 2px 6px; border-radius: 4px;">
                    ⚡ ${card.cost_value || card.cost_val || 0} ${(card.cost_resource || card.cost_res).toUpperCase()}
                </span>
            ` : '';

            const formulaHtml = card.formula ? `
                <span style="font-size: 0.72rem; color: #67e8f9; background: rgba(103, 232, 249, 0.15); border: 1px solid rgba(103, 232, 249, 0.3); padding: 2px 6px; border-radius: 4px;">
                    🎲 ${card.formula}
                </span>
            ` : '';

            // Badges de categoria e obrigatoriedade
            let categoryBadgeHtml = '';
            if (card.category === 'class_ability') {
                categoryBadgeHtml = `<span style="font-size: 0.7rem; color: #f59e0b; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); padding: 2px 6px; border-radius: 4px; font-weight: 600;">⚔️ Classe</span>`;
            } else if (card.category === 'race_trait') {
                categoryBadgeHtml = `<span style="font-size: 0.7rem; color: #10b981; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); padding: 2px 6px; border-radius: 4px; font-weight: 600;">🧬 Raça</span>`;
            } else if (card.category === 'origin_power') {
                categoryBadgeHtml = `<span style="font-size: 0.7rem; color: #3b82f6; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); padding: 2px 6px; border-radius: 4px; font-weight: 600;">📜 Origem</span>`;
            } else if (card.category === 'deity_power') {
                categoryBadgeHtml = `<span style="font-size: 0.7rem; color: #ec4899; background: rgba(236, 72, 153, 0.15); border: 1px solid rgba(236, 72, 153, 0.3); padding: 2px 6px; border-radius: 4px; font-weight: 600;">🕊️ Divindade</span>`;
            }

            const mandatoryBadgeHtml = (card.is_mandatory || card.mandatory) ? `
                <span class="badge-mandatory" title="Habilidade obrigatória intrínseca da classe ou raça">
                    🔒 Obrigatória
                </span>
            ` : '';

            let btnActionText = '';
            if (inDeck) {
                btnActionText = '➕ Adicionar Outro';
            } else if (isAbilMode) {
                btnActionText = '➕ Equipar à Ficha';
            } else if (isEquip) {
                btnActionText = '➕ Adicionar à Mochila';
            } else {
                btnActionText = '➕ Adicionar ao Grimório';
            }

            return `
                <div class="sheet-picker-item-row" data-card-key="${card.key}">
                    <div class="sheet-picker-item-info">
                        <div class="sheet-picker-item-title">
                            <span>${icon}</span>
                            <span>${card.name}</span>
                            ${categoryBadgeHtml}
                            ${mandatoryBadgeHtml}
                            ${inDeck ? `
                                <span style="font-size: 0.7rem; color: #4ade80; background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.3); padding: 2px 6px; border-radius: 4px; font-weight: 600;">
                                    ✓ Já na Ficha
                                </span>
                            ` : ''}
                        </div>
                        <div class="sheet-picker-item-desc">
                            ${card.desc || 'Sem descrição.'}
                        </div>
                        <div style="display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap;">
                            ${costHtml}
                            ${formulaHtml}
                            ${modsHtml}
                        </div>
                    </div>
                    <div class="sheet-picker-item-action">
                        <button type="button" class="btn btn-sm ${inDeck ? 'btn-secondary' : 'btn-primary'} btn-picker-add-card" data-card-key="${card.key}" style="font-weight: 700; padding: 6px 14px; white-space: nowrap;">
                            ${btnActionText}
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Conecta ouvintes dos botões de adicionar
        container.querySelectorAll('.btn-picker-add-card').forEach(btn => {
            btn.addEventListener('click', () => {
                const cardKey = btn.dataset.cardKey;
                const card = filtered.find(c => c.key === cardKey) || allAvailable.find(c => c.key === cardKey);
                if (card) {
                    this.addCardFromPicker(card);
                }
            });
        });
    }

    addCardFromPicker(card) {
        if (!this.engine || !this.engine.isLoaded) return;

        const CARD_TYPES = (typeof window !== 'undefined' && window.CARD_TYPES) ? window.CARD_TYPES : {
            ATTRIBUTE: 0, RESOURCE: 1, STAT: 2, SKILL: 3, ABILITY: 4, EQUIPMENT: 5, SPELL: 6, TRAIT: 7
        };

        const isEquip = card.type === CARD_TYPES.EQUIPMENT;
        const isAbil = this.pickerTargetMode === 'abilities' || card.type === CARD_TYPES.ABILITY || card.type === CARD_TYPES.TRAIT;
        let cardKey = card.key;

        // Se já existe um card com essa chave no deck, gera chave única para permitir múltiplos itens
        if (this.engine.getCardByKey(cardKey)) {
            cardKey = `${cardKey}_${Date.now() % 10000}`;
        }

        const cardObj = {
            key: cardKey,
            name: card.name,
            type: card.type !== undefined ? card.type : CARD_TYPES.ABILITY,
            desc: card.desc || '',
            base: card.base || 0,
            current: card.current || card.curr || 0,
            max: card.max || 0,
            cost_resource: card.cost_resource || card.cost_res || '',
            cost_value: card.cost_value || card.cost_val || 0,
            formula: card.formula || '',
            equipped: isAbil ? true : false,
            modifiers: card.modifiers || card.mods || []
        };

        if (card.category) {
            cardObj.category = card.category;
        }
        if (card.is_mandatory || card.mandatory) {
            cardObj.is_mandatory = 1;
        }

        const added = this.engine.addCard(cardObj);
        if (added) {
            if (this._cardMetaMap) {
                this._cardMetaMap.set(cardKey, {
                    category: card.category || '',
                    is_mandatory: (card.is_mandatory || card.mandatory) ? 1 : 0
                });
            }
            this.engine.recalculate();
            const dest = isAbil ? 'habilidades da ficha' : (isEquip ? 'mochila' : 'grimório');
            this.logger(`[Ficha] "${card.name}" adicionado às ${dest}!`, 'success');
            if (window.characterStorage) {
                window.characterStorage.saveCurrent(this.engine, this.engine.getCharacterName());
            }
            this.updateCardPickerResults();
        }
    }

    setupCardPickerListeners() {
        const overlay = document.getElementById('modal-sheet-add-card-overlay');
        const btnClose = document.getElementById('btn-close-sheet-picker');
        const btnDone = document.getElementById('btn-done-sheet-picker');

        if (btnClose) btnClose.addEventListener('click', () => this.closeCardPicker());
        if (btnDone) btnDone.addEventListener('click', () => this.closeCardPicker());

        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeCardPicker();
                }
            });
        }

        const searchInput = document.getElementById('input-sheet-picker-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.pickerSearchQuery = e.target.value;
                this.updateCardPickerResults();
            });
        }

        const sourceSelect = document.getElementById('select-sheet-picker-source');
        if (sourceSelect) {
            sourceSelect.addEventListener('change', (e) => {
                this.pickerSelectedPackId = e.target.value;
                this.updateCardPickerResults();
            });
        }
    }
}

// Expõe globalmente e para Node.js
if (typeof window !== 'undefined') {
    window.SheetView = SheetView;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SheetView };
}
