#ifndef SHEET_T20_H
#define SHEET_T20_H

#include "sheet_types.h"

#define T20_NAME_MAX_LEN 32
#define T20_RACE_MAX_LEN 24
#define T20_CLASS_MAX_LEN 24

/**
 * Raças suportadas no módulo de Tormenta 20
 */
typedef enum {
    T20_RACE_HUMANO = 0,
    T20_RACE_ELFO = 1,
    T20_RACE_ANAO = 2,
    T20_RACE_GOBLIN = 3,
    T20_RACE_MINOTAURO = 4,
    T20_RACE_DRACONATO = 5,
    T20_RACE_COUNT = 6
} T20Race;

/**
 * Classes oficiais do sistema Tormenta 20
 */
typedef enum {
    T20_CLASS_ARCANISTA = 0,
    T20_CLASS_BARBARO = 1,
    T20_CLASS_BARDO = 2,
    T20_CLASS_BUCANEIRO = 3,
    T20_CLASS_CACADOR = 4,
    T20_CLASS_CAVALEIRO = 5,
    T20_CLASS_CLERIGO = 6,
    T20_CLASS_DRUIDA = 7,
    T20_CLASS_GUERREIRO = 8,
    T20_CLASS_INVENTOR = 9,
    T20_CLASS_LADINO = 10,
    T20_CLASS_LUTADOR = 11,
    T20_CLASS_NOBRE = 12,
    T20_CLASS_PALADINO = 13,
    T20_CLASS_COUNT = 14
} T20Class;

/**
 * Atributos principais de Tormenta 20
 */
typedef enum {
    T20_ATTR_FORCA = 0,
    T20_ATTR_DESTREZA = 1,
    T20_ATTR_CONSTITUICAO = 2,
    T20_ATTR_INTELIGENCIA = 3,
    T20_ATTR_SABEDORIA = 4,
    T20_ATTR_CARISMA = 5,
    T20_ATTR_COUNT = 6
} T20Attribute;

/**
 * Perícias oficiais do sistema Tormenta 20
 */
typedef enum {
    T20_SKILL_ACROBACIA = 0,    /* DES */
    T20_SKILL_ADESTRAMENTO,     /* CAR */
    T20_SKILL_ATLETISMO,        /* FOR */
    T20_SKILL_ATUACAO,          /* CAR */
    T20_SKILL_CAVALGAR,         /* DES */
    T20_SKILL_CONHECIMENTO,     /* INT */
    T20_SKILL_CURA,             /* SAB */
    T20_SKILL_DIPLOMACIA,       /* CAR */
    T20_SKILL_ENGANACAO,        /* CAR */
    T20_SKILL_FORTITUDE,        /* CON */
    T20_SKILL_FURTIVIDADE,      /* DES */
    T20_SKILL_GUERRA,           /* INT */
    T20_SKILL_INICIATIVA,       /* DES */
    T20_SKILL_INTIMIDACAO,      /* CAR */
    T20_SKILL_INTUICAO,         /* SAB */
    T20_SKILL_INVESTIGACAO,     /* INT */
    T20_SKILL_JOGATINA,         /* CAR */
    T20_SKILL_LADINAGEM,        /* DES */
    T20_SKILL_LUTA,             /* FOR */
    T20_SKILL_MISTICISMO,       /* INT */
    T20_SKILL_NOBREZA,          /* INT */
    T20_SKILL_OFICIO,           /* INT */
    T20_SKILL_PERCEPCAO,        /* SAB */
    T20_SKILL_PILOTAGEM,        /* DES */
    T20_SKILL_PONTARIA,         /* DES */
    T20_SKILL_REFLEXOS,         /* DES */
    T20_SKILL_RELIGIAO,         /* SAB */
    T20_SKILL_SOBREVIVENCIA,    /* SAB */
    T20_SKILL_VONTADE,          /* SAB */
    T20_SKILL_COUNT             /* 29 perícias */
} T20Skill;

/**
 * Estrutura representativa de uma ficha de Tormenta 20 em C puro
 */
typedef struct {
    int sistema;                       /* Identificador: SYSTEM_TORMENTA20 */
    char nome[T20_NAME_MAX_LEN];       /* Nome do personagem */
    int raca_id;                       /* Enum T20Race */
    char raca[T20_RACE_MAX_LEN];       /* Texto descritivo da raça */
    int classe_id;                     /* Enum T20Class */
    char classe[T20_CLASS_MAX_LEN];    /* Classe do personagem */
    int nivel;                         /* Nível do personagem (1-20) */
    int experiencia;                   /* Experiência (XP) acumulada */

    /* Pontos de Vida (PV) */
    int pv_max;
    int pv_atual;

    /* Pontos de Mana (PM) */
    int pm_max;
    int pm_atual;

    /* Atributos base */
    int forca;
    int destreza;
    int constituicao;
    int inteligencia;
    int sabedoria;
    int carisma;

    /* Bônus de Defesa */
    int bonus_armadura;
    int bonus_escudo;
    int bonus_outros_defesa;
    int defesa;

    /* Máscara de bits para perícias treinadas (bit 1 << T20Skill) */
    unsigned int pericias_treinadas;
} T20Sheet;

/* Conversões de texto e identificadores */
const char* t20_race_to_string(T20Race race);
T20Race t20_string_to_race(const char *name);

const char* t20_class_to_string(T20Class cls);
T20Class t20_string_to_class(const char *name);

const char* t20_skill_to_string(T20Skill skill);
T20Attribute t20_skill_get_attribute(T20Skill skill);

/* Tabelas oficiais de classes Tormenta 20 */
int t20_get_class_base_pv(T20Class cls);
int t20_get_class_pv_per_level(T20Class cls);
int t20_get_class_base_pm(T20Class cls);
int t20_get_class_pm_per_level(T20Class cls);

/* Cálculos de regras */
int t20_calc_modifier(int attribute_value);
int t20_get_attribute_by_id(const T20Sheet *sheet, T20Attribute attr);
void t20_set_attribute_by_id(T20Sheet *sheet, T20Attribute attr, int valor);

int t20_is_skill_trained(const T20Sheet *sheet, T20Skill skill);
void t20_set_skill_trained(T20Sheet *sheet, T20Skill skill, int trained);
int t20_calc_skill_total(const T20Sheet *sheet, T20Skill skill, int outros_bonus);

/* Inicialização e Recálculo da Ficha */
void t20_init_default(T20Sheet *sheet, const char *nome, T20Race raca, const char *classe);
void t20_recalculate(T20Sheet *sheet);

#endif /* SHEET_T20_H */
