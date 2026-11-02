/**
 * wizard.js — Assistente Passo-a-Passo de Criação de Personagem (RPG-SheetC)
 * Integrado ao Motor C99 (WebAssembly)
 */

class WizardView {
    constructor(engine, router, onCharacterCreated) {
        this.engine = engine;
        this.router = router;
        this.onCharacterCreated = onCharacterCreated;

        this.currentStep = 1;
        this.totalSteps = 3;

        // Estado do personagem em criação
        this.state = {
            name: 'Valeros',
            raceId: 0,
            classId: 8,
            attributes: [14, 12, 14, 10, 10, 10], // FOR, DES, CON, INT, SAB, CAR
            diceRolls: [null, null, null, null, null, null]
        };

        // Raças migradas do C (sheet_t20.h)
        this.races = [
            {
                id: 0,
                name: 'Humano',
                icon: '👤',
                bonusText: '+1 em 3 atributos',
                bonusDesc: 'Versatilidade incomparável, perícia e poderes extras.'
            },
            {
                id: 1,
                name: 'Elfo',
                icon: '🧝',
                bonusText: '+2 INT, +1 DES, -1 CON',
                bonusDesc: 'Graça arcana e sentidos aguçados na penumbra.'
            },
            {
                id: 2,
                name: 'Anão',
                icon: '🧔',
                bonusText: '+2 CON, +1 SAB, -1 DES',
                bonusDesc: 'Resistência pétrea, PV bônus e afinidade com metais.'
            },
            {
                id: 3,
                name: 'Goblin',
                icon: '👺',
                bonusText: '+2 DES, +1 INT, -1 CAR',
                bonusDesc: 'Engenhoso, ágil e acostumado a sobreviver no subterrâneo.'
            },
            {
                id: 4,
                name: 'Minotauro',
                icon: '🐂',
                bonusText: '+2 FOR, +1 CON, -1 SAB',
                bonusDesc: 'Força formidável, chifres pontiagudos e couro rígido (+1 Defesa).'
            },
            {
                id: 5,
                name: 'Draconato',
                icon: '🐲',
                bonusText: '+2 FOR, +1 CAR, -1 DES',
                bonusDesc: 'Descendência de dragões, escamas protetoras e baforada elemental.'
            }
        ];

        // Classes oficiais migradas do C (sheet_t20.c)
        this.classes = [
            { id: 0, name: 'Arcanista', icon: '🔮', pvBase: 8, pmBase: 6, role: 'Conjurador Arcano' },
            { id: 1, name: 'Bárbaro', icon: '🪓', pvBase: 24, pmBase: 3, role: 'Fúria & Vigor' },
            { id: 2, name: 'Bardo', icon: '🪕', pvBase: 12, pmBase: 4, role: 'Especialista & Inspiração' },
            { id: 3, name: 'Bucaneiro', icon: '⚓', pvBase: 16, pmBase: 3, role: 'Agilidade & Bravata' },
            { id: 4, name: 'Caçador', icon: '🏹', pvBase: 16, pmBase: 4, role: 'Rastreador & Disparos' },
            { id: 5, name: 'Cavaleiro', icon: '🛡️', pvBase: 20, pmBase: 3, role: 'Defensor & Honra' },
            { id: 6, name: 'Clérigo', icon: '✝️', pvBase: 16, pmBase: 5, role: 'Conjurador Divino' },
            { id: 7, name: 'Druida', icon: '🌿', pvBase: 16, pmBase: 4, role: 'Natureza & Metamorfose' },
            { id: 8, name: 'Guerreiro', icon: '⚔️', pvBase: 20, pmBase: 3, role: 'Maestria em Combate' },
            { id: 9, name: 'Inventor', icon: '⚙️', pvBase: 12, pmBase: 4, role: 'Engenhosidade & Alquimia' },
            { id: 10, name: 'Ladino', icon: '🗡️', pvBase: 12, pmBase: 4, role: 'Furtividade & Perícias' },
            { id: 11, name: 'Lutador', icon: '🥊', pvBase: 20, pmBase: 3, role: 'Desarmado & Briga' },
            { id: 12, name: 'Nobre', icon: '👑', pvBase: 16, pmBase: 4, role: 'Presença & Liderança' },
            { id: 13, name: 'Paladino', icon: '⚜️', pvBase: 20, pmBase: 3, role: 'Campeão Sagrado' }
        ];

        // 6 Atributos canônicos
        this.attributesMeta = [
            { id: 0, name: 'Força', abbr: 'FOR', desc: 'Poder físico e carga' },
            { id: 1, name: 'Destreza', abbr: 'DES', desc: 'Agilidade, reflexos e pontaria' },
            { id: 2, name: 'Constituição', abbr: 'CON', desc: 'Saúde, vigor e PV' },
            { id: 3, name: 'Inteligência', abbr: 'INT', desc: 'Raciocínio e perícias' },
            { id: 4, name: 'Sabedoria', abbr: 'SAB', desc: 'Percepção e vontade' },
            { id: 5, name: 'Carisma', abbr: 'CAR', desc: 'Presença e persuasão' }
        ];

        this.fantasyNames = [
            'Valeros', 'Kaelen', 'Lorien', 'Thalor', 'Gwendolyn',
            'Brogor', 'Doran', 'Lyra', 'Aelir', 'Durgoth',
            'Sariel', 'Morgran', 'Vanya', 'Zadok', 'Elora',
            'Theron', 'Cassian', 'Jareth', 'Mirena', 'Branok'
        ];

        this.container = null;
    }

