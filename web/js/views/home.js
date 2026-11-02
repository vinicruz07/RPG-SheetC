/**
 * home.js — Visualização Inicial e Seleção de Sistemas de RPG
 */

class HomeView {
    constructor(engine, appRouter) {
        this.engine = engine;
        this.router = appRouter;
        this.selectedSystemId = 1; // 1: Tormenta 20 (padrão ativo)

        this.systems = [
            {
                id: 1,
                name: 'Tormenta 20',
                sigil: '⚔️',
                status: 'ready',
                statusLabel: 'Motor C Ativo',
                desc: 'O maior RPG do Brasil. 14 classes oficiais, 29 perícias treinadas, pontos de vida e mana calculados automaticamente.',
                features: [
                    'Rolagens com d20 oficial no C',
                    'Fórmula canônica de modificadores e PV/PM',
                    'Cálculo de Defesa com armaduras e escudos',
                    'Serialização JSON de alta velocidade'
                ]
            },
            {
                id: 2,
                name: 'Dungeons & Dragons 5e',
                sigil: '🐉',
                status: 'scaffolding',
                statusLabel: 'Scaffolding C Pronto',
                desc: 'O RPG mais jogado do mundo. Atributos clássicos, bônus de proficiência por nível, Armor Class e Hit Points.',
                features: [
                    'Struct DnD5eSheet compilada em C',
                    'Bônus de proficiência (+2 a +6)',
                    'Iniciativa e Classe de Armadura',
                    'União polimórfica RPGSheet'
                ]
            },
            {
                id: 3,
                name: 'Fabula Ultima',
                sigil: '✨',
                status: 'scaffolding',
                statusLabel: 'Scaffolding C Pronto',
                desc: 'Inspirado nos clássicos JRPGs de mesa. Atributos baseados no tamanho dos dados (d6-d12), Pontos de Fabula e Inventário.',
                features: [
                    'Struct FabulaSheet compilada em C',
                    'Atributos como dados (d6, d8, d10, d12)',
                    'HP e MP derivados de Vigor e Vontade',
                    'Defesa Física e Mágica automáticas'
                ]
            },
            {
                id: 4,
                name: '3D&T Victory',
                sigil: '💥',
                status: 'scaffolding',
                statusLabel: 'Scaffolding C Pronto',
                desc: 'Regras ágeis de anime e mangá. Características Poder, Habilidade e Resistência com escalas Ningen a Kami.',
                features: [
                    'Struct ThreeDetSheet compilada em C',
                    'Características P, H e R',
                    'Cálculo de PV e PM baseados em R * 5',
                    'Pontos de Ação e Defesa passiva (H+R)'
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
        // Criar Nova Ficha
        if (this.btnStartNew) {
            this.btnStartNew.addEventListener('click', () => {
                if (this.selectedSystemId === 1) {
                    // Tormenta 20: abre o assistente passo-a-passo de criação
                    if (window.wizardView) {
                        window.wizardView.reset(0, 8);
                    }
                    if (this.router && typeof this.router.navigate === 'function') {
                        this.router.navigate('creator');
                        return;
                    }
                }
                if (this.router && typeof this.router.navigate === 'function') {
                    this.router.navigate('sheet');
                }
            });
        }

        // Carregar Ficha (prepara file input para JSON)
        if (this.btnLoadSheet) {
            this.btnLoadSheet.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json,.sheetc';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        try {
                            const json = JSON.parse(event.target.result);
                            const ok = this.engine.importJson(json);
                            if (ok) {
                                alert(`Ficha "${json.nome || 'Herói'}" carregada com sucesso no motor C!`);
                                if (this.router && typeof this.router.navigate === 'function') {
                                    this.router.navigate('sheet');
                                }
                            } else {
                                alert('Erro: O motor C não conseguiu processar este arquivo.');
                            }
                        } catch (err) {
                            alert('Arquivo inválido: Não foi possível ler o JSON.');
                        }
                    };
                    reader.readAsText(file);
                };
                input.click();
            });
        }

        // Ver Ficha Ativa
        if (this.btnViewActive) {
            this.btnViewActive.addEventListener('click', () => {
                if (this.router && typeof this.router.navigate === 'function') {
                    this.router.navigate('sheet');
                }
            });
        }
    }
}

window.HomeView = HomeView;

