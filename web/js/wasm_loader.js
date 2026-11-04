/**
 * wasm_loader.js — Carregador e Wrapper Reativo do Motor de Cards em C (RPG-SheetC v2.0)
 * Conecta o binário WebAssembly (sheetc_core.wasm) ao Frontend Vanilla JS + Virtual Scroll.
 */

const CARD_TYPES = Object.freeze({
    ATTRIBUTE: 0,
    RESOURCE:  1,
    STAT:      2,
    SKILL:     3,
    ABILITY:   4,
    EQUIPMENT: 5,
    SPELL:     6,
    TRAIT:     7
});

const CARD_TYPE_META = Object.freeze({
    0: { key: 'attribute', label: 'Atributo',    icon: '💪', badgeClass: 'badge-attr' },
    1: { key: 'resource',  label: 'Recurso',     icon: '❤️', badgeClass: 'badge-res' },
    2: { key: 'stat',      label: 'Estatística', icon: '🛡️', badgeClass: 'badge-stat' },
    3: { key: 'skill',     label: 'Perícia',     icon: '🎯', badgeClass: 'badge-skill' },
    4: { key: 'ability',   label: 'Habilidade',  icon: '⚡', badgeClass: 'badge-ability' },
    5: { key: 'equipment', label: 'Equipamento', icon: '⚔️', badgeClass: 'badge-equip' },
    6: { key: 'spell',     label: 'Magia',       icon: '✨', badgeClass: 'badge-spell' },
    7: { key: 'trait',     label: 'Característica', icon: '🧬', badgeClass: 'badge-trait' }
});

class SheetCWasm {
    constructor() {
        this.instance = null;
        this.exports = null;
        this.memory = null;
        this.encoder = new TextEncoder();
        this.decoder = new TextDecoder('utf-8');
        this.isLoaded = false;
        this.listeners = new Set();
    }

    static get CARD_TYPES() {
        return CARD_TYPES;
    }

    static get CARD_TYPE_META() {
        return CARD_TYPE_META;
    }

    /* =========================================================================
     * 1. Sistema Reativo de Eventos (Pub/Sub Leve)
     * ========================================================================= */

    /**
     * Registra um listener chamado sempre que o estado do deck na memória C mudar
     * @param {Function} callback
     * @returns {Function} Função para cancelar a inscrição
     */
    onChange(callback) {
        if (typeof callback === 'function') {
            this.listeners.add(callback);
        }
        return () => this.listeners.delete(callback);
    }

    emitChange(reason = 'update') {
        for (const fn of this.listeners) {
            try {
                fn(reason, this);
            } catch (err) {
                console.error('[SheetCWasm Listener Error]', err);
            }
        }
    }

    /* =========================================================================
     * 2. Inicialização e Carregamento do Módulo WebAssembly
     * ========================================================================= */

    /**
     * Carrega e instancia o binário WebAssembly
     * @param {string|Buffer|ArrayBuffer|Uint8Array} wasmUrl Caminho para o arquivo .wasm ou bytes em memória
     */
    async load(wasmUrl = './dist/sheetc_core.wasm') {
        const importObject = { env: {} };

        // Suporte direto a buffers em memória (testes automatizados em Node.js e offline)
        if (
            typeof ArrayBuffer !== 'undefined' &&
            (wasmUrl instanceof ArrayBuffer ||
             wasmUrl instanceof Uint8Array ||
             (typeof Buffer !== 'undefined' && Buffer.isBuffer(wasmUrl)))
        ) {
            const result = await WebAssembly.instantiate(wasmUrl, importObject);
            this.instance = result.instance || result;
            this.exports = this.instance.exports;
            this.memory = this.exports.memory;
            this.isLoaded = true;
            if (typeof this.exports.wasm_init === 'function') {
                this.exports.wasm_init();
            }
            return true;
        }

        try {
            if (typeof WebAssembly.instantiateStreaming === 'function') {
                try {
                    const response = await fetch(wasmUrl);
                    if (response.ok && response.headers?.get && response.headers.get('content-type')?.includes('application/wasm')) {
                        const result = await WebAssembly.instantiateStreaming(response, importObject);
                        this.instance = result.instance;
                    }
                } catch (streamingErr) {
                    console.warn('[WASM] instantiateStreaming indisponível, usando fallback arrayBuffer:', streamingErr);
                }
            }

            if (!this.instance) {
                const response = await fetch(wasmUrl);
                if (!response.ok) {
                    throw new Error(`Falha ao carregar ${wasmUrl}: HTTP ${response.status} ${response.statusText}`);
                }
                const bytes = await response.arrayBuffer();
                const result = await WebAssembly.instantiate(bytes, importObject);
                this.instance = result.instance;
            }

            this.exports = this.instance.exports;
            this.memory = this.exports.memory;
            this.isLoaded = true;

            if (typeof this.exports.wasm_init === 'function') {
                this.exports.wasm_init();
            }

            console.log('[WASM] Motor de Cards RPG-SheetC v2.0 instanciado. Símbolos exportados:', Object.keys(this.exports).length);
            this.emitChange('init');
            return true;
        } catch (error) {
            this.isLoaded = false;
            console.error('[WASM Error] Não foi possível carregar o módulo WebAssembly:', error);
            throw error;
        }
    }

