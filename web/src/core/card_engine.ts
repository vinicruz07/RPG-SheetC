/**
 * card_engine.ts — Motor Agnóstico de Cards e Decks em TypeScript Puro (RPG-SheetC Web TS)
 * Substitui o antigo núcleo C99/WASM por uma implementação 100% nativa em TypeScript:
 * - Zero dependência de binários .wasm
 * - Sem truncamento de strings UTF-8 (suporta descrições e fórmulas de qualquer tamanho)
 * - Índice em memória + array contíguo para Virtual Scrolling a 60 FPS
 * - Suporte nativo a .cardpack (incluindo metadados de criação, abas de UI e categorias)
 * - Compatibilidade 100% com a interface reativa SheetCWasm / SheetEngine
 */

import {
    CARD_TYPES,
    CARD_TYPE_META,
    type CardModifier,
    type CardPackSchema,
    type DiceRollResult,
    type RawCardInput,
    type RPGCard
} from './types.ts';
import { DiceEngine } from './dice.ts';
import { evaluateFormula, type FormulaContext } from './formula_eval.ts';
import { ServerApiClient } from './api_client.ts';

export type EngineChangeListener = (reason: string, engine: SheetEngine) => void;

interface InternalCardState {
    id: number;
    type: number;
    key: string;
    name: string;
    desc: string;
    base: number;
    current: number;
    max: number;
    effective: number;
    costResource: string;
    costValue: number;
    formula: string;
    equipped: boolean;
    trained: boolean;
    favorite: boolean;
    category?: string;
    isMandatory?: boolean;
    slot?: string;
    weight?: number;
    tags?: string[];
    modifiers: CardModifier[];
}

export function cardTypeToString(type: number): string {
    switch (type) {
        case CARD_TYPES.ATTRIBUTE: return 'Atributo';
        case CARD_TYPES.RESOURCE:  return 'Recurso';
        case CARD_TYPES.STAT:      return 'Estatistica';
        case CARD_TYPES.SKILL:     return 'Pericia';
        case CARD_TYPES.ABILITY:   return 'Habilidade';
        case CARD_TYPES.EQUIPMENT: return 'Equipamento';
        case CARD_TYPES.SPELL:     return 'Magia';
        case CARD_TYPES.TRAIT:     return 'Traco';
        default:                   return 'Desconhecido';
    }
}

export function cardStringToType(str: string | number | undefined | null): number {
    if (typeof str === 'number') {
        return str >= 0 && str <= 7 ? Math.trunc(str) : CARD_TYPES.ATTRIBUTE;
    }
    if (!str) return CARD_TYPES.ATTRIBUTE;
    const norm = String(str).trim().toLowerCase();
    switch (norm) {
        case 'atributo':
        case 'attribute':
            return CARD_TYPES.ATTRIBUTE;
        case 'recurso':
        case 'resource':
            return CARD_TYPES.RESOURCE;
        case 'estatistica':
        case 'estatística':
        case 'stat':
            return CARD_TYPES.STAT;
        case 'pericia':
        case 'perícia':
        case 'skill':
            return CARD_TYPES.SKILL;
        case 'habilidade':
        case 'ability':
            return CARD_TYPES.ABILITY;
        case 'equipamento':
        case 'equipment':
            return CARD_TYPES.EQUIPMENT;
        case 'magia':
        case 'spell':
            return CARD_TYPES.SPELL;
        case 'traco':
        case 'traço':
        case 'caracteristica':
        case 'característica':
        case 'trait':
            return CARD_TYPES.TRAIT;
        default:
            return CARD_TYPES.ATTRIBUTE;
    }
}

export class SheetEngine {
    public isLoaded: boolean = true;
    public apiClient: ServerApiClient;
    private dice: DiceEngine;
    private listeners: Set<EngineChangeListener> = new Set();

    private sheetName: string = 'Novo Personagem';
    private systemName: string = 'Sistema Agnóstico';
    private level: number = 1;
    private xp: number = 0;
    private cards: InternalCardState[] = [];
    private keyIndex: Map<string, number> = new Map();
    private nextCardId: number = 1;

