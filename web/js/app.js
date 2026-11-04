/**
 * app.js — Controlador Principal da Interface Web do RPG-SheetC
 */

document.addEventListener('DOMContentLoaded', async () => {
    const statusBadge = document.getElementById('engine-status-badge');
    const statusText = document.getElementById('engine-status-text');
    const heroNameEl = document.getElementById('hero-name');
    const heroClassEl = document.getElementById('hero-class');
    const heroLevelEl = document.getElementById('hero-level');
    const heroHpEl = document.getElementById('hero-hp');
    const heroMpEl = document.getElementById('hero-mp');
    const heroDefenseEl = document.getElementById('hero-defense');
    const consoleOutput = document.getElementById('console-output');

    const logToConsole = (msg, type = 'info') => {
        if (!consoleOutput) return;
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        const time = new Date().toLocaleTimeString();
        entry.textContent = `[${time}] ${msg}`;
        consoleOutput.prepend(entry);
    };

    // Cria a instância do wrapper do módulo C
    const engine = new window.SheetCWasm();
    window.rpgEngine = engine; // Disponível no DevTools para inspeção interativa

    // Roteador simples da SPA
    const router = {
        currentView: 'home',
        navigate(viewName) {
            this.currentView = viewName;
            
            // Alterna abas
            const tabs = document.querySelectorAll('.tab-button');
            tabs.forEach(tab => {
                if (tab.dataset.view === viewName) {
                    tab.classList.add('active');
                } else {
                    tab.classList.remove('active');
                }
            });

            // Alterna seções
            const views = document.querySelectorAll('.view-section');
            views.forEach(v => {
                if (v.id === `view-${viewName}`) {
                    v.classList.add('active');
                } else {
                    v.classList.remove('active');
                }
            });

            if (viewName === 'sheet') {
                updateUiState();
            } else if (viewName === 'compendium' && window.compendiumView) {
                window.compendiumView.init('compendium-container');
            } else if (viewName === 'creator' && window.wizardView) {
                window.wizardView.render();
            } else if (viewName === 'roller' && window.diceRoller) {
                window.diceRoller.renderDedicatedView();
            }

            logToConsole(`Navegação: visualizando tela "${viewName}".`);
        }
    };
    window.appRouter = router;

    // Configura cliques nas abas de navegação
    const navTabs = document.querySelectorAll('.tab-button[data-view]');
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (!tab.disabled && tab.dataset.view) {
                router.navigate(tab.dataset.view);
            }
        });
    });

    // Inicializa o Gerenciador de Armazenamento Local (localStorage)
    const storage = new window.CharacterStorage();
    window.characterStorage = storage;

    // Atualiza contagem de fichas no header
    const headerSheetsCount = document.getElementById('header-sheets-count');
    const updateStorageBadge = () => {
        if (headerSheetsCount) {
            const count = storage.getAllSheets().length;
            headerSheetsCount.textContent = count;
        }
    };
    updateStorageBadge();
    storage.onChange(updateStorageBadge);

    // Inicializa o Modal de Gerenciamento de Fichas
    const storageModal = new window.CharacterManagerModal(storage, engine, router, logToConsole);
    window.characterManagerModal = storageModal;

    const btnHeaderManageSheets = document.getElementById('btn-header-manage-sheets');
    if (btnHeaderManageSheets) {
        btnHeaderManageSheets.addEventListener('click', () => {
            storageModal.open();
        });
    }

    // Inicializa a View de Home (Seleção de Sistemas)
    let homeView = null;
    if (typeof window.HomeView === 'function') {
        homeView = new window.HomeView(engine, router);
        homeView.init();
        window.homeView = homeView;
    }

    // Inicializa o Assistente de Criação de Personagem (Wizard)
    let wizardView = null;
    if (typeof window.WizardView === 'function') {
        wizardView = new window.WizardView(engine, router, (hero) => {
            logToConsole(`[C Wizard] Herói "${hero.name}" criado com sucesso! PV: ${hero.pv}/${hero.pvMax}, PM: ${hero.pm}/${hero.pmMax}, Defesa: ${hero.defense}.`, 'success');
            // Salva a nova ficha no storage local
            try {
                storage.saveCurrent(engine, hero.name, true);
                updateStorageBadge();
                logToConsole(`[Storage] Nova ficha "${hero.name}" persistida no armazenamento local.`, 'info');
            } catch (e) {
                console.warn('Erro ao salvar nova ficha no storage:', e);
            }
            updateUiState();
        });
        wizardView.init('wizard-container');
        window.wizardView = wizardView;
    }

    // Inicializa a View Principal da Ficha (Edição In-Place)
    let sheetView = null;
    if (typeof window.SheetView === 'function') {
        sheetView = new window.SheetView(engine, router, logToConsole);
        window.sheetView = sheetView;
    }

    // Inicializa o Componente de Rolagem de Dados Poliédricos
    let diceRoller = null;
    if (typeof window.DiceRollerComponent === 'function') {
        diceRoller = new window.DiceRollerComponent(engine, logToConsole);
        diceRoller.init('view-roller');
        window.diceRoller = diceRoller;
    }

    // Inicializa a View do Compêndio de Cards (Virtual Scrolling)
    let compendiumView = null;
    if (typeof window.CompendiumView === 'function') {
        compendiumView = new window.CompendiumView(engine, router, logToConsole);
        window.compendiumView = compendiumView;
    }

    try {
        logToConsole('Iniciando carregamento do binário WebAssembly (sheetc_core.wasm)...');
        await engine.load('./dist/sheetc_core.wasm');

        // Atualiza o indicador de status para sucesso
        if (statusBadge) {
            statusBadge.classList.remove('status-loading', 'status-error');
            statusBadge.classList.add('status-connected');
        }
        if (statusText) {
            statusText.textContent = 'Motor C Conectado';
        }

        logToConsole('Motor C (Clang 16 wasm32) conectado com sucesso! Sistema padrão: Tormenta 20.', 'success');

        // Tenta restaurar automaticamente a última ficha ativa salva no localStorage
        if (storage.autoRestore(engine)) {
            const restoredName = engine.getCharacterName();
            logToConsole(`[Storage] Ficha ativa "${restoredName}" restaurada automaticamente do navegador.`, 'info');
        } else {
            // Se não houver fichas salvas, salva a ficha inicial para que o usuário já tenha um slot
            if (storage.getAllSheets().length === 0) {
                storage.saveCurrent(engine, engine.getCharacterName());
            }
        }
        updateStorageBadge();

        // Atualiza a visualização inicial dos dados
        updateUiState();

        // Configuração dos eventos de teste interativos da casca
        setupEventListeners(engine, logToConsole, updateUiState);

    } catch (err) {
        if (statusBadge) {
            statusBadge.classList.remove('status-loading');
            statusBadge.classList.add('status-error');
        }
        if (statusText) {
            statusText.textContent = 'Erro ao Conectar Motor C';
        }
        logToConsole(`Falha na inicialização do WebAssembly: ${err.message}`, 'error');
        logToConsole('Dica: Execute um servidor HTTP local simples (ex: python -m http.server 8000 na pasta web) para permitir streaming de módulos WASM.', 'warn');
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

    function setupEventListeners(engine, log, refresh) {
        // Botão Rolar d20 no motor C
        const btnRollD20 = document.getElementById('btn-test-d20');
        if (btnRollD20) {
            btnRollD20.addEventListener('click', () => {
                const res = engine.rollDice(1, 20, 0);
                let tag = '';
                if (res.isCritical) tag = ' (CRÍTICO!)';
                if (res.isFumble) tag = ' (FALHA CRÍTICA!)';
                log(`[C Dice Engine] Rolagem 1d20: Resultado = ${res.total}${tag}`, res.isCritical ? 'success' : (res.isFumble ? 'warn' : 'info'));
            });
        }

        // Botão Rolar 3d6+5 no motor C
        const btnRollComplex = document.getElementById('btn-test-complex');
        if (btnRollComplex) {
            btnRollComplex.addEventListener('click', () => {
                const res = engine.rollDice(3, 6, 5);
                log(`[C Dice Engine] Rolagem 3d6+5: Dados [${res.rolls.join(', ')}] + 5 = ${res.total}`, 'info');
            });
        }

        // Botões de Manipulação de PV (+5 / -5)
        const btnHeal = document.getElementById('btn-heal');
        if (btnHeal) {
            btnHeal.addEventListener('click', () => {
                engine.modifyPv(5);
                refresh();
                log(`[C Rules] PV modificado em +5. Atual: ${engine.getPvAtual()}/${engine.getPvMax()}`);
            });
        }

        const btnDamage = document.getElementById('btn-damage');
        if (btnDamage) {
            btnDamage.addEventListener('click', () => {
                engine.modifyPv(-5);
                refresh();
                log(`[C Rules] PV modificado em -5. Atual: ${engine.getPvAtual()}/${engine.getPvMax()}`);
            });
        }

        // Alterar Nome
        const btnChangeName = document.getElementById('btn-change-name');
        if (btnChangeName) {
            btnChangeName.addEventListener('click', () => {
                const newName = prompt('Digite o novo nome do personagem:', engine.getCharacterName());
                if (newName && newName.trim() !== '') {
                    engine.setCharacterName(newName.trim());
                    refresh();
                    log(`[C Memory] Nome atualizado na memória linear para: "${engine.getCharacterName()}"`);
                }
            });
        }

        // Dump JSON do C
        const btnDumpJson = document.getElementById('btn-dump-json');
        if (btnDumpJson) {
            btnDumpJson.addEventListener('click', () => {
                const json = engine.exportJson();
                log(`[C Serializer] JSON exportado do C:\n${JSON.stringify(json, null, 2)}`, 'info');
            });
        }
    }
});
