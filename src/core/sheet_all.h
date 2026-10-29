#ifndef SHEET_ALL_H
#define SHEET_ALL_H

#include "sheet_types.h"
#include "sheet_t20.h"
#include "sheet_dnd5e.h"
#include "sheet_fabula.h"
#include "sheet_3det.h"

/**
 * União polimórfica universal que encapsula qualquer ficha suportada pelo motor
 */
typedef struct {
    RPGSystemId sistema;
    union {
        T20Sheet t20;
        DnD5eSheet dnd5e;
        FabulaSheet fabula;
        ThreeDetSheet threedet;
    } data;
} RPGSheet;

/* Helpers universais para inspeção de ficha polimórfica */
const char* rpg_sheet_get_name(const RPGSheet *sheet);
int rpg_sheet_get_pv_atual(const RPGSheet *sheet);
int rpg_sheet_get_pv_max(const RPGSheet *sheet);
int rpg_sheet_get_defesa(const RPGSheet *sheet);

#endif /* SHEET_ALL_H */
