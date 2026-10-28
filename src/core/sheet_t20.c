#include "sheet_t20.h"
#include "rpg_base.h"

static const char *T20_RACE_NAMES[T20_RACE_COUNT] = {
    "Humano",
    "Elfo",
    "Anão",
    "Goblin",
    "Minotauro",
    "Draconato"
};

static const char *T20_CLASS_NAMES[T20_CLASS_COUNT] = {
    "Arcanista",
    "Bárbaro",
    "Bardo",
    "Bucaneiro",
    "Caçador",
    "Cavaleiro",
    "Clérigo",
    "Druida",
    "Guerreiro",
    "Inventor",
    "Ladino",
    "Lutador",
    "Nobre",
    "Paladino"
};

typedef struct {
    int base_pv;
    int pv_per_level;
    int base_pm;
    int pm_per_level;
} T20ClassProgression;

static const T20ClassProgression T20_CLASS_TABLE[T20_CLASS_COUNT] = {
    {  8, 2, 6, 6 }, /* Arcanista */
    { 24, 6, 3, 3 }, /* Bárbaro */
    { 12, 3, 4, 4 }, /* Bardo */
    { 16, 4, 3, 3 }, /* Bucaneiro */
    { 16, 4, 4, 4 }, /* Caçador */
    { 20, 5, 3, 3 }, /* Cavaleiro */
    { 16, 4, 5, 5 }, /* Clérigo */
    { 16, 4, 4, 4 }, /* Druida */
    { 20, 5, 3, 3 }, /* Guerreiro */
    { 12, 3, 4, 4 }, /* Inventor */
    { 12, 3, 4, 4 }, /* Ladino */
    { 20, 5, 3, 3 }, /* Lutador */
    { 16, 4, 4, 4 }, /* Nobre */
    { 20, 5, 3, 3 }  /* Paladino */
};

typedef struct {
    const char *nome;
    T20Attribute attr;
} T20SkillInfo;

static const T20SkillInfo T20_SKILL_TABLE[T20_SKILL_COUNT] = {
    { "Acrobacia",     T20_ATTR_DESTREZA },
    { "Adestramento",  T20_ATTR_CARISMA },
    { "Atletismo",     T20_ATTR_FORCA },
    { "Atuação",       T20_ATTR_CARISMA },
    { "Cavalgar",      T20_ATTR_DESTREZA },
    { "Conhecimento",  T20_ATTR_INTELIGENCIA },
    { "Cura",          T20_ATTR_SABEDORIA },
    { "Diplomacia",    T20_ATTR_CARISMA },
    { "Enganação",     T20_ATTR_CARISMA },
    { "Fortitude",     T20_ATTR_CONSTITUICAO },
    { "Furtividade",   T20_ATTR_DESTREZA },
    { "Guerra",        T20_ATTR_INTELIGENCIA },
    { "Iniciativa",    T20_ATTR_DESTREZA },
    { "Intimidação",   T20_ATTR_CARISMA },
    { "Intuição",      T20_ATTR_SABEDORIA },
    { "Investigação",  T20_ATTR_INTELIGENCIA },
    { "Jogatina",      T20_ATTR_CARISMA },
    { "Ladinagem",     T20_ATTR_DESTREZA },
    { "Luta",          T20_ATTR_FORCA },
    { "Misticismo",    T20_ATTR_INTELIGENCIA },
    { "Nobreza",       T20_ATTR_INTELIGENCIA },
    { "Ofício",        T20_ATTR_INTELIGENCIA },
    { "Percepção",     T20_ATTR_SABEDORIA },
    { "Pilotagem",     T20_ATTR_DESTREZA },
    { "Pontaria",      T20_ATTR_DESTREZA },
    { "Reflexos",      T20_ATTR_DESTREZA },
    { "Religião",      T20_ATTR_SABEDORIA },
    { "Sobrevivência", T20_ATTR_SABEDORIA },
    { "Vontade",       T20_ATTR_SABEDORIA }
};

const char* t20_race_to_string(T20Race race) {
    if (race >= 0 && race < T20_RACE_COUNT) {
        return T20_RACE_NAMES[race];
    }
    return "Desconhecido";
}

T20Race t20_string_to_race(const char *name) {
    if (name == NULL) {
        return T20_RACE_HUMANO;
    }
    for (int i = 0; i < T20_RACE_COUNT; i++) {
        if (strcmp(T20_RACE_NAMES[i], name) == 0) {
            return (T20Race)i;
        }
    }
    return T20_RACE_HUMANO;
}

