/**
 * wizard.js — Motor Universal e Dinâmico de Criação de Personagens (RPG-SheetC v2.0)
 * 100% Agnóstico e Data-Driven: Todas as opções, assistentes, etapas e modelos são
 * derivados dinamicamente do CardPack ativo ou configurados em modo manual.
 * Zero Propriedade Intelectual Fixa no Código-Fonte.
 */

class WizardView {
    constructor(engine, router, onCharacterCreated) {
        this.engine = engine;
        this.router = router;
        this.onCharacterCreated = onCharacterCreated;

        this.container = null;
        this.currentStep = 1; // 1: Selecionar CardPack | 2: Identidade e Método de Criação | 3: Assistente Guiado
        this.guidedStep = 1;  // Etapa atual dentro do assistente ativo

        this.selectedPackId = null;
        this.characterName = 'Novo Herói';
        this.creationMode = 'manual'; // 'manual' | 'guided' | 'template'
        this.selectedWizardId = null;
        this.selectedTemplateId = null;

        // Tabela de custo padrão de compra de pontos (pode ser sobrescrita pelo CardPack)
        this.costTable = {
            '-1': -1,
            '0': 0,
            '1': 1,
            '2': 2,
            '3': 4,
            '4': 7
        };

        this.characterData = {
            name: 'Novo Herói',
            concept: '',
            details: '',
            attrMethod: 'point_buy', // 'point_buy' | 'rolls'
            attributes: { for: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 },
            rolls: [],
            raceKey: '',
            raceBonusAttrs: [],
            classKey: '',
            trainedSkills: [],
            originKey: '',
            deityKey: '',
            selectedWeapons: [],
            selectedArmor: '',
            selectedShield: ''
        };

        this.fantasyNames = [
            'Valeros', 'Kaelen', 'Lorien', 'Thalor', 'Gwendolyn',
            'Brogor', 'Doran', 'Lyra', 'Aelir', 'Durgoth',
            'Sariel', 'Morgran', 'Vanya', 'Zadok', 'Elora',
            'Theron', 'Cassian', 'Jareth', 'Mirena', 'Branok'
        ];
    }

    /**
     * Inicializa a view do Criador no container DOM
     */
    init(containerId = 'wizard-container') {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.reset();
        this.render();
    }

    /**
     * Reseta o estado do criador para os padrões
     */
    reset() {
        this.currentStep = 1;
        this.guidedStep = 1;
        this.selectedPackId = null;
        this.characterName = this.getRandomName();
        this.creationMode = 'manual';
        this.selectedWizardId = null;
        this.selectedTemplateId = null;

        this.characterData = {
            name: this.characterName,
            concept: 'Aventureiro em busca de glória e desafios',
            details: '',
            attrMethod: 'point_buy',
            attributes: { for: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 },
            rolls: [],
            raceKey: '',
            raceBonusAttrs: [],
            classKey: '',
            trainedSkills: [],
            originKey: '',
            deityKey: '',
            selectedWeapons: [],
            selectedArmor: '',
            selectedShield: ''
        };

        // Auto-seleciona o primeiro CardPack instalado se houver
        const packs = this.getAvailablePacks();
        if (packs.length > 0) {
            this.selectedPackId = packs[0].id;
        } else {
            this.selectedPackId = '__none__';
        }

        this.syncPackDefaults();
    }

    getRandomName() {
        const idx = Math.floor(Math.random() * this.fantasyNames.length);
        return this.fantasyNames[idx];
    }

    /**
     * Retorna os CardPacks disponíveis no Compêndio ou Storage Local
     */
    getAvailablePacks() {
        let packs = [];
        if (typeof window !== 'undefined' && window.compendiumView && typeof window.compendiumView.getInstalledPacks === 'function') {
            packs = window.compendiumView.getInstalledPacks();
        } else if (typeof window !== 'undefined' && window.localStorage) {
            try {
                const raw = window.localStorage.getItem('rpg_sheetc_cardpacks_v1');
                if (raw) packs = JSON.parse(raw);
            } catch (e) {
                // continua
            }
        }
        return Array.isArray(packs) ? packs : [];
    }

    /**
     * Retorna o CardPack atualmente selecionado no Criador
     */
    getSelectedPack() {
        if (!this.selectedPackId || this.selectedPackId === '__none__') {
            return null;
        }
        const packs = this.getAvailablePacks();
        return packs.find(p => p.id === this.selectedPackId) || null;
    }

    /**
     * Extrai a configuração de criação do CardPack selecionado de forma universal.
     * Suporta a árvore customizada 'creation_config' e mantém retrocompatibilidade com 'wizard_schema'.
     */
    getPackCreationConfig(pack = null) {
        const targetPack = pack || this.getSelectedPack();
        if (!targetPack) {
            return {
                wizards: [],
                templates: [],
                customModes: [],
                allowManual: true
            };
        }

        let wizards = [];
        let templates = [];
        let customModes = [];
        let allowManual = true;

        if (targetPack.creation_config) {
            const cc = targetPack.creation_config;
            if (Array.isArray(cc.wizards)) wizards = cc.wizards;
            if (Array.isArray(cc.templates)) templates = cc.templates;
            if (Array.isArray(cc.custom_modes)) customModes = cc.custom_modes;
            if (cc.allow_manual !== undefined) allowManual = !!cc.allow_manual;
        }

        // Retrocompatibilidade se wizard_schema foi declarado diretamente na raiz do pack
        if (wizards.length === 0 && targetPack.wizard_schema && Array.isArray(targetPack.wizard_schema.steps)) {
            wizards = [{
                id: targetPack.wizard_schema.id || 'default_wizard',
                name: targetPack.wizard_schema.name || 'Assistente Guiado do Pacote',
                desc: targetPack.wizard_schema.description || 'Criação passo a passo guiada pelas regras integradas do pacote.',
                icon: '🧙‍♂️',
                steps: targetPack.wizard_schema.steps
            }];
        }

        // Retrocompatibilidade se templates foram declarados diretamente na raiz do pack
        if (templates.length === 0 && Array.isArray(targetPack.templates)) {
            templates = targetPack.templates;
        }

        return { wizards, templates, customModes, allowManual };
    }

    /**
     * Retorna o assistente ativo selecionado
     */
    getActiveWizard() {
        const config = this.getPackCreationConfig();
        if (!config.wizards || config.wizards.length === 0) return null;
        if (this.selectedWizardId) {
            const found = config.wizards.find(w => w.id === this.selectedWizardId);
            if (found) return found;
        }
        return config.wizards[0];
    }

    /**
     * Retorna a lista de etapas do assistente ativo
     */
    getActiveSteps() {
        const wizard = this.getActiveWizard();
        return Array.isArray(wizard?.steps) ? wizard.steps : [];
    }

    /**
     * Sincroniza os padrões de seleção com o pacote escolhido
     */
    syncPackDefaults() {
        const pack = this.getSelectedPack();
        const config = this.getPackCreationConfig(pack);

        if (config.wizards.length > 0) {
            this.selectedWizardId = config.wizards[0].id;
            this.creationMode = 'guided';
        } else if (config.templates.length > 0) {
            this.selectedTemplateId = config.templates[0].id;
            this.creationMode = 'template';
        } else {
            this.selectedWizardId = null;
            this.selectedTemplateId = null;
            this.creationMode = 'manual';
        }

        // Sincroniza opções do assistente se houver
        const steps = this.getActiveSteps();
        const raceStep = steps.find(s => s.key === 'race' || s.type === 'single_choice');
        if (raceStep?.options?.length > 0) {
            this.characterData.raceKey = raceStep.options[0].key;
        }

        const classStep = steps.find(s => s.key === 'class' || s.type === 'class_choice');
        if (classStep?.options?.length > 0) {
            this.characterData.classKey = classStep.options[0].key;
            this.characterData.trainedSkills = [...(classStep.options[0].fixed_skills || [])];
        }

        const originStep = steps.find(s => s.key === 'origin');
        if (originStep?.options?.length > 0) {
            this.characterData.originKey = originStep.options[0].key;
        }

        const deityStep = steps.find(s => s.key === 'deity');
        if (deityStep?.options?.length > 0) {
            this.characterData.deityKey = deityStep.options[0].key;
        }

        const equipStep = steps.find(s => s.key === 'equipment' || s.type === 'equipment_select');
        if (equipStep?.options) {
            if (equipStep.options.weapons_martial?.length > 0) {
                this.characterData.selectedWeapons = [equipStep.options.weapons_martial[0]];
            } else if (equipStep.options.weapons_simple?.length > 0) {
                this.characterData.selectedWeapons = [equipStep.options.weapons_simple[0]];
            }
            if (equipStep.options.armors_light?.length > 0) {
                this.characterData.selectedArmor = equipStep.options.armors_light[0];
            }
            if (equipStep.options.shields?.length > 0) {
                this.characterData.selectedShield = equipStep.options.shields[0];
            }
        }
    }