    constructor(serverUrl?: string) {
        this.dice = new DiceEngine(0x853c49e6);
        this.apiClient = new ServerApiClient(serverUrl ? { baseUrl: serverUrl } : undefined);
    }

    public static get CARD_TYPES() {
        return CARD_TYPES;
    }

    public static get CARD_TYPE_META() {
        return CARD_TYPE_META;
    }

    /* =========================================================================
     * 1. Sistema Reativo de Eventos (Pub/Sub)
     * ========================================================================= */

    public onChange(callback: EngineChangeListener): () => void {
        if (typeof callback === 'function') {
            this.listeners.add(callback);
        }
        return () => this.listeners.delete(callback);
    }

    public emitChange(reason: string = 'update'): void {
        for (const fn of this.listeners) {
            try {
                fn(reason, this);
            } catch (err) {
                console.error('[SheetEngine Listener Error]', err);
            }
        }
    }

    /* =========================================================================
     * 2. Inicialização (Assíncrona para compatibilidade com fluxo de boot)
     * ========================================================================= */

    public async load(_unusedSource?: unknown): Promise<boolean> {
        this.isLoaded = true;
        this.initDeck('Novo Personagem', 'Sistema Generico Aberto');
        this.dice.setSeed(0x853c49e6);
        this.emitChange('init');
        return true;
    }

    /* =========================================================================
     * 3. Ciclo de Vida e Metadados do Deck (Ficha / Sistema)
     * ========================================================================= */

    public initDeck(
        sheetName: string = 'Novo Personagem',
        systemName: string = 'Sistema Generico Aberto'
    ): void {
        this.sheetName = (sheetName || 'Novo Personagem').trim();
        this.systemName = (systemName || 'Sistema Generico Aberto').trim();
        this.level = 1;
        this.xp = 0;
        this.cards = [];
        this.keyIndex.clear();
        this.nextCardId = 1;
        this.emitChange('deck_init');
    }

    public clearDeck(): void {
        this.cards = [];
        this.keyIndex.clear();
        this.nextCardId = 1;
        this.emitChange('deck_clear');
    }

    public getCharacterName(): string {
        return this.sheetName;
    }

    public setCharacterName(name: string, notify: boolean = true): void {
        this.sheetName = String(name ?? '').trim() || 'Novo Personagem';
        if (notify) this.emitChange('meta_name');
    }

    public getSystemName(): string {
        return this.systemName;
    }

    public setSystemName(systemName: string, notify: boolean = true): void {
        this.systemName = String(systemName ?? '').trim() || 'Sistema Aberto';
        if (notify) this.emitChange('meta_system');
    }

    public getLevel(): number {
        return this.level;
    }

    public setLevel(lvl: number): void {
        this.level = Math.max(1, Math.trunc(Number(lvl) || 1));
        this.recalculateInternal();
        this.emitChange('meta_level');
    }

    public getXp(): number {
        return this.xp;
    }

    public setXp(xp: number): void {
        this.xp = Math.trunc(Number(xp) || 0);
        this.emitChange('meta_xp');
    }

    public getCardCount(): number {
        return this.cards.length;
    }

    public getCardCountByType(type: number): number {
        let count = 0;
        for (let i = 0; i < this.cards.length; i++) {
            if (this.cards[i].type === type) count++;
        }
        return count;
    }

    /* =========================================================================
     * 4. Motor de Recálculo em Cascata
     * ========================================================================= */

    private rebuildKeyIndex(): void {
        this.keyIndex.clear();
        for (let i = 0; i < this.cards.length; i++) {
            this.keyIndex.set(this.cards[i].key.toLowerCase(), i);
        }
    }

    private findInternalByKey(key: string): InternalCardState | null {
        if (!key) return null;
        const idx = this.keyIndex.get(String(key).toLowerCase());
        if (idx === undefined) return null;
        return this.cards[idx] || null;
    }