    /* =========================================================================
     * 3. Utilitários de Memória Linear (Strings UTF-8)
     * ========================================================================= */

    readString(ptr, maxLen = 256) {
        if (!this.memory || !ptr) return '';
        const buf = this.memory.buffer;
        const limit = Math.min(maxLen, buf.byteLength - ptr);
        if (limit <= 0) return '';
        const view = new Uint8Array(buf, ptr, limit);
        let end = 0;
        while (end < limit && view[end] !== 0) {
            end++;
        }
        return this.decoder.decode(view.subarray(0, end));
    }

    writeString(ptr, str, maxLen = 256) {
        if (!this.memory || !ptr) return 0;
        const text = String(str ?? '');
        const encoded = this.encoder.encode(text);
        const view = new Uint8Array(this.memory.buffer, ptr, maxLen);
        const len = Math.min(encoded.length, maxLen - 1);
        view.set(encoded.subarray(0, len));
        view[len] = 0;
        return len;
    }

    writeToStrBuffer(str) {
        if (!this.isLoaded) return 0;
        const ptr = this.exports.wasm_get_str_buffer();
        const cap = this.exports.wasm_get_str_buffer_size();
        return this.writeString(ptr, str, cap);
    }

    /* =========================================================================
     * 4. Ciclo de Vida e Metadados do Deck (Ficha / Sistema)
     * ========================================================================= */

    initDeck(sheetName = 'Novo Personagem', systemName = 'Sistema Generico Aberto') {
        if (!this.isLoaded) return;
        this.exports.wasm_deck_init();
        if (sheetName) this.setCharacterName(sheetName, false);
        if (systemName) this.setSystemName(systemName, false);
        this.emitChange('deck_init');
    }

    clearDeck() {
        if (!this.isLoaded) return;
        this.exports.wasm_deck_clear();
        this.emitChange('deck_clear');
    }

    getCharacterName() {
        if (!this.isLoaded) return '';
        return this.readString(this.exports.wasm_deck_get_name_ptr(), 32);
    }

    setCharacterName(name, notify = true) {
        if (!this.isLoaded) return;
        this.writeToStrBuffer(name);
        this.exports.wasm_deck_set_name_from_buffer();
        if (notify) this.emitChange('meta_name');
    }

    getSystemName() {
        if (!this.isLoaded) return '';
        return this.readString(this.exports.wasm_deck_get_system_ptr(), 32);
    }

    setSystemName(systemName, notify = true) {
        if (!this.isLoaded) return;
        this.writeToStrBuffer(systemName);
        this.exports.wasm_deck_set_system_from_buffer();
        if (notify) this.emitChange('meta_system');
    }

    getLevel() {
        return this.isLoaded ? this.exports.wasm_deck_get_level() : 1;
    }

    setLevel(lvl) {
        if (!this.isLoaded) return;
        this.exports.wasm_deck_set_level(Number(lvl) || 1);
        this.exports.wasm_card_apply_all();
        this.emitChange('meta_level');
    }

    getXp() {
        return this.isLoaded ? this.exports.wasm_deck_get_xp() : 0;
    }

    setXp(xp) {
        if (!this.isLoaded) return;
        this.exports.wasm_deck_set_xp(Number(xp) || 0);
        this.emitChange('meta_xp');
    }

    getCardCount() {
        return this.isLoaded ? this.exports.wasm_card_count() : 0;
    }

    getCardCountByType(type) {
        return this.isLoaded ? this.exports.wasm_card_count_by_type(type) : 0;
    }

    /* =========================================================================
     * 5. Leitura e Manipulação de Cards na Memória Linear (O(1) para Virtual Scroll)
     * ========================================================================= */

