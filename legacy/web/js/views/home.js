/**
 * home.js — Visualização Inicial & Galeria de Personagens do RPG-SheetC v2.0
 */

class HomeView {
    constructor(engine, appRouter) {
        this.engine = engine;
        this.router = appRouter;
        this.container = null;
        this.rosterContainer = null;
    }

    /**
     * Inicializa elementos da view de home no DOM
     */
    init() {
        this.rosterContainer = document.getElementById('home-characters-roster-container') || 
                               document.getElementById('systems-grid-container');
        this.btnStartNew = document.getElementById('btn-home-new-sheet');
        this.btnLoadSheet = document.getElementById('btn-home-load-sheet');
        this.btnManageSheets = document.getElementById('btn-home-manage-sheets');
        this.btnViewActive = document.getElementById('btn-home-view-active');

        this.renderRoster();
        this.setupActions();

        // Atualização automática quando personagens forem criados/alterados
        if (window.characterStorage && typeof window.characterStorage.onChange === 'function') {
            window.characterStorage.onChange(() => {
                if (this.rosterContainer && (this.rosterContainer.offsetParent !== null || typeof window === 'undefined')) {
                    this.renderRoster();
                }
            });
        }
    }

    /**
     * Renderiza a galeria visual dos personagens criados
     */
    renderRoster() {
        if (!this.rosterContainer) return;
        if (window.characterStorage) {
            window.characterStorage.renderRosterGallery(this.rosterContainer, this.engine, this.router, {
                onSelect: (sheet) => {
                    if (window.sheetView) {
                        window.sheetView.showingRoster = false;
                        window.sheetView.render();
                    }
                    if (this.router && typeof this.router.navigate === 'function') {
                        this.router.navigate('sheet');
                    }
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
                            this.renderRoster();
                            if (window.sheetView) {
                                window.sheetView.showingRoster = false;
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
