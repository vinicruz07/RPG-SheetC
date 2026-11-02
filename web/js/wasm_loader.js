/**
 * wasm_loader.js — Carregador e Ponte de Interoperabilidade com o Core em C (RPG-SheetC)
 */

class SheetCWasm {
    constructor() {
        this.instance = null;
        this.exports = null;
        this.memory = null;
        this.encoder = new TextEncoder();
        this.decoder = new TextDecoder('utf-8');
        this.isLoaded = false;
    }

    /**
     * Carrega e instancia o binário WebAssembly
     * @param {string|Buffer|ArrayBuffer|Uint8Array} wasmUrl Caminho para o arquivo .wasm ou bytes do módulo
     */
    async load(wasmUrl = './dist/sheetc_core.wasm') {
        const importObject = {
            env: {
                // Símbolos de ambiente opcionais caso necessário no futuro
            }
        };

        // Suporte direto a buffers em memória (testes automatizados e workers offline)
        if (typeof ArrayBuffer !== 'undefined' && (wasmUrl instanceof ArrayBuffer || wasmUrl instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(wasmUrl)))) {
            const result = await WebAssembly.instantiate(wasmUrl, importObject);
            this.instance = result.instance || result;
            this.exports = this.instance.exports;
            this.memory = this.exports.memory;
            this.isLoaded = true;
            if (typeof this.exports.wasm_init === 'function') {
                this.exports.wasm_init();
            }
            console.log('[WASM] Motor RPG-SheetC C99 instanciado via buffer binário. Símbolos exportados:', Object.keys(this.exports).length);
            return;
        }

