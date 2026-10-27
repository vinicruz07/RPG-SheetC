#ifndef SHEET_T20_H
#define SHEET_T20_H

#include "sheet_types.h"

#define T20_NAME_MAX_LEN 32
#define T20_RACE_MAX_LEN 24
#define T20_CLASS_MAX_LEN 24

/**
 * Raças suportadas no módulo de Tormenta 20 (baseadas no legado menu.c)
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
 * Estrutura representativa de uma ficha de Tormenta 20 em C puro
 */
typedef struct {
    int sistema;                       /* Identificador: SYSTEM_TORMENTA20 */
    char nome[T20_NAME_MAX_LEN];       /* Nome do personagem */
    int raca_id;                       /* Enum T20Race */
    char raca[T20_RACE_MAX_LEN];       /* Texto descritivo da raça */
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

    /* Defesa calculada (10 + Mod Des + bônus adicionais) */
    int defesa;
} T20Sheet;

/**
 * Converte o enum T20Race para uma string legível.
 */
const char* t20_race_to_string(T20Race race);

/**
 * Converte string de raça para o enum T20Race correspondente.
 */
T20Race t20_string_to_race(const char *name);

/**
 * Calcula o modificador de atributo no padrão Tormenta 20 / d20.
 * Fórmula: floor((valor - 10) / 2)
 */
int t20_calc_modifier(int attribute_value);

/**
 * Inicializa uma ficha de Tormenta 20 com valores padrão e atributos calculados.
 */
void t20_init_default(T20Sheet *sheet, const char *nome, T20Race raca, const char *classe);

/**
 * Recalcula valores derivados da ficha (defesa, limites de pv/pm).
 */
void t20_recalculate(T20Sheet *sheet);

#endif /* SHEET_T20_H */
