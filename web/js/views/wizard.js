/**
 * wizard.js — Fluxo Dedicado de Criação de Nova Ficha Vinculado ao CardPack Principal (RPG-SheetC v2.0)
 * Permite ao usuário selecionar o CardPack de regras principal e optar entre Ficha Rápida ou Assistente Guiado.
 */

class WizardView {
    constructor(engine, router, onCharacterCreated) {
        this.engine = engine;
        this.router = router;
        this.onCharacterCreated = onCharacterCreated;

        this.container = null;
        this.currentStep = 1; // 1: Selecionar CardPack Principal | 2: Nome e Modo de Criação

        this.selectedPackId = null;
        this.characterName = 'Novo Herói';
        this.creationMode = 'direct'; // 'direct' (Ficha Rápida) | 'guided' (Assistente)

        this.fantasyNames = [
            'Valeros', 'Kaelen', 'Lorien', 'Thalor', 'Gwendolyn',
            'Brogor', 'Doran', 'Lyra', 'Aelir', 'Durgoth',
            'Sariel', 'Morgran', 'Vanya', 'Zadok', 'Elora',
            'Theron', 'Cassian', 'Jareth', 'Mirena', 'Branok'
        ];
    }

    /**
     * Inicializa a view do Criador no container
     */
    init(containerId = 'wizard-container') {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.reset();
        this.render();
    }

    /**
     * Reseta o estado do criador
     */
    reset() {
        this.currentStep = 1;
        this.selectedPackId = null;
        this.characterName = this.getRandomName();
        this.creationMode = 'direct';

        // Auto-seleciona o primeiro CardPack se houver
        const packs = this.getAvailablePacks();
        if (packs.length > 0) {
            this.selectedPackId = packs[0].id;
        }
    }

    getRandomName() {
        const idx = Math.floor(Math.random() * this.fantasyNames.length);
        return this.fantasyNames[idx];
    }

    /**
     * Obtém os CardPacks disponíveis (do Compêndio, Storage ou Fallback SRD)
     */
    getAvailablePacks() {
        let packs = [];
        if (window.compendiumView && typeof window.compendiumView.getInstalledPacks === 'function') {
            packs = window.compendiumView.getInstalledPacks();
        } else if (typeof window !== 'undefined' && window.localStorage) {
            try {
                const raw = window.localStorage.getItem('rpg_sheetc_cardpacks_v1');
                if (raw) packs = JSON.parse(raw);
            } catch (e) {
                // continua
            }
        }
        return packs;
    }

    /**
     * Renderiza o fluxo de criação
     */
    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="wizard-wrapper">
                <!-- Stepper de Progresso Superior -->
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

                <!-- Conteúdo do Passo Ativo -->
                ${this.currentStep === 1 ? this.renderStep1() : this.renderStep2()}
            </div>
        `;

        this.setupEventListeners();
    }

    /* =========================================================================
     * Passo 1: Seleção do CardPack Principal
     * ========================================================================= */

    renderStep1() {
        const packs = this.getAvailablePacks();

        return `
            <div class="card wizard-step-card" style="padding: var(--space-xl); background: var(--color-surface-card); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg);">
                <div class="wizard-section-header">
                    <div class="wizard-header-row">
                        <div>
                            <h2 class="wizard-title" style="margin: 0; color: var(--color-gold-light);">
                                📦 Escolha o CardPack Principal
                            </h2>
                            <p class="wizard-subtitle" style="margin-top: 4px; color: var(--color-text-muted);">
                                Cada ficha no RPG-SheetC é regida pelas regras, perícias, fórmulas e itens de seu CardPack base.
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