    private recalculateInternal(): void {
        // 1. Inicializa valores efetivos e máximos a partir dos valores base
        for (let i = 0; i < this.cards.length; i++) {
            const c = this.cards[i];
            c.effective = c.base;
            c.max = c.base;
        }

        // 1b. Para cards de Estatística (STAT) com base 0 e fórmula determinística (ex: "10 + @des", "10 + 2 * @for"),
        // avalia a fórmula base para que modificadores de equipamentos somem sobre ela
        for (let i = 0; i < this.cards.length; i++) {
            const c = this.cards[i];
            if (c.type === CARD_TYPES.STAT && c.base === 0 && c.formula && !/\d+d\d+/i.test(c.formula)) {
                const res = evaluateFormula(c.formula, {
                    level: this.level,
                    xp: this.xp,
                    resolveCardValue: (k: string) => {
                        const target = this.findInternalByKey(k);
                        return target ? target.effective : 0;
                    }
                });
                if (res.status === 'OK') {
                    c.effective = res.value;
                    c.max = res.value;
                }
            }
        }

        // 2. Acumula todos os modificadores dos cards ativos (equipped === true)
        for (let i = 0; i < this.cards.length; i++) {
            const src = this.cards[i];
            if (!src.equipped) continue;

            for (let m = 0; m < src.modifiers.length; m++) {
                const mod = src.modifiers[m];
                const target = this.findInternalByKey(mod.target_key);
                if (target) {
                    target.effective += mod.value;
                    target.max += mod.value;
                }
            }
        }

        // 3. Limita recursos dinâmicos (current <= max quando max > 0)
        for (let i = 0; i < this.cards.length; i++) {
            const c = this.cards[i];
            if (c.type === CARD_TYPES.RESOURCE) {
                if (c.max > 0 && c.current > c.max) {
                    c.current = c.max;
                }
            }
        }
    }

    public recalculate(): void {
        this.recalculateInternal();
        this.emitChange('recalculate');
    }

    /* =========================================================================
     * 5. Leitura e Manipulação de Cards (O(1) para Virtual Scroll)
     * ========================================================================= */

    private toPublicCard(c: InternalCardState, idx: number): RPGCard {
        const meta = CARD_TYPE_META[c.type] || CARD_TYPE_META[0];
        const formulaValue = c.formula
            ? this.evalExpression(c.formula)
            : c.effective;

        return {
            index: idx,
            id: c.id,
            type: c.type,
            typeKey: meta.key,
            typeLabel: meta.label,
            typeIcon: meta.icon,
            badgeClass: meta.badgeClass,
            key: c.key,
            name: c.name,
            desc: c.desc,
            base: c.base,
            current: c.current,
            max: c.max,
            effective: c.effective,
            formula: c.formula,
            formulaValue,
            costResource: c.costResource,
            costValue: c.costValue,
            equipped: c.equipped,
            trained: c.trained,
            favorite: c.favorite,
            category: c.category,
            isMandatory: c.isMandatory,
            slot: c.slot,
            weight: c.weight,
            tags: c.tags ? [...c.tags] : undefined,
            modifiers: c.modifiers.map(m => ({ ...m }))
        };
    }

    public getCardAt(idx: number): RPGCard | null {
        if (idx < 0 || idx >= this.cards.length) return null;
        return this.toPublicCard(this.cards[idx], idx);
    }

    public getAllCards(filterFn: ((card: RPGCard, index: number) => boolean) | null = null): RPGCard[] {
        const list: RPGCard[] = [];
        for (let i = 0; i < this.cards.length; i++) {
            const card = this.toPublicCard(this.cards[i], i);
            if (!filterFn || filterFn(card, i)) {
                list.push(card);
            }
        }
        return list;
    }