    /**
     * Lê um card completo pelo seu índice contíguo no deck [0 .. count-1]
     * Projetado para ser chamado apenas para os itens visíveis no Virtual Scroll.
     * @param {number} idx Índice do card no array C
     * @returns {Object|null}
     */
    getCardAt(idx) {
        if (!this.isLoaded) return null;
        const count = this.exports.wasm_card_count();
        if (idx < 0 || idx >= count) return null;

        const type = this.exports.wasm_card_get_type(idx);
        const meta = CARD_TYPE_META[type] || CARD_TYPE_META[0];
        const formula = this.readString(this.exports.wasm_card_get_formula_ptr(idx), 48);

        return {
            index: idx,
            id: this.exports.wasm_card_get_id(idx),
            type,
            typeKey: meta.key,
            typeLabel: meta.label,
            typeIcon: meta.icon,
            badgeClass: meta.badgeClass,
            key: this.readString(this.exports.wasm_card_get_key_ptr(idx), 24),
            name: this.readString(this.exports.wasm_card_get_name_ptr(idx), 32),
            desc: this.readString(this.exports.wasm_card_get_desc_ptr(idx), 128),
            base: this.exports.wasm_card_get_base_at(idx),
            current: this.exports.wasm_card_get_current_at(idx),
            max: this.exports.wasm_card_get_max_at(idx),
            effective: this.exports.wasm_card_get_val(idx),
            formula,
            formulaValue: formula ? this.exports.wasm_card_eval_formula(idx) : this.exports.wasm_card_get_val(idx),
            costResource: this.readString(this.exports.wasm_card_get_cost_res_ptr(idx), 24),
            costValue: this.exports.wasm_card_get_cost_val(idx),
            equipped: Boolean(this.exports.wasm_card_get_equipped_at(idx)),
            trained: Boolean(this.exports.wasm_card_get_trained_at(idx)),
            favorite: Boolean(this.exports.wasm_card_get_favorite_at(idx)),
            modifiers: this._readCardModifiers(idx)
        };
    }

    _readCardModifiers(idx) {
        if (!this.isLoaded || typeof this.exports.wasm_card_get_mod_count !== 'function') {
            return [];
        }
        const count = this.exports.wasm_card_get_mod_count(idx);
        const mods = [];
        for (let m = 0; m < count; m++) {
            const target = this.readString(this.exports.wasm_card_get_mod_target_ptr(idx, m), 24);
            const value = this.exports.wasm_card_get_mod_val(idx, m);
            mods.push({ target_key: target, target, value, val: value });
        }
        return mods;
    }

    /**
     * Retorna todos os cards do deck (ou filtrados por predicado)
     * @param {Function|null} filterFn
     */
    getAllCards(filterFn = null) {
        if (!this.isLoaded) return [];
        const count = this.exports.wasm_card_count();
        const list = [];
        for (let i = 0; i < count; i++) {
            const card = this.getCardAt(i);
            if (card && (!filterFn || filterFn(card, i))) {
                list.push(card);
            }
        }
        return list;
    }

    /**
     * Retorna apenas os índices dos cards que satisfazem um filtro de tipo e/ou busca textual.
     * Ideal para alimentar o Virtual Scroll com custo mínimo de memória.
     * @param {Object} options { type: number|null, query: string, onlyEquipped: boolean }
     * @returns {number[]} Array de índices no C
     */
    queryCardIndices({ type = null, query = '', onlyEquipped = false } = {}) {
        if (!this.isLoaded) return [];
        const count = this.exports.wasm_card_count();
        const q = (query || '').trim().toLowerCase();
        const indices = [];

        for (let i = 0; i < count; i++) {
            if (type !== null && type !== undefined && type !== -1) {
                if (this.exports.wasm_card_get_type(i) !== type) continue;
            }
            if (onlyEquipped && !this.exports.wasm_card_get_equipped_at(i)) {
                continue;
            }
            if (q) {
                const name = this.readString(this.exports.wasm_card_get_name_ptr(i), 32).toLowerCase();
                const key = this.readString(this.exports.wasm_card_get_key_ptr(i), 24).toLowerCase();
                const desc = this.readString(this.exports.wasm_card_get_desc_ptr(i), 128).toLowerCase();
                if (!name.includes(q) && !key.includes(q) && !desc.includes(q)) {
                    continue;
                }
            }
            indices.push(i);
        }
        return indices;
    }

    getCardByKey(key) {
        if (!this.isLoaded || !key) return null;
        const target = String(key).toLowerCase();
        const count = this.exports.wasm_card_count();
        for (let i = 0; i < count; i++) {
            const k = this.readString(this.exports.wasm_card_get_key_ptr(i), 24);
            if (k.toLowerCase() === target) {
                return this.getCardAt(i);
            }
        }
        return null;
    }

