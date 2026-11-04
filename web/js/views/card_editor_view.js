/**
 * card_editor_view.js — Editor e Criador Visual de Cards Personalizados (RPG-SheetC v2.0)
 * Permite criar e editar qualquer card de RPG com fórmulas e modificadores sem tocar em código.
 */

class CardEditorView {
    constructor(engine, router, logToConsole = console.log) {
        this.engine = engine;
        this.router = router;
        this.log = logToConsole;

        this.containerId = 'editor-container';
        this.isEditingExisting = false;

        this.cardState = this.getDefaultCardState();
    }

    getDefaultCardState() {
        return {
            id: 0,
            key: '',
            name: '',
            type: 5, // Padrão: Equipamento
            desc: '',
            base_value: 0,
            current_value: 0,
            max_value: 0,
            cost_resource: '',
            cost_value: 0,
            formula: '',
            is_equipped: 1,
            is_trained: 0,
            is_favorite: 0,
            modifiers: []
        };
    }

    /**
     * Inicializa o editor no container DOM
     * @param {string} containerId
     * @param {string|null} targetKey Chave de card existente para edição, ou null para novo
     */
    init(containerId = 'editor-container', targetKey = null) {
        this.containerId = containerId;
        const container = document.getElementById(this.containerId);
        if (!container) return;

        const keyToLoad = targetKey || window.cardEditorTargetKey || null;
        window.cardEditorTargetKey = null; // consome o alvo

        if (keyToLoad && this.engine) {
            const existing = this.engine.getCardByKey(keyToLoad);
            if (existing) {
                this.loadCardFromEngine(existing);
                this.isEditingExisting = true;
            } else {
                this.cardState = this.getDefaultCardState();
                this.isEditingExisting = false;
            }
        } else {
            this.cardState = this.getDefaultCardState();
            this.isEditingExisting = false;
        }

        this.render(container);
        this.setupEventListeners();
        this.updateLivePreview();
    }

    loadCardFromEngine(card) {
        this.cardState = {
            id: card.id || 0,
            key: card.key || '',
            name: card.name || '',
            type: card.type !== undefined ? card.type : 5,
            desc: card.desc || '',
            base_value: card.base || 0,
            current_value: card.current !== undefined ? card.current : card.base,
            max_value: card.max !== undefined ? card.max : card.base,
            cost_resource: card.costResource || '',
            cost_value: card.costValue || 0,
            formula: card.formula || '',
            is_equipped: card.equipped ? 1 : 0,
            is_trained: card.trained ? 1 : 0,
            is_favorite: card.favorite ? 1 : 0,
            modifiers: card.modifiers ? [...card.modifiers] : []
        };
    }

    /* =========================================================================
     * 1. Renderização do Formulário e Estrutura do Editor
     * ========================================================================= */

