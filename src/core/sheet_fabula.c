#include "sheet_fabula.h"

void fabula_recalculate(FabulaSheet *sheet) {
    if (sheet == NULL) return;

    int lvl = sheet->nivel > 0 ? sheet->nivel : 5;

    /* HP Max: Nível + (Vigor * 5) */
    sheet->hp_max = lvl + (sheet->vigor * 5);
    if (sheet->hp_atual > sheet->hp_max || sheet->hp_atual == 0) {
        sheet->hp_atual = sheet->hp_max;
    }

    /* MP Max: Nível + (Vontade * 5) */
    sheet->mp_max = lvl + (sheet->vontade * 5);
    if (sheet->mp_atual > sheet->mp_max || sheet->mp_atual == 0) {
        sheet->mp_atual = sheet->mp_max;
    }

    /* Defesas base = tamanho do dado do atributo */
    sheet->defesa = sheet->destreza;
    sheet->defesa_magica = sheet->intuicao;
}

void fabula_init_default(FabulaSheet *sheet, const char *nome, const char *identidade) {
    if (sheet == NULL) return;

    memset(sheet, 0, sizeof(FabulaSheet));
    sheet->sistema = SYSTEM_FABULA_ULTIMA;

    if (nome != NULL && nome[0] != '\0') {
        strncpy(sheet->nome, nome, sizeof(sheet->nome) - 1);
        sheet->nome[sizeof(sheet->nome) - 1] = '\0';
    } else {
        strncpy(sheet->nome, "Herói Fabula", sizeof(sheet->nome) - 1);
        sheet->nome[sizeof(sheet->nome) - 1] = '\0';
    }

    if (identidade != NULL && identidade[0] != '\0') {
        strncpy(sheet->identidade, identidade, sizeof(sheet->identidade) - 1);
        sheet->identidade[sizeof(sheet->identidade) - 1] = '\0';
    } else {
        strncpy(sheet->identidade, "Guerreiro Errante", sizeof(sheet->identidade) - 1);
        sheet->identidade[sizeof(sheet->identidade) - 1] = '\0';
    }

    strncpy(sheet->tema, "Esperança", sizeof(sheet->tema) - 1);
    sheet->tema[sizeof(sheet->tema) - 1] = '\0';

    strncpy(sheet->origem, "Reino das Brumas", sizeof(sheet->origem) - 1);
    sheet->origem[sizeof(sheet->origem) - 1] = '\0';

    sheet->nivel = 5; /* Fabula Ultima inicia no nível 5 */

    /* Atributos iniciais padrão (d8 em todos) */
    sheet->destreza = 8;
    sheet->intuicao = 8;
    sheet->vigor = 8;
    sheet->vontade = 8;

    sheet->ip_max = 6;
    sheet->ip_atual = 6;
    sheet->pontos_fabula = 3;

    fabula_recalculate(sheet);
}