    /**
     * Adiciona um card simples via buffer de string ("chave:Nome")
     */
    addSimpleCard(key, name, type = CARD_TYPES.ATTRIBUTE, baseVal = 0) {
        if (!this.isLoaded) return -1;
        this.writeToStrBuffer(`${key}:${name || key}`);
        const idx = this.exports.wasm_card_add(type, Number(baseVal) || 0);
        if (idx >= 0) this.emitChange('card_add');
        return idx;
    }

    /**
     * Adiciona ou atualiza um card completo (com descrição, fórmula, modificadores, etc.)
     * usando o importador nativo de pacote em modo merge.
     * @param {Object} cardObj Objeto descrevendo o card
     * @returns {boolean}
     */
    addCard(cardObj) {
        if (!this.isLoaded || !cardObj || !cardObj.key) return false;
        const imported = this.importCardPack([cardObj], true);
        return imported > 0;
    }

    removeCardById(cardId) {
        if (!this.isLoaded) return false;
        const ok = this.exports.wasm_card_remove(Number(cardId)) === 1;
        if (ok) this.emitChange('card_remove');
        return ok;
    }

    removeCardByKey(key) {
        if (!this.isLoaded || !key) return false;
        this.writeToStrBuffer(key);
        const ok = this.exports.wasm_card_remove_by_key() === 1;
        if (ok) this.emitChange('card_remove');
        return ok;
    }

    getEffectiveValue(key) {
        if (!this.isLoaded || !key) return 0;
        this.writeToStrBuffer(key);
        return this.exports.wasm_card_get_effective_val();
    }

    getCurrentValue(key) {
        if (!this.isLoaded || !key) return 0;
        this.writeToStrBuffer(key);
        return this.exports.wasm_card_get_current_val();
    }

    getMaxValue(key) {
        if (!this.isLoaded || !key) return 0;
        this.writeToStrBuffer(key);
        return this.exports.wasm_card_get_max_val();
    }

    setBaseValue(key, val) {
        if (!this.isLoaded || !key) return false;
        this.writeToStrBuffer(key);
        const ok = this.exports.wasm_card_set_base_val(Number(val) || 0) === 1;
        if (ok) this.emitChange('card_base');
        return ok;
    }

    setCurrentValue(key, val) {
        if (!this.isLoaded || !key) return false;
        this.writeToStrBuffer(key);
        const ok = this.exports.wasm_card_set_current_val(Number(val) || 0) === 1;
        if (ok) this.emitChange('card_current');
        return ok;
    }

    modifyCurrentValue(key, delta) {
        if (!this.isLoaded || !key) return false;
        this.writeToStrBuffer(key);
        const ok = this.exports.wasm_card_modify_current(Number(delta) || 0) === 1;
        if (ok) this.emitChange('card_current');
        return ok;
    }

    setEquipped(key, equipped) {
        if (!this.isLoaded || !key) return false;
        this.writeToStrBuffer(key);
        const ok = this.exports.wasm_card_set_equipped(equipped ? 1 : 0) === 1;
        if (ok) this.emitChange('card_equipped');
        return ok;
    }

    toggleEquipped(key) {
        const card = this.getCardByKey(key);
        if (!card) return false;
        return this.setEquipped(key, !card.equipped);
    }

    setTrained(key, trained) {
        if (!this.isLoaded || !key) return false;
        this.writeToStrBuffer(key);
        const ok = this.exports.wasm_card_set_trained(trained ? 1 : 0) === 1;
        if (ok) this.emitChange('card_trained');
        return ok;
    }

    toggleTrained(key) {
        const card = this.getCardByKey(key);
        if (!card) return false;
        return this.setTrained(key, !card.trained);
    }

    recalculate() {
        if (!this.isLoaded) return;
        this.exports.wasm_card_apply_all();
        this.emitChange('recalculate');
    }

    /* =========================================================================
     * 6. Avaliador de Fórmulas e Expressões Matemáticas em C (card_eval)
     * ========================================================================= */

    /**
     * Avalia uma expressão matemática arbitrária referenciando cards do deck (ex: "10 + @des + @armadura")
     * @param {string} expr
     * @returns {number}
     */
    evalExpression(expr) {
        if (!this.isLoaded || !expr) return 0;
        this.writeToStrBuffer(expr);
        return this.exports.wasm_eval_expression();
    }

