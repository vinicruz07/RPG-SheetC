/**
 * app.ts — Controlador Principal da Interface Web (TypeScript Target) do RPG-SheetC
 * Utiliza o motor agnóstico 100% TypeScript (SheetEngine / SheetCWasm) sem dependência de binários .wasm.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const win = window as any;
    const statusBadge = document.getElementById('engine-status-badge');
    const statusText = document.getElementById('engine-status-text');
    const consoleOutput = document.getElementById('console-output');

    const logToConsole = (msg: string, type = 'info') => {
        if (!consoleOutput) return;
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        const time = new Date().toLocaleTimeString();
        entry.textContent = `[${time}] ${msg}`;
        consoleOutput.prepend(entry);
    };

    // Instancia o Motor Agnóstico Nativo em TypeScript
    const EngineCtor = win.SheetEngine || win.SheetCWasm;
    const engine = new EngineCtor();
    win.rpgEngine = engine;

    // Elementos do Sidebar Drawer
    const sidebarDrawer = document.getElementById('sidebar-drawer');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');
    const btnToggleMenu = document.getElementById('btn-toggle-menu');
    const btnCloseSidebar = document.getElementById('btn-close-sidebar');

    const openSidebar = () => {
        if (sidebarDrawer) {
            sidebarDrawer.classList.add('open');
            sidebarDrawer.setAttribute('aria-hidden', 'false');
        }
        if (sidebarBackdrop) {
            sidebarBackdrop.classList.add('active');
        }
    };

    const closeSidebar = () => {
        if (sidebarDrawer) {
            sidebarDrawer.classList.remove('open');
            sidebarDrawer.setAttribute('aria-hidden', 'true');
        }
        if (sidebarBackdrop) {
            sidebarBackdrop.classList.remove('active');
        }
    };

    if (btnToggleMenu) btnToggleMenu.addEventListener('click', openSidebar);
    if (btnCloseSidebar) btnCloseSidebar.addEventListener('click', closeSidebar);
    if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeSidebar);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebarDrawer && sidebarDrawer.classList.contains('open')) {
            closeSidebar();
        }
    });

    // Roteador da SPA
    const router = {
        currentView: 'home',
        navigate(viewName: string) {
            this.currentView = viewName;

            closeSidebar();

            const navItems = document.querySelectorAll('.sidebar-nav-item[data-view]');
            navItems.forEach((item: any) => {
                if (item.dataset.view === viewName) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });

            const tabs = document.querySelectorAll('.tab-button');
            tabs.forEach((tab: any) => {
                if (tab.dataset.view === viewName) {
                    tab.classList.add('active');
                } else {
                    tab.classList.remove('active');
                }
            });

            const views = document.querySelectorAll('.view-section');
            views.forEach((v: any) => {
                if (v.id === `view-${viewName}`) {
                    v.classList.add('active');
                } else {
                    v.classList.remove('active');
                }
            });

            if (viewName === 'sheet') {
                updateUiState();
            } else if (viewName === 'compendium' && win.compendiumView) {
                win.compendiumView.init('compendium-container');
            } else if (viewName === 'editor' && win.cardEditorView) {
                win.cardEditorView.init('editor-container');
            } else if (viewName === 'creator' && win.wizardView) {
                win.wizardView.render();
            } else if (viewName === 'roller' && win.diceRoller) {
                win.diceRoller.renderDedicatedView();
            }

            logToConsole(`Navegação: visualizando tela "${viewName}".`);
        }
    };
    win.appRouter = router;

    const sidebarNavItems = document.querySelectorAll('.sidebar-nav-item[data-view]');
    sidebarNavItems.forEach((item: any) => {
        item.addEventListener('click', () => {
            if (!item.disabled && item.dataset.view) {
                router.navigate(item.dataset.view);
            }
        });
    });

    const navTabs = document.querySelectorAll('.tab-button[data-view]');
    navTabs.forEach((tab: any) => {
        tab.addEventListener('click', () => {
            if (!tab.disabled && tab.dataset.view) {
                router.navigate(tab.dataset.view);
            }
        });
    });

    // Inicializa o Gerenciador de Armazenamento Local (localStorage)
    const storage = new win.CharacterStorage();
    win.characterStorage = storage;

    const headerSheetsCount = document.getElementById('header-sheets-count');
    const updateStorageBadge = () => {
        if (headerSheetsCount) {
            const count = storage.getAllSheets().length;
            headerSheetsCount.textContent = String(count);
        }
    };
    updateStorageBadge();
    storage.onChange(updateStorageBadge);

    const storageModal = new win.CharacterManagerModal(storage, engine, router, logToConsole);
    win.characterManagerModal = storageModal;

    let sheetView: any = null;
    const btnHeaderManageSheets = document.getElementById('btn-header-manage-sheets');
    if (btnHeaderManageSheets) {
        btnHeaderManageSheets.addEventListener('click', () => {
            if (sheetView) {
                sheetView.showingRoster = true;
            }
            router.navigate('sheet');
        });
    }

    // Inicializa Compêndio de CardPacks primeiro para que o Criador tenha acesso aos pacotes
    let compendiumView: any = null;
    if (typeof win.CompendiumView === 'function') {
        compendiumView = new win.CompendiumView(engine, router, logToConsole);
        win.compendiumView = compendiumView;
    }

    // Inicializa o Gerenciador de Data Packs Comunitários
    let packManager: any = null;
    if (typeof win.PackManager === 'function') {
        packManager = new win.PackManager(engine, logToConsole);
        win.packManager = packManager;
    }

    // Inicializa a View de Home
    let homeView: any = null;
    if (typeof win.HomeView === 'function') {
        homeView = new win.HomeView(engine, router);
        homeView.init();
        win.homeView = homeView;
    }

    // Inicializa o Assistente Universal de Criação de Personagem (Wizard)
    let wizardView: any = null;
    if (typeof win.WizardView === 'function') {
        wizardView = new win.WizardView(engine, router, (hero: any) => {
            logToConsole(`[Motor TS] Herói "${hero.name}" criado com sucesso (${hero.cardCount || engine.getCardCount()} cards)!`, 'success');
            try {
                storage.saveCurrent(engine, hero.name, true);
                updateStorageBadge();
            } catch (e) {
                console.warn('Erro ao salvar nova ficha no storage:', e);
            }
            updateUiState();
        });
        wizardView.init('wizard-container');
        win.wizardView = wizardView;
    }

    // Inicializa a View Principal da Ficha
    if (typeof win.SheetView === 'function') {
        sheetView = new win.SheetView(engine, router, logToConsole);
        win.sheetView = sheetView;
    }

    // Inicializa o Componente de Rolagem de Dados Poliédricos
    let diceRoller: any = null;
    if (typeof win.DiceRollerComponent === 'function') {
        diceRoller = new win.DiceRollerComponent(engine, logToConsole);
        diceRoller.init('view-roller');
        win.diceRoller = diceRoller;
    }

    // Inicializa o Editor Visual de Cards Personalizados
    let cardEditorView: any = null;
    if (typeof win.CardEditorView === 'function') {
        cardEditorView = new win.CardEditorView(engine, router, logToConsole);
        win.cardEditorView = cardEditorView;
    }

    try {
        await engine.load();

        if (statusBadge) {
            statusBadge.classList.remove('status-loading', 'status-error');
            statusBadge.classList.add('status-connected');
        }
        if (statusText) {
            statusText.textContent = 'Motor TS Core Ativo';
        }

        logToConsole('Motor Agnóstico TypeScript v3.0 inicializado com sucesso (Zero WASM, 100% Nativo)!', 'success');

        engine.initDeck('Novo Personagem', 'Sistema Agnóstico');
        engine.clearDeck();
        updateStorageBadge();
        updateUiState();

        // Verifica assincronamente se o servidor Rust está online
        if (engine.apiClient && typeof engine.apiClient.checkHealth === 'function') {
            engine.apiClient.checkHealth().then((online: boolean) => {
                if (online && statusText) {
                    statusText.textContent = 'Motor TS + Servidor Rust Online';
                    logToConsole('[API] Conectado ao servidor Rust central.', 'success');
                }
            }).catch(() => {});
        }
    } catch (err: any) {
        if (statusBadge) {
            statusBadge.classList.remove('status-loading');
            statusBadge.classList.add('status-error');
        }
        if (statusText) {
            statusText.textContent = 'Erro no Motor TS';
        }
        logToConsole(`Falha na inicialização do Motor TS: ${err.message}`, 'error');
    }

    function updateUiState() {
        if (!engine.isLoaded) return;
        if (sheetView) {
            sheetView.init('sheet-container');
        }
        if (compendiumView && router.currentView === 'compendium') {
            compendiumView.init('compendium-container');
        }
    }
});
