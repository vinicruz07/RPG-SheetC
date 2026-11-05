/**
 * home.js — Visualização Inicial e Apresentação dos Módulos do RPG-SheetC v2.0
 */

class HomeView {
    constructor(engine, appRouter) {
        this.engine = engine;
        this.router = appRouter;
        this.selectedSystemId = 1; // 1: Motor Baseado em Cards (padrão ativo)

        this.systems = [
            {
                id: 1,
                name: 'Motor Baseado em Cards',
                sigil: '🎴',
                status: 'ready',
                statusLabel: 'Motor C Ativo',
                desc: 'Arquitetura universal orientada a dados. Atributos, recursos, equipamentos, magias e perícias modelados como cards modulares.',
                features: [
                    'Cálculos e modificadores em C puro',
                    'Totalmente livre de direitos autorais',
                    'Compatível com qualquer cenário ou sistema',
                    'Serialização JSON de alta performance'
                ]
            },
            {
                id: 2,
                name: 'Fórmulas Dinâmicas & Expressões',
                sigil: '🧮',
                status: 'ready',
                statusLabel: 'Parser C Ativo',
                desc: 'Parser matemático recursivo em C com suporte a expressões aritméticas completas, precedência e referências @chave.',
                features: [
                    'Expressões dinâmicas (ex: @for_mod, @defesa)',
                    'Parênteses, floor, ceil, round e abs',
                    'Recálculo instantâneo na memória linear',
                    'Avaliação determinística em tempo real'
                ]
            },
            {
                id: 3,
                name: 'Virtual Scrolling O(1)',
                sigil: '⚡',
                status: 'ready',
                statusLabel: '60 FPS Estável',
                desc: 'Renderização ultra-otimizada com reciclagem contínua de nós do DOM para navegar em acervos massivos sem travamentos.',
                features: [
                    'Janelamento O(1) de alta performance',
                    'Estável a 60 FPS com 5.000+ cards',
                    'Apenas ~36 nós instanciados no DOM',
                    'Filtros instantâneos por tipo e busca rápida'
                ]
            },
            {
                id: 4,
                name: 'Data Packs & Editor Visual',
                sigil: '📦',
                status: 'ready',
                statusLabel: 'Comunidade Aberta',
                desc: 'Crie, edite, exporte e importe pacotes de cards completos (.cardpack) no formato aberto universal JSON.',
                features: [
                    '1-Click Import do pacote SRD Fantasy',
                    'Editor visual de cards com live preview',
                    'Mesclagem inteligente (merge) de pacotes',
                    'Exportação e compartilhamento comunitário'
                ]
            }
        ];
    }

    /**
     * Inicializa elementos da view de home no DOM
     */
    init() {
        this.container = document.getElementById('systems-grid-container');
        this.selectedBannerTitle = document.getElementById('selected-system-title');
        this.btnStartNew = document.getElementById('btn-home-new-sheet');
        this.btnLoadSheet = document.getElementById('btn-home-load-sheet');
        this.btnManageSheets = document.getElementById('btn-home-manage-sheets');
        this.btnViewActive = document.getElementById('btn-home-view-active');

        this.renderSystemsGrid();
        this.setupActions();
    }

    /**
     * Renderiza os cards de seleção dos sistemas
     */
    renderSystemsGrid() {
        if (!this.container) return;
        this.container.innerHTML = '';

        this.systems.forEach(sys => {
            const card = document.createElement('div');
            card.className = `system-card ${sys.id === this.selectedSystemId ? 'selected' : ''}`;
            card.dataset.systemId = sys.id;

            const pillClass = sys.status === 'ready' ? 'status-pill-ready' : 'status-pill-scaffolding';

            card.innerHTML = `
                <div>
                    <div class="system-card-top">
                        <span class="system-sigil">${sys.sigil}</span>
                        <span class="system-status-pill ${pillClass}">${sys.statusLabel}</span>
                    </div>
                    <h3 class="system-name">${sys.name}</h3>
                    <p class="system-description">${sys.desc}</p>
                </div>
                <ul class="system-features">
                    ${sys.features.map(f => `<li>${f}</li>`).join('')}
                </ul>
            `;

            card.addEventListener('click', () => {
                this.selectSystem(sys.id);
            });

            this.container.appendChild(card);
        });

        this.updateSelectedInfo();
    }

    /**
     * Seleciona um sistema de RPG
     * @param {number} systemId 
     */
    selectSystem(systemId) {
        this.selectedSystemId = systemId;
        const cards = this.container.querySelectorAll('.system-card');
        cards.forEach(card => {
            if (parseInt(card.dataset.systemId, 10) === systemId) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
        this.updateSelectedInfo();
    }

    /**
     * Atualiza o banner de sistema selecionado
     */
    updateSelectedInfo() {
        const sys = this.systems.find(s => s.id === this.selectedSystemId);
        if (this.selectedBannerTitle && sys) {
            this.selectedBannerTitle.textContent = `${sys.sigil} ${sys.name}`;
        }
    }

    /**
     * Conecta os botões de ação da Home
     */
    setupActions() {
        // Acessar Ficha Modular
        if (this.btnStartNew) {
            this.btnStartNew.addEventListener('click', () => {
                if (this.router && typeof this.router.navigate === 'function') {
                    this.router.navigate('sheet');
                }
            });
        }

        // Gerenciar Fichas Salvas (abre modal do localStorage)
        if (this.btnManageSheets) {
            this.btnManageSheets.addEventListener('click', () => {
                if (window.characterManagerModal) {
                    window.characterManagerModal.open();
                }
            });
        }

        // Carregar Ficha do computador
        if (this.btnLoadSheet) {
            this.btnLoadSheet.addEventListener('click', () => {
                if (window.CharacterExportService) {
                    window.CharacterExportService.promptImportFile(this.engine, window.characterStorage, (res) => {
                        if (res.success) {
                            alert(`Ficha "${res.characterName}" carregada com sucesso no motor C!`);
                            if (window.sheetView) {
                                window.sheetView.render();
                            }
                            if (this.router && typeof this.router.navigate === 'function') {
                                this.router.navigate('sheet');
                            }
                        } else {
                            alert(`Falha na importação: ${res.error}`);
                        }
                    });
                }
            });
        }

        // Abrir Compêndio de Cards
        if (this.btnViewActive) {
            this.btnViewActive.addEventListener('click', () => {
                if (this.router && typeof this.router.navigate === 'function') {
                    this.router.navigate('compendium');
                }
            });
        }
    }
}

window.HomeView = HomeView;