    /**
     * Avalia a fórmula configurada no card de índice `cardIdx`
     * @param {number} cardIdx
     * @returns {number}
     */
    evalCardFormula(cardIdx) {
        if (!this.isLoaded) return 0;
        return this.exports.wasm_card_eval_formula(Number(cardIdx));
    }

    /* =========================================================================
     * 7. Serialização e Importação de Pacotes de Cards (.cardpack JSON)
     * ========================================================================= */

    /**
     * Exporta o deck ativo completo em formato .cardpack JSON direto da memória do C
     * @param {boolean} asString Se true, retorna string JSON bruta; se false, retorna objeto JS
     */
    exportCardPack(asString = false) {
        if (!this.isLoaded) return null;
        const bytes = this.exports.wasm_pack_export();
        if (bytes <= 0) return null;
        const ptr = this.exports.wasm_get_json_buffer();
        const rawJson = this.readString(ptr, bytes + 1);
        if (asString) return rawJson;
        try {
            return JSON.parse(rawJson);
        } catch (err) {
            console.error('[WASM CardPack Parse Error]', err, rawJson);
            return null;
        }
    }

    /**
     * Importa um pacote .cardpack JSON (objeto, array de cards ou string JSON) para o motor C
     * @param {Object|Array|string} packData
     * @param {boolean} mergeMode Se true, mescla os cards sobre a ficha atual; se false, substitui tudo
     * @returns {number} Quantidade de cards importados (>= 0), ou código negativo em caso de erro
     */
    importCardPack(packData, mergeMode = false) {
        if (!this.isLoaded || !packData) return -1;
        const jsonStr = typeof packData === 'string' ? packData : JSON.stringify(packData);
        const ptr = this.exports.wasm_get_json_buffer();
        const cap = this.exports.wasm_get_json_buffer_capacity();
        this.writeString(ptr, jsonStr, cap);
        const count = this.exports.wasm_pack_import(mergeMode ? 1 : 0);
        if (count >= 0) {
            this.emitChange(mergeMode ? 'pack_merge' : 'pack_import');
        }
        return count;
    }

    /* Aliases de compatibilidade com os serviços de Storage e Export */
    exportJson() {
        return this.exportCardPack(false);
    }

    importJson(jsonObj, mergeMode = false) {
        return this.importCardPack(jsonObj, mergeMode) >= 0;
    }

    getActiveClass() {
        return this.getSystemName() || 'Sistema Aberto';
    }

    getActiveRace() {
        return `${this.getCardCount()} Cards`;
    }

    getPvAtual() {
        const c = this.getCardByKey('pv') || this.getCardByKey('vida') || this.getCardByKey('hp');
        return c ? c.current : 0;
    }

    getPvMax() {
        const c = this.getCardByKey('pv') || this.getCardByKey('vida') || this.getCardByKey('hp');
        return c ? c.max : 0;
    }

    getPmAtual() {
        const c = this.getCardByKey('pm') || this.getCardByKey('mana') || this.getCardByKey('mp');
        return c ? c.current : 0;
    }

    getPmMax() {
        const c = this.getCardByKey('pm') || this.getCardByKey('mana') || this.getCardByKey('mp');
        return c ? c.max : 0;
    }

    getDefesa() {
        const c = this.getCardByKey('defesa') || this.getCardByKey('ca') || this.getCardByKey('def');
        return c ? c.effective : 10;
    }

    /* =========================================================================
     * 8. Motor de Rolagem de Dados Poliédricos (Xorshift32 em C)
     * ========================================================================= */

    rollDice(count = 1, faces = 20, modifier = 0) {
        if (!this.isLoaded) return null;
        const total = this.exports.wasm_roll_dice(count, faces, modifier);
        const subtotal = this.exports.wasm_get_last_roll_subtotal();
        const rollCount = this.exports.wasm_get_last_roll_count();
        const rolls = [];
        for (let i = 0; i < rollCount; i++) {
            rolls.push(this.exports.wasm_get_last_roll_die(i));
        }

        return {
            count,
            faces,
            modifier,
            subtotal,
            total,
            rolls,
            isCritical: Boolean(this.exports.wasm_get_last_roll_is_critical()),
            isFumble: Boolean(this.exports.wasm_get_last_roll_is_fumble())
        };
    }
}

if (typeof window !== 'undefined') {
    window.SheetCWasm = SheetCWasm;
    window.CARD_TYPES = CARD_TYPES;
    window.CARD_TYPE_META = CARD_TYPE_META;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SheetCWasm, CARD_TYPES, CARD_TYPE_META };
}
