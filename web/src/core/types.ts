/**
 * types.ts — Definições de Tipos e Interfaces do Motor Agnóstico de Cards (RPG-SheetC Web TS)
 * 100% TypeScript • Agnóstico a Sistemas • Orientado a .cardpack
 */

export const CARD_TYPES = Object.freeze({
    ATTRIBUTE: 0,
    RESOURCE:  1,
    STAT:      2,
    SKILL:     3,
    ABILITY:   4,
    EQUIPMENT: 5,
    SPELL:     6,
    TRAIT:     7
});

export type CardTypeId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface CardTypeMetadata {
    key: string;
    label: string;
    icon: string;
    badgeClass: string;
}

export const CARD_TYPE_META: Record<number, CardTypeMetadata> = Object.freeze({
    0: { key: 'attribute', label: 'Atributo',       icon: '💪', badgeClass: 'badge-attr' },
    1: { key: 'resource',  label: 'Recurso',        icon: '❤️', badgeClass: 'badge-res' },
    2: { key: 'stat',      label: 'Estatística',    icon: '🛡️', badgeClass: 'badge-stat' },
    3: { key: 'skill',     label: 'Perícia',        icon: '🎯', badgeClass: 'badge-skill' },
    4: { key: 'ability',   label: 'Habilidade',     icon: '⚡', badgeClass: 'badge-ability' },
    5: { key: 'equipment', label: 'Equipamento',    icon: '⚔️', badgeClass: 'badge-equip' },
    6: { key: 'spell',     label: 'Magia',          icon: '✨', badgeClass: 'badge-spell' },
    7: { key: 'trait',     label: 'Característica', icon: '🧬', badgeClass: 'badge-trait' }
});

export interface CardModifier {
    target_key: string;
    target: string;
    value: number;
    val: number;
}

export interface RPGCard {
    index: number;
    id: number;
    type: number;
    typeKey: string;
    typeLabel: string;
    typeIcon: string;
    badgeClass: string;
    key: string;
    name: string;
    desc: string;
    base: number;
    current: number;
    max: number;
    effective: number;
    formula: string;
    formulaValue: number;
    costResource: string;
    costValue: number;
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

export interface RawCardInput {
    id?: number;
    type?: number | string;
    key: string;
    name?: string;
    desc?: string;
    description?: string;
    base?: number;
    base_value?: number;
    curr?: number;
    current?: number;
    current_value?: number;
    max?: number;
    max_value?: number;
    cost_res?: string;
    cost_resource?: string;
    costResource?: string;
    cost_val?: number;
    cost_value?: number;
    costValue?: number;
    formula?: string;
    equipped?: number | boolean;
    is_equipped?: number | boolean;
    trained?: number | boolean;
    is_trained?: number | boolean;
    fav?: number | boolean;
    favorite?: number | boolean;
    is_favorite?: number | boolean;
    category?: string;
    is_mandatory?: number | boolean;
    isMandatory?: boolean;
    slot?: string;
    weight?: number;
    tags?: string[];
    mods?: Array<{ target?: string; target_key?: string; val?: number; value?: number; bonus?: number }>;
    modifiers?: Array<{ target?: string; target_key?: string; val?: number; value?: number; bonus?: number }>;
}

export interface EditorTabConfig {
    id: string;
    name: string;
    icon?: string;
}

export interface AbilitySectionConfig {
    id: string;
    title: string;
    icon?: string;
    categories: string[];
}

export interface UiLayoutConfig {
    default_tab?: string;
    attribute_mode?: 'modifier' | 'direct';
    editor_tabs?: EditorTabConfig[];
    ability_sections?: AbilitySectionConfig[];
    vital_resource_keys?: string[];
    currency_keys?: string[];
}

export interface WizardOption {
    key: string;
    name: string;
    icon?: string;
    desc?: string;
    mods?: Array<{ target: string; val: number }>;
    free_bonus_count?: number;
    free_bonus_val?: number;
    excluded_attrs?: string[];
    pv_base?: number;
    pv_per_level?: number;
    pm_base?: number;
    pm_per_level?: number;
    fixed_skills?: string[];
    choose_skills_count?: number;
    allowed_skills?: string[];
    abilities?: string[];
    mandatory_cards?: string[];
    optional_cards?: string[];
}

export interface WizardStepSchema {
    id?: string;
    key: string;
    title: string;
    subtitle?: string;
    type: 'concept' | 'attributes' | 'single_choice' | 'class_choice' | 'equipment_select' | 'review' | string;
    point_buy_budget?: number;
    options?: WizardOption[] | Record<string, string[]>;
}

export interface WizardDefinition {
    id: string;
    name: string;
    desc?: string;
    icon?: string;
    steps: WizardStepSchema[];
}

export interface CharacterTemplate {
    id: string;
    name: string;
    subtitle?: string;
    icon?: string;
    desc?: string;
    level?: number;
    attributes?: Record<string, number>;
    resources?: Record<string, number>;
    trained_skills?: string[];
    equipped_cards?: string[];
    inventory_cards?: string[];
}

export interface CreationConfig {
    allow_manual?: boolean;
    point_buy_budget?: number;
    cost_table?: Record<string, number>;
    derived_stats?: RawCardInput[];
    currencies?: RawCardInput[];
    wizards?: WizardDefinition[];
    templates?: CharacterTemplate[];
    custom_modes?: unknown[];
}

export interface CardPackSchema {
    id?: string;
    pack_name?: string;
    sheet_name?: string;
    name?: string;
    system_name?: string;
    system?: string;
    author?: string;
    version?: string;
    desc?: string;
    description?: string;
    level?: number;
    xp?: number;
    ui_layout?: UiLayoutConfig;
    creation_config?: CreationConfig;
    wizard_schema?: {
        id?: string;
        name?: string;
        description?: string;
        steps: WizardStepSchema[];
    };
    templates?: CharacterTemplate[];
    cards: RawCardInput[];
}

export interface DiceRollResult {
    count: number;
    faces: number;
    modifier: number;
    subtotal: number;
    total: number;
    rolls: number[];
    isCritical: boolean;
    isFumble: boolean;
}

export type EvalStatus = 'OK' | 'ERR_SYNTAX' | 'ERR_DIV_BY_ZERO' | 'ERR_MAX_DEPTH';

export interface EvalResult {
    status: EvalStatus;
    value: number;
}
