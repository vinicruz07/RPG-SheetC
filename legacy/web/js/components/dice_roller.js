/**
 * dice_roller.js — Componente Visual de Rolagem de Dados Conectado ao Motor C
 * Suporta d4, d6, d8, d10, d12, d20, d100, gaveta lateral, visualização de histórico e integração com ficha.
 */

class DiceRollerComponent {
    constructor(engine, logger) {
        this.engine = engine;
        this.logger = logger || console.log;

        // Estado do rolador
        this.selectedFaces = 20; // Padrão d20
        this.count = 1;
        this.modifier = 0;

        this.history = [];
        this.isOpen = false;

        // Dados poliédricos suportados
        this.diceTypes = [
            { faces: 4, name: 'd4', icon: '▲', desc: 'Tetraedro' },
            { faces: 6, name: 'd6', icon: '■', desc: 'Hexaedro' },
            { faces: 8, name: 'd8', icon: '◆', desc: 'Octaedro' },
            { faces: 10, name: 'd10', icon: '⬟', desc: 'Decaedro' },
            { faces: 12, name: 'd12', icon: '⬢', desc: 'Dodecaedro' },
            { faces: 20, name: 'd20', icon: '⯁', desc: 'Icosaedro Oficial' },
            { faces: 100, name: 'd100', icon: '💯', desc: 'Percentual' }
        ];

        this.drawerEl = null;
        this.backdropEl = null;
        this.floatingBtnEl = null;
        this.dedicatedViewEl = null;
    }

    /**
     * Inicializa o componente na página (injetando o botão flutuante e o drawer)
     */
    init(dedicatedContainerId = 'view-roller') {
        this.dedicatedViewEl = document.getElementById(dedicatedContainerId);

        this.createFloatingTrigger();
        this.createDrawer();

        if (this.dedicatedViewEl) {
            this.renderDedicatedView();
        }
    }

    /**
     * Cria botão flutuante no canto inferior direito
     */
    createFloatingTrigger() {
        if (document.getElementById('dice-floating-trigger')) return;

        const btn = document.createElement('button');
        btn.id = 'dice-floating-trigger';
        btn.className = 'dice-floating-trigger';
        btn.innerHTML = `
            <span>🎲</span>
            <span>Rolar Dados</span>
            <span class="dice-floating-badge" id="dice-floating-badge">d20</span>
        `;

        btn.addEventListener('click', () => {
            this.toggleDrawer();
        });

        document.body.appendChild(btn);
        this.floatingBtnEl = btn;
    }

    /**
     * Cria o drawer lateral (gaveta) e backdrop
     */
    createDrawer() {
        if (document.getElementById('dice-drawer')) return;

        // Backdrop
        const backdrop = document.createElement('div');
        backdrop.id = 'dice-drawer-backdrop';
        backdrop.className = 'dice-drawer-backdrop';
        backdrop.addEventListener('click', () => this.closeDrawer());
        document.body.appendChild(backdrop);
        this.backdropEl = backdrop;

        // Drawer Panel
        const drawer = document.createElement('div');
        drawer.id = 'dice-drawer';
        drawer.className = 'dice-drawer';

        drawer.innerHTML = `
            <div class="dice-drawer-header">
                <div class="dice-drawer-title">
                    <span>🎲</span> Rolador de Dados Poliédricos
                </div>
                <button type="button" class="btn-drawer-close" id="btn-close-drawer" title="Fechar">&times;</button>
            </div>
            <div class="dice-drawer-body" id="dice-drawer-body">
                <!-- Conteúdo do Rolador -->
            </div>
        `;

        document.body.appendChild(drawer);
        this.drawerEl = drawer;

        const btnClose = drawer.querySelector('#btn-close-drawer');
        if (btnClose) {
            btnClose.addEventListener('click', () => this.closeDrawer());
        }

        this.renderDrawerContent();
    }

    /**
     * Alterna abertura da gaveta lateral
     */
    toggleDrawer() {
        if (this.isOpen) {
            this.closeDrawer();
        } else {
            this.openDrawer();
        }
    }

    openDrawer() {
        this.isOpen = true;
        if (this.drawerEl) this.drawerEl.classList.add('open');
        if (this.backdropEl) this.backdropEl.classList.add('open');
    }

    closeDrawer() {
        this.isOpen = false;
        if (this.drawerEl) this.drawerEl.classList.remove('open');
        if (this.backdropEl) this.backdropEl.classList.remove('open');
    }

    /**
     * Renderiza o conteúdo dentro da gaveta lateral
     */
    renderDrawerContent() {
        const bodyEl = document.getElementById('dice-drawer-body');
        if (!bodyEl) return;

        bodyEl.innerHTML = this.generateRollerHtml('drawer');
        this.attachControlListeners('drawer');
    }