    /**
     * Inicia o Assistente Guiado
     */
    startGuidedWizard() {
        const steps = this.getActiveSteps();
        if (steps.length === 0) {
            // Se o pacote não tiver etapas de assistente, inicia em modo manual
            this.finishCreation();
            return;
        }
        this.currentStep = 3;
        this.guidedStep = 1;
        this.characterData.name = this.characterName;
        this.render();
    }

    /**
     * Renderiza o fluxo atual do Criador
     */
    render() {
        if (!this.container) return;

        if (this.currentStep === 1) {
            this.container.innerHTML = `
                <div class="wizard-wrapper">
                    ${this.renderTopStepper()}
                    ${this.renderStep1()}
                </div>
            `;
        } else if (this.currentStep === 2) {
            this.container.innerHTML = `
                <div class="wizard-wrapper">
                    ${this.renderTopStepper()}
                    ${this.renderStep2()}
                </div>
            `;
        } else {
            this.container.innerHTML = `
                <div class="wizard-wrapper">
                    ${this.renderGuidedStepper()}
                    ${this.renderGuidedStep(this.guidedStep)}
                </div>
            `;
        }

        this.setupEventListeners();
    }

    renderTopStepper() {
        return `
            <div class="wizard-stepper" style="max-width: 600px; margin: 0 auto var(--space-lg) auto;">
                <div class="wizard-step ${this.currentStep === 1 ? 'active' : ''} ${this.currentStep > 1 ? 'completed' : ''}">
                    <div class="step-num">${this.currentStep > 1 ? '✓' : '1'}</div>
                    <div class="step-label">CardPack Principal</div>
                </div>
                <div class="wizard-step-line ${this.currentStep > 1 ? 'completed' : ''}"></div>
                <div class="wizard-step ${this.currentStep === 2 ? 'active' : ''}">
                    <div class="step-num">2</div>
                    <div class="step-label">Identidade & Modo</div>
                </div>
            </div>
        `;
    }

