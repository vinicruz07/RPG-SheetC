#include <stdio.h>
#include <assert.h>
#include <string.h>
#include "../src/core/sheet_types.h"
#include "../src/core/sheet_t20.h"
#include "../src/core/dice.h"

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

static void test_dice_distribution(void) {
    dice_set_seed(123456789);

    /* Teste de 10.000 rolagens de d20 para verificar limites e distribuicao */
    int counts[21] = {0};
    for (int i = 0; i < 10000; i++) {
        int r = roll_d20();
        assert(r >= 1 && r <= 20);
        counts[r]++;
    }

    /* Cada face de 1 a 20 deve ter ocorrido ao menos 300 vezes (media 500) */
    for (int face = 1; face <= 20; face++) {
        assert(counts[face] > 300 && counts[face] < 700);
    }

    printf("  [OK] Distribuicao estatistica uniforme de 10.000 rolagens de d20\n");
}

static void test_dice_detailed_roll(void) {
    dice_set_seed(987654321);

    /* Rola 3d6+5 */
    DiceRollResult res = roll_dice(6, 3, 5);
    assert(res.faces == 6);
    assert(res.count == 3);
    assert(res.modifier == 5);
    assert(res.subtotal >= 3 && res.subtotal <= 18);
    assert(res.total == res.subtotal + 5);

    int manual_sum = 0;
    for (int i = 0; i < res.count; i++) {
        assert(res.rolls[i] >= 1 && res.rolls[i] <= 6);
        manual_sum += res.rolls[i];
    }
    assert(manual_sum == res.subtotal);

    /* Rola 1d20 com forca bruta ate obter um critico e uma falha para testar flags */
    int saw_crit = 0, saw_fumble = 0;
    for (int i = 0; i < 500; i++) {
        DiceRollResult d20 = roll_dice(20, 1, 0);
        if (d20.rolls[0] == 20) {
            assert(d20.is_critical == 1);
            saw_crit = 1;
        }
        if (d20.rolls[0] == 1) {
            assert(d20.is_fumble == 1);
            saw_fumble = 1;
        }
    }
    assert(saw_crit && saw_fumble);

    printf("  [OK] Rolagem detalhada de multiplos dados e flags de critico/falha\n");
}

int main(void) {
    printf("=== Executando Testes Unitarios do Core C (RPG-SheetC) ===\n");
    test_t20_modifiers();
    test_t20_initialization();
    test_t20_recalculate();
    test_dice_distribution();
    test_dice_detailed_roll();
    printf("=== Todos os testes passaram com sucesso! ===\n");
    return 0;
}