const char* t20_class_to_string(T20Class cls) {
    if (cls >= 0 && cls < T20_CLASS_COUNT) {
        return T20_CLASS_NAMES[cls];
    }
    return "Guerreiro";
}

T20Class t20_string_to_class(const char *name) {
    if (name == NULL) {
        return T20_CLASS_GUERREIRO;
    }
    for (int i = 0; i < T20_CLASS_COUNT; i++) {
        if (strcmp(T20_CLASS_NAMES[i], name) == 0) {
            return (T20Class)i;
        }
    }
    return T20_CLASS_GUERREIRO;
}

const char* t20_skill_to_string(T20Skill skill) {
    if (skill >= 0 && skill < T20_SKILL_COUNT) {
        return T20_SKILL_TABLE[skill].nome;
    }
    return "Desconhecido";
}

T20Attribute t20_skill_get_attribute(T20Skill skill) {
    if (skill >= 0 && skill < T20_SKILL_COUNT) {
        return T20_SKILL_TABLE[skill].attr;
    }
    return T20_ATTR_FORCA;
}

int t20_get_class_base_pv(T20Class cls) {
    if (cls >= 0 && cls < T20_CLASS_COUNT) {
        return T20_CLASS_TABLE[cls].base_pv;
    }
    return 20;
}

int t20_get_class_pv_per_level(T20Class cls) {
    if (cls >= 0 && cls < T20_CLASS_COUNT) {
        return T20_CLASS_TABLE[cls].pv_per_level;
    }
    return 5;
}

int t20_get_class_base_pm(T20Class cls) {
    if (cls >= 0 && cls < T20_CLASS_COUNT) {
        return T20_CLASS_TABLE[cls].base_pm;
    }
    return 3;
}

int t20_get_class_pm_per_level(T20Class cls) {
    if (cls >= 0 && cls < T20_CLASS_COUNT) {
        return T20_CLASS_TABLE[cls].pm_per_level;
    }
    return 3;
}

int t20_calc_modifier(int attribute_value) {
    if (attribute_value >= 10) {
        return (attribute_value - 10) / 2;
    } else {
        return (attribute_value - 11) / 2;
    }
}

int t20_get_attribute_by_id(const T20Sheet *sheet, T20Attribute attr) {
    if (sheet == NULL) return 10;
    switch (attr) {
        case T20_ATTR_FORCA:        return sheet->forca;
        case T20_ATTR_DESTREZA:     return sheet->destreza;
        case T20_ATTR_CONSTITUICAO: return sheet->constituicao;
        case T20_ATTR_INTELIGENCIA: return sheet->inteligencia;
        case T20_ATTR_SABEDORIA:    return sheet->sabedoria;
        case T20_ATTR_CARISMA:      return sheet->carisma;
        default:                    return 10;
    }
}

void t20_set_attribute_by_id(T20Sheet *sheet, T20Attribute attr, int valor) {
    if (sheet == NULL) return;
    switch (attr) {
        case T20_ATTR_FORCA:        sheet->forca = valor; break;
        case T20_ATTR_DESTREZA:     sheet->destreza = valor; break;
        case T20_ATTR_CONSTITUICAO: sheet->constituicao = valor; break;
        case T20_ATTR_INTELIGENCIA: sheet->inteligencia = valor; break;
        case T20_ATTR_SABEDORIA:    sheet->sabedoria = valor; break;
        case T20_ATTR_CARISMA:      sheet->carisma = valor; break;
        default: break;
    }
    t20_recalculate(sheet);
}

int t20_is_skill_trained(const T20Sheet *sheet, T20Skill skill) {
    if (sheet == NULL || skill < 0 || skill >= T20_SKILL_COUNT) {
        return 0;
    }
    return (sheet->pericias_treinadas & (1U << (unsigned int)skill)) != 0;
}

void t20_set_skill_trained(T20Sheet *sheet, T20Skill skill, int trained) {
    if (sheet == NULL || skill < 0 || skill >= T20_SKILL_COUNT) {
        return;
    }
    if (trained) {
        sheet->pericias_treinadas |= (1U << (unsigned int)skill);
    } else {
        sheet->pericias_treinadas &= ~(1U << (unsigned int)skill);
    }
}

int t20_calc_skill_total(const T20Sheet *sheet, T20Skill skill, int outros_bonus) {
    if (sheet == NULL || skill < 0 || skill >= T20_SKILL_COUNT) {
        return 0;
    }

    T20Attribute attr = t20_skill_get_attribute(skill);
    int mod_attr = t20_calc_modifier(t20_get_attribute_by_id(sheet, attr));
    int metade_nivel = (sheet->nivel > 0 ? sheet->nivel : 1) / 2;

    int bonus_treino = 0;
    if (t20_is_skill_trained(sheet, skill)) {
        int lvl = sheet->nivel > 0 ? sheet->nivel : 1;
        if (lvl <= 6) {
            bonus_treino = 2;
        } else if (lvl <= 14) {
            bonus_treino = 4;
        } else {
            bonus_treino = 6;
        }
    }

    return mod_attr + metade_nivel + bonus_treino + outros_bonus;
}