    renderGuidedStepper() {
        const steps = this.getActiveSteps();
        if (steps.length === 0) return '';

        return `
            <div class="guided-stepper" style="margin-bottom: var(--space-lg); display: flex; flex-wrap: wrap; gap: 8px;">
                ${steps.map((s, idx) => {
                    const num = idx + 1;
                    const isActive = num === this.guidedStep;
                    const isDone = num < this.guidedStep;
                    const label = s.title || `Etapa ${num}`;
                    return `
                        <div class="guided-pill ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}" data-guided-step="${num}" style="cursor: pointer;">
                            ${isDone ? '✓ ' : ''}${label}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    /* =========================================================================
     * Passo 1: Seleção do CardPack Principal
     * ========================================================================= */
    renderStep1() {
        const packs = this.getAvailablePacks();
        const isNoneSelected = this.selectedPackId === '__none__';

        return `
            <div class="card wizard-step-card" style="padding: var(--space-xl); background: var(--color-surface-card); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg);">
                <div class="wizard-section-header">
                    <div class="wizard-header-row" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: var(--space-md);">
                        <div>
                            <h2 class="wizard-title" style="margin: 0; color: var(--color-gold-light);">
                                📦 Escolha o CardPack Principal
                            </h2>
                            <p class="wizard-subtitle" style="margin-top: 4px; color: var(--color-text-muted);">
                                Selecione um CardPack de regras instalado ou crie uma ficha avulsa em branco para edição manual.
                            </p>
                        </div>
                        <div class="wizard-quick-actions">
                            <button type="button" id="btn-creator-upload-pack" class="btn btn-sm btn-secondary" title="Fazer upload de um arquivo .cardpack do computador">
                                📂 Fazer Upload de .cardpack
                            </button>
                            <input type="file" id="creator-file-input" accept=".cardpack,.json" style="display: none;">
                        </div>
                    </div>
                </div>

                <div class="creator-packs-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-md); margin-bottom: var(--space-lg);">
                    <!-- Opção Neutra: Sem CardPack / Ficha Manual em Branco -->
                    <div class="card creator-pack-card ${isNoneSelected ? 'is-selected' : ''}" data-pack-id="__none__" style="cursor: pointer; padding: 16px; border: 2px solid ${isNoneSelected ? 'var(--color-gold-primary)' : 'var(--color-border-subtle)'}; background: ${isNoneSelected ? 'rgba(212, 163, 115, 0.08)' : 'var(--color-surface-inset)'}; border-radius: var(--radius-md); transition: all 0.15s ease;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 1.4rem;">📄</span>
                                <strong style="color: var(--color-parchment-light); font-size: 1rem;">Ficha Manual em Branco</strong>
                            </div>
                            <input type="radio" name="creator-pack-radio" value="__none__" ${isNoneSelected ? 'checked' : ''} style="cursor: pointer;">
                        </div>
                        <div style="display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;">
                            <span class="sheet-meta-pill system-pill" style="font-size: 0.68rem; padding: 2px 6px;">Sem CardPack</span>
                            <span class="sheet-meta-pill race-pill" style="font-size: 0.68rem; padding: 2px 6px;">Edição Manual Livre</span>
                        </div>
                        <p style="font-size: 0.8rem; color: var(--color-text-muted); margin: 0; line-height: 1.35;">
                            Inicia uma ficha independente e limpa. Você pode criar ou adicionar cards manualmente depois.
                        </p>
                    </div>

                    ${packs.map(p => {
                        const isSelected = p.id === this.selectedPackId;
                        const count = Array.isArray(p.cards) ? p.cards.length : 0;
                        const config = this.getPackCreationConfig(p);
                        const hasWizard = config.wizards.length > 0;
                        const hasTemplates = config.templates.length > 0;

                        return `
                            <div class="card creator-pack-card ${isSelected ? 'is-selected' : ''}" data-pack-id="${p.id}" style="cursor: pointer; padding: 16px; border: 2px solid ${isSelected ? 'var(--color-gold-primary)' : 'var(--color-border-subtle)'}; background: ${isSelected ? 'rgba(212, 163, 115, 0.08)' : 'var(--color-surface-inset)'}; border-radius: var(--radius-md); transition: all 0.15s ease;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span style="font-size: 1.4rem;">📦</span>
                                        <strong style="color: var(--color-parchment-light); font-size: 1rem;">${p.name || p.pack_name || 'CardPack'}</strong>
                                    </div>
                                    <input type="radio" name="creator-pack-radio" value="${p.id}" ${isSelected ? 'checked' : ''} style="cursor: pointer;">
                                </div>
                                <div style="display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;">
                                    <span class="sheet-meta-pill system-pill" style="font-size: 0.68rem; padding: 2px 6px;">📜 ${p.system || p.system_name || 'Sistema Customizado'}</span>
                                    <span class="sheet-meta-pill race-pill" style="font-size: 0.68rem; padding: 2px 6px;">🃏 ${count} Cards</span>
                                    ${hasWizard ? '<span class="sheet-meta-pill origin-pill" style="font-size: 0.68rem; padding: 2px 6px; background: rgba(59,130,246,0.15); color: #60a5fa;">🧙 Assistente</span>' : ''}
                                    ${hasTemplates ? '<span class="sheet-meta-pill class-pill" style="font-size: 0.68rem; padding: 2px 6px; background: rgba(16,185,129,0.15); color: #34d399;">📋 Modelos</span>' : ''}
                                </div>
                                <p style="font-size: 0.8rem; color: var(--color-text-muted); margin: 0; line-height: 1.35;">
                                    ${p.desc || p.description || 'Pacote de regras para personagens.'}
                                </p>
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="wizard-footer" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px;">
                    <span style="font-size: 0.85rem; color: var(--color-text-muted);">Passo 1 de 2: Seleção de Regras</span>
                    <button type="button" id="btn-creator-next-step" class="btn btn-primary" ${!this.selectedPackId ? 'disabled' : ''} style="padding: 10px 24px; font-weight: 700;">
                        Avançar para Identidade & Modo ➔
                    </button>
                </div>
            </div>
        `;
    }

    /* =========================================================================
     * Passo 2: Identidade do Herói e Método de Criação (Dinâmico / Schema-Driven)
     * ========================================================================= */
    renderStep2() {
        const selectedPack = this.getSelectedPack();
        const config = this.getPackCreationConfig(selectedPack);

        const hasWizards = config.wizards.length > 0;
        const hasTemplates = config.templates.length > 0;
        const hasCustomModes = config.customModes.length > 0;
        const hasAnyConfiguredOptions = hasWizards || hasTemplates || hasCustomModes;

        if (!this.selectedWizardId && hasWizards) {
            this.selectedWizardId = config.wizards[0].id;
        }
        if (!this.selectedTemplateId && hasTemplates) {
            this.selectedTemplateId = config.templates[0].id;
        }

        const packTitle = selectedPack ? (selectedPack.name || selectedPack.pack_name || 'CardPack Selecionado') : 'Sem CardPack (Ficha Neutra)';

        return `
            <div class="card wizard-step-card" style="padding: var(--space-xl); background: var(--color-surface-card); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg);">
                <div class="wizard-section-header">
                    <h2 class="wizard-title" style="margin: 0; color: var(--color-gold-light);">
                        ⚔️ Identidade & Método de Criação
                    </h2>
                    <p class="wizard-subtitle" style="margin-top: 4px; color: var(--color-text-muted);">
                        Defina o nome do herói e o modo de criação a partir de <strong>${packTitle}</strong>.
                    </p>
                </div>

                <div style="display: flex; flex-direction: column; gap: var(--space-lg); margin-bottom: var(--space-xl);">
                    <!-- Campo de Nome do Herói -->
                    <div style="background: var(--color-surface-inset); padding: 18px; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md);">
                        <label style="display: block; font-size: 0.85rem; font-weight: 700; color: var(--color-gold-primary); margin-bottom: 6px;">
                            Nome do Personagem
                        </label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="input-creator-name" class="sheet-name-field" value="${this.characterName}" maxlength="32" placeholder="Nome do Herói" style="flex: 1; padding: 10px 14px; font-size: 1.1rem;">
                            <button type="button" id="btn-creator-random-name" class="btn btn-secondary" title="Gerar nome aleatório">
                                🎲 Aleatório
                            </button>
                        </div>
                    </div>

                    <!-- Modos de Inicialização da Ficha -->
                    <div>
                        <label style="display: block; font-size: 0.85rem; font-weight: 700; color: var(--color-gold-primary); margin-bottom: 10px;">
                            Opções de Criação Disponíveis
                        </label>

                        ${!hasAnyConfiguredOptions ? `
                            <!-- Caso Padrão: CardPack sem assistente/modelo configurado ou sem pacote -> Modo Manual Direto -->
                            <div style="background: var(--color-surface-inset); border: 1px dashed var(--color-border-subtle); border-radius: var(--radius-md); padding: 24px; text-align: center;">
                                <div style="font-size: 2.2rem; margin-bottom: 8px;">⚙️</div>
                                <h3 style="color: var(--color-parchment-light); margin: 0 0 6px 0;">Configuração Manual Direta</h3>
                                <p style="color: var(--color-text-muted); font-size: 0.85rem; max-width: 520px; margin: 0 auto 16px auto; line-height: 1.4;">
                                    ${!selectedPack 
                                        ? 'Esta ficha será criada em branco sem regras de CardPack vinculadas. Você terá controle manual total para adicionar cards, recursos e fórmulas.'
                                        : 'Este CardPack não possui assistentes nem fichas modelo pré-configurados. A ficha será inicializada imediatamente para você equipar e configurar manualmente os cards do compêndio.'}
                                </p>
                                <span class="badge" style="background: rgba(34, 197, 94, 0.15); color: #4ade80;">Modo Manual Padrão Ativo</span>
                            </div>
                        ` : `
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-md);">
                                <!-- 1. Assistente(s) Guiado(s) se configurado(s) no pacote -->
                                ${hasWizards ? config.wizards.map(w => {
                                    const isThisWizard = this.creationMode === 'guided' && (this.selectedWizardId === w.id);
                                    const stepCount = Array.isArray(w.steps) ? w.steps.length : 0;
                                    return `
                                        <div class="card creator-mode-option ${isThisWizard ? 'is-selected' : ''}" data-mode="guided" data-wizard-id="${w.id}" style="cursor: pointer; padding: 18px; border: 2px solid ${isThisWizard ? 'var(--color-gold-primary)' : 'var(--color-border-subtle)'}; background: ${isThisWizard ? 'rgba(212, 163, 115, 0.08)' : 'var(--color-surface-inset)'}; border-radius: var(--radius-md); transition: all 0.15s ease;">
                                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                                <div style="display: flex; align-items: center; gap: 8px;">
                                                    <span style="font-size: 1.4rem;">${w.icon || '🧙‍♂️'}</span>
                                                    <strong style="color: var(--color-gold-light); font-size: 1.05rem;">${w.name}</strong>
                                                </div>
                                                <span class="badge" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; font-size: 0.7rem;">${stepCount} Etapas</span>
                                            </div>
                                            <p style="font-size: 0.82rem; color: var(--color-text-muted); line-height: 1.4; margin: 0;">
                                                ${w.desc || 'Assistente passo a passo configurado pelas regras deste CardPack.'}
                                            </p>
                                        </div>
                                    `;
                                }).join('') : ''}
                                }).join('') : ''}

                                <!-- 2. Ficha(s) Modelo se configurada(s) no pacote -->
                                ${hasTemplates ? `
                                    <div class="card creator-mode-option ${this.creationMode === 'template' ? 'is-selected' : ''}" data-mode="template" style="cursor: pointer; padding: 18px; border: 2px solid ${this.creationMode === 'template' ? 'var(--color-gold-primary)' : 'var(--color-border-subtle)'}; background: ${this.creationMode === 'template' ? 'rgba(212, 163, 115, 0.08)' : 'var(--color-surface-inset)'}; border-radius: var(--radius-md); transition: all 0.15s ease;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <span style="font-size: 1.4rem;">📋</span>
                                                <strong style="color: var(--color-gold-light); font-size: 1.05rem;">Ficha Modelo (Template)</strong>
                                            </div>
                                            <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 0.7rem;">Pronto para Jogar</span>
                                        </div>
                                        <p style="font-size: 0.82rem; color: var(--color-text-muted); line-height: 1.4; margin: 0 0 10px 0;">
                                            Inicializa uma ficha pré-construída oferecida por este CardPack.
                                        </p>
                                        ${this.creationMode === 'template' ? `
                                            <select id="select-creator-template" class="sheet-number-field" style="width: 100%; padding: 8px; font-size: 0.85rem; text-align: left;">
                                                ${config.templates.map(t => `<option value="${t.id}" ${this.selectedTemplateId === t.id ? 'selected' : ''}>${t.name} — ${t.desc || ''}</option>`).join('')}
                                            </select>
                                        ` : ''}
                                    </div>
                                ` : ''}

                                <!-- 3. Modos Customizados adicionais se houver -->
                                ${hasCustomModes ? config.customModes.map(cm => {
                                    const isSelected = this.creationMode === cm.id;
                                    return `
                                        <div class="card creator-mode-option ${isSelected ? 'is-selected' : ''}" data-mode="${cm.id}" style="cursor: pointer; padding: 18px; border: 2px solid ${isSelected ? 'var(--color-gold-primary)' : 'var(--color-border-subtle)'}; background: ${isSelected ? 'rgba(212, 163, 115, 0.08)' : 'var(--color-surface-inset)'}; border-radius: var(--radius-md); transition: all 0.15s ease;">
                                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                                <div style="display: flex; align-items: center; gap: 8px;">
                                                    <span style="font-size: 1.4rem;">${cm.icon || '✨'}</span>
                                                    <strong style="color: var(--color-gold-light); font-size: 1.05rem;">${cm.name}</strong>
                                                </div>
                                            </div>
                                            <p style="font-size: 0.82rem; color: var(--color-text-muted); line-height: 1.4; margin: 0;">
                                                ${cm.desc || ''}
                                            </p>
                                        </div>
                                    `;
                                }).join('') : ''}

                                <!-- 4. Opção Manual Livre (Sempre permitida para controle total) -->
                                ${config.allowManual ? `
                                    <div class="card creator-mode-option ${this.creationMode === 'manual' || this.creationMode === 'direct' ? 'is-selected' : ''}" data-mode="manual" style="cursor: pointer; padding: 18px; border: 2px solid ${this.creationMode === 'manual' || this.creationMode === 'direct' ? 'var(--color-gold-primary)' : 'var(--color-border-subtle)'}; background: ${this.creationMode === 'manual' || this.creationMode === 'direct' ? 'rgba(212, 163, 115, 0.08)' : 'var(--color-surface-inset)'}; border-radius: var(--radius-md); transition: all 0.15s ease;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <span style="font-size: 1.4rem;">⚙️</span>
                                                <strong style="color: var(--color-gold-light); font-size: 1.05rem;">Configuração Manual com Cards</strong>
                                            </div>
                                            <span class="badge" style="background: rgba(255, 255, 255, 0.1); color: var(--color-text-muted); font-size: 0.7rem;">Controle Total</span>
                                        </div>
                                        <p style="font-size: 0.82rem; color: var(--color-text-muted); line-height: 1.4; margin: 0;">
                                            Pula assistentes e modelos, abrindo a ficha diretamente para edição manual através do compêndio de cards.
                                        </p>
                                    </div>
                                ` : ''}
                            </div>
                        `}
                    </div>
                </div>

                <!-- Rodapé com Botões de Ação -->
                <div class="wizard-footer" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px;">
                    <button type="button" id="btn-creator-prev-step" class="btn btn-secondary">
                        ⬅️ Voltar ao Passo 1
                    </button>
                    <button type="button" id="btn-creator-finish" class="btn btn-primary" style="padding: 10px 28px; font-weight: 800; font-size: 1rem;">
                        ${this.creationMode === 'guided' 
                            ? `🧙 Iniciar ${this.getActiveWizard()?.name || 'Assistente'} ➔`
                            : (this.creationMode === 'template' 
                                ? '📋 Criar Ficha do Modelo & Jogar'
                                : '🚀 Criar Ficha e Começar Edição Manual')}
                    </button>
                </div>
            </div>
        `;
    }

    /* =========================================================================
     * Assistente Guiado: Máquina de Passos 100% Data-Driven (Schema-Driven)
     * ========================================================================= */
    renderGuidedStep(stepNum) {
        const steps = this.getActiveSteps();
        if (steps.length === 0) {
            return `
                <div class="card wizard-step-card" style="padding: var(--space-xl); text-align: center;">
                    <h3>Nenhum assistente configurado neste CardPack</h3>
                    <button type="button" class="btn btn-primary" id="btn-guided-fallback-finish">Finalizar em Modo Manual</button>
                </div>
            `;
        }

        const stepIndex = Math.max(0, Math.min(stepNum - 1, steps.length - 1));
        const step = steps[stepIndex];

        // Roteamento dinâmico pelo tipo de passo especificado no schema do pacote
        if (step.type === 'concept' || step.key === 'concept') {
            return this.renderStepType_Concept(step, stepIndex + 1, steps.length);
        } else if (step.type === 'attributes' || step.key === 'attributes') {
            return this.renderStepType_Attributes(step, stepIndex + 1, steps.length);
        } else if (step.type === 'class_choice' || step.key === 'class') {
            return this.renderStepType_Class(step, stepIndex + 1, steps.length);
        } else if (step.type === 'equipment_select' || step.key === 'equipment') {
            return this.renderStepType_Equipment(step, stepIndex + 1, steps.length);
        } else if (step.type === 'summary' || step.key === 'finishing') {
            return this.renderStepType_Summary(step, stepIndex + 1, steps.length);
        } else {
            // Passo de Escolha Única Genérica (Raça, Origem, Divindade, Facção, etc.)
            return this.renderStepType_SingleChoice(step, stepIndex + 1, steps.length);
        }
    }

    /* --- Tipo de Etapa: Conceito do Personagem --- */
    renderStepType_Concept(step, num, total) {
        const suggestions = Array.isArray(step.suggestions) ? step.suggestions : [];

        return `
            <div class="card wizard-step-card" style="padding: var(--space-xl); background: var(--color-surface-card); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg);">
                <div class="wizard-section-header">
                    <span class="sheet-meta-pill system-pill" style="font-size: 0.72rem; margin-bottom: 6px;">Etapa ${num} de ${total} • ${step.title || 'Conceito'}</span>
                    <h2 class="wizard-title" style="margin: 0; color: var(--color-gold-light);">
                        📜 ${step.title || 'Conceito do Personagem'}
                    </h2>
                    <p class="wizard-subtitle" style="margin-top: 4px; color: var(--color-text-muted);">
                        ${step.subtitle || 'Defina a essência do seu personagem, seu arquétipo e motivações.'}
                    </p>
                </div>

                <div style="display: flex; flex-direction: column; gap: var(--space-lg); margin-bottom: var(--space-xl);">
                    <div style="background: var(--color-surface-inset); padding: 16px; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md);">
                        <label style="display: block; font-size: 0.85rem; font-weight: 700; color: var(--color-gold-primary); margin-bottom: 6px;">
                            Nome do Personagem
                        </label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="guided-input-name" class="sheet-name-field" value="${this.characterData.name}" maxlength="32" placeholder="Nome do Herói" style="flex: 1; padding: 10px 14px; font-size: 1.1rem;">
                            <button type="button" id="btn-guided-random-name" class="btn btn-secondary">🎲 Aleatório</button>
                        </div>
                    </div>

                    <div style="background: var(--color-surface-inset); padding: 16px; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md);">
                        <label style="display: block; font-size: 0.85rem; font-weight: 700; color: var(--color-gold-primary); margin-bottom: 6px;">
                            Conceito em Uma Frase
                        </label>
                        <input type="text" id="guided-input-concept" value="${this.characterData.concept}" placeholder="Ex: Guerreiro veterano em busca de glória e aventura" style="width: 100%; padding: 10px 14px; background: rgba(0,0,0,0.25); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-sm); color: var(--color-text-main); font-size: 0.95rem;">
                        ${suggestions.length > 0 ? `
                            <div style="display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;">
                                ${suggestions.map(s => `
                                    <span class="badge concept-pill" data-concept="${s.concept || s.desc || s}" style="cursor: pointer; background: var(--color-surface-card);">
                                        ${s.label || s}
                                    </span>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>

                    <div style="background: var(--color-surface-inset); padding: 16px; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md);">
                        <label style="display: block; font-size: 0.85rem; font-weight: 700; color: var(--color-gold-primary); margin-bottom: 6px;">
                            Aparência & Personalidade (Opcional)
                        </label>
                        <textarea id="guided-input-details" rows="3" placeholder="Traços físicos marcantes, vestimentas ou temperamento..." style="width: 100%; padding: 10px 14px; background: rgba(0,0,0,0.25); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-sm); color: var(--color-text-main); font-family: inherit; font-size: 0.9rem;">${this.characterData.details}</textarea>
                    </div>
                </div>

                ${this.renderGuidedFooter(num, total)}
            </div>
        `;
    }

    /* --- Tipo de Etapa: Atributos Básicos --- */
    renderStepType_Attributes(step, num, total) {
        const rules = step.rules || {};
        const totalPoints = rules.point_buy?.points !== undefined ? rules.point_buy.points : 10;
        const spent = this.calcPointBuySpent();
        const pointsLeft = totalPoints - spent;
        const isPointBuy = this.characterData.attrMethod === 'point_buy';

        const attrList = Array.isArray(step.attributes) && step.attributes.length > 0 ? step.attributes : [
            { key: 'for', abbr: 'FOR', name: 'Força', desc: 'Poder muscular, impacto e carga.' },
            { key: 'des', abbr: 'DES', name: 'Destreza', desc: 'Agilidade, reflexos e pontaria.' },
            { key: 'con', abbr: 'CON', name: 'Constituição', desc: 'Vigor, saúde e Pontos de Vida.' },
            { key: 'int', abbr: 'INT', name: 'Inteligência', desc: 'Raciocínio, memória e perícias.' },
            { key: 'sab', abbr: 'SAB', name: 'Sabedoria', desc: 'Percepção e força de vontade.' },
            { key: 'car', abbr: 'CAR', name: 'Carisma', desc: 'Presença social e liderança.' }
        ];

        return `
            <div class="card wizard-step-card" style="padding: var(--space-xl); background: var(--color-surface-card); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg);">
                <div class="wizard-section-header">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
                        <div>
                            <span class="sheet-meta-pill system-pill" style="font-size: 0.72rem; margin-bottom: 6px;">Etapa ${num} de ${total} • ${step.title || 'Atributos'}</span>
                            <h2 class="wizard-title" style="margin: 0; color: var(--color-gold-light);">
                                🎲 ${step.title || 'Atributos Básicos'}
                            </h2>
                            <p class="wizard-subtitle" style="margin-top: 4px; color: var(--color-text-muted);">
                                ${step.subtitle || 'Distribua seus pontos de atributo para definir o potencial do seu personagem.'}
                            </p>
                        </div>

                        <!-- Contador de Pontos -->
                        <div style="background: ${pointsLeft >= 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; border: 2px solid ${pointsLeft >= 0 ? '#22c55e' : '#ef4444'}; border-radius: var(--radius-md); padding: 10px 16px; text-align: center;">
                            <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted);">Pontos Restantes</div>
                            <div style="font-family: var(--font-heading); font-size: 1.8rem; font-weight: 800; color: ${pointsLeft >= 0 ? '#4ade80' : '#f87171'};">
                                ${pointsLeft} / ${totalPoints}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Seletor de Método de Atributos -->
                <div style="display: flex; gap: 10px; margin-bottom: var(--space-lg);">
                    <button type="button" class="btn btn-sm ${isPointBuy ? 'btn-primary' : 'btn-secondary'} btn-attr-mode" data-mode="point_buy">
                        ⚖️ Compra de Pontos
                    </button>
                    <button type="button" class="btn btn-sm ${!isPointBuy ? 'btn-primary' : 'btn-secondary'} btn-attr-mode" data-mode="rolls">
                        🎲 Rolar Dados
                    </button>
                </div>

                ${!isPointBuy ? `
                    <div style="background: var(--color-surface-inset); padding: 14px 18px; border-radius: var(--radius-md); margin-bottom: var(--space-lg); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <strong style="color: var(--color-gold-light);">Rolagem Aleatória</strong>
                            <p style="font-size: 0.8rem; color: var(--color-text-muted); margin: 2px 0 0 0;">
                                Rola os dados do sistema e atribui automaticamente aos atributos.
                            </p>
                        </div>
                        <button type="button" id="btn-roll-attributes" class="btn btn-accent" style="font-weight: 700;">
                            🎲 Rolar Todos os Atributos
                        </button>
                    </div>
                ` : ''}

                <!-- Grade de Atributos -->
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-md); margin-bottom: var(--space-xl);">
                    ${attrList.map(attr => {
                        const val = this.characterData.attributes[attr.key] !== undefined ? this.characterData.attributes[attr.key] : 0;
                        const cost = this.costTable[String(val)] !== undefined ? this.costTable[String(val)] : val;
                        return `
                            <div class="card" style="padding: 16px; background: var(--color-surface-inset); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); display: flex; flex-direction: column; justify-content: space-between;">
                                <div>
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                        <strong style="color: var(--color-gold-light); font-size: 1.1rem;">${attr.abbr || attr.key.toUpperCase()} &bull; ${attr.name}</strong>
                                        <span class="badge" style="font-size: 0.75rem; background: rgba(0,0,0,0.3);">Custo: ${cost} pts</span>
                                    </div>
                                    <p style="font-size: 0.8rem; color: var(--color-text-muted); margin: 0 0 14px 0; min-height: 28px;">
                                        ${attr.desc || ''}
                                    </p>
                                </div>
                                <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.25); padding: 8px 12px; border-radius: var(--radius-sm);">
                                    <button type="button" class="btn btn-sm btn-secondary btn-attr-dec" data-attr="${attr.key}" ${val <= -1 ? 'disabled' : ''} style="width: 32px; font-weight: 800;">-</button>
                                    <span style="font-family: var(--font-heading); font-size: 1.6rem; font-weight: 800; color: ${val > 0 ? '#4ade80' : (val < 0 ? '#f87171' : 'var(--color-parchment-light)')};">
                                        ${val >= 0 ? `+${val}` : val}
                                    </span>
                                    <button type="button" class="btn btn-sm btn-secondary btn-attr-inc" data-attr="${attr.key}" ${val >= 4 ? 'disabled' : ''} style="width: 32px; font-weight: 800;">+</button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                ${this.renderGuidedFooter(num, total)}
            </div>
        `;
    }

    /* --- Tipo de Etapa: Escolha de Classe --- */
    renderStepType_Class(step, num, total) {
        const classOptions = Array.isArray(step.options) ? step.options : [];
        const selectedClass = classOptions.find(c => c.key === this.characterData.classKey) || classOptions[0] || null;

        return `
            <div class="card wizard-step-card" style="padding: var(--space-xl); background: var(--color-surface-card); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg);">
                <div class="wizard-section-header">
                    <span class="sheet-meta-pill system-pill" style="font-size: 0.72rem; margin-bottom: 6px;">Etapa ${num} de ${total} • ${step.title || 'Classe'}</span>
                    <h2 class="wizard-title" style="margin: 0; color: var(--color-gold-light);">
                        ⚔️ ${step.title || 'Escolha sua Classe'}
                    </h2>
                    <p class="wizard-subtitle" style="margin-top: 4px; color: var(--color-text-muted);">
                        ${step.subtitle || 'Sua classe determina seu papel no grupo, treinamento em perícias e recursos vitais.'}
                    </p>
                </div>

                <!-- Grade de Seleção de Classes -->
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--space-md); margin-bottom: var(--space-xl);">
                    ${classOptions.map(cls => {
                        const isSelected = cls.key === this.characterData.classKey;
                        return `
                            <div class="card guided-card ${isSelected ? 'is-selected' : ''}" data-class="${cls.key}" style="cursor: pointer; padding: 16px; border: 2px solid ${isSelected ? 'var(--color-gold-primary)' : 'var(--color-border-subtle)'}; background: ${isSelected ? 'rgba(212, 163, 115, 0.08)' : 'var(--color-surface-inset)'}; border-radius: var(--radius-md); transition: all 0.15s ease;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                                    <strong style="color: var(--color-parchment-light); font-size: 1.05rem;">${cls.name}</strong>
                                    <input type="radio" name="guided-class-radio" value="${cls.key}" ${isSelected ? 'checked' : ''}>
                                </div>
                                <div style="display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;">
                                    ${cls.pv_base ? `<span class="badge" style="background: rgba(239,68,68,0.2); color: #f87171; font-size: 0.7rem;">PV Base: ${cls.pv_base}</span>` : ''}
                                    ${cls.pm_base ? `<span class="badge" style="background: rgba(59,130,246,0.2); color: #60a5fa; font-size: 0.7rem;">PM Base: ${cls.pm_base}</span>` : ''}
                                </div>
                                <p style="font-size: 0.8rem; color: var(--color-text-muted); margin: 0; line-height: 1.35;">
                                    ${cls.desc || ''}
                                </p>
                            </div>
                        `;
                    }).join('')}
                </div>

                ${selectedClass?.fixed_skills?.length ? `
                    <div style="background: var(--color-surface-inset); padding: 16px; border-radius: var(--radius-md); margin-bottom: var(--space-xl);">
                        <strong style="color: var(--color-gold-light); font-size: 0.95rem; display: block; margin-bottom: 8px;">
                            Perícias Treinadas da Classe:
                        </strong>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            ${selectedClass.fixed_skills.map(sk => `
                                <span class="badge" style="background: rgba(34,197,94,0.15); color: #4ade80;">✓ ${this.formatKey(sk)}</span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                ${this.renderGuidedFooter(num, total)}
            </div>
        `;
    }

    /* --- Tipo de Etapa: Escolha Única Genérica (Raça, Origem, Divindade, Facção, etc.) --- */
    renderStepType_SingleChoice(step, num, total) {
        const options = Array.isArray(step.options) ? step.options : [];
        const stateKey = `${step.key}Key`; // ex: raceKey, originKey, deityKey
        const currentVal = this.characterData[stateKey] || (options.length > 0 ? options[0].key : '');

        return `
            <div class="card wizard-step-card" style="padding: var(--space-xl); background: var(--color-surface-card); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg);">
                <div class="wizard-section-header">
                    <span class="sheet-meta-pill system-pill" style="font-size: 0.72rem; margin-bottom: 6px;">Etapa ${num} de ${total} • ${step.title || step.key}</span>
                    <h2 class="wizard-title" style="margin: 0; color: var(--color-gold-light);">
                        ${step.title || 'Escolha uma Opção'}
                    </h2>
                    <p class="wizard-subtitle" style="margin-top: 4px; color: var(--color-text-muted);">
                        ${step.subtitle || 'Selecione uma opção para incorporar à sua ficha de personagem.'}
                    </p>
                </div>

                <!-- Opções Dinâmicas do Pacote -->
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-md); margin-bottom: var(--space-xl);">
                    ${options.map(opt => {
                        const isSelected = opt.key === currentVal;
                        return `
                            <div class="card guided-card ${isSelected ? 'is-selected' : ''}" data-step-key="${step.key}" data-option-key="${opt.key}" style="cursor: pointer; padding: 16px; border: 2px solid ${isSelected ? 'var(--color-gold-primary)' : 'var(--color-border-subtle)'}; background: ${isSelected ? 'rgba(212, 163, 115, 0.08)' : 'var(--color-surface-inset)'}; border-radius: var(--radius-md); transition: all 0.15s ease;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                                    <strong style="color: var(--color-parchment-light); font-size: 1.05rem;">${opt.name}</strong>
                                    <input type="radio" name="guided-${step.key}-radio" value="${opt.key}" ${isSelected ? 'checked' : ''}>
                                </div>
                                <p style="font-size: 0.8rem; color: var(--color-text-muted); margin: 0; line-height: 1.35;">
                                    ${opt.desc || ''}
                                </p>
                            </div>
                        `;
                    }).join('')}
                </div>

                ${this.renderGuidedFooter(num, total)}
            </div>
        `;
    }

    /* --- Tipo de Etapa: Equipamento Inicial --- */
    renderStepType_Equipment(step, num, total) {
        const options = step.options || {};
        const martialWeapons = Array.isArray(options.weapons_martial) ? options.weapons_martial : [];
        const simpleWeapons = Array.isArray(options.weapons_simple) ? options.weapons_simple : [];
        const armors = [...(options.armors_light || []), ...(options.armors_heavy || [])];
        const shields = Array.isArray(options.shields) ? options.shields : [];

        const selectedWeapon = this.characterData.selectedWeapons[0] || (martialWeapons[0] || simpleWeapons[0] || '');

        return `
            <div class="card wizard-step-card" style="padding: var(--space-xl); background: var(--color-surface-card); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg);">
                <div class="wizard-section-header">
                    <span class="sheet-meta-pill system-pill" style="font-size: 0.72rem; margin-bottom: 6px;">Etapa ${num} de ${total} • ${step.title || 'Equipamento'}</span>
                    <h2 class="wizard-title" style="margin: 0; color: var(--color-gold-light);">
                        ⚔️ ${step.title || 'Equipamento Inicial'}
                    </h2>
                    <p class="wizard-subtitle" style="margin-top: 4px; color: var(--color-text-muted);">
                        ${step.subtitle || 'Escolha seu armamento, proteção e itens de sobrevivência.'}
                    </p>
                </div>

                <div style="display: flex; flex-direction: column; gap: var(--space-lg); margin-bottom: var(--space-xl);">
                    <!-- Arma Principal -->
                    <div style="background: var(--color-surface-inset); padding: 16px; border-radius: var(--radius-md);">
                        <label style="display: block; font-size: 0.85rem; font-weight: 700; color: var(--color-gold-primary); margin-bottom: 6px;">
                            Arma Principal
                        </label>
                        <select id="select-guided-weapon" class="sheet-number-field" style="width: 100%; padding: 8px; font-size: 0.9rem; text-align: left;">
                            ${[...martialWeapons, ...simpleWeapons].map(w => `
                                <option value="${w}" ${selectedWeapon === w ? 'selected' : ''}>${this.formatKey(w)}</option>
                            `).join('')}
                        </select>
                    </div>

                    <!-- Armadura -->
                    ${armors.length > 0 ? `
                        <div style="background: var(--color-surface-inset); padding: 16px; border-radius: var(--radius-md);">
                            <label style="display: block; font-size: 0.85rem; font-weight: 700; color: var(--color-gold-primary); margin-bottom: 6px;">
                                Armadura
                            </label>
                            <select id="select-guided-armor" class="sheet-number-field" style="width: 100%; padding: 8px; font-size: 0.9rem; text-align: left;">
                                <option value="nenhuma" ${this.characterData.selectedArmor === 'nenhuma' ? 'selected' : ''}>Nenhuma</option>
                                ${armors.map(a => `
                                    <option value="${a}" ${this.characterData.selectedArmor === a ? 'selected' : ''}>${this.formatKey(a)}</option>
                                `).join('')}
                            </select>
                        </div>
                    ` : ''}

                    <!-- Escudo -->
                    ${shields.length > 0 ? `
                        <div style="background: var(--color-surface-inset); padding: 16px; border-radius: var(--radius-md);">
                            <label style="display: block; font-size: 0.85rem; font-weight: 700; color: var(--color-gold-primary); margin-bottom: 6px;">
                                Escudo (Opcional)
                            </label>
                            <select id="select-guided-shield" class="sheet-number-field" style="width: 100%; padding: 8px; font-size: 0.9rem; text-align: left;">
                                <option value="nenhum" ${this.characterData.selectedShield === 'nenhum' ? 'selected' : ''}>Nenhum</option>
                                ${shields.map(s => `
                                    <option value="${s}" ${this.characterData.selectedShield === s ? 'selected' : ''}>${this.formatKey(s)}</option>
                                `).join('')}
                            </select>
                        </div>
                    ` : ''}
                </div>

                ${this.renderGuidedFooter(num, total)}
            </div>
        `;
    }

    /* --- Tipo de Etapa: Revisão Final & Início do Jogo --- */
    renderStepType_Summary(step, num, total) {
        const finalAttrs = this.calcFinalAttributes();
        const derived = this.calcDerivedStats(finalAttrs);

        return `
            <div class="card wizard-step-card" style="padding: var(--space-xl); background: var(--color-surface-card); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg);">
                <div class="wizard-section-header">
                    <span class="sheet-meta-pill system-pill" style="font-size: 0.72rem; margin-bottom: 6px;">Etapa ${num} de ${total} • ${step.title || 'Toques Finais'}</span>
                    <h2 class="wizard-title" style="margin: 0; color: var(--color-gold-light);">
                        ✨ ${step.title || 'Revisão dos Toques Finais'}
                    </h2>
                    <p class="wizard-subtitle" style="margin-top: 4px; color: var(--color-text-muted);">
                        ${step.subtitle || 'Confira os atributos e valores derivados calculados antes de ir para a sua ficha.'}
                    </p>
                </div>

                <!-- Estatísticas Derivadas Calculadas -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-md); margin-bottom: var(--space-xl);">
                    <div class="guided-stat-box" style="background: var(--color-surface-inset); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); padding: 16px; text-align: center;">
                        <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--color-text-muted); font-weight: 700;">Defesa Total</span>
                        <div style="font-family: var(--font-heading); font-size: 2.2rem; font-weight: 800; color: #60a5fa;">${derived.defesa}</div>
                    </div>
                    <div class="guided-stat-box" style="background: var(--color-surface-inset); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); padding: 16px; text-align: center;">
                        <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--color-text-muted); font-weight: 700;">Pontos de Vida (PV)</span>
                        <div style="font-family: var(--font-heading); font-size: 2.2rem; font-weight: 800; color: #f87171;">${derived.pv}</div>
                    </div>
                    <div class="guided-stat-box" style="background: var(--color-surface-inset); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); padding: 16px; text-align: center;">
                        <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--color-text-muted); font-weight: 700;">Pontos de Mana (PM)</span>
                        <div style="font-family: var(--font-heading); font-size: 2.2rem; font-weight: 800; color: #a78bfa;">${derived.pm}</div>
                    </div>
                </div>

                ${this.renderGuidedFooter(num, total)}
            </div>
        `;
    }

    renderGuidedFooter(num, total) {
        const isFirst = num === 1;
        const isLast = num === total;

        return `
            <div class="wizard-footer" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px;">
                <button type="button" id="btn-guided-prev" class="btn btn-secondary">
                    ${isFirst ? '⬅️ Voltar às Opções de Criação' : '⬅️ Etapa Anterior'}
                </button>
                <button type="button" id="btn-guided-next" class="btn btn-primary" style="padding: 10px 24px; font-weight: 800;">
                    ${isLast ? '✨ Concluir Ficha & Jogar' : 'Próxima Etapa ➔'}
                </button>
            </div>
        `;
    }

    /* =========================================================================
     * Cálculos e Métodos Auxiliares
     * ========================================================================= */
    calcPointBuySpent() {
        let total = 0;
        for (const [k, v] of Object.entries(this.characterData.attributes)) {
            const cost = this.costTable[String(v)] !== undefined ? this.costTable[String(v)] : v;
            total += cost;
        }
        return total;
    }

    roll4d6Attributes() {
        const rollOne = () => {
            const dice = [
                Math.floor(Math.random() * 6) + 1,
                Math.floor(Math.random() * 6) + 1,
                Math.floor(Math.random() * 6) + 1,
                Math.floor(Math.random() * 6) + 1
            ];
            dice.sort((a, b) => a - b);
            const sum = dice[1] + dice[2] + dice[3];
            return Math.floor((sum - 10) / 2);
        };

        const attrs = {};
        for (const k of Object.keys(this.characterData.attributes)) {
            attrs[k] = rollOne();
        }
        this.characterData.attributes = attrs;
        this.render();
    }

    calcFinalAttributes() {
        const finalAttrs = { ...this.characterData.attributes };
        const steps = this.getActiveSteps();
        const raceStep = steps.find(s => s.key === 'race' || s.type === 'single_choice');
        const raceOpt = raceStep?.options?.find(r => r.key === this.characterData.raceKey);

        if (raceOpt?.mods) {
            for (const [attr, mod] of Object.entries(raceOpt.mods)) {
                if (finalAttrs[attr] !== undefined) {
                    finalAttrs[attr] += mod;
                }
            }
        }

        if (Array.isArray(this.characterData.raceBonusAttrs)) {
            for (const attr of this.characterData.raceBonusAttrs) {
                if (finalAttrs[attr] !== undefined) {
                    finalAttrs[attr] += 1;
                }
            }
        }

        return finalAttrs;
    }

    calcDerivedStats(finalAttrs) {
        const steps = this.getActiveSteps();
        const classStep = steps.find(s => s.key === 'class' || s.type === 'class_choice');
        const classOpt = classStep?.options?.find(c => c.key === this.characterData.classKey);

        const des = finalAttrs?.des || 0;
        const con = finalAttrs?.con || 0;

        let armorDef = 0;
        if (this.characterData.selectedArmor === 'couro_batido') armorDef = 3;
        else if (this.characterData.selectedArmor === 'armadura_couro') armorDef = 2;
        else if (this.characterData.selectedArmor === 'brunea') armorDef = 5;
        else if (this.characterData.selectedArmor === 'cota_malha') armorDef = 6;

        let shieldDef = 0;
        if (this.characterData.selectedShield === 'escudo_pesado') shieldDef = 2;
        else if (this.characterData.selectedShield === 'escudo_leve') shieldDef = 1;

        const pvBase = classOpt?.pv_base || 16;
        const pmBase = classOpt?.pm_base || 4;

        return {
            defesa: 10 + des + armorDef + shieldDef,
            pv: pvBase + con,
            pm: pmBase
        };
    }

    formatKey(key) {
        if (!key) return '';
        return key.replace(/^(raca_|deus_|origem_|armadura_|escudo_)/, '')
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, l => l.toUpperCase());
    }

    /* =========================================================================
     * Finalização de Criação (Manual, Modelo e Assistente)
     * ========================================================================= */
    finishCreation() {
        const selectedPack = this.getSelectedPack();
        const charName = this.characterName || 'Novo Herói';
        const sysName = selectedPack?.system || selectedPack?.system_name || 'Sistema Neutro';

        if (this.creationMode === 'template' && this.selectedTemplateId) {
            this.createFromTemplate(selectedPack, this.selectedTemplateId);
            return;
        }

        // Criação Direta / Manual
        this.createDirectCharacter(selectedPack);
    }

    createDirectCharacter(selectedPack) {
        const charName = this.characterName || 'Novo Herói';
        const sysName = selectedPack?.system || selectedPack?.system_name || 'Sistema Neutro';

        this.engine.initDeck(charName, sysName);

        if (selectedPack && Array.isArray(selectedPack.cards) && selectedPack.cards.length > 0) {
            this.engine.importCardPack(selectedPack, false);
            this.engine.setCharacterName(charName);
            this.engine.setSystemName(sysName);
        }

        this.engine.recalculate();
        this.persistAndNavigate(charName, sysName);
    }

    createFromTemplate(selectedPack, templateId) {
        const charName = this.characterName || 'Novo Herói';
        const sysName = selectedPack?.system || selectedPack?.system_name || 'Sistema Neutro';
        const config = this.getPackCreationConfig(selectedPack);
        const template = config.templates.find(t => t.id === templateId);

        this.engine.initDeck(charName, sysName);

        if (template && Array.isArray(template.cards)) {
            this.engine.importCardPack({
                pack_name: `${charName} (${template.name})`,
                system_name: sysName,
                cards: template.cards
            }, false);
        } else if (selectedPack && Array.isArray(selectedPack.cards)) {
            this.engine.importCardPack(selectedPack, false);
        }

        this.engine.setCharacterName(charName);
        this.engine.setSystemName(sysName);
        this.engine.recalculate();
        this.persistAndNavigate(charName, sysName);
    }

    finishGuidedCreation() {
        const pack = this.getSelectedPack();
        const charName = this.characterData.name || this.characterName || 'Novo Herói';
        const sysName = pack?.system || pack?.system_name || 'Sistema Aberto';
        const packCards = Array.isArray(pack?.cards) ? pack.cards : [];

        const finalAttrs = this.calcFinalAttributes();
        const derived = this.calcDerivedStats(finalAttrs);

        const customCards = [];
        let cardId = 1;

        // 1. Atributos
        for (const [k, v] of Object.entries(finalAttrs)) {
            const packCard = packCards.find(c => c.key === k && c.type === 0);
            customCards.push({
                id: cardId++,
                type: 0,
                key: k,
                name: packCard ? packCard.name : this.formatKey(k),
                desc: packCard ? packCard.desc : `Modificador de ${k.toUpperCase()}`,
                base: v,
                curr: v,
                max: v,
                equipped: 1,
                fav: 1
            });
        }

        // 2. Recursos PV e PM
        customCards.push({
            id: cardId++,
            type: 1,
            key: 'pv',
            name: 'Pontos de Vida',
            desc: 'Saúde física e vigor.',
            base: derived.pv,
            curr: derived.pv,
            max: derived.pv,
            equipped: 1,
            fav: 1
        });

        customCards.push({
            id: cardId++,
            type: 1,
            key: 'pm',
            name: 'Pontos de Mana',
            desc: 'Energia mágica e foco heroico.',
            base: derived.pm,
            curr: derived.pm,
            max: derived.pm,
            equipped: 1,
            fav: 1
        });

        // 3. Defesa Dinâmica
        const defCard = packCards.find(c => c.key === 'defesa');
        customCards.push({
            id: cardId++,
            type: 2,
            key: 'defesa',
            name: 'Defesa',
            desc: 'Dificuldade para acertar ataques contra você.',
            formula: defCard ? defCard.formula : '10 + @des',
            equipped: 1,
            fav: 1
        });

        // 4. Perícias do CardPack
        const packSkills = packCards.filter(c => c.type === 3);
        for (const sk of packSkills) {
            const isTrained = this.characterData.trainedSkills.includes(sk.key) ? 1 : 0;
            customCards.push({
                id: cardId++,
                type: 3,
                key: sk.key,
                name: sk.name,
                desc: sk.desc,
                formula: sk.formula || `@${sk.cost_res || 'des'}`,
                trained: isTrained,
                equipped: 1,
                fav: isTrained
            });
        }

        // 5. Raça
        if (this.characterData.raceKey) {
            const raceCard = packCards.find(c => c.key === this.characterData.raceKey);
            customCards.push({
                id: cardId++,
                type: 7,
                key: this.characterData.raceKey,
                name: raceCard ? raceCard.name : this.formatKey(this.characterData.raceKey),
                desc: raceCard ? raceCard.desc : 'Traços raciais.',
                equipped: 1,
                fav: 0
            });
        }

        // 6. Classe
        if (this.characterData.classKey) {
            const classCard = packCards.find(c => c.key === this.characterData.classKey);
            customCards.push({
                id: cardId++,
                type: 7,
                key: this.characterData.classKey,
                name: classCard ? classCard.name : this.formatKey(this.characterData.classKey),
                desc: classCard ? classCard.desc : 'Habilidades de classe.',
                equipped: 1,
                fav: 0
            });
        }

        // 7. Origem
        if (this.characterData.originKey) {
            const originCard = packCards.find(c => c.key === this.characterData.originKey);
            customCards.push({
                id: cardId++,
                type: 7,
                key: this.characterData.originKey,
                name: originCard ? originCard.name : this.formatKey(this.characterData.originKey),
                desc: originCard ? originCard.desc : 'Benefícios de origem.',
                equipped: 1,
                fav: 0
            });
        }

        // 8. Divindade
        if (this.characterData.deityKey && this.characterData.deityKey !== 'deus_nenhum') {
            const deityCard = packCards.find(c => c.key === this.characterData.deityKey);
            customCards.push({
                id: cardId++,
                type: 4,
                key: this.characterData.deityKey,
                name: deityCard ? deityCard.name : this.formatKey(this.characterData.deityKey),
                desc: deityCard ? deityCard.desc : 'Poder divino concedido.',
                equipped: 1,
                fav: 0
            });
        }

        // 9. Equipamentos
        if (this.characterData.selectedWeapons.length > 0) {
            const wKey = this.characterData.selectedWeapons[0];
            const wCard = packCards.find(c => c.key === wKey);
            customCards.push({
                id: cardId++,
                type: 5,
                key: wKey,
                name: wCard ? wCard.name : this.formatKey(wKey),
                desc: wCard ? wCard.desc : 'Arma.',
                formula: wCard ? wCard.formula : '1d8 + @for',
                equipped: 1,
                fav: 1
            });
        }

        if (this.characterData.selectedArmor && this.characterData.selectedArmor !== 'nenhuma') {
            const aKey = this.characterData.selectedArmor;
            const aCard = packCards.find(c => c.key === aKey);
            customCards.push({
                id: cardId++,
                type: 5,
                key: aKey,
                name: aCard ? aCard.name : this.formatKey(aKey),
                desc: aCard ? aCard.desc : 'Armadura protetora.',
                equipped: 1,
                fav: 0,
                mods: aCard?.mods || [{ target: 'defesa', val: 2 }]
            });
        }

        if (this.characterData.selectedShield && this.characterData.selectedShield !== 'nenhum') {
            const sKey = this.characterData.selectedShield;
            const sCard = packCards.find(c => c.key === sKey);
            customCards.push({
                id: cardId++,
                type: 5,
                key: sKey,
                name: sCard ? sCard.name : this.formatKey(sKey),
                desc: sCard ? sCard.desc : 'Escudo protetor.',
                equipped: 1,
                fav: 0,
                mods: sCard?.mods || [{ target: 'defesa', val: 1 }]
            });
        }

        // Importa no motor C
        const generatedPack = {
            pack_name: `${charName} — Ficha Inicial`,
            system_name: sysName,
            version: '2.0.0',
            cards: customCards
        };
        this.engine.importCardPack(generatedPack, false);
        this.engine.setCharacterName(charName);
        this.engine.setSystemName(sysName);
        this.engine.recalculate();

        this.persistAndNavigate(charName, sysName);
    }

    persistAndNavigate(charName, sysName) {
        if (typeof window !== 'undefined' && window.characterStorage && typeof window.characterStorage.saveCurrent === 'function') {
            try {
                window.characterStorage.saveCurrent(this.engine, charName);
            } catch (err) {
                console.warn('[Creator] Falha ao persistir no storage:', err);
            }
        }

        if (typeof this.onCharacterCreated === 'function') {
            this.onCharacterCreated({
                name: charName,
                system: sysName,
                cardCount: this.engine.getCardCount()
            });
        }

        if (typeof window !== 'undefined' && window.sheetView) {
            window.sheetView.showingRoster = false;
            window.sheetView.sheetMode = 'play';
            window.sheetView.render();
        }

        if (this.router && typeof this.router.navigate === 'function') {
            this.router.navigate('sheet');
        }
    }

    /* =========================================================================
     * Event Listeners
     * ========================================================================= */
    setupEventListeners() {
        if (!this.container) return;

        // Seleção de CardPack no Passo 1
        this.container.querySelectorAll('.creator-pack-card').forEach(card => {
            card.addEventListener('click', () => {
                const pId = card.dataset.packId;
                if (pId) {
                    this.selectedPackId = pId;
                    this.syncPackDefaults();
                    this.render();
                }
            });
        });

        // Avançar para Passo 2
        const btnNext = document.getElementById('btn-creator-next-step');
        if (btnNext) {
            btnNext.addEventListener('click', () => {
                if (this.selectedPackId) {
                    this.currentStep = 2;
                    this.render();
                }
            });
        }

        // Voltar para Passo 1
        const btnPrev = document.getElementById('btn-creator-prev-step');
        if (btnPrev) {
            btnPrev.addEventListener('click', () => {
                this.currentStep = 1;
                this.render();
            });
        }

        // Nome no Passo 2
        const nameInput = document.getElementById('input-creator-name');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.characterName = e.target.value.trim() || 'Novo Herói';
                this.characterData.name = this.characterName;
            });
        }

        const btnRandom = document.getElementById('btn-creator-random-name');
        if (btnRandom && nameInput) {
            btnRandom.addEventListener('click', () => {
                const r = this.getRandomName();
                this.characterName = r;
                this.characterData.name = r;
                nameInput.value = r;
            });
        }

        // Seleção de Modo no Passo 2
        this.container.querySelectorAll('.creator-mode-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                if (e.target && (e.target.tagName === 'SELECT' || e.target.tagName === 'OPTION')) return;
                this.creationMode = opt.dataset.mode;
                if (opt.dataset.wizardId) {
                    this.selectedWizardId = opt.dataset.wizardId;
                }
                this.render();
            });
        });

        // Select de Template
        const tplSelect = document.getElementById('select-creator-template');
        if (tplSelect) {
            tplSelect.addEventListener('change', (e) => {
                this.selectedTemplateId = e.target.value;
            });
        }

        // Botão de Ação do Passo 2
        const btnFinish = document.getElementById('btn-creator-finish');
        if (btnFinish) {
            btnFinish.addEventListener('click', () => {
                if (this.creationMode === 'guided') {
                    this.startGuidedWizard();
                } else {
                    this.finishCreation();
                }
            });
        }

        // Pílulas de Navegação do Assistente
        this.container.querySelectorAll('.guided-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                const targetStep = parseInt(pill.dataset.guidedStep, 10);
                if (targetStep) {
                    this.guidedStep = targetStep;
                    this.render();
                }
            });
        });

        // Voltar no Assistente
        const btnGuidedPrev = document.getElementById('btn-guided-prev');
        if (btnGuidedPrev) {
            btnGuidedPrev.addEventListener('click', () => {
                if (this.guidedStep === 1) {
                    this.currentStep = 2;
                } else {
                    this.guidedStep -= 1;
                }
                this.render();
            });
        }

        // Avançar no Assistente
        const btnGuidedNext = document.getElementById('btn-guided-next');
        if (btnGuidedNext) {
            btnGuidedNext.addEventListener('click', () => {
                const totalSteps = this.getActiveSteps().length;
                if (this.guidedStep >= totalSteps) {
                    this.finishGuidedCreation();
                } else {
                    this.guidedStep += 1;
                    this.render();
                }
            });
        }

        // Fallback Finish se não houver etapas
        const btnFallbackFinish = document.getElementById('btn-guided-fallback-finish');
        if (btnFallbackFinish) {
            btnFallbackFinish.addEventListener('click', () => this.finishCreation());
        }

        // Eventos de Etapa: Conceito
        const gName = document.getElementById('guided-input-name');
        if (gName) {
            gName.addEventListener('input', (e) => {
                this.characterData.name = e.target.value.trim() || 'Novo Herói';
                this.characterName = this.characterData.name;
            });
        }

        const btnGRand = document.getElementById('btn-guided-random-name');
        if (btnGRand && gName) {
            btnGRand.addEventListener('click', () => {
                const r = this.getRandomName();
                this.characterData.name = r;
                this.characterName = r;
                gName.value = r;
            });
        }

        const gConcept = document.getElementById('guided-input-concept');
        if (gConcept) {
            gConcept.addEventListener('input', (e) => {
                this.characterData.concept = e.target.value.trim();
            });
        }

        this.container.querySelectorAll('.concept-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                const c = pill.dataset.concept;
                if (c && gConcept) {
                    this.characterData.concept = c;
                    gConcept.value = c;
                }
            });
        });

        const gDetails = document.getElementById('guided-input-details');
        if (gDetails) {
            gDetails.addEventListener('input', (e) => {
                this.characterData.details = e.target.value.trim();
            });
        }

        // Eventos de Etapa: Atributos
        this.container.querySelectorAll('.btn-attr-mode').forEach(btn => {
            btn.addEventListener('click', () => {
                this.characterData.attrMethod = btn.dataset.mode;
                this.render();
            });
        });

        const btnRoll = document.getElementById('btn-roll-attributes');
        if (btnRoll) {
            btnRoll.addEventListener('click', () => this.roll4d6Attributes());
        }

        this.container.querySelectorAll('.btn-attr-inc').forEach(btn => {
            btn.addEventListener('click', () => {
                const k = btn.dataset.attr;
                if (k && this.characterData.attributes[k] < 4) {
                    const curVal = this.characterData.attributes[k];
                    const nextCost = this.costTable[String(curVal + 1)] || (curVal + 1);
                    const curCost = this.costTable[String(curVal)] || curVal;
                    const diff = nextCost - curCost;
                    if (this.calcPointBuySpent() + diff <= 10) {
                        this.characterData.attributes[k] += 1;
                        this.render();
                    }
                }
            });
        });

        this.container.querySelectorAll('.btn-attr-dec').forEach(btn => {
            btn.addEventListener('click', () => {
                const k = btn.dataset.attr;
                if (k && this.characterData.attributes[k] > -1) {
                    this.characterData.attributes[k] -= 1;
                    this.render();
                }
            });
        });

        // Eventos de Etapa: Escolha Única Genérica
        this.container.querySelectorAll('.guided-card[data-step-key]').forEach(card => {
            card.addEventListener('click', () => {
                const sKey = card.dataset.stepKey;
                const oKey = card.dataset.optionKey;
                if (sKey && oKey) {
                    this.characterData[`${sKey}Key`] = oKey;
                    this.render();
                }
            });
        });

        // Eventos de Etapa: Classe
        this.container.querySelectorAll('.guided-card[data-class]').forEach(card => {
            card.addEventListener('click', () => {
                this.characterData.classKey = card.dataset.class;
                const steps = this.getActiveSteps();
                const clsStep = steps.find(s => s.key === 'class' || s.type === 'class_choice');
                const clsOpt = clsStep?.options?.find(c => c.key === card.dataset.class);
                if (clsOpt?.fixed_skills) {
                    this.characterData.trainedSkills = [...clsOpt.fixed_skills];
                }
                this.render();
            });
        });

        // Eventos de Etapa: Equipamento
        const wSelect = document.getElementById('select-guided-weapon');
        if (wSelect) {
            wSelect.addEventListener('change', (e) => {
                this.characterData.selectedWeapons = [e.target.value];
            });
        }

        const aSelect = document.getElementById('select-guided-armor');
        if (aSelect) {
            aSelect.addEventListener('change', (e) => {
                this.characterData.selectedArmor = e.target.value;
            });
        }

        const sSelect = document.getElementById('select-guided-shield');
        if (sSelect) {
            sSelect.addEventListener('change', (e) => {
                this.characterData.selectedShield = e.target.value;
            });
        }
    }
}

// Suporte a ambientes Web e Node.js
if (typeof window !== 'undefined') {
    window.WizardView = WizardView;
    window.CharacterCreatorView = WizardView;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WizardView, CharacterCreatorView: WizardView };
}
