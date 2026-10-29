#include "sheet_dnd5e.h"

void dnd5e_recalculate(DnD5eSheet *sheet) {
    if (sheet == NULL) return;

    int lvl = sheet->nivel > 0 ? sheet->nivel : 1;
    sheet->bonus_proficiencia = dnd5e_calc_proficiency(lvl);

    int mod_des = dnd5e_calc_modifier(sheet->destreza);
    sheet->iniciativa = mod_des;

    /* Base AC se sem armadura = 10 + Mod Des */
    if (sheet->classe_armadura == 0) {
        sheet->classe_armadura = 10 + mod_des;
    }

    if (sheet->hp_atual > sheet->hp_max || sheet->hp_atual == 0) {
        sheet->hp_atual = sheet->hp_max;
    }
}

void dnd5e_init_default(DnD5eSheet *sheet, const char *nome, const char *raca, const char *classe) {
    if (sheet == NULL) return;

    memset(sheet, 0, sizeof(DnD5eSheet));
    sheet->sistema = SYSTEM_DND5E;

    if (nome != NULL && nome[0] != '\0') {
        strncpy(sheet->nome, nome, sizeof(sheet->nome) - 1);
        sheet->nome[sizeof(sheet->nome) - 1] = '\0';
    } else {
        strncpy(sheet->nome, "Novo Personagem D&D", sizeof(sheet->nome) - 1);
        sheet->nome[sizeof(sheet->nome) - 1] = '\0';
    }

    if (raca != NULL && raca[0] != '\0') {
        strncpy(sheet->raca, raca, sizeof(sheet->raca) - 1);
        sheet->raca[sizeof(sheet->raca) - 1] = '\0';
    } else {
        strncpy(sheet->raca, "Humano", sizeof(sheet->raca) - 1);
        sheet->raca[sizeof(sheet->raca) - 1] = '\0';
    }

    if (classe != NULL && classe[0] != '\0') {
        strncpy(sheet->classe, classe, sizeof(sheet->classe) - 1);
        sheet->classe[sizeof(sheet->classe) - 1] = '\0';
    } else {
        strncpy(sheet->classe, "Fighter", sizeof(sheet->classe) - 1);
        sheet->classe[sizeof(sheet->classe) - 1] = '\0';
    }

    sheet->nivel = 1;
    sheet->experiencia = 0;

    sheet->forca = 10;
    sheet->destreza = 10;
    sheet->constituicao = 10;
    sheet->inteligencia = 10;
    sheet->sabedoria = 10;
    sheet->carisma = 10;

    int mod_con = dnd5e_calc_modifier(sheet->constituicao);
    sheet->hp_max = 10 + mod_con; /* Padrão Fighter */
    sheet->hp_atual = sheet->hp_max;
    sheet->hp_temp = 0;
    sheet->deslocamento = 9;

    dnd5e_recalculate(sheet);
}