                ${packs.length === 0 ? `
                    <div style="text-align: center; padding: 40px 20px; background: var(--color-surface-inset); border: 2px dashed var(--color-border-subtle); border-radius: var(--radius-md); margin-bottom: var(--space-lg);">
                        <div style="font-size: 3rem; margin-bottom: 8px;">📭</div>
                        <h3 style="color: var(--color-gold-primary); margin-bottom: 6px;">Nenhum CardPack Instalado no Compêndio</h3>
                        <p style="color: var(--color-text-muted); max-width: 500px; margin: 0 auto 18px auto; font-size: 0.9rem;">
                            Carregue o pacote padrão neutro de fantasia (SRD d20) com 1 clique ou importe qualquer arquivo <code>.cardpack</code> do seu computador.
                        </p>
                        <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
                            <button type="button" id="btn-creator-load-srd-fallback" class="btn btn-primary" style="font-weight: 700;">
                                ✨ Carregar Pacote Padrão SRD d20
                            </button>
                            <button type="button" id="btn-creator-upload-empty" class="btn btn-accent">
                                📂 Fazer Upload de Arquivo .cardpack
                            </button>
                        </div>
                    </div>
                ` : `
                    <div class="creator-packs-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-md); margin-bottom: var(--space-lg);">
                        ${packs.map(p => {
                            const isSelected = p.id === this.selectedPackId;
                            const count = p.cards ? p.cards.length : 0;
                            return `
                                <div class="card creator-pack-card ${isSelected ? 'is-selected' : ''}" data-pack-id="${p.id}" style="cursor: pointer; padding: 16px; border: 2px solid ${isSelected ? 'var(--color-gold-primary)' : 'var(--color-border-subtle)'}; background: ${isSelected ? 'rgba(212, 163, 115, 0.08)' : 'var(--color-surface-inset)'}; border-radius: var(--radius-md); transition: all 0.15s ease;">
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <span style="font-size: 1.4rem;">📦</span>
                                            <strong style="color: var(--color-parchment-light); font-size: 1rem;">${p.name}</strong>
                                        </div>
                                        <input type="radio" name="creator-pack-radio" value="${p.id}" ${isSelected ? 'checked' : ''} style="cursor: pointer;">
                                    </div>
                                    <div style="display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;">
                                        <span class="sheet-meta-pill system-pill" style="font-size: 0.68rem; padding: 2px 6px;">📜 ${p.system}</span>
                                        <span class="sheet-meta-pill race-pill" style="font-size: 0.68rem; padding: 2px 6px;">🃏 ${count} Cards</span>
                                    </div>
                                    <p style="font-size: 0.8rem; color: var(--color-text-muted); margin: 0; line-height: 1.35;">
                                        ${p.desc || 'Pacote de regras para personagens.'}
                                    </p>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}

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
     * Passo 2: Nome do Personagem e Método de Criação
     * ========================================================================= */

