#include "sheet_3det.h"

void threedet_recalculate(ThreeDetSheet *sheet) {
    if (sheet == NULL) return;

    /* PV = R * 5 (se R = 0, PV = 1) */
    int pv = sheet->resistencia * 5;
    sheet->pv_max = pv > 0 ? pv : 1;
    if (sheet->pv_atual > sheet->pv_max || sheet->pv_atual == 0) {
        sheet->pv_atual = sheet->pv_max;
    }

    /* PM = R * 5 (se R = 0, PM = 1) */
    int pm = sheet->resistencia * 5;
    sheet->pm_max = pm > 0 ? pm : 1;
    if (sheet->pm_atual > sheet->pm_max || sheet->pm_atual == 0) {
        sheet->pm_atual = sheet->pm_max;
    }

    /* PA base = 1 */
    sheet->pa_max = 1;
    if (sheet->pa_atual == 0) {
        sheet->pa_atual = sheet->pa_max;
    }

    /* Defesa passiva = Habilidade + Resistência */
    sheet->defesa = sheet->habilidade + sheet->resistencia;
}

void threedet_init_default(ThreeDetSheet *sheet, const char *nome, const char *arquetipo) {
    if (sheet == NULL) return;

    memset(sheet, 0, sizeof(ThreeDetSheet));
    sheet->sistema = SYSTEM_3DET_VICTORY;

    if (nome != NULL && nome[0] != '\0') {
        strncpy(sheet->nome, nome, sizeof(sheet->nome) - 1);
        sheet->nome[sizeof(sheet->nome) - 1] = '\0';
    } else {
        strncpy(sheet->nome, "Novo Campeão", sizeof(sheet->nome) - 1);
        sheet->nome[sizeof(sheet->nome) - 1] = '\0';
    }

    if (arquetipo != NULL && arquetipo[0] != '\0') {
        strncpy(sheet->arquétipo, arquetipo, sizeof(sheet->arquétipo) - 1);
        sheet->arquétipo[sizeof(sheet->arquétipo) - 1] = '\0';
    } else {
        strncpy(sheet->arquétipo, "Lutador", sizeof(sheet->arquétipo) - 1);
        sheet->arquétipo[sizeof(sheet->arquétipo) - 1] = '\0';
    }

    sheet->pontos_personagem = 10;
    sheet->escala = THREEDET_ESCALA_NINGEN;

    /* Padrão 3D&T: P1, H2, R2 */
    sheet->poder = 1;
    sheet->habilidade = 2;
    sheet->resistencia = 2;

    threedet_recalculate(sheet);
}
