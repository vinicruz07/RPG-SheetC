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
     * Inicializa a view da ficha
     */
    init(containerId = 'sheet-container') {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            this.container = document.getElementById('view-sheet');
        }
        if (!this.container) return;

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

                <div class="dashboard-grid sheet-grid-columns">
                    <!-- Coluna Principal (Recursos, Stats, Atributos, Equipamentos, Habilidades, Perícias) -->
                    <main class="sheet-column-main" style="display: flex; flex-direction: column; gap: var(--space-lg);">
                        
                        <!-- 1. Recursos Dinâmicos (PV, PM, Sanidade, etc.) e Estatísticas (Defesa, etc.) -->
                        <section class="card sheet-resources-card">
                            <div class="card-header" style="margin-bottom: var(--space-md);">
                                <div>
                                    <span class="card-title">Recursos de Combate & Estatísticas</span>
                                    <span class="card-subtitle-small">Recalculados automaticamente na memória C</span>
                                </div>
                            </div>

                            <!-- Grade de Recursos Dinâmicos -->
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

                            <!-- Estatísticas Derivadas (Defesa, etc.) -->
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

                        <!-- 2. Atributos Básicos com Edição In-Place ou Rolagem Direta -->
                        ${attributeCards.length > 0 ? `
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
                        ` : ''}

                        <!-- 3. Equipamentos e Itens Aplicados (Cards com Recálculo Dinâmico) -->
                        <section class="card sheet-equipment-card">
                            <div class="card-header">
                                <div>
                                    <span class="card-title">Equipamento & Armas</span>
                                    <span class="card-subtitle-small">${isPlayMode ? 'Apenas itens em uso (clique em Rolar para atacar ou causar dano)' : 'Itens em uso afetam dinamicamente os valores da ficha'}</span>
                                </div>
                                ${!isPlayMode ? `
                                    <button type="button" class="btn btn-sm btn-open-compendium-equip" style="font-size: 0.8rem;">
                                        + Adicionar do Compêndio
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
                                        <p style="font-size: 0.82rem; color: var(--color-text-dim); margin: 0;">
                                            Mochila vazia. Adicione novos equipamentos no Compêndio ou crie novos cards.
                                        </p>
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

                        <!-- 4. Magias, Habilidades & Características -->
                        <section class="card sheet-spells-abilities-card">
                            <div class="card-header">
                                <div>
                                    <span class="card-title">Habilidades & Magias</span>
                                    <span class="card-subtitle-small">${isPlayMode ? 'Poderes ativos em combate (custo debitado automaticamente)' : 'Cards ativos aplicam bônus ou executam rolagens com custo'}</span>
                                </div>
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
                                        <p style="font-size: 0.82rem; color: var(--color-text-dim); margin: 0;">
                                            Nenhuma magia ou habilidade cadastrada.
                                        </p>
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

                        <!-- 5. Perícias Baseadas em Cards -->
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
            </div>
        `;

        this.setupHeaderEventListeners();
        this.setupEventListeners();
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
                    if (typeof confirm === 'function' && !confirm(`Deseja remover o card "${key}" da ficha?`)) {
                        return;
                    }
                    this.engine.removeCardByKey(key);
                    this.logger(`[C Deck] Card "${key}" excluído da ficha.`, 'info');
                    this.render();
                }
            });
        });

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
}

// Expõe globalmente e para Node.js
if (typeof window !== 'undefined') {
    window.SheetView = SheetView;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SheetView };
}
