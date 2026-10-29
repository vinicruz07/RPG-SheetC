#ifndef SHEET_FABULA_H
#define SHEET_FABULA_H

#include "sheet_types.h"
#include "rpg_base.h"

#define FABULA_NAME_MAX_LEN 32
#define FABULA_CLASS_MAX_LEN 32

/**
 * Estrutura para ficha de Fabula Ultima (JRPG Tabletop)
 */
typedef struct {
    int sistema;                       /* SYSTEM_FABULA_ULTIMA */
    char nome[FABULA_NAME_MAX_LEN];
    char identidade[FABULA_CLASS_MAX_LEN];
    char tema[FABULA_CLASS_MAX_LEN];
    char origem[FABULA_CLASS_MAX_LEN];
    int nivel;                         /* Nível do personagem (5 a 50) */

    /* Atributos em dados (d6, d8, d10, d12) */
    int destreza;                      /* d6 = 6, d8 = 8, d10 = 10, d12 = 12 */
    int intuicao;                      /* Insight */
    int vigor;                         /* Might */
    int vontade;                       /* Willpower */

    /* Pontos de Vida, Mana e Inventário */
    int hp_max;
    int hp_atual;
    int mp_max;
    int mp_atual;
    int ip_max;                        /* Inventory Points (padrão 6) */
    int ip_atual;
    int pontos_fabula;                 /* Fabula Points (padrão 3) */

    /* Defesas derivadas */
    int defesa;                        /* Baseado no dado de Destreza */
    int defesa_magica;                 /* Baseado no dado de Intuição */
} FabulaSheet;

void fabula_init_default(FabulaSheet *sheet, const char *nome, const char *identidade);
void fabula_recalculate(FabulaSheet *sheet);

#endif /* SHEET_FABULA_H */