    public queryCardIndices(
        options: { type?: number | null; query?: string; onlyEquipped?: boolean } = {}
    ): number[] {
        const { type = null, query = '', onlyEquipped = false } = options;
        const q = (query || '').trim().toLowerCase();
        const indices: number[] = [];

        for (let i = 0; i < this.cards.length; i++) {
            const c = this.cards[i];
            if (type !== null && type !== undefined && type !== -1 && c.type !== type) {
                continue;
            }
            if (onlyEquipped && !c.equipped) {
                continue;
            }
            if (q) {
                const matchName = c.name.toLowerCase().includes(q);
                const matchKey = c.key.toLowerCase().includes(q);
                const matchDesc = c.desc.toLowerCase().includes(q);
                if (!matchName && !matchKey && !matchDesc) {
                    continue;
                }
            }
            indices.push(i);
        }

        return indices;
    }

    public getCardByKey(key: string): RPGCard | null {
        if (!key) return null;
        const idx = this.keyIndex.get(String(key).toLowerCase());
        if (idx === undefined) return null;
        return this.getCardAt(idx);
    }

    public addSimpleCard(
        key: string,
        name?: string,
        type: number = CARD_TYPES.ATTRIBUTE,
        baseVal: number = 0
    ): number {
        const cleanKey = String(key || '').trim();
        if (!cleanKey) return -2;
        if (this.keyIndex.has(cleanKey.toLowerCase())) return -3;

        const cleanBase = Math.trunc(Number(baseVal) || 0);
        const card: InternalCardState = {
            id: this.nextCardId++,
            type: cardStringToType(type),
            key: cleanKey,
            name: String(name || cleanKey).trim(),
            desc: '',
            base: cleanBase,
            current: cleanBase,
            max: cleanBase,
            effective: cleanBase,
            costResource: '',
            costValue: 0,
            formula: '',
            equipped: true,
            trained: false,
            favorite: false,
            modifiers: []
        };

        const idx = this.cards.length;
        this.cards.push(card);
        this.keyIndex.set(cleanKey.toLowerCase(), idx);
        this.recalculateInternal();
        this.emitChange('card_add');
        return idx;
    }

    public addCard(cardObj: RawCardInput): boolean {
        if (!cardObj || !cardObj.key) return false;
        const imported = this.importCardPack([cardObj], true);
        return imported > 0;
    }

    public removeCardById(cardId: number): boolean {
        const targetId = Number(cardId);
        const idx = this.cards.findIndex(c => c.id === targetId);
        if (idx === -1) return false;
        this.cards.splice(idx, 1);
        this.rebuildKeyIndex();
        this.recalculateInternal();
        this.emitChange('card_remove');
        return true;
    }

    public removeCardByKey(key: string): boolean {
        if (!key) return false;
        const idx = this.keyIndex.get(String(key).toLowerCase());
        if (idx === undefined) return false;
        this.cards.splice(idx, 1);
        this.rebuildKeyIndex();
        this.recalculateInternal();
        this.emitChange('card_remove');
        return true;
    }

    public getEffectiveValue(key: string): number {
        const c = this.findInternalByKey(key);
        return c ? c.effective : 0;
    }

    public getCurrentValue(key: string): number {
        const c = this.findInternalByKey(key);
        return c ? c.current : 0;
    }

    public getMaxValue(key: string): number {
        const c = this.findInternalByKey(key);
        return c ? c.max : 0;
    }

    public setBaseValue(key: string, val: number): boolean {
        const c = this.findInternalByKey(key);
        if (!c) return false;
        c.base = Math.trunc(Number(val) || 0);
        this.recalculateInternal();
        this.emitChange('card_base');
        return true;
    }

    public setCurrentValue(key: string, val: number): boolean {
        const c = this.findInternalByKey(key);
        if (!c) return false;
        c.current = Math.trunc(Number(val) || 0);
        if (c.max > 0 && c.current > c.max) {
            c.current = c.max;
        }
        this.emitChange('card_current');
        return true;
    }

    public modifyCurrentValue(key: string, delta: number): boolean {
        const c = this.findInternalByKey(key);
        if (!c) return false;
        c.current += Math.trunc(Number(delta) || 0);
        if (c.max > 0 && c.current > c.max) {
            c.current = c.max;
        }
        this.emitChange('card_current');
        return true;
    }

