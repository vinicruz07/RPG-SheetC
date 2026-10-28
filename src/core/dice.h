#ifndef DICE_H
#define DICE_H

#include "rpg_base.h"

#define DICE_MAX_ROLLS 32

/**
 * Estrutura com o resultado detalhado de uma rolagem de dados
 */
typedef struct {
    int faces;                    /* Quantidade de faces do dado (d4, d6, d20, etc.) */
    int count;                    /* Quantidade de dados rolados */
    int modifier;                 /* Modificador numérico adicionado ao total (+2, -1, etc.) */
    int rolls[DICE_MAX_ROLLS];    /* Valores individuais de cada dado rolado */
    int subtotal;                 /* Soma de todos os dados rolados (sem o modificador) */
    int total;                    /* Resultado final (subtotal + modifier) */
    int is_critical;              /* 1 se for um 20 natural em d20 (sucesso crítico), 0 caso contrário */
    int is_fumble;                /* 1 se for um 1 natural em d20 (falha crítica), 0 caso contrário */
} DiceRollResult;

/**
 * Define a semente (seed) do gerador de números aleatórios.
 */
void dice_set_seed(unsigned int seed);

/**
 * Retorna um número pseudoaleatório de 32 bits.
 */
unsigned int dice_get_random_u32(void);

/**
 * Retorna um número inteiro uniforme no intervalo [min, max] (inclusivo).
 */
int dice_random_range(int min, int max);

/**
 * Rola um único d20 (1 a 20).
 */
int roll_d20(void);

/**
 * Rola dados e retorna diretamente a soma com o modificador.
 */
int roll_dice_simple(int faces, int count, int modifier);

/**
 * Rola dados e preenche a estrutura completa com cada dado individual e flags de crítico/falha.
 */
DiceRollResult roll_dice(int faces, int count, int modifier);

#endif /* DICE_H */