    /**
     * Inicializa a view do Wizard no elemento de container
     */
    init(containerId = 'wizard-container') {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.render();
    }

    /**
     * Reseta o wizard para nova criação
     */
    reset(initialRaceId = 0, initialClassId = 8) {
        this.currentStep = 1;
        this.state = {
            name: this.getRandomName(),
            raceId: initialRaceId,
            classId: initialClassId,
            attributes: [14, 12, 14, 10, 10, 10],
            diceRolls: [null, null, null, null, null, null]
        };
        this.render();
    }

    /**
     * Retorna nome aleatório de fantasia
     */
    getRandomName() {
        const idx = Math.floor(Math.random() * this.fantasyNames.length);
        return this.fantasyNames[idx];
    }

    /**
     * Calcula modificador de atributo no padrão canônico de Tormenta 20
     */
    calcModifier(val) {
        if (val >= 10) {
            return Math.floor((val - 10) / 2);
        } else {
            return Math.floor((val - 11) / 2);
        }
    }

    formatMod(mod) {
        return mod >= 0 ? `+${mod}` : `${mod}`;
    }

    /**
     * Renderiza o assistente completo
     */
    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="wizard-wrapper">
                <!-- Barra de Progresso / Stepper -->
                <div class="wizard-stepper">
                    <div class="wizard-step ${this.currentStep === 1 ? 'active' : ''} ${this.currentStep > 1 ? 'completed' : ''}" data-step="1">
                        <div class="step-num">${this.currentStep > 1 ? '✓' : '1'}</div>
                        <div class="step-label">Identidade & Classe</div>
                    </div>
                    <div class="wizard-step-line ${this.currentStep > 1 ? 'completed' : ''}"></div>
                    <div class="wizard-step ${this.currentStep === 2 ? 'active' : ''} ${this.currentStep > 2 ? 'completed' : ''}" data-step="2">
                        <div class="step-num">${this.currentStep > 2 ? '✓' : '2'}</div>
                        <div class="step-label">Atributos & Dados</div>
                    </div>
                    <div class="wizard-step-line ${this.currentStep > 2 ? 'completed' : ''}"></div>
                    <div class="wizard-step ${this.currentStep === 3 ? 'active' : ''}" data-step="3">
                        <div class="step-num">3</div>
                        <div class="step-label">Resumo & Finalização</div>
                    </div>
                </div>

                <!-- Conteúdo do Passo Ativo -->
                <div class="wizard-content card">
                    <div id="wizard-step-body"></div>
                </div>