    renderStep2() {
        const packs = this.getAvailablePacks();
        const selectedPack = packs.find(p => p.id === this.selectedPackId) || { name: 'Pacote Selecionado', system: 'Sistema Aberto', cards: [] };

        return `
            <div class="card wizard-step-card" style="padding: var(--space-xl); background: var(--color-surface-card); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg);">
                <div class="wizard-section-header">
                    <h2 class="wizard-title" style="margin: 0; color: var(--color-gold-light);">
                        ⚔️ Identidade & Método de Criação
                    </h2>
                    <p class="wizard-subtitle" style="margin-top: 4px; color: var(--color-text-muted);">
                        Defina o nome do herói e como deseja iniciar a ficha a partir de <strong>${selectedPack.name}</strong>.
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

                    <!-- Métodos de Criação: Ficha Rápida vs Assistente -->
                    <div>
                        <label style="display: block; font-size: 0.85rem; font-weight: 700; color: var(--color-gold-primary); margin-bottom: 10px;">
                            Método de Inicialização da Ficha
                        </label>

                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-md);">
                            <!-- Opção 1: Ficha Direta do CardPack -->
                            <div class="card creator-mode-option ${this.creationMode === 'direct' ? 'is-selected' : ''}" data-mode="direct" style="cursor: pointer; padding: 18px; border: 2px solid ${this.creationMode === 'direct' ? 'var(--color-gold-primary)' : 'var(--color-border-subtle)'}; background: ${this.creationMode === 'direct' ? 'rgba(212, 163, 115, 0.08)' : 'var(--color-surface-inset)'}; border-radius: var(--radius-md); transition: all 0.15s ease;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span style="font-size: 1.4rem;">⚡</span>
                                        <strong style="color: var(--color-gold-light); font-size: 1.05rem;">Ficha Rápida do Pacote</strong>
                                    </div>
                                    <span class="badge" style="background: rgba(34, 197, 94, 0.15); color: #4ade80; font-size: 0.7rem;">Recomendado</span>
                                </div>
                                <p style="font-size: 0.82rem; color: var(--color-text-muted); line-height: 1.4; margin: 0;">
                                    Inicializa a ficha imediatamente com todos os atributos, perícias, fórmulas e itens básicos do CardPack prontos para jogar. Você poderá personalizar tudo depois no <strong>Modo Editar</strong>.
                                </p>
                            </div>

                            <!-- Opção 2: Assistente Guiado -->
                            <div class="card creator-mode-option ${this.creationMode === 'guided' ? 'is-selected' : ''}" data-mode="guided" style="cursor: pointer; padding: 18px; border: 2px solid ${this.creationMode === 'guided' ? 'var(--color-gold-primary)' : 'var(--color-border-subtle)'}; background: ${this.creationMode === 'guided' ? 'rgba(212, 163, 115, 0.08)' : 'var(--color-surface-inset)'}; border-radius: var(--radius-md); transition: all 0.15s ease;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span style="font-size: 1.4rem;">🧙</span>
                                        <strong style="color: var(--color-gold-light); font-size: 1.05rem;">Assistente Guiado do Pacote</strong>
                                    </div>
                                </div>
                                <p style="font-size: 0.82rem; color: var(--color-text-muted); line-height: 1.4; margin: 0;">
                                    Abre o assistente guiado passo a passo para distribuir atributos com rolagem de dados e escolher especialidades do pacote.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Rodapé com Botões de Ação -->
                <div class="wizard-footer" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px;">
                    <button type="button" id="btn-creator-prev-step" class="btn btn-secondary">
                        ⬅️ Voltar ao Passo 1
                    </button>
                    <button type="button" id="btn-creator-finish" class="btn btn-primary" style="padding: 10px 28px; font-weight: 800; font-size: 1rem;">
                        ⚔️ Criar Ficha e Jogar
                    </button>
                </div>
            </div>
        `;
    }

    /* =========================================================================
     * Manipulação de Eventos e Finalização
     * ========================================================================= */

