#include "sheet_t20.h"
#include "rpg_base.h"


static const char *T20_RACE_NAMES[T20_RACE_COUNT] = {
    "Humano",
    "Elfo",
    "Anão",
    "Goblin",
    "Minotauro",
    "Draconato"
};

const char* t20_race_to_string(T20Race race) {
    if (race >= 0 && race < T20_RACE_COUNT) {
        return T20_RACE_NAMES[race];
    }
    return "Desconhecido";
}

T20Race t20_string_to_race(const char *name) {
    if (name == NULL) {
        return T20_RACE_HUMANO;
    }
    for (int i = 0; i < T20_RACE_COUNT; i++) {
        if (strcmp(T20_RACE_NAMES[i], name) == 0) {
            return (T20Race)i;
        }
    }
    return T20_RACE_HUMANO;
}

int t20_calc_modifier(int attribute_value) {
    if (attribute_value >= 10) {
        return (attribute_value - 10) / 2;
    } else {
        return (attribute_value - 11) / 2;
    }
}

void t20_recalculate(T20Sheet *sheet) {
    if (sheet == NULL) {
        return;
    }

    int mod_des = t20_calc_modifier(sheet->destreza);
    sheet->defesa = 10 + mod_des;

    /* Garante que valores atuais não excedam os máximos se válidos */
    if (sheet->pv_max > 0 && sheet->pv_atual > sheet->pv_max) {
        sheet->pv_atual = sheet->pv_max;
    }
    if (sheet->pm_max > 0 && sheet->pm_atual > sheet->pm_max) {
        sheet->pm_atual = sheet->pm_max;
    }
}

void t20_init_default(T20Sheet *sheet, const char *nome, T20Race raca, const char *classe) {
    if (sheet == NULL) {
        return;
    }

    memset(sheet, 0, sizeof(T20Sheet));
    sheet->sistema = SYSTEM_TORMENTA20;

    /* Nome */
    if (nome != NULL && nome[0] != '\0') {
        strncpy(sheet->nome, nome, sizeof(sheet->nome) - 1);
        sheet->nome[sizeof(sheet->nome) - 1] = '\0';
    } else {
        strncpy(sheet->nome, "Novo Aventureiro", sizeof(sheet->nome) - 1);
        sheet->nome[sizeof(sheet->nome) - 1] = '\0';
    }

    /* Raça */
    if (raca < 0 || raca >= T20_RACE_COUNT) {
        raca = T20_RACE_HUMANO;
    }
    sheet->raca_id = raca;
    strncpy(sheet->raca, t20_race_to_string(raca), sizeof(sheet->raca) - 1);
    sheet->raca[sizeof(sheet->raca) - 1] = '\0';

    /* Classe */
    if (classe != NULL && classe[0] != '\0') {
        strncpy(sheet->classe, classe, sizeof(sheet->classe) - 1);
        sheet->classe[sizeof(sheet->classe) - 1] = '\0';
    } else {
        strncpy(sheet->classe, "Guerreiro", sizeof(sheet->classe) - 1);
        sheet->classe[sizeof(sheet->classe) - 1] = '\0';
    }

    sheet->nivel = 1;
    sheet->experiencia = 0;

    /* Atributos base padrão (10 em todos para ficha recém-criada) */
    sheet->forca = 10;
    sheet->destreza = 10;
    sheet->constituicao = 10;
    sheet->inteligencia = 10;
    sheet->sabedoria = 10;
    sheet->carisma = 10;

    /* Pontos de Vida e Mana iniciais padrão */
    int mod_con = t20_calc_modifier(sheet->constituicao);
    sheet->pv_max = 16 + mod_con;
    sheet->pv_atual = sheet->pv_max;

    sheet->pm_max = 5;
    sheet->pm_atual = sheet->pm_max;

    t20_recalculate(sheet);
}
