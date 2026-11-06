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
                system: 'Agnóstico v2.0',
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
     * Define ou atualiza a foto/avatar de um personagem
     */
    setSheetAvatar(id, avatarUrl) {
        if (!id) return false;
        const list = this.getAllSheets();
        const sheet = list.find(s => s.id === id);
        if (!sheet) return false;
        sheet.avatar = avatarUrl;
        sheet.updatedAt = Date.now();
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
        this._notify();
        return true;
    }

    /**
     * Define a localização física do arquivo da ficha no computador
     */
    setSheetFilePath(id, filePath) {
        if (!id) return false;
        const list = this.getAllSheets();
        const sheet = list.find(s => s.id === id);
        if (!sheet) return false;
        sheet.filePath = filePath;
        sheet.updatedAt = Date.now();
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
        this._notify();
        return true;
    }

    /**
     * Retorna o avatar ou símbolo visual estilizado para o personagem
     */
    getDefaultAvatar(sheet) {
        if (sheet.avatar && sheet.avatar.trim()) {
            return { type: 'custom', value: sheet.avatar };
        }
        const cls = (sheet.class || '').toLowerCase();
        if (cls.includes('guerreiro') || cls.includes('cavaleiro') || cls.includes('lutador')) {
            return { type: 'icon', icon: '⚔️', bg: 'linear-gradient(135deg, #7f1d1d 0%, #350808 100%)' };
        }
        if (cls.includes('arcanista') || cls.includes('mago') || cls.includes('bruxo') || cls.includes('feiticeiro')) {
            return { type: 'icon', icon: '🔮', bg: 'linear-gradient(135deg, #312e81 0%, #151336 100%)' };
        }
        if (cls.includes('ladino') || cls.includes('bucaneiro') || cls.includes('cacador') || cls.includes('caçador')) {
            return { type: 'icon', icon: '🗡️', bg: 'linear-gradient(135deg, #064e3b 0%, #022018 100%)' };
        }
        if (cls.includes('clerigo') || cls.includes('clérigo') || cls.includes('paladino')) {
            return { type: 'icon', icon: '✨', bg: 'linear-gradient(135deg, #78350f 0%, #381803 100%)' };
        }
        if (cls.includes('bardo')) {
            return { type: 'icon', icon: '🎭', bg: 'linear-gradient(135deg, #701a75 0%, #350438 100%)' };
        }
        if (cls.includes('druida')) {
            return { type: 'icon', icon: '🍃', bg: 'linear-gradient(135deg, #14532d 0%, #052410 100%)' };
        }
        return { type: 'icon', icon: '🛡️', bg: 'linear-gradient(135deg, #374151 0%, #171d26 100%)' };
    }

    /**
     * Renderiza a Galeria Visual de Personagens (Ícones/Retângulos com Foto)
     * Reutilizada tanto na Home quanto na aba de Ficha
     * @param {HTMLElement} container 
     * @param {Object} engine 
     * @param {Object} router 
     * @param {Object} callbacks { onSelect, onNew, onImport }
     */
    renderRosterGallery(container, engine, router, callbacks = {}) {
        if (!container) return;
        container.innerHTML = '';

        const sheets = this.getAllSheets();
        const activeId = this.getActiveSheetId();

        const grid = document.createElement('div');
        grid.className = 'character-roster-grid';

        // 1. Cards dos Personagens Salvos
        sheets.forEach(sheet => {
            const card = document.createElement('div');
            const isActive = (sheet.id === activeId && engine && engine.isLoaded && engine.getCardCount() > 0);
            card.className = `character-card-icon ${isActive ? 'active-sheet-card' : ''}`;
            card.dataset.sheetId = sheet.id;

            const av = this.getDefaultAvatar(sheet);
            const portraitContent = av.type === 'custom'
                ? `<img src="${av.value}" alt="${sheet.name}" class="char-portrait-custom-img" onerror="this.parentElement.innerHTML='⚔️';">`
                : `<span class="char-portrait-emoji">${av.icon}</span>`;
            const portraitBg = av.type === 'custom' ? '#111' : av.bg;

            const fileLabel = sheet.filePath 
                ? `<div class="char-card-filepath" title="${sheet.filePath}">📂 ${sheet.filePath.split(/[\\\\/]/).pop()}</div>`
                : '';

            card.innerHTML = `
                <div class="char-portrait-wrapper" style="background: ${portraitBg}">
                    <div class="char-portrait-content">${portraitContent}</div>
                    <div class="char-level-badge">Nível ${sheet.level || 1}</div>
                    ${isActive ? '<span class="char-active-pill">⚔️ Ficha Ativa</span>' : ''}
                    <button type="button" class="btn-change-avatar" title="Alterar Foto/Retrato" data-action="change-photo">📷</button>
                </div>
                <div class="char-card-body">
                    <h3 class="char-card-name" title="${sheet.name}">${sheet.name}</h3>
                    <div class="char-card-meta">${sheet.race || 'Humano'} &bull; ${sheet.class || 'Aventureiro'}</div>
                    <div class="char-card-sys-pill">📜 ${sheet.system || 'Agnóstico v2.0'}</div>
                    
                    <div class="char-card-quick-stats">
                        <span class="quick-stat-item stat-pv" title="Pontos de Vida">
                            <span class="quick-stat-icon">❤️</span>
                            <span class="quick-stat-val">${sheet.pvCur ?? '-'}/${sheet.pvMax ?? '-'}</span>
                        </span>
                        <span class="quick-stat-item stat-pm" title="Pontos de Mana">
                            <span class="quick-stat-icon">💧</span>
                            <span class="quick-stat-val">${sheet.pmCur ?? '-'}/${sheet.pmMax ?? '-'}</span>
                        </span>
                        <span class="quick-stat-item stat-def" title="Defesa">
                            <span class="quick-stat-icon">🛡️</span>
                            <span class="quick-stat-val">${sheet.defense ?? '-'}</span>
                        </span>
                    </div>

                    ${fileLabel}
                </div>
                <div class="char-card-actions">
                    <button type="button" class="btn btn-primary btn-play-char" data-action="play" title="Abrir e Jogar com esta Ficha">
                        ⚔️ Jogar
                    </button>
                    <button type="button" class="btn btn-action-icon" data-action="export" title="Exportar Ficha (.sheetc)">
                        📥
                    </button>
                    <button type="button" class="btn btn-action-icon btn-action-delete" data-action="delete" title="Excluir Personagem">
                        🗑️
                    </button>
                </div>
            `;

            // Evento: Jogar / Abrir
            card.querySelector('[data-action="play"]').addEventListener('click', (e) => {
                e.stopPropagation();
                const loaded = this.loadSheet(sheet.id, engine);
                if (loaded) {
                    if (callbacks.onSelect) {
                        callbacks.onSelect(loaded);
                    } else {
                        if (window.sheetView) {
                            window.sheetView.showingRoster = false;
                            window.sheetView.render();
                        }
                        if (router && typeof router.navigate === 'function') {
                            router.navigate('sheet');
                        }
                    }
                }
            });

            // Evento: Alterar Foto
            card.querySelector('[data-action="change-photo"]').addEventListener('click', (e) => {
                e.stopPropagation();
                const newPhoto = prompt('Informe a URL da imagem (ou cole um emoji) para o retrato do personagem:', sheet.avatar || '');
                if (newPhoto !== null) {
                    this.setSheetAvatar(sheet.id, newPhoto.trim());
                    this.renderRosterGallery(container, engine, router, callbacks);
                }
            });

            // Evento: Exportar
            card.querySelector('[data-action="export"]').addEventListener('click', (e) => {
                e.stopPropagation();
                try {
                    const charName = sheet.name || 'heroi';
                    const sanitized = charName.toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
                    const filename = `${sanitized}.sheetc`;
                    const payload = {
                        format: 'RPG-SheetC',
                        version: '2.0.0',
                        exportedAt: new Date().toISOString(),
                        engine: 'C99 Freestanding WebAssembly',
                        system: sheet.system || 'Agnóstico v2.0',
                        sheet: sheet.data
                    };
                    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                } catch (err) {
                    alert('Erro ao exportar: ' + err.message);
                }
            });

            // Evento: Excluir
            card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Tem certeza que deseja excluir o personagem "${sheet.name}"?`)) {
                    this.deleteSheet(sheet.id);
                    this.renderRosterGallery(container, engine, router, callbacks);
                    if (window.sheetView) {
                        window.sheetView.render();
                    }
                }
            });

            // Clique no próprio card abre a ficha
            card.addEventListener('click', () => {
                const btn = card.querySelector('[data-action="play"]');
                if (btn) btn.click();
            });

            grid.appendChild(card);
        });

        // 2. Card de Ação Especial: Criar Novo Personagem
        const cardNew = document.createElement('div');
        cardNew.className = 'character-card-icon card-action-dashed';
        cardNew.innerHTML = `
            <div class="card-action-dashed-inner">
                <span class="action-dashed-icon">➕</span>
                <h3 class="action-dashed-title">Novo Personagem</h3>
                <p class="action-dashed-desc">Crie um novo herói escolhendo um CardPack do seu compêndio.</p>
            </div>
        `;
        cardNew.addEventListener('click', () => {
            if (callbacks.onNew) {
                callbacks.onNew();
            } else if (router && typeof router.navigate === 'function') {
                router.navigate('creator');
            }
        });
        grid.appendChild(cardNew);

        // 3. Card de Ação Especial: Carregar do Computador
        const cardImport = document.createElement('div');
        cardImport.className = 'character-card-icon card-action-dashed';
        cardImport.innerHTML = `
            <div class="card-action-dashed-inner">
                <span class="action-dashed-icon">📂</span>
                <h3 class="action-dashed-title">Carregar Ficha Local</h3>
                <p class="action-dashed-desc">Abra um arquivo .sheetc ou .json salvo no seu computador.</p>
            </div>
        `;
        cardImport.addEventListener('click', () => {
            if (window.CharacterExportService) {
                window.CharacterExportService.promptImportFile(engine, this, (res) => {
                    if (res.success) {
                        this.renderRosterGallery(container, engine, router, callbacks);
                        if (window.sheetView) {
                            window.sheetView.showingRoster = false;
                            window.sheetView.render();
                        }
                        if (router && typeof router.navigate === 'function') {
                            router.navigate('sheet');
                        }
                    } else {
                        alert(`Falha na importação: ${res.error}`);
                    }
                });
            }
        });
        grid.appendChild(cardImport);

        container.appendChild(grid);
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
                        <button type="button" id="btn-modal-import-file" class="btn" title="Importar arquivo .sheetc ou .json do computador">
                            📥 Importar Arquivo
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

        const btnModalImport = document.getElementById('btn-modal-import-file');
        if (btnModalImport) {
            btnModalImport.addEventListener('click', () => {
                if (window.CharacterExportService) {
                    window.CharacterExportService.promptImportFile(this.engine, this.storage, (res) => {
                        if (res.success) {
                            this.showFeedback(`Ficha "${res.characterName}" importada com sucesso!`, 'success');
                            this.renderList();
                            if (window.sheetView) {
                                window.sheetView.render();
                            }
                        } else {
                            this.showFeedback(`Erro ao importar: ${res.error}`, 'error');
                        }
                    });
                }
            });
        }

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
                        <span class="sheet-pill pill-sys">📜 ${sheet.system || 'Agnóstico v2.0'}</span>
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
                    <button type="button" class="btn btn-action-icon" data-action="export" title="Exportar para arquivo .sheetc">
                        📥
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

            const btnExport = card.querySelector('[data-action="export"]');
            btnExport.addEventListener('click', () => {
                try {
                    const charName = sheet.name || 'heroi';
                    const sanitized = charName.toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
                    const filename = `${sanitized}.sheetc`;

                    const payload = {
                        format: 'RPG-SheetC',
                        version: '2.0.0',
                        exportedAt: new Date().toISOString(),
                        engine: 'C99 Freestanding WebAssembly',
                        system: sheet.system || 'Agnóstico v2.0',
                        systemId: sheet.systemId || 1,
                        sheet: sheet.data
                    };

                    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 1000);

                    this.showFeedback(`Ficha "${charName}" exportada como ${filename}!`, 'success');
                } catch (e) {
                    this.showFeedback(`Erro ao exportar: ${e.message}`, 'error');
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

