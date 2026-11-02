/**
 * storage.js — Gerenciador de Persistência Local e Fichas Salvas (localStorage)
 * RPG-SheetC — Conectado ao Motor C99 via WebAssembly
 */

class CharacterStorage {
    constructor() {
        this.STORAGE_KEY = 'sheetc_saved_characters';
        this.ACTIVE_KEY = 'sheetc_active_character_id';
        this.listeners = [];
    }

    /**
     * Registra callback para notificações de alteração de armazenamento
     */
    onChange(callback) {
        if (typeof callback === 'function') {
            this.listeners.push(callback);
        }
    }

    _notify() {
        this.listeners.forEach(cb => {
            try { cb(); } catch (e) { console.error('Storage listener error:', e); }
        });
    }

    /**
     * Retorna todas as fichas salvas ordenadas da mais recente para a mais antiga
     * @returns {Array<Object>}
     */
    getAllSheets() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (!raw) return [];
            const list = JSON.parse(raw);
            if (!Array.isArray(list)) return [];
            return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        } catch (err) {
            console.error('Erro ao ler fichas do localStorage:', err);
            return [];
        }
    }

    /**
     * Busca uma ficha por ID
     * @param {string} id 
     * @returns {Object|null}
     */
    getSheet(id) {
        if (!id) return null;
        const list = this.getAllSheets();
        return list.find(s => s.id === id) || null;
    }

    /**
     * Retorna o ID da ficha ativa
     * @returns {string|null}
     */
    getActiveSheetId() {
        try {
            return localStorage.getItem(this.ACTIVE_KEY) || null;
        } catch {
            return null;
        }
    }

    /**
     * Define o ID da ficha ativa
     * @param {string|null} id 
     */
    setActiveSheetId(id) {
        try {
            if (id) {
                localStorage.setItem(this.ACTIVE_KEY, id);
            } else {
                localStorage.removeItem(this.ACTIVE_KEY);
            }
        } catch (e) {
            console.error('Erro ao definir active ID:', e);
        }
    }

    /**
     * Salva o estado atual da ficha do motor C no localStorage
     * @param {Object} engine - Instância SheetCWasm
     * @param {string|null} customName - Nome opcional para sobrescrever
     * @param {boolean} forceNew - Se true, força a criação de um novo registro
     * @returns {Object} A ficha salva
     */
    saveCurrent(engine, customName = null, forceNew = false) {
        if (!engine || !engine.isLoaded) {
            throw new Error('Motor C não está carregado.');
        }

        const data = engine.exportJson();
        if (!data) {
            throw new Error('Não foi possível exportar os dados do motor C.');
        }

        const name = (customName && customName.trim()) 
            ? customName.trim() 
            : (data.nome || engine.getCharacterName() || 'Herói sem Nome');

        data.nome = name; // Garante sincronia do nome no JSON

        const race = data.raca || engine.getActiveRace() || 'Humano';
        const cls = data.classe || engine.getActiveClass() || 'Guerreiro';
        const level = data.nivel || engine.getLevel() || 1;
        const pvCur = engine.getPvAtual();
        const pvMax = engine.getPvMax();
        const pmCur = engine.getPmAtual();
        const pmMax = engine.getPmMax();
        const defense = engine.getDefesa();

        let activeId = forceNew ? null : this.getActiveSheetId();
        let list = this.getAllSheets();
        let sheetRecord = null;

        if (activeId) {
            sheetRecord = list.find(s => s.id === activeId);
        }

        const now = Date.now();

        if (sheetRecord) {
            // Atualiza registro existente
            sheetRecord.name = name;
            sheetRecord.race = race;
            sheetRecord.class = cls;
            sheetRecord.level = level;
            sheetRecord.pvCur = pvCur;
            sheetRecord.pvMax = pvMax;
            sheetRecord.pmCur = pmCur;
            sheetRecord.pmMax = pmMax;
            sheetRecord.defense = defense;
            sheetRecord.data = data;
            sheetRecord.updatedAt = now;
        } else {
            // Cria novo registro
            const newId = 'sheet_' + now + '_' + Math.random().toString(36).substring(2, 7);
            sheetRecord = {
                id: newId,
                name: name,
                race: race,
                class: cls,
                level: level,
                system: 'Tormenta 20',
                systemId: 1,
                pvCur: pvCur,
                pvMax: pvMax,
                pmCur: pmCur,
                pmMax: pmMax,
                defense: defense,
                createdAt: now,
                updatedAt: now,
                data: data
            };
            list.unshift(sheetRecord);
            activeId = newId;
            this.setActiveSheetId(activeId);
        }

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
        this._notify();
        return sheetRecord;
    }

    /**
     * Carrega uma ficha do storage para o motor C
     * @param {string} id 
     * @param {Object} engine 
     * @returns {Object|null}
     */
    loadSheet(id, engine) {
        if (!engine || !engine.isLoaded) return null;
        const sheet = this.getSheet(id);
        if (!sheet || !sheet.data) return null;

        const success = engine.importJson(sheet.data);
        if (success) {
            this.setActiveSheetId(id);
            this._notify();
            return sheet;
        }
        return null;
    }

    /**
     * Renomeia uma ficha salva
     * @param {string} id 
     * @param {string} newName 
     * @param {Object|null} engine - Opcional se for a ficha ativa para atualizar na memória linear
     * @returns {Object|null}
     */
    renameSheet(id, newName, engine = null) {
        if (!id || !newName || !newName.trim()) return null;
        const trimmed = newName.trim();
        const list = this.getAllSheets();
        const sheet = list.find(s => s.id === id);
        if (!sheet) return null;

        sheet.name = trimmed;
        if (sheet.data) {
            sheet.data.nome = trimmed;
        }
        sheet.updatedAt = Date.now();

        // Se a ficha renomeada for a ativa, atualiza no motor C também
        if (engine && engine.isLoaded && this.getActiveSheetId() === id) {
            engine.setCharacterName(trimmed);
        }

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
        this._notify();
        return sheet;
    }

    /**
     * Duplica uma ficha salva gerando uma cópia independente
     * @param {string} id 
     * @returns {Object|null}
     */
    duplicateSheet(id) {
        const original = this.getSheet(id);
        if (!original) return null;

        const list = this.getAllSheets();
        const now = Date.now();
        const cloneId = 'sheet_' + now + '_' + Math.random().toString(36).substring(2, 7);
        const cloneName = `Cópia de ${original.name}`;

        // Clona dados profundos
        const clonedData = JSON.parse(JSON.stringify(original.data));
        clonedData.nome = cloneName;

        const cloneRecord = {
            ...JSON.parse(JSON.stringify(original)),
            id: cloneId,
            name: cloneName,
            createdAt: now,
            updatedAt: now,
            data: clonedData
        };

        list.unshift(cloneRecord);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
        this._notify();
        return cloneRecord;
    }

    /**
     * Exclui uma ficha salva
     * @param {string} id 
     * @returns {boolean}
     */
    deleteSheet(id) {
        if (!id) return false;
        let list = this.getAllSheets();
        const prevLen = list.length;
        list = list.filter(s => s.id !== id);

        if (list.length === prevLen) return false;

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));

        // Se excluiu a ficha ativa, limpa a referência ativa
        if (this.getActiveSheetId() === id) {
            const nextActive = list.length > 0 ? list[0].id : null;
            this.setActiveSheetId(nextActive);
        }

        this._notify();
        return true;
    }

    /**
     * Tenta restaurar automaticamente a última ficha ativa ao iniciar
     * @param {Object} engine 
     * @returns {boolean}
     */
    autoRestore(engine) {
        if (!engine || !engine.isLoaded) return false;
        const activeId = this.getActiveSheetId();
        if (activeId) {
            const sheet = this.getSheet(activeId);
            if (sheet && sheet.data) {
                return engine.importJson(sheet.data);
            }
        }
        return false;
    }

    /**
     * Salva silenciosamente o estado atual (auto-save)
     * @param {Object} engine 
     */
    autoSave(engine) {
        if (!engine || !engine.isLoaded) return;
        try {
            this.saveCurrent(engine);
        } catch (e) {
            console.warn('AutoSave error:', e);
        }
    }
}