    public setEquipped(key: string, equipped: boolean | number): boolean {
        const c = this.findInternalByKey(key);
        if (!c) return false;
        c.equipped = Boolean(equipped);
        this.recalculateInternal();
        this.emitChange('card_equipped');
        return true;
    }

    public toggleEquipped(key: string): boolean {
        const c = this.findInternalByKey(key);
        if (!c) return false;
        return this.setEquipped(key, !c.equipped);
    }

    public toggleEquip(keyOrId: string | number): boolean {
        if (typeof keyOrId === 'number') {
            const c = this.cards.find(item => item.id === keyOrId);
            if (!c) return false;
            return this.setEquipped(c.key, !c.equipped);
        }
        return this.toggleEquipped(String(keyOrId));
    }

    public setTrained(key: string, trained: boolean | number): boolean {
        const c = this.findInternalByKey(key);
        if (!c) return false;
        c.trained = Boolean(trained);
        this.recalculateInternal();
        this.emitChange('card_trained');
        return true;
    }

    public toggleTrained(key: string): boolean {
        const c = this.findInternalByKey(key);
        if (!c) return false;
        return this.setTrained(key, !c.trained);
    }

    /* =========================================================================
     * 6. Avaliador de Fórmulas e Expressões Matemáticas
     * ========================================================================= */

    private createFormulaContext(withRoller: boolean = false): FormulaContext {
        return {
            level: this.level,
            xp: this.xp,
            resolveCardValue: (key: string) => {
                const card = this.findInternalByKey(key);
                return card ? card.effective : 0;
            },
            rollDice: withRoller
                ? (count: number, faces: number) => this.dice.rollSimple(faces, count, 0)
                : undefined
        };
    }

    public evalExpression(expr: string): number {
        if (!expr) return 0;
        const res = evaluateFormula(expr, this.createFormulaContext(false));
        return res.status === 'OK' ? res.value : 0;
    }

    public evalCardFormula(cardIdx: number): number {
        const idx = Math.trunc(Number(cardIdx));
        if (idx < 0 || idx >= this.cards.length) return 0;
        const c = this.cards[idx];
        if (!c.formula) return c.effective;
        return this.evalExpression(c.formula);
    }

    /* =========================================================================
     * 7. Serialização e Importação de Pacotes de Cards (.cardpack JSON)
     * ========================================================================= */

    private normalizeRawCard(raw: RawCardInput, fallbackId: number): InternalCardState | null {
        if (!raw || typeof raw.key !== 'string' || raw.key.trim() === '') {
            return null;
        }

        const key = raw.key.trim();
        const type = cardStringToType(raw.type);
        const base = Math.trunc(Number(raw.base ?? raw.base_value ?? 0) || 0);
        const hasMax = raw.max !== undefined || raw.max_value !== undefined;
        const max = hasMax ? Math.trunc(Number(raw.max ?? raw.max_value ?? base) || 0) : base;

        const hasCurr =
            raw.curr !== undefined ||
            raw.current !== undefined ||
            raw.current_value !== undefined;
        const current = hasCurr
            ? Math.trunc(Number(raw.curr ?? raw.current ?? raw.current_value ?? base) || 0)
            : type === CARD_TYPES.RESOURCE
              ? max
              : base;

        const equippedRaw = raw.equipped ?? raw.is_equipped;
        const equipped = equippedRaw === undefined ? true : Boolean(equippedRaw);

        const trainedRaw = raw.trained ?? raw.is_trained;
        const trained = trainedRaw === undefined ? false : Boolean(trainedRaw);

        const favRaw = raw.fav ?? raw.favorite ?? raw.is_favorite;
        const favorite = favRaw === undefined ? false : Boolean(favRaw);

        const rawMods = Array.isArray(raw.mods)
            ? raw.mods
            : Array.isArray(raw.modifiers)
              ? raw.modifiers
              : [];

        const modifiers: CardModifier[] = [];
        for (const m of rawMods) {
            if (!m) continue;
            const tKey = String(m.target ?? m.target_key ?? '').trim();
            if (!tKey) continue;
            const mVal = Math.trunc(Number(m.val ?? m.value ?? m.bonus ?? 0) || 0);
            modifiers.push({
                target_key: tKey,
                target: tKey,
                value: mVal,
                val: mVal
            });
        }

        const idNum = Number(raw.id);
        const id = idNum > 0 ? Math.trunc(idNum) : fallbackId;

        return {
            id,
            type,
            key,
            name: String(raw.name ?? key).trim(),
            desc: String(raw.desc ?? raw.description ?? ''),
            base,
            current,
            max,
            effective: base,
            costResource: String(raw.cost_res ?? raw.cost_resource ?? raw.costResource ?? ''),
            costValue: Math.trunc(Number(raw.cost_val ?? raw.cost_value ?? raw.costValue ?? 0) || 0),
            formula: String(raw.formula ?? ''),
            equipped,
            trained,
            favorite,
            category: raw.category,
            isMandatory: raw.is_mandatory !== undefined ? Boolean(raw.is_mandatory) : raw.isMandatory,
            slot: raw.slot,
            weight: raw.weight !== undefined ? Number(raw.weight) : undefined,
            tags: Array.isArray(raw.tags) ? [...raw.tags] : undefined,
            modifiers
        };
    }