void t20_recalculate(T20Sheet *sheet) {
    if (sheet == NULL) {
        return;
    }

    T20Class cls = (T20Class)sheet->classe_id;
    if (cls < 0 || cls >= T20_CLASS_COUNT) {
        cls = T20_CLASS_GUERREIRO;
        sheet->classe_id = cls;
    }

    int lvl = sheet->nivel > 0 ? sheet->nivel : 1;
    int mod_con = t20_calc_modifier(sheet->constituicao);
    int mod_des = t20_calc_modifier(sheet->destreza);

    /* Cálculo de PV Max oficial T20:
       Nível 1: Base PV + Mod Con
       Níveis seguintes: (Nível - 1) * (PV por Nível + Mod Con) */
    int base_pv = t20_get_class_base_pv(cls);
    int pv_per_lvl = t20_get_class_pv_per_level(cls);
    int pv_calc = (base_pv + mod_con) + (lvl - 1) * (pv_per_lvl + mod_con);
    if (pv_calc < 1) {
        pv_calc = 1;
    }
    sheet->pv_max = pv_calc;

    /* Cálculo de PM Max oficial T20:
       Nível 1: Base PM
       Níveis seguintes: (Nível - 1) * PM por Nível */
    int base_pm = t20_get_class_base_pm(cls);
    int pm_per_lvl = t20_get_class_pm_per_level(cls);
    int pm_calc = base_pm + (lvl - 1) * pm_per_lvl;
    if (pm_calc < 1) {
        pm_calc = 1;
    }
    sheet->pm_max = pm_calc;

    /* Cálculo da Defesa (10 + Mod Des + Armadura + Escudo + Outros) */
    sheet->defesa = 10 + mod_des + sheet->bonus_armadura + sheet->bonus_escudo + sheet->bonus_outros_defesa;

    /* Ajuste de limites atuais */
    if (sheet->pv_atual > sheet->pv_max || sheet->pv_atual == 0) {
        sheet->pv_atual = sheet->pv_max;
    }
    if (sheet->pm_atual > sheet->pm_max || sheet->pm_atual == 0) {
        sheet->pm_atual = sheet->pm_max;
    }
}

void t20_init_default(T20Sheet *sheet, const char *nome, T20Race raca, const char *classe) {
    if (sheet == NULL) {
        return;
    }

    memset(sheet, 0, sizeof(T20Sheet));
    sheet->sistema = SYSTEM_TORMENTA20;

    /* Nome */
    if (nome != NULL && nome[0] != '\0') {
        strncpy(sheet->nome, nome, sizeof(sheet->nome) - 1);
        sheet->nome[sizeof(sheet->nome) - 1] = '\0';
    } else {
        strncpy(sheet->nome, "Novo Aventureiro", sizeof(sheet->nome) - 1);
        sheet->nome[sizeof(sheet->nome) - 1] = '\0';
    }

    /* Raça */
    if (raca < 0 || raca >= T20_RACE_COUNT) {
        raca = T20_RACE_HUMANO;
    }
    sheet->raca_id = raca;
    strncpy(sheet->raca, t20_race_to_string(raca), sizeof(sheet->raca) - 1);
    sheet->raca[sizeof(sheet->raca) - 1] = '\0';

    /* Classe */
    T20Class cls = t20_string_to_class(classe);
    sheet->classe_id = cls;
    strncpy(sheet->classe, t20_class_to_string(cls), sizeof(sheet->classe) - 1);
    sheet->classe[sizeof(sheet->classe) - 1] = '\0';

    sheet->nivel = 1;
    sheet->experiencia = 0;

    /* Atributos base padrão (10 em todos para ficha recém-criada) */
    sheet->forca = 10;
    sheet->destreza = 10;
    sheet->constituicao = 10;
    sheet->inteligencia = 10;
    sheet->sabedoria = 10;
    sheet->carisma = 10;

    sheet->bonus_armadura = 0;
    sheet->bonus_escudo = 0;
    sheet->bonus_outros_defesa = 0;
    sheet->pericias_treinadas = 0;

    /* Inicializa e calcula PV, PM e Defesa com base na classe */
    t20_recalculate(sheet);
}