    /**
     * Renderiza o rolador na aba dedicada da SPA
     */
    renderDedicatedView() {
        if (!this.dedicatedViewEl) return;

        this.dedicatedViewEl.innerHTML = `
            <div class="roller-page-grid">
                <div class="card">
                    <div class="card-header">
                        <span class="card-title">Mesa de Rolagem de Dados Poliédricos</span>
                    </div>
                    <div id="dedicated-roller-controls">
                        ${this.generateRollerHtml('dedicated')}
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <span class="card-title">Histórico Geral de Rolagens do Motor C</span>
                        <button type="button" class="btn-clear-history" id="btn-clear-history-dedicated">Limpar Histórico</button>
                    </div>
                    <div class="roll-history-list" id="roll-history-list-dedicated">
                        ${this.generateHistoryHtml()}
                    </div>
                </div>
            </div>
        `;

        this.attachControlListeners('dedicated');
        this.setupDedicatedHistoryEvents();
    }

    /**
     * Gera o HTML dos controles do rolador
     */
    generateRollerHtml(prefix) {
        const modSign = this.modifier >= 0 ? `+${this.modifier}` : `${this.modifier}`;
        const formulaStr = `${this.count}d${this.selectedFaces}${this.modifier !== 0 ? (this.modifier > 0 ? ` + ${this.modifier}` : ` - ${Math.abs(this.modifier)}`) : ''}`;

        return `
            <!-- Grade de Dados Poliédricos -->
            <div class="dice-section">
                <div class="dice-section-label">
                    <span>Dado Selecionado: <strong>d${this.selectedFaces}</strong></span>
                </div>
                <div class="polyhedral-grid">
                    ${this.diceTypes.map(d => `
                        <div class="die-btn ${this.selectedFaces === d.faces ? 'selected' : ''}" data-prefix="${prefix}" data-faces="${d.faces}">
                            <span class="die-btn-icon">${d.icon}</span>
                            <span class="die-btn-name">${d.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Quantidade e Modificador -->
            <div class="dice-config-row" style="margin-top: var(--space-md);">
                <div class="dice-config-item">
                    <span class="dice-config-label">Qtd. de Dados</span>
                    <div class="dice-stepper">
                        <button type="button" class="dice-stepper-btn btn-count-minus" data-prefix="${prefix}">-</button>
                        <input type="number" class="dice-stepper-input count-input" data-prefix="${prefix}" value="${this.count}" min="1" max="20">
                        <button type="button" class="dice-stepper-btn btn-count-plus" data-prefix="${prefix}">+</button>
                    </div>
                </div>

                <div class="dice-config-item">
                    <span class="dice-config-label">Bônus / Modificador</span>
                    <div class="dice-stepper">
                        <button type="button" class="dice-stepper-btn btn-mod-minus" data-prefix="${prefix}">-</button>
                        <input type="number" class="dice-stepper-input mod-input" data-prefix="${prefix}" value="${this.modifier}" min="-30" max="30">
                        <button type="button" class="dice-stepper-btn btn-mod-plus" data-prefix="${prefix}">+</button>
                    </div>
                </div>
            </div>

            <!-- Botão de Rolagem -->
            <div style="margin-top: var(--space-md);">
                <button type="button" class="btn-main-roll btn-trigger-roll" data-prefix="${prefix}">
                    <span>🎲</span> Rolar ${formulaStr}
                </button>
            </div>

            <!-- Presets Rápidos -->
            <div class="dice-section" style="margin-top: var(--space-md);">
                <div class="dice-section-label">Presets Comuns</div>
                <div class="dice-presets-grid">
                    <button type="button" class="btn-preset" data-prefix="${prefix}" data-c="1" data-f="20" data-m="0" data-t="1d20 Puro">🎯 1d20 Puro</button>
                    <button type="button" class="btn-preset" data-prefix="${prefix}" data-c="3" data-f="6" data-m="0" data-t="3d6 Clássico">🎲 3d6 Clássico</button>
                    <button type="button" class="btn-preset" data-prefix="${prefix}" data-c="2" data-f="6" data-m="0" data-t="2d6 Ataque">⚔️ 2d6 Ataque</button>
                    <button type="button" class="btn-preset" data-prefix="${prefix}" data-c="1" data-f="100" data-m="0" data-t="1d100 Percentual">💯 1d100 Percentual</button>
                </div>
            </div>

            ${prefix === 'drawer' ? `
                <!-- Histórico no Drawer -->
                <div class="roll-history-card" style="margin-top: var(--space-lg);">
                    <div class="roll-history-header">
                        <span class="dice-section-label">Histórico de Rolagens</span>
                        <button type="button" class="btn-clear-history" id="btn-clear-history-drawer">Limpar</button>
                    </div>
                    <div class="roll-history-list" id="roll-history-list-drawer">
                        ${this.generateHistoryHtml()}
                    </div>
                </div>
            ` : ''}
        `;
    }

    /**
     * Gera o HTML da lista de histórico de rolagens
     */
    generateHistoryHtml() {
        if (!this.history || this.history.length === 0) {
            return `
                <div class="roll-history-empty">
                    Nenhuma rolagem realizada ainda nesta sessão.<br>
                    Selecione um dado acima ou clique em perícias e atributos na ficha!
                </div>
            `;
        }

        return this.history.map(item => {
            const isCrit = item.isCritical;
            const isFumble = item.isFumble;
            const modStr = item.modifier !== 0 ? (item.modifier > 0 ? `+ ${item.modifier}` : `- ${Math.abs(item.modifier)}`) : '';

            return `
                <div class="roll-history-entry ${isCrit ? 'is-critical' : ''} ${isFumble ? 'is-fumble' : ''}">
                    <div class="roll-entry-top">
                        <span class="roll-entry-title">${item.title || `${item.count}d${item.faces}`}</span>
                        <span class="roll-entry-time">${item.time}</span>
                    </div>

                    <div class="roll-entry-breakdown">
                        <div class="roll-dice-collection">
                            ${item.rolls.map(r => `
                                <span class="history-die-badge ${r === 20 && item.faces === 20 ? 'crit' : ''} ${r === 1 && item.faces === 20 ? 'fumble' : ''}">
                                    ${r}
                                </span>
                            `).join('')}
                            ${modStr ? `<span class="roll-mod-tag">${modStr}</span>` : ''}
                        </div>

                        <div class="roll-total-box">
                            <span class="roll-total-num">${item.total}</span>
                        </div>
                    </div>

                    ${isCrit ? `
                        <span class="roll-badge-tag badge-crit">⭐ Sucesso Crítico! (20 Natural)</span>
                    ` : ''}
                    ${isFumble ? `
                        <span class="roll-badge-tag badge-fumble">💀 Falha Crítica! (1 Natural)</span>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    /**
     * Executa uma rolagem através do motor C WebAssembly
     * @param {number} count Quantidade de dados
     * @param {number} faces Faces do dado
     * @param {number} modifier Bônus/Modificador
     * @param {string} title Título contextual da rolagem (ex: "Teste de Luta (FOR)")
     */
    roll(count = 1, faces = 20, modifier = 0, title = '') {
        if (!this.engine || !this.engine.isLoaded) {
            alert('Aguardando inicialização do motor WebAssembly...');
            return null;
        }

        // Executa no motor C puro (C99 com PRNG Xorshift32)
        const result = this.engine.rollDice(count, faces, modifier);
        if (!result) return null;

        const time = new Date().toLocaleTimeString();
        const displayTitle = title || `Rolagem ${count}d${faces}${modifier !== 0 ? (modifier > 0 ? `+${modifier}` : modifier) : ''}`;

        const entry = {
            id: Date.now(),
            time,
            title: displayTitle,
            faces,
            count,
            modifier,
            rolls: result.rolls,
            subtotal: result.subtotal,
            total: result.total,
            isCritical: result.isCritical,
            isFumble: result.isFumble
        };

        // Adiciona ao topo do histórico
        this.history.unshift(entry);
        if (this.history.length > 50) {
            this.history.pop();
        }

        // Log detalhado no console do WASM
        let critTag = '';
        if (result.isCritical) critTag = ' [CRÍTICO!]';
        if (result.isFumble) critTag = ' [FALHA CRÍTICA!]';
        const modFormat = modifier !== 0 ? (modifier > 0 ? `+${modifier}` : `${modifier}`) : '';
        this.logger(`[C Dice Engine] ${displayTitle}: [${result.rolls.join(', ')}] ${modFormat} = ${result.total}${critTag}`, result.isCritical ? 'success' : (result.isFumble ? 'warn' : 'info'));

        // Atualiza a exibição de histórico
        this.updateHistoryDisplays();

        return entry;
    }

    /**
     * Atualiza as listas de histórico onde estiverem visíveis
     */
    updateHistoryDisplays() {
        const drawerHistory = document.getElementById('roll-history-list-drawer');
        if (drawerHistory) {
            drawerHistory.innerHTML = this.generateHistoryHtml();
        }

        const dedicatedHistory = document.getElementById('roll-history-list-dedicated');
        if (dedicatedHistory) {
            dedicatedHistory.innerHTML = this.generateHistoryHtml();
        }
    }

    /**
     * Vincula listeners dos controles (quantidade, modificador, dados, presets)
     */
    attachControlListeners(prefix) {
        const root = prefix === 'drawer' ? this.drawerEl : this.dedicatedViewEl;
        if (!root) return;

        // Seleção de Faces do Dado
        root.querySelectorAll(`.die-btn[data-prefix="${prefix}"]`).forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedFaces = parseInt(btn.dataset.faces, 10);
                this.updateTriggerBadge();
                this.refreshControls();
            });
        });

        // Controles de Quantidade
        const countMinus = root.querySelector(`.btn-count-minus[data-prefix="${prefix}"]`);
        if (countMinus) {
            countMinus.addEventListener('click', () => {
                if (this.count > 1) {
                    this.count--;
                    this.refreshControls();
                }
            });
        }

        const countPlus = root.querySelector(`.btn-count-plus[data-prefix="${prefix}"]`);
        if (countPlus) {
            countPlus.addEventListener('click', () => {
                if (this.count < 20) {
                    this.count++;
                    this.refreshControls();
                }
            });
        }

        const countInput = root.querySelector(`.count-input[data-prefix="${prefix}"]`);
        if (countInput) {
            countInput.addEventListener('change', (e) => {
                let v = parseInt(e.target.value, 10);
                if (isNaN(v) || v < 1) v = 1;
                if (v > 20) v = 20;
                this.count = v;
                this.refreshControls();
            });
        }

        // Controles de Modificador
        const modMinus = root.querySelector(`.btn-mod-minus[data-prefix="${prefix}"]`);
        if (modMinus) {
            modMinus.addEventListener('click', () => {
                this.modifier--;
                this.refreshControls();
            });
        }

        const modPlus = root.querySelector(`.btn-mod-plus[data-prefix="${prefix}"]`);
        if (modPlus) {
            modPlus.addEventListener('click', () => {
                this.modifier++;
                this.refreshControls();
            });
        }

        const modInput = root.querySelector(`.mod-input[data-prefix="${prefix}"]`);
        if (modInput) {
            modInput.addEventListener('change', (e) => {
                let v = parseInt(e.target.value, 10);
                if (isNaN(v)) v = 0;
                this.modifier = v;
                this.refreshControls();
            });
        }

        // Botão de Rolagem Principal
        const btnRoll = root.querySelector(`.btn-trigger-roll[data-prefix="${prefix}"]`);
        if (btnRoll) {
            btnRoll.addEventListener('click', () => {
                this.roll(this.count, this.selectedFaces, this.modifier);
            });
        }

        // Presets Rápidos
        root.querySelectorAll(`.btn-preset[data-prefix="${prefix}"]`).forEach(btn => {
            btn.addEventListener('click', () => {
                const c = parseInt(btn.dataset.c, 10);
                const f = parseInt(btn.dataset.f, 10);
                const m = parseInt(btn.dataset.m, 10);
                const t = btn.dataset.t;
                this.roll(c, f, m, t);
            });
        });

        // Limpar Histórico no Drawer
        if (prefix === 'drawer') {
            const btnClear = root.querySelector('#btn-clear-history-drawer');
            if (btnClear) {
                btnClear.addEventListener('click', () => {
                    this.history = [];
                    this.updateHistoryDisplays();
                });
            }
        }
    }

    setupDedicatedHistoryEvents() {
        const btnClear = document.getElementById('btn-clear-history-dedicated');
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                this.history = [];
                this.updateHistoryDisplays();
            });
        }
    }

    /**
     * Atualiza o badge do botão flutuante com o dado ativo
     */
    updateTriggerBadge() {
        const badge = document.getElementById('dice-floating-badge');
        if (badge) {
            badge.textContent = `d${this.selectedFaces}`;
        }
    }

    /**
     * Re-renderiza os controles do rolador
     */
    refreshControls() {
        this.renderDrawerContent();
        if (this.dedicatedViewEl && this.dedicatedViewEl.offsetParent !== null) {
            this.renderDedicatedView();
        }
    }

    /**
     * Conecta gatilhos de clique na ficha para rolagem automática de atributos e perícias
     */
    connectSheetInteractions() {
        // Ao clicar em cartões de atributos na ficha
        document.querySelectorAll('.sheet-attr-card').forEach(card => {
            const attrId = parseInt(card.dataset.attrId, 10);
            const modEl = card.querySelector('.sheet-attr-mod');
            if (modEl) {
                modEl.style.cursor = 'pointer';
                modEl.title = 'Clique para rolar teste de atributo (1d20 + Modificador)';
                modEl.addEventListener('click', () => {
                    const mod = this.engine.getModifier(attrId);
                    const attrNames = ['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Carisma'];
                    const name = attrNames[attrId] || 'Atributo';
                    this.roll(1, 20, mod, `Teste de Atributo: ${name}`);
                    this.openDrawer();
                });
            }
        });
    }
}

// Expõe globalmente
if (typeof window !== 'undefined') {
    window.DiceRollerComponent = DiceRollerComponent;
}