                <!-- Barra de Navegação Inferior -->
                <div class="wizard-footer">
                    <button id="btn-wizard-prev" class="btn" ${this.currentStep === 1 ? 'disabled' : ''}>
                        ← Voltar
                    </button>
                    <div class="wizard-step-indicator">
                        Passo <strong>${this.currentStep}</strong> de ${this.totalSteps}
                    </div>
                    ${this.currentStep < 3 ? `
                        <button id="btn-wizard-next" class="btn btn-primary">
                            Avançar →
                        </button>
                    ` : `
                        <button id="btn-wizard-finish" class="btn btn-primary">
                            ⚔️ Concluir e Criar no Motor C
                        </button>
                    `}
                </div>
            </div>
        `;

        this.setupStepperEvents();
        this.renderCurrentStepBody();
    }

    /**
     * Configura eventos de navegação
     */
    setupStepperEvents() {
        const btnPrev = document.getElementById('btn-wizard-prev');
        if (btnPrev) {
            btnPrev.addEventListener('click', () => {
                if (this.currentStep > 1) {
                    this.currentStep--;
                    this.render();
                }
            });
        }

        const btnNext = document.getElementById('btn-wizard-next');
        if (btnNext) {
            btnNext.addEventListener('click', () => {
                if (this.validateCurrentStep()) {
                    if (this.currentStep < this.totalSteps) {
                        this.currentStep++;
                        this.render();
                    }
                }
            });
        }

        const btnFinish = document.getElementById('btn-wizard-finish');
        if (btnFinish) {
            btnFinish.addEventListener('click', () => {
                this.finishCreation();
            });
        }
    }

    /**
     * Valida os campos da etapa atual antes de avançar
     */
    validateCurrentStep() {
        if (this.currentStep === 1) {
            const nameInput = document.getElementById('wizard-char-name');
            if (nameInput) {
                const val = nameInput.value.trim();
                if (!val) {
                    alert('Por favor, informe o nome do seu personagem.');
                    nameInput.focus();
                    return false;
                }
                this.state.name = val;
            }
        }
        return true;
    }

    /**
     * Renderiza o corpo do passo atual
     */
    renderCurrentStepBody() {
        const bodyEl = document.getElementById('wizard-step-body');
        if (!bodyEl) return;

        if (this.currentStep === 1) {
            this.renderStep1(bodyEl);
        } else if (this.currentStep === 2) {
            this.renderStep2(bodyEl);
        } else if (this.currentStep === 3) {
            this.renderStep3(bodyEl);
        }
    }

    /* =========================================================================
     * Passo 1: Nome, Raça e Classe
     * ========================================================================= */

    renderStep1(container) {
        container.innerHTML = `
            <div class="wizard-section-header">
                <h3 class="wizard-title">Identidade do Aventureiro</h3>
                <p class="wizard-subtitle">Defina o nome, a linhagem ancestral e a vocação heroica do seu personagem.</p>
            </div>

            <!-- Campo de Nome -->
            <div class="form-group wizard-name-group">
                <label for="wizard-char-name" class="form-label">Nome do Personagem</label>
                <div class="input-with-button">
                    <input type="text" id="wizard-char-name" class="form-input" value="${this.state.name}" maxlength="30" placeholder="Ex: Sir Galahad, Valeros, etc.">
                    <button type="button" id="btn-wizard-random-name" class="btn" title="Gera um nome de fantasia aleatório">
                        🎲 Nome Aleatório
                    </button>
                </div>
            </div>