    setupEventListeners() {
        if (!this.container) return;

        // Seleção de CardPack no Passo 1
        this.container.querySelectorAll('.creator-pack-card').forEach(card => {
            card.addEventListener('click', () => {
                const packId = card.dataset.packId;
                if (packId) {
                    this.selectedPackId = packId;
                    this.render();
                }
            });
        });

        // Upload de CardPack (vincula botões do header e do estado vazio)
        const uploadButtons = [
            document.getElementById('btn-creator-upload-pack'),
            document.getElementById('btn-creator-upload-empty')
        ].filter(Boolean);
        const fileInput = document.getElementById('creator-file-input');
        if (uploadButtons.length > 0 && fileInput) {
            uploadButtons.forEach(btn => {
                btn.addEventListener('click', () => fileInput.click());
            });
            fileInput.onchange = async (e) => {
                const file = e.target?.files?.[0];
                if (file) {
                    try {
                        const text = await file.text();
                        const parsed = JSON.parse(text);
                        const newPack = {
                            id: 'pack_' + Date.now(),
                            name: parsed.sheet_name || parsed.name || file.name.replace(/\.[^/.]+$/, ''),
                            system: parsed.system_name || parsed.system || 'Sistema Aberto',
                            author: parsed.author || 'Importado',
                            version: parsed.version || '1.0.0',
                            desc: parsed.desc || `Importado de "${file.name}".`,
                            cards: Array.isArray(parsed.cards) ? parsed.cards : []
                        };

                        if (window.compendiumView && typeof window.compendiumView.addOrUpdatePack === 'function') {
                            window.compendiumView.addOrUpdatePack(newPack);
                        }
                        this.selectedPackId = newPack.id;
                        this.render();
                    } catch (err) {
                        alert(`Erro ao ler .cardpack: ${err.message}`);
                    }
                }
            };
        }

        // Carregar SRD Fallback
        const btnSrd = document.getElementById('btn-creator-load-srd-fallback');
        if (btnSrd) {
            btnSrd.addEventListener('click', () => {
                if (window.compendiumView && typeof window.compendiumView.seedStarterCards === 'function') {
                    window.compendiumView.seedStarterCards();
                    const packs = this.getAvailablePacks();
                    if (packs.length > 0) {
                        this.selectedPackId = packs[0].id;
                    }
                    this.render();
                }
            });
        }

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

        // Voltar ao Passo 1
        const btnPrev = document.getElementById('btn-creator-prev-step');
        if (btnPrev) {
            btnPrev.addEventListener('click', () => {
                this.currentStep = 1;
                this.render();
            });
        }

        // Nome do Herói e Aleatório
        const nameInput = document.getElementById('input-creator-name');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.characterName = e.target.value.trim() || 'Novo Herói';
            });
        }

        const btnRandom = document.getElementById('btn-creator-random-name');
        if (btnRandom && nameInput) {
            btnRandom.addEventListener('click', () => {
                const rName = this.getRandomName();
                this.characterName = rName;
                nameInput.value = rName;
            });
        }

        // Escolha de Modo (Ficha Rápida vs Assistente)
        this.container.querySelectorAll('.creator-mode-option').forEach(opt => {
            opt.addEventListener('click', () => {
                this.creationMode = opt.dataset.mode;
                this.render();
            });
        });

        // Botão Finalizar e Criar Ficha
        const btnFinish = document.getElementById('btn-creator-finish');
        if (btnFinish) {
            btnFinish.addEventListener('click', () => {
                this.finishCreation();
            });
        }
    }

    /**
     * Inicializa a ficha no motor C com as regras do CardPack e direciona para a aba Ficha
     */
    finishCreation() {
        if (!this.engine || !this.engine.isLoaded) {
            alert('Motor C não conectado.');
            return;
        }

        const packs = this.getAvailablePacks();
        const pack = packs.find(p => p.id === this.selectedPackId);
        if (!pack) {
            alert('Por favor, selecione um CardPack.');
            return;
        }

        const charName = (this.characterName || 'Novo Herói').trim();
        const sysName = pack.system || 'Sistema Aberto';

        // 1. Inicializa deck limpo no C com identidade da ficha
        this.engine.initDeck(charName, sysName);

        // 2. Importa os cards do CardPack principal
        if (pack.cards && pack.cards.length > 0) {
            this.engine.importCardPack(pack, false);
        }

        // Garante que o nome do herói seja preservado
        this.engine.setCharacterName(charName);
        this.engine.setSystemName(sysName);
        this.engine.recalculate();

        // 3. Salva a nova ficha no CharacterStorage
        if (window.characterStorage && typeof window.characterStorage.saveCurrent === 'function') {
            try {
                window.characterStorage.saveCurrent(this.engine, charName);
            } catch (err) {
                console.warn('[Creator] Falha ao persistir no storage:', err);
            }
        }

        // 4. Notifica callbacks
        if (typeof this.onCharacterCreated === 'function') {
            this.onCharacterCreated({
                name: charName,
                system: sysName,
                cardCount: this.engine.getCardCount()
            });
        }

        // 5. Configura a SheetView e navega para a Ficha
        if (window.sheetView) {
            window.sheetView.showingRoster = false;
            window.sheetView.sheetMode = 'play'; // Inicia no Modo In-Game ágil
            window.sheetView.render();
        }

        if (this.router && typeof this.router.navigate === 'function') {
            this.router.navigate('sheet');
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
