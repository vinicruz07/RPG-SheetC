#ifndef SHEET_3DET_H
#define SHEET_3DET_H

#include "sheet_types.h"
#include "rpg_base.h"

#define THREEDET_NAME_MAX_LEN 32
#define THREEDET_ARCH_MAX_LEN 32

/**
 * Escala de poder do 3D&T Victory
 */
typedef enum {
    THREEDET_ESCALA_NINGEN = 0,   /* Humano/Comum */
    THREEDET_ESCALA_SUGOI = 1,    /* Incrível (x10) */
    THREEDET_ESCALA_KYOUJIN = 2,  /* Titânico (x100) */
    THREEDET_ESCALA_KAMI = 3      /* Divino (x1000) */
} ThreeDetEscala;

/**
 * Estrutura para ficha de 3D&T Victory
 */
typedef struct {
    int sistema;                       /* SYSTEM_3DET_VICTORY */
    char nome[THREEDET_NAME_MAX_LEN];
    char arquétipo[THREEDET_ARCH_MAX_LEN];
    int pontos_personagem;             /* Pontos totais de construção (ex: 10, 12) */
    ThreeDetEscala escala;

    /* Características base de 3D&T Victory */
    int poder;                         /* P */
    int habilidade;                    /* H */
    int resistencia;                   /* R */

    /* Recursos derivados */
    int pv_max;                        /* PV = R * 5 (mínimo 1) */
    int pv_atual;
    int pm_max;                        /* PM = R * 5 (mínimo 1) */
    int pm_atual;
    int pa_max;                        /* Pontos de Ação (PA = 1 base) */
    int pa_atual;

    int defesa;                        /* Defesa passiva = H + R */
} ThreeDetSheet;

void threedet_init_default(ThreeDetSheet *sheet, const char *nome, const char *arquetipo);
void threedet_recalculate(ThreeDetSheet *sheet);

#endif /* SHEET_3DET_H */