            <!-- Seleção de Raça -->
            <div class="wizard-choice-section">
                <div class="choice-section-header">
                    <label class="form-label">Escolha a Raça</label>
                    <span class="choice-counter">6 opções disponíveis do Tormenta 20</span>
                </div>
                <div class="races-grid">
                    ${this.races.map(r => `
                        <div class="choice-card ${this.state.raceId === r.id ? 'selected' : ''}" data-race-id="${r.id}">
                            <div class="choice-icon">${r.icon}</div>
                            <div class="choice-content">
                                <div class="choice-name">${r.name}</div>
                                <div class="choice-badge">${r.bonusText}</div>
                                <div class="choice-desc">${r.bonusDesc}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Seleção de Classe -->
            <div class="wizard-choice-section" style="margin-top: var(--space-lg);">
                <div class="choice-section-header">
                    <label class="form-label">Escolha a Classe Oficial</label>
                    <span class="choice-counter">14 classes oficiais compiladas no C</span>
                </div>
                <div class="classes-grid">
                    ${this.classes.map(c => `
                        <div class="choice-card class-card-mini ${this.state.classId === c.id ? 'selected' : ''}" data-class-id="${c.id}">
                            <div class="choice-header-mini">
                                <span class="choice-icon-mini">${c.icon}</span>
                                <span class="choice-name-mini">${c.name}</span>
                            </div>
                            <div class="choice-role">${c.role}</div>
                            <div class="choice-stats-mini">
                                <span class="stat-tag-pv">PV: ${c.pvBase}</span>
                                <span class="stat-tag-pm">PM: ${c.pmBase}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Input nome
        const nameInput = document.getElementById('wizard-char-name');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.state.name = e.target.value;
            });
        }

        // Botão nome aleatório
        const btnRand = document.getElementById('btn-wizard-random-name');
        if (btnRand && nameInput) {
            btnRand.addEventListener('click', () => {
                const newName = this.getRandomName();
                this.state.name = newName;
                nameInput.value = newName;
            });
        }

        // Cards de Raça
        const raceCards = container.querySelectorAll('.choice-card[data-race-id]');
        raceCards.forEach(card => {
            card.addEventListener('click', () => {
                const raceId = parseInt(card.dataset.raceId, 10);
                this.state.raceId = raceId;
                raceCards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            });
        });

        // Cards de Classe
        const classCards = container.querySelectorAll('.choice-card[data-class-id]');
        classCards.forEach(card => {
            card.addEventListener('click', () => {
                const classId = parseInt(card.dataset.classId, 10);
                this.state.classId = classId;
                classCards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            });
        });
    }

    /* =========================================================================
     * Passo 2: Atributos & Rolador 4d6
     * ========================================================================= */

    renderStep2(container) {
        container.innerHTML = `
            <div class="wizard-section-header">
                <div class="wizard-header-row">
                    <div>
                        <h3 class="wizard-title">Atributos Básicos</h3>
                        <p class="wizard-subtitle">Ajuste os valores manualmente ou role <strong>4d6 descartando o menor</strong> via motor C.</p>
                    </div>
                    <div class="wizard-quick-actions">
                        <button type="button" id="btn-roll-all-attrs" class="btn btn-primary" title="Rola 4d6 para todos os 6 atributos usando o PRNG Xorshift32 do C">
                            🎲 Rolar Todos (4d6)
                        </button>
                        <button type="button" id="btn-standard-array" class="btn" title="Aplica a distribuição padrão de T20 (18, 14, 13, 12, 10, 8)">
                            ⚖️ Array Padrão
                        </button>
                        <button type="button" id="btn-reset-attrs" class="btn" title="Reseta todos para 10">
                            🔄 Resetar (10)
                        </button>
                    </div>
                </div>
            </div>

            <!-- Grade de Atributos -->
            <div class="wizard-attributes-grid" id="wizard-attrs-grid">
                <!-- Renderizado dinamicamente -->
            </div>
        `;

        this.renderStep2AttributesList();

        // Ações de topo
        const btnRollAll = document.getElementById('btn-roll-all-attrs');
        if (btnRollAll) {
            btnRollAll.addEventListener('click', () => {
                this.rollAllAttributes();
            });
        }

        const btnStandard = document.getElementById('btn-standard-array');
        if (btnStandard) {
            btnStandard.addEventListener('click', () => {
                this.applyStandardArray();
            });
        }

        const btnReset = document.getElementById('btn-reset-attrs');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                this.state.attributes = [10, 10, 10, 10, 10, 10];
                this.state.diceRolls = [null, null, null, null, null, null];
                this.renderStep2AttributesList();
            });
        }
    }

    renderStep2AttributesList() {
        const grid = document.getElementById('wizard-attrs-grid');
        if (!grid) return;

        grid.innerHTML = this.attributesMeta.map(attr => {
            const val = this.state.attributes[attr.id];
            const mod = this.calcModifier(val);
            const rollInfo = this.state.diceRolls[attr.id];

            return `
                <div class="wizard-attr-card" data-attr-id="${attr.id}">
                    <div class="wizard-attr-top">
                        <div class="wizard-attr-info">
                            <span class="wizard-attr-abbr">${attr.abbr}</span>
                            <span class="wizard-attr-name">${attr.name}</span>
                        </div>
                        <div class="wizard-attr-mod ${mod >= 0 ? 'mod-positive' : 'mod-negative'}">
                            ${this.formatMod(mod)}
                        </div>
                    </div>

                    <div class="wizard-attr-desc">${attr.desc}</div>

                    <div class="wizard-attr-controls">
                        <button type="button" class="btn-stepper btn-stepper-minus" data-attr-id="${attr.id}" title="Diminuir">-</button>
                        <input type="number" class="wizard-attr-input" data-attr-id="${attr.id}" value="${val}" min="3" max="22">
                        <button type="button" class="btn-stepper btn-stepper-plus" data-attr-id="${attr.id}" title="Aumentar">+</button>
                        <button type="button" class="btn btn-roll-single" data-attr-id="${attr.id}" title="Rolar 4d6 descartando o menor no motor C">
                            🎲 Rolar 4d6
                        </button>
                    </div>

                    ${rollInfo ? `
                        <div class="wizard-roll-badge">
                            <span class="roll-badge-label">C 4d6:</span>
                            <div class="roll-dice-tags">
                                ${rollInfo.rolls.map((r, i) => `
                                    <span class="die-tag ${i === rollInfo.droppedIndex ? 'die-dropped' : 'die-kept'}">${r}</span>
                                `).join('')}
                            </div>
                            <span class="roll-sum">= <strong>${rollInfo.total}</strong></span>
                        </div>
                    ` : `
                        <div class="wizard-roll-placeholder">Valor manual / inicial</div>
                    `}
                </div>
            `;
        }).join('');

        // Eventos dos steppers e inputs
        grid.querySelectorAll('.btn-stepper-minus').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.attrId, 10);
                if (this.state.attributes[id] > 3) {
                    this.state.attributes[id]--;
                    this.state.diceRolls[id] = null;
                    this.renderStep2AttributesList();
                }
            });
        });

        grid.querySelectorAll('.btn-stepper-plus').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.attrId, 10);
                if (this.state.attributes[id] < 22) {
                    this.state.attributes[id]++;
                    this.state.diceRolls[id] = null;
                    this.renderStep2AttributesList();
                }
            });
        });

        grid.querySelectorAll('.wizard-attr-input').forEach(inp => {
            inp.addEventListener('change', (e) => {
                const id = parseInt(inp.dataset.attrId, 10);
                let val = parseInt(e.target.value, 10);
                if (isNaN(val)) val = 10;
                if (val < 3) val = 3;
                if (val > 22) val = 22;
                this.state.attributes[id] = val;
                this.state.diceRolls[id] = null;
                this.renderStep2AttributesList();
            });
        });

        grid.querySelectorAll('.btn-roll-single').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.attrId, 10);
                this.rollAttribute(id);
            });
        });
    }

    /**
     * Rola 4d6 descartando o menor para um atributo específico através do motor C
     */
    rollAttribute(attrId) {
        if (!this.engine || !this.engine.isLoaded) {
            alert('Aguardando inicialização do motor WebAssembly...');
            return;
        }

        // Executa 4d6 no motor C
        const rollResult = this.engine.rollDice(4, 6, 0);
        if (!rollResult || !rollResult.rolls || rollResult.rolls.length < 4) return;

        const rolls = [...rollResult.rolls];
        
        // Localiza índice do menor dado para descarte
        let minIdx = 0;
        for (let i = 1; i < rolls.length; i++) {
            if (rolls[i] < rolls[minIdx]) {
                minIdx = i;
            }
        }

        // Soma os 3 dados mais altos
        let total = 0;
        for (let i = 0; i < rolls.length; i++) {
            if (i !== minIdx) {
                total += rolls[i];
            }
        }

        this.state.attributes[attrId] = total;
        this.state.diceRolls[attrId] = {
            rolls: rolls,
            droppedIndex: minIdx,
            total: total
        };

        this.renderStep2AttributesList();
    }

    /**
     * Rola 4d6 para todos os 6 atributos usando o motor C
     */
    rollAllAttributes() {
        for (let i = 0; i < 6; i++) {
            this.rollAttribute(i);
        }
    }

    /**
     * Aplica o array clássico de Tormenta 20
     */
    applyStandardArray() {
        // Distribuição padrão heroica: 18, 14, 13, 12, 10, 8
        this.state.attributes = [18, 14, 13, 12, 10, 8];
        this.state.diceRolls = [null, null, null, null, null, null];
        this.renderStep2AttributesList();
    }

    /* =========================================================================
     * Passo 3: Resumo e Confirmação
     * ========================================================================= */

    renderStep3(container) {
        const selectedRace = this.races.find(r => r.id === this.state.raceId) || this.races[0];
        const selectedClass = this.classes.find(c => c.id === this.state.classId) || this.classes[8];

        const conMod = this.calcModifier(this.state.attributes[2]);
        const desMod = this.calcModifier(this.state.attributes[1]);

        const estimatedPv = Math.max(1, selectedClass.pvBase + conMod);
        const estimatedPm = Math.max(1, selectedClass.pmBase);
        const estimatedDefesa = 10 + desMod + (selectedRace.id === 4 ? 1 : 0); // Minotauro ganha +1 couro

        container.innerHTML = `
            <div class="wizard-section-header">
                <h3 class="wizard-title">Resumo do Herói</h3>
                <p class="wizard-subtitle">Revise todos os parâmetros calculados antes de instanciar a ficha completa no motor C.</p>
            </div>

            <div class="wizard-summary-card">
                <!-- Cabeçalho do Personagem -->
                <div class="summary-identity">
                    <div class="summary-avatar">${selectedRace.icon}</div>
                    <div class="summary-info">
                        <h4 class="summary-name">${this.state.name || 'Sem Nome'}</h4>
                        <div class="summary-tags">
                            <span class="summary-tag">⚔️ ${selectedRace.name}</span>
                            <span class="summary-tag">🛡️ ${selectedClass.name}</span>
                            <span class="summary-tag">⭐ Nível 1</span>
                            <span class="summary-tag">📜 Tormenta 20</span>
                        </div>
                    </div>
                </div>

                <!-- Estimativas de Combate no Nível 1 -->
                <div class="summary-combat-grid">
                    <div class="summary-combat-box pv-box">
                        <span class="combat-box-title">Pontos de Vida (PV)</span>
                        <div class="combat-box-val">${estimatedPv}</div>
                        <span class="combat-box-formula">Base ${selectedClass.pvBase} + CON (${this.formatMod(conMod)})</span>
                    </div>

                    <div class="summary-combat-box pm-box">
                        <span class="combat-box-title">Pontos de Mana (PM)</span>
                        <div class="combat-box-val">${estimatedPm}</div>
                        <span class="combat-box-formula">Base da Classe ${selectedClass.name}</span>
                    </div>

                    <div class="summary-combat-box def-box">
                        <span class="combat-box-title">Defesa Passiva</span>
                        <div class="combat-box-val">${estimatedDefesa}</div>
                        <span class="combat-box-formula">10 + DES (${this.formatMod(desMod)})${selectedRace.id === 4 ? ' + Couro (1)' : ''}</span>
                    </div>
                </div>

                <!-- Tabela de Atributos Finais -->
                <div class="summary-attrs-section">
                    <h5 class="summary-section-title">Atributos e Modificadores Finais</h5>
                    <div class="summary-attrs-grid">
                        ${this.attributesMeta.map(attr => {
                            const val = this.state.attributes[attr.id];
                            const mod = this.calcModifier(val);
                            return `
                                <div class="summary-attr-pill">
                                    <span class="attr-pill-name">${attr.abbr}</span>
                                    <span class="attr-pill-val">${val}</span>
                                    <span class="attr-pill-mod ${mod >= 0 ? 'mod-positive' : 'mod-negative'}">${this.formatMod(mod)}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Aviso do Motor C -->
                <div class="summary-c-notice">
                    <span>⚡</span>
                    <div>
                        Ao clicar em concluir, a struct <code>T20Sheet</code> será inicializada na memória linear do WebAssembly,
                        recalculando todas as 29 perícias treinadas, limites e salvamentos.
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Finaliza a criação e envia todos os dados ao Motor C
     */
    finishCreation() {
        if (!this.engine || !this.engine.isLoaded) {
            alert('Erro: O motor C (WebAssembly) ainda não está carregado.');
            return;
        }

        const { name, raceId, classId, attributes } = this.state;
        const finalName = (name || 'Herói').trim();

        // 1. Instancia ficha limpa no C com raça e classe selecionadas
        this.engine.newDefaultCharacter(raceId, classId);

        // 2. Define o nome na memória linear
        this.engine.setCharacterName(finalName);

        // 3. Aplica os 6 atributos (dispara t20_recalculate automaticamente no C)
        for (let i = 0; i < 6; i++) {
            this.engine.setAttribute(i, attributes[i]);
        }

        // 4. Executa callback de atualização da ficha
        if (typeof this.onCharacterCreated === 'function') {
            this.onCharacterCreated({
                name: finalName,
                raceId: raceId,
                classId: classId,
                pv: this.engine.getPvAtual(),
                pvMax: this.engine.getPvMax(),
                pm: this.engine.getPmAtual(),
                pmMax: this.engine.getPmMax(),
                defense: this.engine.getDefesa()
            });
        }

        // 5. Navega para a visualização da ficha
        if (this.router && typeof this.router.navigate === 'function') {
            this.router.navigate('sheet');
        }
    }
}

// Expõe globalmente
if (typeof window !== 'undefined') {
    window.WizardView = WizardView;
}