    public exportCardPack(asString: boolean = false): CardPackSchema | string | null {
        const exported: CardPackSchema = {
            sheet_name: this.sheetName,
            system_name: this.systemName,
            level: this.level,
            xp: this.xp,
            cards: this.cards.map(c => {
                const item: RawCardInput = {
                    id: c.id,
                    type: c.type,
                    key: c.key,
                    name: c.name,
                    desc: c.desc,
                    base: c.base,
                    curr: c.current,
                    max: c.max,
                    cost_res: c.costResource,
                    cost_val: c.costValue,
                    formula: c.formula,
                    equipped: c.equipped ? 1 : 0,
                    trained: c.trained ? 1 : 0,
                    fav: c.favorite ? 1 : 0,
                    mods: c.modifiers.map(m => ({
                        target: m.target_key,
                        val: m.value
                    }))
                };
                if (c.category !== undefined) item.category = c.category;
                if (c.isMandatory !== undefined) item.is_mandatory = c.isMandatory ? 1 : 0;
                if (c.slot !== undefined) item.slot = c.slot;
                if (c.weight !== undefined) item.weight = c.weight;
                if (c.tags !== undefined) item.tags = [...c.tags];
                return item;
            })
        };

        if (asString) {
            return JSON.stringify(exported);
        }
        return exported;
    }