/**
 * Modal Interativo de Gerenciamento de Fichas
 */
class CharacterManagerModal {
    constructor(storage, engine, router, logger) {
        this.storage = storage;
        this.engine = engine;
        this.router = router;
        this.logger = logger || console.log;

        this.modalEl = null;
        this.isOpen = false;
        this.searchQuery = '';
    }

    /**
     * Cria e anexa a estrutura do modal ao DOM se ainda não existir
     */
    ensureDom() {
        if (document.getElementById('character-manager-modal')) return;

        const modalMarkup = document.createElement('div');
        modalMarkup.id = 'character-manager-modal';
        modalMarkup.className = 'storage-modal-overlay';
        modalMarkup.innerHTML = `
            <div class="storage-modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-storage-title">
                <!-- Cabeçalho do Modal -->
                <div class="storage-modal-header">
                    <div class="storage-modal-title-wrap">
                        <span class="storage-modal-icon">📜</span>
                        <div>
                            <h2 id="modal-storage-title" class="storage-modal-title">Gerenciador de Fichas Salvas</h2>
                            <p class="storage-modal-subtitle">Persistência local no navegador &bull; Sincronizado ao Motor C99</p>
                        </div>
                    </div>
                    <button type="button" class="storage-modal-close" id="btn-close-storage-modal" title="Fechar (ESC)">&times;</button>
                </div>

                <!-- Barra de Ações Rápidas & Busca -->
                <div class="storage-modal-toolbar">
                    <div class="storage-modal-search">
                        <span class="search-icon">🔍</span>
                        <input type="text" id="storage-search-input" placeholder="Buscar personagem por nome, classe ou raça..." class="storage-input">
                    </div>
                    <div class="storage-modal-actions">
                        <button type="button" id="btn-modal-save-current" class="btn btn-primary" title="Salva o estado atual da ficha ativa">
                            💾 Salvar Ficha Atual
                        </button>
                        <button type="button" id="btn-modal-new-character" class="btn" title="Iniciar assistente para novo personagem">
                            ➕ Novo Personagem
                        </button>
                    </div>
                </div>

                <!-- Notificação / Toast inline -->
                <div id="storage-modal-feedback" class="storage-modal-feedback" style="display: none;"></div>

                <!-- Lista de Fichas -->
                <div class="storage-modal-body">
                    <div id="storage-sheets-list" class="storage-sheets-list">
                        <!-- Renderizado dinamicamente -->
                    </div>
                </div>

                <!-- Rodapé informativo -->
                <div class="storage-modal-footer">
                    <span id="storage-footer-count" class="storage-footer-count">0 fichas salvas localmente</span>
                    <button type="button" class="btn" id="btn-modal-dismiss">Fechar</button>
                </div>
            </div>
        `;

        document.body.appendChild(modalMarkup);

        // Bindings de fechamento
        modalMarkup.addEventListener('click', (e) => {
            if (e.target === modalMarkup) this.close();
        });

        document.getElementById('btn-close-storage-modal').addEventListener('click', () => this.close());
        document.getElementById('btn-modal-dismiss').addEventListener('click', () => this.close());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // Ações da Toolbar
        document.getElementById('btn-modal-save-current').addEventListener('click', () => {
            try {
                const sheet = this.storage.saveCurrent(this.engine);
                this.showFeedback(`Ficha "${sheet.name}" salva com sucesso!`, 'success');
                this.renderList();
                this.logger(`[Storage] Ficha "${sheet.name}" salva no navegador.`, 'success');
            } catch (err) {
                this.showFeedback(`Erro ao salvar: ${err.message}`, 'error');
            }
        });

        document.getElementById('btn-modal-new-character').addEventListener('click', () => {
            this.close();
            if (window.wizardView) {
                window.wizardView.reset(0, 8);
            }
            if (this.router && typeof this.router.navigate === 'function') {
                this.router.navigate('creator');
            }
        });

        const searchInput = document.getElementById('storage-search-input');
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase().trim();
            this.renderList();
        });

        // Atualização automática quando o storage mudar
        this.storage.onChange(() => {
            if (this.isOpen) {
                this.renderList();
            }
        });
    }

    /**
     * Exibe toast/alerta temporário no modal
     */
    showFeedback(msg, type = 'info') {
        const el = document.getElementById('storage-modal-feedback');
        if (!el) return;
        el.textContent = msg;
        el.className = `storage-modal-feedback feedback-${type}`;
        el.style.display = 'block';
        clearTimeout(this._feedbackTimeout);
        this._feedbackTimeout = setTimeout(() => {
            el.style.display = 'none';
        }, 3500);
    }

    /**
     * Formata data amigável
     */
    formatDate(timestamp) {
        if (!timestamp) return 'Data desconhecida';
        const d = new Date(timestamp);
        const pad = (n) => String(n).padStart(2, '0');
        const dia = pad(d.getDate());
        const mes = pad(d.getMonth() + 1);
        const ano = d.getFullYear();
        const hora = pad(d.getHours());
        const min = pad(d.getMinutes());
        return `${dia}/${mes}/${ano} às ${hora}:${min}`;
    }

    /**
     * Abre o modal
     */
    open() {
        this.ensureDom();
        this.isOpen = true;
        const modal = document.getElementById('character-manager-modal');
        if (modal) {
            modal.classList.add('active');
        }
        this.renderList();
    }

    /**
     * Fecha o modal
     */
    close() {
        this.isOpen = false;
        const modal = document.getElementById('character-manager-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    /**
     * Renderiza a lista de fichas salvas
     */
    renderList() {
        const listEl = document.getElementById('storage-sheets-list');
        const countEl = document.getElementById('storage-footer-count');
        if (!listEl) return;

        let sheets = this.storage.getAllSheets();
        const activeId = this.storage.getActiveSheetId();

        if (countEl) {
            countEl.textContent = `${sheets.length} ${sheets.length === 1 ? 'ficha salva' : 'fichas salvas'} no navegador`;
        }

        if (this.searchQuery) {
            sheets = sheets.filter(s => {
                const q = this.searchQuery;
                return (s.name && s.name.toLowerCase().includes(q)) ||
                       (s.class && s.class.toLowerCase().includes(q)) ||
                       (s.race && s.race.toLowerCase().includes(q));
            });
        }

        if (sheets.length === 0) {
            if (this.searchQuery) {
                listEl.innerHTML = `
                    <div class="storage-empty-state">
                        <span class="empty-icon">🔍</span>
                        <h3>Nenhum personagem encontrado</h3>
                        <p>Nenhuma ficha salva corresponde à busca "${this.searchQuery}".</p>
                    </div>
                `;
            } else {
                listEl.innerHTML = `
                    <div class="storage-empty-state">
                        <span class="empty-icon">📂</span>
                        <h3>Nenhuma Ficha Salva</h3>
                        <p>Você ainda não possui fichas guardadas no navegador. Clique no botão acima para salvar sua ficha atual ou criar uma nova!</p>
                        <button type="button" class="btn btn-primary" id="btn-empty-save-now">💾 Salvar Ficha Atual Agora</button>
                    </div>
                `;
                const btnSaveNow = document.getElementById('btn-empty-save-now');
                if (btnSaveNow) {
                    btnSaveNow.addEventListener('click', () => {
                        try {
                            const sheet = this.storage.saveCurrent(this.engine);
                            this.showFeedback(`Ficha "${sheet.name}" salva com sucesso!`, 'success');
                            this.renderList();
                        } catch (e) {
                            this.showFeedback(`Erro: ${e.message}`, 'error');
                        }
                    });
                }
            }
            return;
        }

        listEl.innerHTML = '';

        sheets.forEach(sheet => {
            const isActive = (sheet.id === activeId);
            const card = document.createElement('div');
            card.className = `storage-sheet-card ${isActive ? 'card-active-sheet' : ''}`;
            card.dataset.id = sheet.id;

            card.innerHTML = `
                <div class="sheet-card-info-main">
                    <div class="sheet-card-title-row">
                        <div class="sheet-card-name-group">
                            <span class="sheet-card-sigil">🛡️</span>
                            <h3 class="sheet-card-name">${sheet.name || 'Herói'}</h3>
                            ${isActive ? '<span class="sheet-badge-active">⭐ Ficha Ativa no Motor C</span>' : ''}
                        </div>
                        <span class="sheet-card-date">🕒 ${this.formatDate(sheet.updatedAt)}</span>
                    </div>

                    <div class="sheet-card-pills">
                        <span class="sheet-pill pill-lvl">Nível ${sheet.level || 1}</span>
                        <span class="sheet-pill pill-race">🧬 ${sheet.race || 'Humano'}</span>
                        <span class="sheet-pill pill-class">⚔️ ${sheet.class || 'Guerreiro'}</span>
                        <span class="sheet-pill pill-sys">📜 ${sheet.system || 'Tormenta 20'}</span>
                    </div>

                    <div class="sheet-card-stats-preview">
                        <span class="stat-tag tag-pv">❤️ PV: <strong>${sheet.pvCur ?? '-'}/${sheet.pvMax ?? '-'}</strong></span>
                        <span class="stat-tag tag-pm">💧 PM: <strong>${sheet.pmCur ?? '-'}/${sheet.pmMax ?? '-'}</strong></span>
                        <span class="stat-tag tag-def">🛡️ Defesa: <strong>${sheet.defense ?? '-'}</strong></span>
                    </div>
                </div>

                <div class="sheet-card-actions">
                    <button type="button" class="btn btn-action-load ${isActive ? 'btn-primary' : ''}" data-action="load" title="Carregar no Motor C">
                        ${isActive ? '✅ Ativa' : '📂 Carregar'}
                    </button>
                    <button type="button" class="btn btn-action-icon" data-action="rename" title="Renomear Ficha">
                        ✏️
                    </button>
                    <button type="button" class="btn btn-action-icon" data-action="duplicate" title="Duplicar / Clonar">
                        📋
                    </button>
                    <button type="button" class="btn btn-action-icon btn-action-delete" data-action="delete" title="Excluir Ficha">
                        🗑️
                    </button>
                </div>
            `;

            // Ações do Card
            const btnLoad = card.querySelector('[data-action="load"]');
            btnLoad.addEventListener('click', () => {
                const loaded = this.storage.loadSheet(sheet.id, this.engine);
                if (loaded) {
                    this.showFeedback(`Ficha "${loaded.name}" carregada no motor C!`, 'success');
                    this.logger(`[Storage] Ficha "${loaded.name}" carregada no motor C.`, 'success');
                    this.renderList();
                    // Atualiza a UI da ficha
                    if (window.sheetView) {
                        window.sheetView.render();
                    }
                    setTimeout(() => {
                        this.close();
                        if (this.router && typeof this.router.navigate === 'function') {
                            this.router.navigate('sheet');
                        }
                    }, 400);
                } else {
                    this.showFeedback('Falha ao importar dados para a memória linear do C.', 'error');
                }
            });

            const btnRename = card.querySelector('[data-action="rename"]');
            btnRename.addEventListener('click', () => {
                const currentName = sheet.name || 'Herói';
                const newName = prompt(`Digite o novo nome para "${currentName}":`, currentName);
                if (newName && newName.trim() !== '' && newName.trim() !== currentName) {
                    this.storage.renameSheet(sheet.id, newName.trim(), this.engine);
                    this.showFeedback(`Nome alterado para "${newName.trim()}"!`, 'success');
                    this.renderList();
                    if (window.sheetView) {
                        window.sheetView.render();
                    }
                }
            });

            const btnDuplicate = card.querySelector('[data-action="duplicate"]');
            btnDuplicate.addEventListener('click', () => {
                const clone = this.storage.duplicateSheet(sheet.id);
                if (clone) {
                    this.showFeedback(`Cópia "${clone.name}" criada com sucesso!`, 'success');
                    this.renderList();
                }
            });

            const btnDelete = card.querySelector('[data-action="delete"]');
            btnDelete.addEventListener('click', () => {
                const confirmed = confirm(`Tem certeza que deseja excluir permanentemente a ficha de "${sheet.name}"?`);
                if (confirmed) {
                    this.storage.deleteSheet(sheet.id);
                    this.showFeedback(`Ficha "${sheet.name}" removida.`, 'warn');
                    this.renderList();
                }
            });

            listEl.appendChild(card);
        });
    }
}

// Exportações globais
window.CharacterStorage = CharacterStorage;
window.CharacterManagerModal = CharacterManagerModal;
