/**
 * sheet_view.js — Painel Interativo Completo da Ficha (Edição In-Place)
 * Integrado ao Motor C99 (WebAssembly)
 */

class SheetView {
    constructor(engine, router, logger) {
        this.engine = engine;
        this.router = router;
        this.logger = logger || console.log;

        this.container = null;
        this.skillFilter = '';
        this.skillFilterOnlyTrained = false;

        this.attrMeta = [
            { id: 0, name: 'Força', abbr: 'FOR', desc: 'Ataques corpo a corpo, dano e atletismo' },
            { id: 1, name: 'Destreza', abbr: 'DES', desc: 'Iniciativa, reflexos, pontaria e defesa' },
            { id: 2, name: 'Constituição', abbr: 'CON', desc: 'Pontos de vida, vigor e fortitude' },
            { id: 3, name: 'Inteligência', abbr: 'INT', desc: 'Conhecimento, investigação e perícias' },
            { id: 4, name: 'Sabedoria', abbr: 'SAB', desc: 'Percepção, intuição, vontade e cura' },
            { id: 5, name: 'Carisma', abbr: 'CAR', desc: 'Diplomacia, atuação, enganação e liderança' }
        ];
    }

    /**
     * Inicializa a view da ficha
     */
    init(containerId = 'view-sheet') {
        this.container = document.getElementById(containerId);
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
     * Renderiza o painel da ficha completo
     */
    render() {
        if (!this.container || !this.engine.isLoaded) return;

        const sheet = this.engine.exportJson() || {};
        const name = sheet.nome || this.engine.getCharacterName() || 'Herói';
        const race = sheet.raca || this.engine.getActiveRace() || 'Humano';
        const cls = sheet.classe || this.engine.getActiveClass() || 'Guerreiro';
        const level = sheet.nivel || this.engine.getLevel() || 1;
        const xp = this.engine.getXp();

        const pvCur = this.engine.getPvAtual();
        const pvMax = this.engine.getPvMax();
        const pmCur = this.engine.getPmAtual();
        const pmMax = this.engine.getPmMax();
        const defense = this.engine.getDefesa();
        const armorBonus = this.engine.getBonusArmadura();
        const shieldBonus = this.engine.getBonusEscudo();

        const desMod = this.engine.getModifier(1);
        const pvPct = pvMax > 0 ? Math.min(100, Math.max(0, (pvCur / pvMax) * 100)) : 0;
        const pmPct = pmMax > 0 ? Math.min(100, Math.max(0, (pmCur / pmMax) * 100)) : 0;

        this.container.innerHTML = `
            <div class="sheet-main-layout">
                <!-- Cabeçalho Principal da Ficha -->
                <section class="card sheet-header-card">
                    <div class="sheet-header-top">
                        <div class="sheet-identity-group">
                            <label class="sheet-field-label">Nome do Personagem (Edição In-Place)</label>
                            <input type="text" id="sheet-name-input" class="sheet-name-field" value="${name}" maxlength="30" placeholder="Nome do Herói">
                        </div>
                        <div class="sheet-badges-group">
                            <span class="sheet-meta-pill race-pill">🧬 ${race}</span>
                            <span class="sheet-meta-pill class-pill">🛡️ ${cls}</span>
                            <span class="sheet-meta-pill system-pill">📜 Tormenta 20</span>
                        </div>
                    </div>

                    <div class="sheet-level-xp-row">
                        <div class="sheet-stepper-control">
                            <span class="sheet-field-label">Nível de Personagem</span>
                            <div class="stepper-box">
                                <button type="button" id="btn-lvl-down" class="btn-stepper" title="Diminuir Nível">-</button>
                                <span class="stepper-value" id="sheet-level-val">${level}</span>
                                <button type="button" id="btn-lvl-up" class="btn-stepper" title="Aumentar Nível">+</button>
                            </div>
                        </div>

                        <div class="sheet-xp-control">
                            <label class="sheet-field-label" for="sheet-xp-input">Pontos de Experiência (XP)</label>
                            <input type="number" id="sheet-xp-input" class="sheet-number-field" value="${xp}" min="0" step="100">
                        </div>

                        <div class="sheet-header-actions">
                            <button id="btn-sheet-open-wizard" class="btn" title="Abre o assistente para recriar ou configurar este personagem">
                                🪄 Assistente de Criação
                            </button>
                        </div>
                    </div>
                </section>

                <div class="dashboard-grid sheet-grid-columns">
                    <!-- Coluna Principal (Recursos, Atributos, Perícias) -->
                    <main class="sheet-column-main">
                        <!-- Barra de Recursos de Combate (PV / PM / Defesa) -->
                        <section class="card sheet-resources-card">
                            <div class="card-header">
                                <span class="card-title">Recursos de Combate</span>
                                <span class="card-subtitle-small">Sincronizado na memória linear do C</span>
                            </div>

                            <div class="sheet-combat-meters">
                                <!-- Pontos de Vida (PV) -->
                                <div class="resource-block pv-block">
                                    <div class="resource-block-header">
                                        <span class="res-label">❤️ Pontos de Vida (PV)</span>
                                        <div class="res-inputs">
                                            <input type="number" id="sheet-pv-cur-input" class="res-num-input" value="${pvCur}" min="0" max="${pvMax}">
                                            <span class="res-sep">/</span>
                                            <span class="res-max" id="sheet-pv-max-val">${pvMax}</span>
                                        </div>
                                    </div>
                                    <div class="res-progress-track">
                                        <div class="res-progress-fill pv-fill" style="width: ${pvPct}%;"></div>
                                    </div>
                                    <div class="res-quick-buttons">
                                        <button type="button" class="btn-quick-dmg" data-delta="-5">-5</button>
                                        <button type="button" class="btn-quick-dmg" data-delta="-1">-1</button>
                                        <button type="button" class="btn-quick-heal" data-delta="1">+1</button>
                                        <button type="button" class="btn-quick-heal" data-delta="5">+5</button>
                                        <button type="button" id="btn-full-heal" class="btn-quick-action" title="Cura total">Cura Total</button>
                                    </div>
                                </div>

                                <!-- Pontos de Mana (PM) -->
                                <div class="resource-block pm-block">
                                    <div class="resource-block-header">
                                        <span class="res-label">✨ Pontos de Mana (PM)</span>
                                        <div class="res-inputs">
                                            <input type="number" id="sheet-pm-cur-input" class="res-num-input" value="${pmCur}" min="0" max="${pmMax}">
                                            <span class="res-sep">/</span>
                                            <span class="res-max" id="sheet-pm-max-val">${pmMax}</span>
                                        </div>
                                    </div>
                                    <div class="res-progress-track">
                                        <div class="res-progress-fill pm-fill" style="width: ${pmPct}%;"></div>
                                    </div>
                                    <div class="res-quick-buttons">
                                        <button type="button" class="btn-quick-mana-sub" data-delta="-5">-5</button>
                                        <button type="button" class="btn-quick-mana-sub" data-delta="-1">-1</button>
                                        <button type="button" class="btn-quick-mana-add" data-delta="1">+1</button>
                                        <button type="button" class="btn-quick-mana-add" data-delta="5">+5</button>
                                        <button type="button" id="btn-full-pm" class="btn-quick-action" title="Recupera todo PM">PM Total</button>
                                    </div>
                                </div>
                            </div>

                            <!-- Defesa e Bônus de Armadura / Escudo -->
                            <div class="defense-breakdown-card">
                                <div class="defense-main-badge">
                                    <span class="def-badge-label">Defesa Passiva Total</span>
                                    <div class="def-badge-val" id="sheet-def-val">${defense}</div>
                                </div>
                                <div class="defense-calc-items">
                                    <div class="def-calc-item">
                                        <span class="calc-label">Base</span>
                                        <span class="calc-val">10</span>
                                    </div>
                                    <span class="calc-op">+</span>
                                    <div class="def-calc-item">
                                        <span class="calc-label">DES</span>
                                        <span class="calc-val" id="def-mod-des">${this.formatMod(desMod)}</span>
                                    </div>
                                    <span class="calc-op">+</span>
                                    <div class="def-calc-item def-input-item">
                                        <label class="calc-label" for="sheet-armor-input">Armadura</label>
                                        <input type="number" id="sheet-armor-input" class="calc-input" value="${armorBonus}" min="0" max="20">
                                    </div>
                                    <span class="calc-op">+</span>
                                    <div class="def-calc-item def-input-item">
                                        <label class="calc-label" for="sheet-shield-input">Escudo</label>
                                        <input type="number" id="sheet-shield-input" class="calc-input" value="${shieldBonus}" min="0" max="10">
                                    </div>
                                </div>
                            </div>
                        </section>

                        <!-- Grade de 6 Atributos Básicos com Edição In-Place -->
                        <section class="card sheet-attributes-card">
                            <div class="card-header">
                                <span class="card-title">Atributos Básicos</span>
                                <span class="card-subtitle-small">Edite os valores para recalcular modificadores, PV e perícias na hora</span>
                            </div>

                            <div class="sheet-attributes-grid">
                                ${this.attrMeta.map(attr => {
                                    const val = this.engine.getAttribute(attr.id);
                                    const mod = this.engine.getModifier(attr.id);
                                    return `
                                        <div class="sheet-attr-card" data-attr-id="${attr.id}">
                                            <div class="sheet-attr-header">
                                                <span class="attr-abbr-tag">${attr.abbr}</span>
                                                <span class="attr-title-text">${attr.name}</span>
                                            </div>
                                            <div class="sheet-attr-mod ${mod >= 0 ? 'mod-positive' : 'mod-negative'}">
                                                ${this.formatMod(mod)}
                                            </div>
                                            <div class="sheet-attr-input-row">
                                                <button type="button" class="btn-attr-stepper btn-attr-minus" data-attr-id="${attr.id}">-</button>
                                                <input type="number" class="sheet-attr-val-input" data-attr-id="${attr.id}" value="${val}" min="1" max="40">
                                                <button type="button" class="btn-attr-stepper btn-attr-plus" data-attr-id="${attr.id}">+</button>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </section>

                        <!-- Tabela Completa das 29 Perícias Oficiais de Tormenta 20 -->
                        <section class="card sheet-skills-card">
                            <div class="card-header">
                                <span class="card-title">Perícias de Tormenta 20 (29 Perícias Oficiais)</span>
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
                                            <th class="th-attr">Atributo</th>
                                            <th class="th-bonus">Bônus Total</th>
                                            <th class="th-roll">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody id="skills-table-body">
                                        <!-- Preenchido dinamicamente -->
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </main>

                    <!-- Coluna Lateral (Logs e Testes do Motor C) -->
                    <aside class="sheet-column-side">
                        <section class="card">
                            <div class="card-header">
                                <span class="card-title">Ações Rápidas de Teste</span>
                            </div>
                            <div class="action-group">
                                <button id="btn-test-d20" class="btn btn-primary">🎲 Rolar 1d20</button>
                                <button id="btn-test-complex" class="btn">🎲 Rolar 3d6+5</button>
                                <button id="btn-dump-json" class="btn">📄 Visualizar JSON do C</button>
                            </div>
                        </section>

                        <section class="card">
                            <div class="card-header">
                                <span class="card-title">Console de Execução WASM</span>
                            </div>
                            <div id="console-output" class="console-container">
                                <div class="log-entry log-info">[Motor C] Pronto para executar comandos.</div>
                            </div>
                        </section>
                    </aside>
                </div>
            </div>
        `;

        this.setupEventListeners();
        this.renderSkillsTable();
    }

    /**
     * Renderiza a tabela de 29 perícias com base nos filtros
     */
    renderSkillsTable() {
        const tbody = document.getElementById('skills-table-body');
        if (!tbody || !this.engine.isLoaded) return;

        const count = this.engine.getSkillCount();
        const search = this.skillFilter.toLowerCase().trim();
        const onlyTrained = this.skillFilterOnlyTrained;

        let rowsHtml = '';
        for (let i = 0; i < count; i++) {
            const skillName = this.engine.getSkillName(i);
            const attrId = this.engine.getSkillAttr(i);
            const isTrained = this.engine.isSkillTrained(i);
            const totalBonus = this.engine.calcSkill(i, 0);

            const attrMeta = this.attrMeta[attrId] || { abbr: '???' };

            // Aplica filtros de busca e treinamento
            if (search && !skillName.toLowerCase().includes(search) && !attrMeta.abbr.toLowerCase().includes(search)) {
                continue;
            }
            if (onlyTrained && !isTrained) {
                continue;
            }

            rowsHtml += `
                <tr class="skill-row ${isTrained ? 'skill-trained' : ''}" data-skill-id="${i}">
                    <td class="td-train">
                        <input type="checkbox" class="skill-trained-checkbox" data-skill-id="${i}" ${isTrained ? 'checked' : ''} title="Marcar/Desmarcar como Perícia Treinada (+2 de bônus do 1º ao 6º nível)">
                    </td>
                    <td class="td-name">
                        <strong>${skillName}</strong>
                    </td>
                    <td class="td-attr">
                        <span class="skill-attr-tag">${attrMeta.abbr}</span>
                    </td>
                    <td class="td-bonus">
                        <span class="skill-bonus-val ${totalBonus >= 0 ? 'bonus-pos' : 'bonus-neg'}">
                            ${this.formatMod(totalBonus)}
                        </span>
                    </td>
                    <td class="td-roll">
                        <button type="button" class="btn btn-roll-skill" data-skill-id="${i}" data-skill-name="${skillName}" data-skill-bonus="${totalBonus}" title="Rolar 1d20 + ${totalBonus} no Motor C">
                            🎲 Rolar
                        </button>
                    </td>
                </tr>
            `;
        }

        if (!rowsHtml) {
            rowsHtml = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 20px; color: var(--color-text-dim);">
                        Nenhuma perícia encontrada para o filtro atual.
                    </td>
                </tr>
            `;
        }

        tbody.innerHTML = rowsHtml;

        // Conecta eventos dos checkboxes de treino
        tbody.querySelectorAll('.skill-trained-checkbox').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const skillId = parseInt(chk.dataset.skillId, 10);
                const trained = e.target.checked;
                this.engine.setSkillTrained(skillId, trained);
                this.logger(`[C Rules] Perícia "${this.engine.getSkillName(skillId)}" marcada como ${trained ? 'Treinada' : 'Não-Treinada'}.`, 'info');
                this.refreshState();
            });
        });

        // Conecta eventos dos botões de rolagem de perícia
        tbody.querySelectorAll('.btn-roll-skill').forEach(btn => {
            btn.addEventListener('click', () => {
                const skillName = btn.dataset.skillName;
                const bonus = parseInt(btn.dataset.skillBonus, 10);
                if (window.diceRoller) {
                    window.diceRoller.roll(1, 20, bonus, `Teste de Perícia: ${skillName}`);
                    window.diceRoller.openDrawer();
                } else {
                    const roll = this.engine.rollDice(1, 20, bonus);
                    let tag = '';
                    if (roll.isCritical) tag = ' ⭐ CRÍTICO!';
                    if (roll.isFumble) tag = ' 💀 FALHA CRÍTICA!';
                    this.logger(`[C Roll] Teste de ${skillName}: 1d20 (${roll.rolls[0]}) ${this.formatMod(bonus)} = ${roll.total}${tag}`, roll.isCritical ? 'success' : (roll.isFumble ? 'warn' : 'info'));
                }
            });
        });
    }

    /**
     * Configura todos os eventos de edição in-place
     */
    setupEventListeners() {
        // 1. Nome do personagem in-place
        const nameInput = document.getElementById('sheet-name-input');
        if (nameInput) {
            const updateName = () => {
                const newName = nameInput.value.trim();
                if (newName && newName !== this.engine.getCharacterName()) {
                    this.engine.setCharacterName(newName);
                    this.logger(`[C Memory] Nome atualizado na struct para: "${newName}".`, 'info');
                }
            };
            nameInput.addEventListener('change', updateName);
            nameInput.addEventListener('blur', updateName);
        }

        // 2. Nível (Aumentar / Diminuir)
        const btnLvlUp = document.getElementById('btn-lvl-up');
        if (btnLvlUp) {
            btnLvlUp.addEventListener('click', () => {
                const cur = this.engine.getLevel();
                if (cur < 20) {
                    this.engine.setLevel(cur + 1);
                    this.logger(`[C Level Up] Personagem subiu para o Nível ${cur + 1}! PV e PM recalculados.`, 'success');
                    this.refreshState();
                }
            });
        }

        const btnLvlDown = document.getElementById('btn-lvl-down');
        if (btnLvlDown) {
            btnLvlDown.addEventListener('click', () => {
                const cur = this.engine.getLevel();
                if (cur > 1) {
                    this.engine.setLevel(cur - 1);
                    this.logger(`[C Level Down] Personagem ajustado para o Nível ${cur - 1}.`, 'info');
                    this.refreshState();
                }
            });
        }

        // 3. Pontos de Experiência (XP)
        const xpInput = document.getElementById('sheet-xp-input');
        if (xpInput) {
            xpInput.addEventListener('change', (e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 0) {
                    this.engine.setXp(val);
                }
            });
        }

        // 4. Abrir Wizard a partir da ficha
        const btnOpenWizard = document.getElementById('btn-sheet-open-wizard');
        if (btnOpenWizard) {
            btnOpenWizard.addEventListener('click', () => {
                if (this.router && typeof this.router.navigate === 'function') {
                    this.router.navigate('creator');
                }
            });
        }

        // 5. Botões de ajuste rápido de PV
        this.container.querySelectorAll('.btn-quick-dmg, .btn-quick-heal').forEach(btn => {
            btn.addEventListener('click', () => {
                const delta = parseInt(btn.dataset.delta, 10);
                this.engine.modifyPv(delta);
                this.logger(`[C PV] Modificado em ${this.formatMod(delta)}. Atual: ${this.engine.getPvAtual()}/${this.engine.getPvMax()}`);
                this.refreshState();
            });
        });

        const btnFullHeal = document.getElementById('btn-full-heal');
        if (btnFullHeal) {
            btnFullHeal.addEventListener('click', () => {
                this.engine.setPvAtual(this.engine.getPvMax());
                this.logger(`[C PV] Personagem totalmente curado (${this.engine.getPvMax()} PV)!`, 'success');
                this.refreshState();
            });
        }

        // 6. Botões de ajuste rápido de PM
        this.container.querySelectorAll('.btn-quick-mana-sub, .btn-quick-mana-add').forEach(btn => {
            btn.addEventListener('click', () => {
                const delta = parseInt(btn.dataset.delta, 10);
                this.engine.modifyPm(delta);
                this.logger(`[C PM] Modificado em ${this.formatMod(delta)}. Atual: ${this.engine.getPmAtual()}/${this.engine.getPmMax()}`);
                this.refreshState();
            });
        });

        const btnFullPm = document.getElementById('btn-full-pm');
        if (btnFullPm) {
            btnFullPm.addEventListener('click', () => {
                this.engine.setPmAtual(this.engine.getPmMax());
                this.logger(`[C PM] Mana totalmente recuperada (${this.engine.getPmMax()} PM)!`, 'success');
                this.refreshState();
            });
        }

        // 7. Inputs diretos de PV Atual e PM Atual
        const pvInput = document.getElementById('sheet-pv-cur-input');
        if (pvInput) {
            pvInput.addEventListener('change', (e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                    this.engine.setPvAtual(val);
                    this.refreshState();
                }
            });
        }

        const pmInput = document.getElementById('sheet-pm-cur-input');
        if (pmInput) {
            pmInput.addEventListener('change', (e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                    this.engine.setPmAtual(val);
                    this.refreshState();
                }
            });
        }

        // 8. Bônus de Armadura e Escudo
        const armorInput = document.getElementById('sheet-armor-input');
        if (armorInput) {
            armorInput.addEventListener('change', (e) => {
                const val = parseInt(e.target.value, 10) || 0;
                this.engine.setBonusArmadura(val);
                this.logger(`[C Defesa] Bônus de Armadura ajustado para ${val}. Nova Defesa: ${this.engine.getDefesa()}`);
                this.refreshState();
            });
        }

        const shieldInput = document.getElementById('sheet-shield-input');
        if (shieldInput) {
            shieldInput.addEventListener('change', (e) => {
                const val = parseInt(e.target.value, 10) || 0;
                this.engine.setBonusEscudo(val);
                this.logger(`[C Defesa] Bônus de Escudo ajustado para ${val}. Nova Defesa: ${this.engine.getDefesa()}`);
                this.refreshState();
            });
        }

        // 9. Atributos Básicos (Edição In-Place com steppers e input)
        this.container.querySelectorAll('.btn-attr-minus').forEach(btn => {
            btn.addEventListener('click', () => {
                const attrId = parseInt(btn.dataset.attrId, 10);
                const cur = this.engine.getAttribute(attrId);
                if (cur > 1) {
                    this.engine.setAttribute(attrId, cur - 1);
                    this.logger(`[C Atributo] ${this.attrMeta[attrId].abbr} alterado para ${cur - 1}. Recalculando...`);
                    this.refreshState();
                }
            });
        });

        this.container.querySelectorAll('.btn-attr-plus').forEach(btn => {
            btn.addEventListener('click', () => {
                const attrId = parseInt(btn.dataset.attrId, 10);
                const cur = this.engine.getAttribute(attrId);
                if (cur < 40) {
                    this.engine.setAttribute(attrId, cur + 1);
                    this.logger(`[C Atributo] ${this.attrMeta[attrId].abbr} alterado para ${cur + 1}. Recalculando...`);
                    this.refreshState();
                }
            });
        });

        this.container.querySelectorAll('.sheet-attr-val-input').forEach(inp => {
            inp.addEventListener('change', (e) => {
                const attrId = parseInt(inp.dataset.attrId, 10);
                let val = parseInt(e.target.value, 10);
                if (isNaN(val)) val = 10;
                if (val < 1) val = 1;
                if (val > 40) val = 40;
                this.engine.setAttribute(attrId, val);
                this.logger(`[C Atributo] ${this.attrMeta[attrId].abbr} alterado para ${val}. Recalculando...`);
                this.refreshState();
            });
        });

        // Clique no modificador para rolar teste de atributo
        this.container.querySelectorAll('.sheet-attr-card').forEach(card => {
            const attrId = parseInt(card.dataset.attrId, 10);
            const modEl = card.querySelector('.sheet-attr-mod');
            if (modEl) {
                modEl.style.cursor = 'pointer';
                modEl.title = 'Clique para rolar teste de atributo (1d20 + Modificador)';
                modEl.addEventListener('click', () => {
                    const mod = this.engine.getModifier(attrId);
                    const attrName = this.attrMeta[attrId]?.name || 'Atributo';
                    if (window.diceRoller) {
                        window.diceRoller.roll(1, 20, mod, `Teste de Atributo: ${attrName}`);
                        window.diceRoller.openDrawer();
                    }
                });
            }
        });

        // 10. Filtro de Perícias
        const searchInput = document.getElementById('skills-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.skillFilter = e.target.value;
                this.renderSkillsTable();
            });
        }

        const trainedCheck = document.getElementById('skills-only-trained');
        if (trainedCheck) {
            trainedCheck.addEventListener('change', (e) => {
                this.skillFilterOnlyTrained = e.target.checked;
                this.renderSkillsTable();
            });
        }

        // 11. Testes Rápidos do Painel Lateral
        const btnTestD20 = document.getElementById('btn-test-d20');
        if (btnTestD20) {
            btnTestD20.addEventListener('click', () => {
                const res = this.engine.rollDice(1, 20, 0);
                let tag = '';
                if (res.isCritical) tag = ' (CRÍTICO!)';
                if (res.isFumble) tag = ' (FALHA CRÍTICA!)';
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
                const json = this.engine.exportJson();
                this.logger(`[C Serializer] JSON exportado do C:\n${JSON.stringify(json, null, 2)}`, 'info');
            });
        }
    }

    /**
     * Atualiza os elementos de status sem reconstruir o DOM inteiro
     */
    refreshState() {
        this.render();
    }
}

// Expõe globalmente
if (typeof window !== 'undefined') {
    window.SheetView = SheetView;
}