    public importCardPack(
        packData: CardPackSchema | RawCardInput[] | string,
        mergeMode: boolean = false
    ): number {
        if (!packData) return -1;

        let parsed: CardPackSchema | RawCardInput[];
        if (typeof packData === 'string') {
            const trimmed = packData.trim();
            if (!trimmed) return -3;
            try {
                parsed = JSON.parse(trimmed);
            } catch {
                return -3;
            }
        } else if (typeof packData === 'object') {
            parsed = packData;
        } else {
            return -3;
        }

        if (!mergeMode) {
            this.sheetName = 'Novo Personagem';
            this.systemName = 'Sistema Generico Aberto';
            this.level = 1;
            this.xp = 0;
            this.cards = [];
            this.keyIndex.clear();
            this.nextCardId = 1;
        }

        let rawCards: RawCardInput[] = [];

        if (Array.isArray(parsed)) {
            rawCards = parsed;
        } else if (parsed && typeof parsed === 'object') {
            const nameCandidate = parsed.sheet_name ?? parsed.pack_name;
            if (typeof nameCandidate === 'string' && (!mergeMode || parsed.sheet_name !== undefined)) {
                this.sheetName = nameCandidate.trim() || this.sheetName;
            }
            const sysCandidate = parsed.system_name ?? parsed.system;
            if (typeof sysCandidate === 'string' && sysCandidate.trim()) {
                this.systemName = sysCandidate.trim();
            }
            if (typeof parsed.level === 'number' && !mergeMode) {
                this.level = Math.max(1, Math.trunc(parsed.level));
            }
            if (typeof parsed.xp === 'number' && !mergeMode) {
                this.xp = Math.trunc(parsed.xp);
            }
            if (Array.isArray(parsed.cards)) {
                rawCards = parsed.cards;
            } else {
                return -3;
            }
        } else {
            return -3;
        }

        let loadedCards = 0;

        for (const raw of rawCards) {
            const norm = this.normalizeRawCard(raw, this.nextCardId);
            if (!norm) continue;

            const lowerKey = norm.key.toLowerCase();
            const existingIdx = this.keyIndex.get(lowerKey);

            if (mergeMode && existingIdx !== undefined) {
                const keepId = this.cards[existingIdx].id;
                norm.id = keepId;
                this.cards[existingIdx] = norm;
                loadedCards++;
            } else if (!mergeMode && existingIdx !== undefined) {
                // Evita duplicata mesmo em modo replace
                continue;
            } else {
                const newIdx = this.cards.length;
                if (norm.id >= this.nextCardId) {
                    this.nextCardId = norm.id + 1;
                } else {
                    norm.id = this.nextCardId++;
                }
                this.cards.push(norm);
                this.keyIndex.set(lowerKey, newIdx);
                loadedCards++;
            }
        }

        this.recalculateInternal();
        this.emitChange(mergeMode ? 'pack_merge' : 'pack_import');
        return loadedCards;
    }

    /* =========================================================================
     * 8. Aliases de Compatibilidade com Serviços de Storage e Export
     * ========================================================================= */

    public exportJson(): CardPackSchema | null {
        return this.exportCardPack(false) as CardPackSchema | null;
    }

    public importJson(jsonObj: CardPackSchema | RawCardInput[] | string, mergeMode: boolean = false): boolean {
        return this.importCardPack(jsonObj, mergeMode) >= 0;
    }

    public getActiveClass(): string {
        return this.getSystemName() || 'Sistema Aberto';
    }

    public getActiveRace(): string {
        return `${this.getCardCount()} Cards`;
    }

    public getPvAtual(): number {
        const c = this.findInternalByKey('pv') || this.findInternalByKey('vida') || this.findInternalByKey('hp');
        return c ? c.current : 0;
    }

    public getPvMax(): number {
        const c = this.findInternalByKey('pv') || this.findInternalByKey('vida') || this.findInternalByKey('hp');
        return c ? c.max : 0;
    }

    public getPmAtual(): number {
        const c = this.findInternalByKey('pm') || this.findInternalByKey('mana') || this.findInternalByKey('mp');
        return c ? c.current : 0;
    }

    public getPmMax(): number {
        const c = this.findInternalByKey('pm') || this.findInternalByKey('mana') || this.findInternalByKey('mp');
        return c ? c.max : 0;
    }

    public getDefesa(): number {
        const c = this.findInternalByKey('defesa') || this.findInternalByKey('ca') || this.findInternalByKey('def');
        return c ? c.effective : 10;
    }

    /* =========================================================================
     * 9. Motor de Rolagem de Dados Poliédricos (Xorshift32 em TypeScript)
     * ========================================================================= */

    public setDiceSeed(seed: number): void {
        this.dice.setSeed(seed);
    }

    public rollDice(count: number = 1, faces: number = 20, modifier: number = 0): DiceRollResult {
        return this.dice.roll(count, faces, modifier);
    }
}

// Exporta também como SheetCWasm para retrocompatibilidade com views e testes
export { SheetEngine as SheetCWasm, CARD_TYPES, CARD_TYPE_META };

if (typeof window !== 'undefined') {
    const win = window as unknown as Record<string, unknown>;
    win.SheetEngine = SheetEngine;
    win.SheetCWasm = SheetEngine;
    win.CARD_TYPES = CARD_TYPES;
    win.CARD_TYPE_META = CARD_TYPE_META;
}