    render(container) {
        const types = window.CARD_TYPES || {
            ATTRIBUTE: 0, RESOURCE: 1, STAT: 2, SKILL: 3, ABILITY: 4, EQUIPMENT: 5, SPELL: 6, TRAIT: 7
        };
        const meta = window.CARD_TYPE_META || {};

        let typeOptionsHtml = '';
        for (const [tKey, tId] of Object.entries(types)) {
            const m = meta[tId] || { label: tKey, icon: '🎴' };
            const selected = this.cardState.type === tId ? 'selected' : '';
            typeOptionsHtml += `<option value="${tId}" ${selected}>${m.icon || ''} ${m.label}</option>`;
        }

        container.innerHTML = `
            <div class="card-editor-container">
                <!-- Cabeçalho do Editor -->
                <div class="card-editor-header">
                    <div class="compendium-title-group">
                        <h2>${this.isEditingExisting ? '✏️ Editar Card de RPG' : '✨ Criador de Cards Personalizados'}</h2>
                        <p>${this.isEditingExisting ? 'Atualize atributos, fórmulas e bônus deste card em tempo real no motor C.' : 'Crie armas, magias, itens ou atributos e integre-os diretamente às regras do sistema.'}</p>
                    </div>
                    <div class="card-editor-actions">
                        <button type="button" id="btn-editor-cancel" class="btn">
                            ← Voltar ao Compêndio
                        </button>
                        ${this.isEditingExisting ? `
                            <button type="button" id="btn-editor-delete" class="btn" style="color: #ef4444; border-color: rgba(239,68,68,0.4);">
                                🗑️ Excluir Card
                            </button>
                        ` : ''}
                        <button type="button" id="btn-editor-save" class="btn btn-primary">
                            💾 Salvar no Motor C
                        </button>
                    </div>
                </div>

                <!-- Modelos Pré-definidos (Templates Rápidos) -->
                ${!this.isEditingExisting ? `
                    <div class="editor-section-card" style="padding: 12px 18px;">
                        <span style="font-size: 0.8rem; font-weight: 600; color: var(--color-text-muted); margin-right: 8px;">
                            ⚡ Modelos Rápidos:
                        </span>
                        <div class="editor-templates-row" style="display: inline-flex; margin: 0;">
                            <button type="button" class="editor-template-btn" data-template="weapon">⚔️ Arma de Batalha</button>
                            <button type="button" class="editor-template-btn" data-template="armor">🛡️ Armadura Protetora</button>
                            <button type="button" class="editor-template-btn" data-template="spell">✨ Magia Arcana</button>
                            <button type="button" class="editor-template-btn" data-template="skill">🎯 Perícia / Ação</button>
                            <button type="button" class="editor-template-btn" data-template="resource">❤️ Recurso Dinâmico</button>
                        </div>
                    </div>
                ` : ''}

                <!-- Layout em Grid (Formulário + Live Preview) -->
                <div class="card-editor-layout">
                    <!-- Coluna do Formulário -->
                    <div class="card-editor-form-col">
                        <!-- Seção 1: Identificação Básica -->
                        <div class="editor-section-card">
                            <h3 class="editor-section-title">🏷️ Identificação e Categoria</h3>
                            
                            <div class="editor-field-row">
                                <div class="editor-field-group">
                                    <label class="editor-label" for="ed-name">Nome de Exibição *</label>
                                    <input type="text" id="ed-name" class="editor-input" maxlength="31" placeholder="Ex: Espada Vorpal, Defesa, Vida..." value="${this.cardState.name}">
                                </div>

                                <div class="editor-field-group">
                                    <label class="editor-label" for="ed-key">
                                        <span>Chave / Tag Única (@chave) *</span>
                                    </label>
                                    <input type="text" id="ed-key" class="editor-input editor-input-mono" maxlength="23" placeholder="Ex: espada_vorpal, for, pv..." value="${this.cardState.key}" ${this.isEditingExisting ? 'readonly style="opacity: 0.7;"' : ''}>
                                    <span class="editor-hint">Identificador em minúsculas usado em fórmulas (ex: @chave).</span>
                                </div>
                            </div>

                            <div class="editor-field-row">
                                <div class="editor-field-group">
                                    <label class="editor-label" for="ed-type">Tipo / Categoria de Card *</label>
                                    <select id="ed-type" class="editor-select">
                                        ${typeOptionsHtml}
                                    </select>
                                </div>

                                <div class="editor-field-group">
                                    <label class="editor-label" for="ed-desc">Descrição / Efeito de Regra</label>
                                    <input type="text" id="ed-desc" class="editor-input" maxlength="127" placeholder="Descrição do efeito, dano ou regra..." value="${this.cardState.desc}">
                                </div>
                            </div>
                        </div>

                        <!-- Seção 2: Valores e Custos -->
                        <div class="editor-section-card">
                            <h3 class="editor-section-title">📊 Valores Numéricos e Custo de Ativação</h3>

                            <div class="editor-field-row">
                                <div class="editor-field-group">
                                    <label class="editor-label" for="ed-base">Valor Base / Inicial</label>
                                    <input type="number" id="ed-base" class="editor-input" value="${this.cardState.base_value}">
                                </div>

                                <div class="editor-field-group">
                                    <label class="editor-label" for="ed-cost-res">Recurso de Custo (Opcional)</label>
                                    <input type="text" id="ed-cost-res" class="editor-input editor-input-mono" placeholder="Ex: pm, mana, pv..." value="${this.cardState.cost_resource}">
                                </div>

                                <div class="editor-field-group">
                                    <label class="editor-label" for="ed-cost-val">Quantidade Consumida</label>
                                    <input type="number" id="ed-cost-val" class="editor-input" min="0" value="${this.cardState.cost_value}">
                                </div>
                            </div>
                        </div>

                        <!-- Seção 3: Fórmula Dinâmica em C -->
                        <div class="editor-section-card">
                            <h3 class="editor-section-title">🎲 Fórmula de Rolagem e Cálculo Dinâmico</h3>
                            
                            <div class="editor-field-group">
                                <label class="editor-label" for="ed-formula">
                                    <span>Expressão Aritmética / Referência a outros Cards</span>
                                </label>
                                <input type="text" id="ed-formula" class="editor-input editor-input-mono" placeholder="Ex: (@for - 10) / 2 + 5, 10 + @des + @armadura..." value="${this.cardState.formula}">
                                <span class="editor-hint">Suporta +, -, *, /, parênteses () e referências @chave, @nivel e @xp. Calculado a 60 FPS no C.</span>
                            </div>
                        </div>

                        <!-- Seção 4: Modificadores Concedidos a Outros Cards -->
                        <div class="editor-section-card">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                                <h3 class="editor-section-title" style="margin: 0; border: none; padding: 0;">⚡ Modificadores Concedidos</h3>
                                <button type="button" id="btn-add-modifier" class="btn" style="font-size: 0.75rem; padding: 4px 10px;">
                                    + Adicionar Bônus
                                </button>
                            </div>
                            <span class="editor-hint" style="display: block; margin-bottom: 10px;">
                                Bônus ou penalidades numéricas que este card concede a outro card quando ativo (ex: +4 na Defesa, +2 na Força).
                            </span>

                            <div id="editor-modifiers-list" class="editor-mods-list">
                                <!-- Renderizado dinamicamente -->
                            </div>
                        </div>

                        <!-- Seção 5: Flags e Estados -->
                        <div class="editor-section-card">
                            <h3 class="editor-section-title">⚙️ Estados Iniciais</h3>
                            
                            <div class="editor-flags-row">
                                <label class="editor-checkbox-label">
                                    <input type="checkbox" id="ed-equipped" ${this.cardState.is_equipped ? 'checked' : ''}>
                                    <span>Equipado / Ativo na ficha por padrão</span>
                                </label>

                                <label class="editor-checkbox-label">
                                    <input type="checkbox" id="ed-trained" ${this.cardState.is_trained ? 'checked' : ''}>
                                    <span>Treinado / Proficiente</span>
                                </label>

                                <label class="editor-checkbox-label">
                                    <input type="checkbox" id="ed-favorite" ${this.cardState.is_favorite ? 'checked' : ''}>
                                    <span>Favorito</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- Coluna de Live Preview -->
                    <div class="card-editor-preview-col">
                        <div class="editor-section-card">
                            <h3 class="editor-section-title">👁️ Pré-visualização em Tempo Real</h3>
                            <span class="editor-hint" style="display: block; margin-bottom: 14px;">
                                Exibição idêntica ao que aparecerá no compêndio e na ficha de personagem.
                            </span>

                            <div id="editor-card-live-preview" class="editor-live-preview-box">
                                <!-- Renderizado via updateLivePreview -->
                            </div>

                            <div id="editor-formula-eval-container" class="editor-formula-eval-box" style="display: none;">
                                <span>Resultado Calculado pelo Motor C:</span>
                                <span id="editor-formula-eval-result" class="editor-formula-result">-</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.renderModifiers();
    }

    renderModifiers() {
        const listEl = document.getElementById('editor-modifiers-list');
        if (!listEl) return;

        if (this.cardState.modifiers.length === 0) {
            listEl.innerHTML = `<span style="font-size: 0.8rem; color: var(--color-text-dim);">Nenhum modificador configurado.</span>`;
            return;
        }

        let html = '';
        this.cardState.modifiers.forEach((mod, idx) => {
            html += `
                <div class="editor-mod-row">
                    <input type="text" class="editor-input editor-input-mono mod-target-input" data-mod-idx="${idx}" placeholder="Card alvo (@chave, ex: defesa)" value="${mod.target_key || ''}">
                    <input type="number" class="editor-input mod-val-input" data-mod-idx="${idx}" placeholder="Bônus" value="${mod.value || 0}">
                    <button type="button" class="editor-mod-remove-btn" data-remove-mod-idx="${idx}" title="Remover modificador">✕</button>
                </div>
            `;
        });

        listEl.innerHTML = html;
    }

    /* =========================================================================
     * 2. Eventos e Interatividade do Formulário
     * ========================================================================= */

    setupEventListeners() {
        // Sincronização de campos em tempo real para o Live Preview
        const nameInput = document.getElementById('ed-name');
        const keyInput = document.getElementById('ed-key');
        const typeSelect = document.getElementById('ed-type');
        const descInput = document.getElementById('ed-desc');
        const baseInput = document.getElementById('ed-base');
        const formulaInput = document.getElementById('ed-formula');
        const costResInput = document.getElementById('ed-cost-res');
        const costValInput = document.getElementById('ed-cost-val');
        const equippedInput = document.getElementById('ed-equipped');
        const trainedInput = document.getElementById('ed-trained');
        const favoriteInput = document.getElementById('ed-favorite');

        const onFieldChange = () => {
            this.cardState.name = nameInput ? nameInput.value : '';
            if (!this.isEditingExisting && keyInput) {
                // Auto-sugere chave higienizada a partir do nome se a chave estiver vazia ou coincidente
                if (!this.manuallyEditedKey) {
                    keyInput.value = this.sanitizeKey(this.cardState.name);
                }
            }
            this.cardState.key = keyInput ? keyInput.value.trim() : '';
            this.cardState.type = typeSelect ? parseInt(typeSelect.value, 10) : 5;
            this.cardState.desc = descInput ? descInput.value : '';
            this.cardState.base_value = baseInput ? parseInt(baseInput.value, 10) || 0 : 0;
            this.cardState.formula = formulaInput ? formulaInput.value.trim() : '';
            this.cardState.cost_resource = costResInput ? costResInput.value.trim() : '';
            this.cardState.cost_value = costValInput ? parseInt(costValInput.value, 10) || 0 : 0;
            this.cardState.is_equipped = (equippedInput && equippedInput.checked) ? 1 : 0;
            this.cardState.is_trained = (trainedInput && trainedInput.checked) ? 1 : 0;
            this.cardState.is_favorite = (favoriteInput && favoriteInput.checked) ? 1 : 0;

            this.updateLivePreview();
        };

        [nameInput, typeSelect, descInput, baseInput, formulaInput, costResInput, costValInput].forEach(el => {
            if (el) el.addEventListener('input', onFieldChange);
        });

        if (keyInput) {
            keyInput.addEventListener('input', () => {
                this.manuallyEditedKey = true;
                this.cardState.key = keyInput.value.trim();
                this.updateLivePreview();
            });
        }

        [equippedInput, trainedInput, favoriteInput].forEach(el => {
            if (el) el.addEventListener('change', onFieldChange);
        });

        // Botões de Templates Rápidos
        const templateBtns = document.querySelectorAll('.editor-template-btn');
        templateBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tmpl = btn.dataset.template;
                this.applyTemplate(tmpl);
            });
        });

        // Gerenciamento de modificadores
        const btnAddMod = document.getElementById('btn-add-modifier');
        if (btnAddMod) {
            btnAddMod.addEventListener('click', () => {
                if (this.cardState.modifiers.length < 4) {
                    this.cardState.modifiers.push({ target_key: 'defesa', value: 2 });
                    this.renderModifiers();
                    this.updateLivePreview();
                } else {
                    alert('Cada card pode conceder no máximo 4 modificadores simultâneos.');
                }
            });
        }

        const modsList = document.getElementById('editor-modifiers-list');
        if (modsList) {
            modsList.addEventListener('input', (e) => {
                const targetInput = e.target.closest('.mod-target-input');
                const valInput = e.target.closest('.mod-val-input');
                if (targetInput) {
                    const idx = parseInt(targetInput.dataset.modIdx, 10);
                    if (this.cardState.modifiers[idx]) {
                        this.cardState.modifiers[idx].target_key = targetInput.value.trim();
                        this.updateLivePreview();
                    }
                } else if (valInput) {
                    const idx = parseInt(valInput.dataset.modIdx, 10);
                    if (this.cardState.modifiers[idx]) {
                        this.cardState.modifiers[idx].value = parseInt(valInput.value, 10) || 0;
                        this.updateLivePreview();
                    }
                }
            });

            modsList.addEventListener('click', (e) => {
                const removeBtn = e.target.closest('[data-remove-mod-idx]');
                if (removeBtn) {
                    const idx = parseInt(removeBtn.dataset.removeModIdx, 10);
                    this.cardState.modifiers.splice(idx, 1);
                    this.renderModifiers();
                    this.updateLivePreview();
                }
            });
        }

        // Salvar, Cancelar e Excluir
        const btnSave = document.getElementById('btn-editor-save');
        if (btnSave) {
            btnSave.addEventListener('click', () => this.saveCard());
        }

        const btnCancel = document.getElementById('btn-editor-cancel');
        if (btnCancel) {
            btnCancel.addEventListener('click', () => {
                if (this.router && typeof this.router.navigate === 'function') {
                    this.router.navigate('compendium');
                }
            });
        }

        const btnDelete = document.getElementById('btn-editor-delete');
        if (btnDelete) {
            btnDelete.addEventListener('click', () => this.deleteCard());
        }
    }

    sanitizeKey(str) {
        return (str || '')
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .substring(0, 23);
    }

    /* =========================================================================
     * 3. Modelos Rápidos (Templates)
     * ========================================================================= */

    applyTemplate(templateName) {
        if (templateName === 'weapon') {
            this.cardState.name = 'Machado de Batalha Rúnico';
            this.cardState.key = 'machado_runico';
            this.cardState.type = 5; // Equipamento
            this.cardState.desc = 'Lâmina afiada banhada em fogo primal.';
            this.cardState.base_value = 8;
            this.cardState.formula = '(@for - 10) / 2 + 8';
            this.cardState.modifiers = [{ target_key: 'for', value: 1 }];
        } else if (templateName === 'armor') {
            this.cardState.name = 'Placas de Aço Valiriano';
            this.cardState.key = 'armadura_valiriana';
            this.cardState.type = 5;
            this.cardState.desc = 'Armadura maciça de placas com forja lendária.';
            this.cardState.base_value = 7;
            this.cardState.formula = '';
            this.cardState.modifiers = [{ target_key: 'defesa', value: 7 }];
        } else if (templateName === 'spell') {
            this.cardState.name = 'Raio da Mente Arcano';
            this.cardState.key = 'raio_mente';
            this.cardState.type = 6; // Magia
            this.cardState.desc = 'Disparo psíquico concentrado de pura energia mágica.';
            this.cardState.cost_resource = 'pm';
            this.cardState.cost_value = 2;
            this.cardState.formula = '(@int - 10) / 2 + 14';
            this.cardState.modifiers = [];
        } else if (templateName === 'skill') {
            this.cardState.name = 'Acrobacia Excepcional';
            this.cardState.key = 'acrobacia';
            this.cardState.type = 3; // Perícia
            this.cardState.desc = 'Capacidade de saltar, esquivar e realizar manobras ágeis.';
            this.cardState.base_value = 5;
            this.cardState.formula = '(@des - 10) / 2 + 5';
            this.cardState.is_trained = 1;
            this.cardState.modifiers = [];
        } else if (templateName === 'resource') {
            this.cardState.name = 'Estresse & Corrupção';
            this.cardState.key = 'estresse';
            this.cardState.type = 1; // Recurso
            this.cardState.desc = 'Medidor dinâmico de sanidade e tensão psicológica.';
            this.cardState.base_value = 20;
            this.cardState.max_value = 20;
            this.cardState.current_value = 20;
            this.cardState.formula = '';
            this.cardState.modifiers = [];
        }

        const container = document.getElementById(this.containerId);
        if (container) {
            this.render(container);
            this.setupEventListeners();
            this.updateLivePreview();
        }
    }

    /* =========================================================================
     * 4. Pré-visualização ao Vivo e Avaliação de Fórmulas
     * ========================================================================= */

    updateLivePreview() {
        const previewContainer = document.getElementById('editor-card-live-preview');
        if (!previewContainer) return;

        const types = window.CARD_TYPES || {};
        const meta = window.CARD_TYPE_META || {};
        const m = meta[this.cardState.type] || { key: 'custom', label: 'Card', icon: '🎴', badgeClass: 'badge-attr' };

        let evaluatedFormula = undefined;
        if (this.cardState.formula && this.engine && typeof this.engine.evalExpression === 'function') {
            evaluatedFormula = this.engine.evalExpression(this.cardState.formula);
        }

        const cardDto = {
            id: this.cardState.id || 1,
            key: this.cardState.key || 'chave',
            name: this.cardState.name || 'Nome do Card',
            type: this.cardState.type,
            typeKey: m.key,
            typeLabel: m.label,
            typeIcon: m.icon,
            badgeClass: m.badgeClass,
            desc: this.cardState.desc,
            base: this.cardState.base_value,
            current: this.cardState.current_value || this.cardState.base_value,
            max: this.cardState.max_value || this.cardState.base_value,
            effective: this.cardState.base_value,
            formula: this.cardState.formula,
            formulaValue: evaluatedFormula,
            costResource: this.cardState.cost_resource,
            costValue: this.cardState.cost_value,
            equipped: Boolean(this.cardState.is_equipped),
            trained: Boolean(this.cardState.is_trained),
            favorite: Boolean(this.cardState.is_favorite)
        };

        // Renderiza card usando a função padrão do VirtualList ou fallback interno
        if (window.VirtualList && typeof window.VirtualList.prototype.defaultCardRenderer === 'function') {
            previewContainer.innerHTML = window.VirtualList.prototype.defaultCardRenderer(cardDto, 0);
        }

        // Atualiza caixa de avaliação de fórmula se houver expressão
        const evalContainer = document.getElementById('editor-formula-eval-container');
        const evalResult = document.getElementById('editor-formula-eval-result');
        if (evalContainer && evalResult) {
            if (this.cardState.formula) {
                evalContainer.style.display = 'flex';
                evalResult.textContent = evaluatedFormula !== undefined ? String(evaluatedFormula) : '0';
            } else {
                evalContainer.style.display = 'none';
            }
        }
    }

    /* =========================================================================
     * 5. Persistência no Motor C e Exclusão
     * ========================================================================= */

    saveCard() {
        const name = (this.cardState.name || '').trim();
        const key = this.sanitizeKey(this.cardState.key || this.cardState.name);

        if (!name) {
            alert('Por favor, informe um nome para o card.');
            return;
        }

        if (!key) {
            alert('Por favor, defina uma chave (@chave) válida em minúsculas.');
            return;
        }

        this.cardState.key = key;

        if (!this.engine) {
            alert('Motor C não conectado.');
            return;
        }

        // Converte modificadores para o formato do parser JSON C
        const formattedMods = (this.cardState.modifiers || [])
            .filter(m => m.target_key && m.value !== 0)
            .map(m => ({ target: m.target_key, val: m.value }));

        const cardPayload = {
            id: this.cardState.id || (this.engine.getCardCount() + 1),
            key: this.cardState.key,
            name: this.cardState.name,
            type: this.cardState.type,
            desc: this.cardState.desc || '',
            base: this.cardState.base_value || 0,
            curr: this.cardState.current_value || this.cardState.base_value || 0,
            max: this.cardState.max_value || this.cardState.base_value || 0,
            cost_res: this.cardState.cost_resource || '',
            cost_val: this.cardState.cost_value || 0,
            formula: this.cardState.formula || '',
            equipped: this.cardState.is_equipped ? 1 : 0,
            trained: this.cardState.is_trained ? 1 : 0,
            fav: this.cardState.is_favorite ? 1 : 0,
            mods: formattedMods
        };

        const success = this.engine.addCard(cardPayload);

        if (success) {
            this.engine.recalculate();
            this.log(`[Editor] Card "${cardPayload.name}" (@${cardPayload.key}) salvo com sucesso no motor C!`, 'success');

            if (this.router && typeof this.router.navigate === 'function') {
                this.router.navigate('compendium');
            }
        } else {
            this.log('[Editor Erro] Falha ao injetar card na memória C.', 'error');
            alert('Não foi possível salvar o card no motor C.');
        }
    }

    deleteCard() {
        if (!this.cardState.key || !this.engine) return;

        if (confirm(`Tem certeza que deseja excluir o card "${this.cardState.name}" (@${this.cardState.key})?`)) {
            const ok = this.engine.removeCardByKey(this.cardState.key);
            if (ok) {
                this.engine.recalculate();
                this.log(`[Editor] Card "@${this.cardState.key}" removido do motor C.`, 'info');
                if (this.router && typeof this.router.navigate === 'function') {
                    this.router.navigate('compendium');
                }
            } else {
                alert('Erro ao excluir card no motor C.');
            }
        }
    }
}

if (typeof window !== 'undefined') {
    window.CardEditorView = CardEditorView;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CardEditorView };
}
