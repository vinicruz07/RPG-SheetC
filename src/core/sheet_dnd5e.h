#ifndef SHEET_DND5E_H
#define SHEET_DND5E_H

#include "sheet_types.h"
#include "rpg_base.h"

#define DND5E_NAME_MAX_LEN 32
#define DND5E_RACE_MAX_LEN 24
#define DND5E_CLASS_MAX_LEN 24

/**
 * Estrutura para ficha de Dungeons & Dragons 5ª Edição
 */
typedef struct {
    int sistema;                       /* SYSTEM_DND5E */
    char nome[DND5E_NAME_MAX_LEN];
    char raca[DND5E_RACE_MAX_LEN];
    char classe[DND5E_CLASS_MAX_LEN];
    int nivel;
    int experiencia;

    /* Hit Points (HP) */
    int hp_max;
    int hp_atual;
    int hp_temp;

    /* Atributos Clássicos D&D */
    int forca;
    int destreza;
    int constituicao;
    int inteligencia;
    int sabedoria;
    int carisma;

    /* Estatísticas de Combate */
    int bonus_proficiencia;            /* +2 no lvl 1-4, até +6 no lvl 17-20 */
    int classe_armadura;               /* Armor Class (AC) */
    int iniciativa;
    int deslocamento;                  /* Em metros ou pés (padrão 9m / 30ft) */
} DnD5eSheet;

static inline int dnd5e_calc_modifier(int score) {
    if (score >= 10) return (score - 10) / 2;
    return (score - 11) / 2;
}

static inline int dnd5e_calc_proficiency(int nivel) {
    if (nivel <= 4) return 2;
    if (nivel <= 8) return 3;
    if (nivel <= 12) return 4;
    if (nivel <= 16) return 5;
    return 6;
}

void dnd5e_init_default(DnD5eSheet *sheet, const char *nome, const char *raca, const char *classe);
void dnd5e_recalculate(DnD5eSheet *sheet);

#endif /* SHEET_DND5E_H */
