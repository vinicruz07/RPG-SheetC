#include <stdio.h>
#include <assert.h>
#include <string.h>
#include "../src/core/sheet_types.h"
#include "../src/core/sheet_t20.h"

static void test_t20_modifiers(void) {
    assert(t20_calc_modifier(10) == 0);
    assert(t20_calc_modifier(11) == 0);
    assert(t20_calc_modifier(12) == 1);
    assert(t20_calc_modifier(18) == 4);
    assert(t20_calc_modifier(9) == -1);
    assert(t20_calc_modifier(8) == -1);
    assert(t20_calc_modifier(7) == -2);
    assert(t20_calc_modifier(1) == -5);
    printf("  [OK] Calculo de modificadores de atributos\n");
}

static void test_t20_initialization(void) {
    T20Sheet sheet;
    t20_init_default(&sheet, "Valeros", T20_RACE_HUMANO, "Guerreiro");

    assert(sheet.sistema == SYSTEM_TORMENTA20);
    assert(strcmp(sheet.nome, "Valeros") == 0);
    assert(sheet.raca_id == T20_RACE_HUMANO);
    assert(strcmp(sheet.raca, "Humano") == 0);
    assert(strcmp(sheet.classe, "Guerreiro") == 0);
    assert(sheet.nivel == 1);
    assert(sheet.forca == 10);
    assert(sheet.destreza == 10);
    assert(sheet.pv_max == 16);
    assert(sheet.pv_atual == 16);
    assert(sheet.pm_max == 5);
    assert(sheet.pm_atual == 5);
    assert(sheet.defesa == 10);

    printf("  [OK] Inicializacao de ficha padrao Tormenta 20\n");
}

static void test_t20_recalculate(void) {
    T20Sheet sheet;
    t20_init_default(&sheet, "Sir Alistair", T20_RACE_ANAO, "Guerreiro");

    /* Aumenta a destreza para 16 (+3) */
    sheet.destreza = 16;
    t20_recalculate(&sheet);
    assert(sheet.defesa == 13);

    printf("  [OK] Recalculo de defesa baseada em atributos\n");
}

int main(void) {
    printf("=== Executando Testes Unitarios do Core C (RPG-SheetC) ===\n");
    test_t20_modifiers();
    test_t20_initialization();
    test_t20_recalculate();
    printf("=== Todos os testes passaram com sucesso! ===\n");
    return 0;
}
