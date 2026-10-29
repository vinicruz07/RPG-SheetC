#include "sheet_all.h"


const char* rpg_sheet_get_name(const RPGSheet *sheet) {
    if (sheet == NULL) return "Desconhecido";
    switch (sheet->sistema) {
        case SYSTEM_TORMENTA20:     return sheet->data.t20.nome;
        case SYSTEM_DND5E:          return sheet->data.dnd5e.nome;
        case SYSTEM_FABULA_ULTIMA:  return sheet->data.fabula.nome;
        case SYSTEM_3DET_VICTORY:   return sheet->data.threedet.nome;
        default:                    return "Desconhecido";
    }
}

int rpg_sheet_get_pv_atual(const RPGSheet *sheet) {
    if (sheet == NULL) return 0;
    switch (sheet->sistema) {
        case SYSTEM_TORMENTA20:     return sheet->data.t20.pv_atual;
        case SYSTEM_DND5E:          return sheet->data.dnd5e.hp_atual;
        case SYSTEM_FABULA_ULTIMA:  return sheet->data.fabula.hp_atual;
        case SYSTEM_3DET_VICTORY:   return sheet->data.threedet.pv_atual;
        default:                    return 0;
    }
}

int rpg_sheet_get_pv_max(const RPGSheet *sheet) {
    if (sheet == NULL) return 0;
    switch (sheet->sistema) {
        case SYSTEM_TORMENTA20:     return sheet->data.t20.pv_max;
        case SYSTEM_DND5E:          return sheet->data.dnd5e.hp_max;
        case SYSTEM_FABULA_ULTIMA:  return sheet->data.fabula.hp_max;
        case SYSTEM_3DET_VICTORY:   return sheet->data.threedet.pv_max;
        default:                    return 0;
    }
}

int rpg_sheet_get_defesa(const RPGSheet *sheet) {
    if (sheet == NULL) return 10;
    switch (sheet->sistema) {
        case SYSTEM_TORMENTA20:     return sheet->data.t20.defesa;
        case SYSTEM_DND5E:          return sheet->data.dnd5e.classe_armadura;
        case SYSTEM_FABULA_ULTIMA:  return sheet->data.fabula.defesa;
        case SYSTEM_3DET_VICTORY:   return sheet->data.threedet.defesa;
        default:                    return 10;
    }
}