        try {
            // Tenta instantiateStreaming primeiro (método mais eficiente)
            if (typeof WebAssembly.instantiateStreaming === 'function') {
                try {
                    const response = await fetch(wasmUrl);
                    if (response.ok && response.headers?.get && response.headers.get('content-type')?.includes('application/wasm')) {
                        const result = await WebAssembly.instantiateStreaming(response, importObject);
                        this.instance = result.instance;
                    }
                } catch (streamingErr) {
                    console.warn('[WASM] instantiateStreaming falhou ou não compatível, usando fallback arrayBuffer:', streamingErr);
                }
            }

            // Fallback: fetch buffer binário tradicional (funciona em mais servidores locais)
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

            // Inicializa estado padrão no C
            if (typeof this.exports.wasm_init === 'function') {
                this.exports.wasm_init();
            }

            console.log('[WASM] Motor RPG-SheetC C99 instanciado com sucesso. Símbolos exportados:', Object.keys(this.exports).length);
            return true;
        } catch (error) {
            this.isLoaded = false;
            console.error('[WASM Error] Não foi possível carregar o módulo WebAssembly:', error);
            throw error;
        }
    }

    /* =========================================================================
     * Utilitários de Memória Linear (Strings UTF-8)
     * ========================================================================= */

    /**
     * Lê uma string terminada em null a partir de um ponteiro na memória do C
     */
    readString(ptr, maxLen = 256) {
        if (!this.memory || !ptr) return '';
        const view = new Uint8Array(this.memory.buffer, ptr, maxLen);
        let end = 0;
        while (end < maxLen && view[end] !== 0) {
            end++;
        }
        return this.decoder.decode(view.subarray(0, end));
    }

    /**
     * Escreve uma string JavaScript para um buffer na memória do C
     */
    writeString(ptr, str, maxLen = 128) {
        if (!this.memory || !ptr) return 0;
        const encoded = this.encoder.encode(str);
        const view = new Uint8Array(this.memory.buffer, ptr, maxLen);
        const len = Math.min(encoded.length, maxLen - 1);
        view.set(encoded.subarray(0, len));
        view[len] = 0;
        return len;
    }

    /* =========================================================================
     * Métodos de Personagem (Tormenta 20)
     * ========================================================================= */

    newDefaultCharacter(racaId = 0, classeId = 8) {
        if (!this.isLoaded) return;
        this.exports.wasm_t20_new_default(racaId, classeId);
    }

    getCharacterName() {
        if (!this.isLoaded) return '';
        const ptr = this.exports.wasm_t20_get_name_ptr();
        return this.readString(ptr, 64);
    }

    setCharacterName(name) {
        if (!this.isLoaded) return;
        const ptr = this.exports.wasm_get_str_buffer();
        const cap = this.exports.wasm_get_str_buffer_size();
        this.writeString(ptr, name, cap);
        this.exports.wasm_t20_set_name_from_buffer();
    }

    getLevel() {
        return this.isLoaded ? this.exports.wasm_t20_get_level() : 1;
    }

    setLevel(lvl) {
        if (!this.isLoaded) return;
        this.exports.wasm_t20_set_level(lvl);
    }

    getXp() {
        return this.isLoaded ? this.exports.wasm_t20_get_xp() : 0;
    }

    setXp(xp) {
        if (!this.isLoaded) return;
        this.exports.wasm_t20_set_xp(xp);
    }

    getRaceId() {
        return this.isLoaded ? this.exports.wasm_t20_get_raca_id() : 0;
    }

    getClassId() {
        return this.isLoaded ? this.exports.wasm_t20_get_classe_id() : 8;
    }

    getActiveRace() {
        if (!this.isLoaded) return 'Humano';
        const ptr = this.exports.wasm_t20_get_race_ptr();
        return this.readString(ptr, 32) || 'Humano';
    }

    getActiveClass() {
        if (!this.isLoaded) return 'Guerreiro';
        const ptr = this.exports.wasm_t20_get_class_ptr();
        return this.readString(ptr, 32) || 'Guerreiro';
    }

    getRaceName(raceId) {
        if (!this.isLoaded) return '';
        const ptr = this.exports.wasm_t20_race_name(raceId);
        return this.readString(ptr, 32);
    }

    getClassName(classId) {
        if (!this.isLoaded) return '';
        const ptr = this.exports.wasm_t20_class_name(classId);
        return this.readString(ptr, 32);
    }

    getAttribute(attrId) {
        return this.isLoaded ? this.exports.wasm_t20_get_attribute(attrId) : 10;
    }

    setAttribute(attrId, val) {
        if (!this.isLoaded) return;
        this.exports.wasm_t20_set_attribute(attrId, val);
    }

    getModifier(attrId) {
        return this.isLoaded ? this.exports.wasm_t20_get_modifier(attrId) : 0;
    }

    getPvAtual() {
        return this.isLoaded ? this.exports.wasm_t20_get_pv_atual() : 0;
    }

    getPvMax() {
        return this.isLoaded ? this.exports.wasm_t20_get_pv_max() : 0;
    }

    setPvAtual(val) {
        if (!this.isLoaded) return;
        this.exports.wasm_t20_set_pv_atual(val);
    }

    modifyPv(delta) {
        if (!this.isLoaded) return;
        this.exports.wasm_t20_modify_pv(delta);
    }

    getPmAtual() {
        return this.isLoaded ? this.exports.wasm_t20_get_pm_atual() : 0;
    }

    getPmMax() {
        return this.isLoaded ? this.exports.wasm_t20_get_pm_max() : 0;
    }

    setPmAtual(val) {
        if (!this.isLoaded) return;
        this.exports.wasm_t20_set_pm_atual(val);
    }

    modifyPm(delta) {
        if (!this.isLoaded) return;
        this.exports.wasm_t20_modify_pm(delta);
    }

    getDefesa() {
        return this.isLoaded ? this.exports.wasm_t20_get_defesa() : 10;
    }

    getBonusArmadura() {
        return this.isLoaded ? this.exports.wasm_t20_get_bonus_armadura() : 0;
    }

    setBonusArmadura(bonus) {
        if (!this.isLoaded) return;
        this.exports.wasm_t20_set_bonus_armadura(bonus);
    }

    getBonusEscudo() {
        return this.isLoaded ? this.exports.wasm_t20_get_bonus_escudo() : 0;
    }

    setBonusEscudo(bonus) {
        if (!this.isLoaded) return;
        this.exports.wasm_t20_set_bonus_escudo(bonus);
    }

    /* =========================================================================
     * Métodos de Perícias (Tormenta 20)
     * ========================================================================= */

    getSkillCount() {
        return this.isLoaded ? this.exports.wasm_t20_skill_count() : 29;
    }

    getSkillName(skillId) {
        if (!this.isLoaded) return '';
        const ptr = this.exports.wasm_t20_skill_name(skillId);
        return this.readString(ptr, 32);
    }

    getSkillAttr(skillId) {
        return this.isLoaded ? this.exports.wasm_t20_skill_attr(skillId) : 0;
    }

    isSkillTrained(skillId) {
        return this.isLoaded ? Boolean(this.exports.wasm_t20_is_skill_trained(skillId)) : false;
    }

    setSkillTrained(skillId, trained) {
        if (!this.isLoaded) return;
        this.exports.wasm_t20_set_skill_trained(skillId, trained ? 1 : 0);
    }

    calcSkill(skillId, outrosBonus = 0) {
        return this.isLoaded ? this.exports.wasm_t20_calc_skill(skillId, outrosBonus) : 0;
    }

    /* =========================================================================
     * Motor de Rolagem de Dados
     * ========================================================================= */

    rollDice(count, faces, modifier = 0) {
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

    /* =========================================================================
     * Serialização JSON
     * ========================================================================= */

    exportJson() {
        if (!this.isLoaded) return null;
        const bytes = this.exports.wasm_export_json();
        if (bytes <= 0) return null;
        const ptr = this.exports.wasm_get_json_buffer();
        const rawJson = this.readString(ptr, bytes + 1);
        try {
            return JSON.parse(rawJson);
        } catch (e) {
            console.error('[WASM JSON Parse Error]', e, rawJson);
            return null;
        }
    }

    importJson(jsonObj) {
        if (!this.isLoaded) return false;
        const jsonStr = typeof jsonObj === 'string' ? jsonObj : JSON.stringify(jsonObj);
        const ptr = this.exports.wasm_get_json_buffer();
        const cap = this.exports.wasm_get_json_buffer_capacity();
        this.writeString(ptr, jsonStr, cap);
        const status = this.exports.wasm_import_json_from_buffer();
        return status === 0;
    }
}

// Exporta globalmente para uso pelo app
window.SheetCWasm = SheetCWasm;
