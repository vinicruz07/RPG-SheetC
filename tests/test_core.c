#include <stdio.h>
#include <assert.h>
#include <string.h>
#include "../src/core/sheet_types.h"
#include "../src/core/sheet_t20.h"
#include "../src/core/dice.h"
#include "../src/core/sheet_json.h"

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

static void test_t20_initialization_and_classes(void) {
    T20Sheet guerreiro;
    t20_init_default(&guerreiro, "Valeros", T20_RACE_HUMANO, "Guerreiro");

    assert(guerreiro.sistema == SYSTEM_TORMENTA20);
    assert(strcmp(guerreiro.nome, "Valeros") == 0);
    assert(guerreiro.classe_id == T20_CLASS_GUERREIRO);
    assert(guerreiro.nivel == 1);
    assert(guerreiro.pv_max == 20); /* Guerreiro base 20 + Con (+0) */
    assert(guerreiro.pm_max == 3);  /* Guerreiro base 3 */
    assert(guerreiro.defesa == 10);

    /* Teste com Arcanista */
    T20Sheet arcanista;
    t20_init_default(&arcanista, "Mestrado", T20_RACE_ELFO, "Arcanista");
    assert(arcanista.classe_id == T20_CLASS_ARCANISTA);
    assert(arcanista.pv_max == 8);  /* Arcanista base 8 + Con (+0) */
    assert(arcanista.pm_max == 6);  /* Arcanista base 6 */

    /* Teste com Bárbaro */
    T20Sheet barbaro;
    t20_init_default(&barbaro, "Conan", T20_RACE_MINOTAURO, "Bárbaro");
    assert(barbaro.classe_id == T20_CLASS_BARBARO);
    assert(barbaro.pv_max == 24); /* Bárbaro base 24 */
    assert(barbaro.pm_max == 3);

    printf("  [OK] Inicializacao de classes oficiais Tormenta 20 e bases de PV/PM\n");
}

static void test_t20_progression_and_attributes(void) {
    T20Sheet sheet;
    t20_init_default(&sheet, "Aventureiro", T20_RACE_HUMANO, "Guerreiro");

    /* Con 14 (+2) no nível 1: 20 + 2 = 22 PV */
    sheet.constituicao = 14;
    t20_recalculate(&sheet);
    assert(sheet.pv_max == 22);

    /* No nível 3 com Con 14 (+2):
       Nível 1: 20 + 2 = 22
       Nível 2 e 3: 2 * (5 + 2) = 14
       Total: 36 PV
       PM: Base 3 + 2 * (3) = 9 PM */
    sheet.nivel = 3;
    t20_recalculate(&sheet);
    assert(sheet.pv_max == 36);
    assert(sheet.pm_max == 9);

    /* Arcanista nível 3 com Con 12 (+1):
       Nível 1: 8 + 1 = 9
       Nível 2 e 3: 2 * (2 + 1) = 6
       Total: 15 PV
       PM: Base 6 + 2 * (6) = 18 PM */
    sheet.classe_id = T20_CLASS_ARCANISTA;
    sheet.constituicao = 12;
    t20_recalculate(&sheet);
    assert(sheet.pv_max == 15);
    assert(sheet.pm_max == 18);

    printf("  [OK] Recalculo de PV/PM com progressao de nivel e modificador de constituicao\n");
}

static void test_t20_defense_and_armor(void) {
    T20Sheet sheet;
    t20_init_default(&sheet, "Guarda", T20_RACE_ANAO, "Cavaleiro");

    /* Des 14 (+2), Defesa base: 10 + 2 = 12 */
    sheet.destreza = 14;
    t20_recalculate(&sheet);
    assert(sheet.defesa == 12);

    /* Equipando Armadura Pesada (+5) e Escudo (+2) */
    sheet.bonus_armadura = 5;
    sheet.bonus_escudo = 2;
    t20_recalculate(&sheet);
    assert(sheet.defesa == 19);

    printf("  [OK] Calculo de Defesa com Mod Des, armadura e escudo\n");
}

static void test_t20_skills(void) {
    T20Sheet sheet;
    t20_init_default(&sheet, "Ladino", T20_RACE_GOBLIN, "Ladino");
    sheet.destreza = 16; /* Mod Des: +3 */
    sheet.nivel = 1;     /* Metade nivel: 0 */

    /* Acrobacia nao treinada: Mod Des (+3) + Metade Nivel (0) = +3 */
    assert(t20_is_skill_trained(&sheet, T20_SKILL_ACROBACIA) == 0);
    assert(t20_calc_skill_total(&sheet, T20_SKILL_ACROBACIA, 0) == 3);

    /* Treina Acrobacia (Nivel 1 da +2 de treino): 3 + 0 + 2 = +5 */
    t20_set_skill_trained(&sheet, T20_SKILL_ACROBACIA, 1);
    assert(t20_is_skill_trained(&sheet, T20_SKILL_ACROBACIA) == 1);
    assert(t20_calc_skill_total(&sheet, T20_SKILL_ACROBACIA, 0) == 5);

    /* No nivel 8 (Metade nivel: 4, Treino nivel 8: +4): 3 + 4 + 4 = +11 */
    sheet.nivel = 8;
    assert(t20_calc_skill_total(&sheet, T20_SKILL_ACROBACIA, 0) == 11);

    printf("  [OK] Regras de pericias de T20 (atributos-chave, metade do nivel e treino)\n");
}

static void test_dice_distribution(void) {
    dice_set_seed(123456789);

    int counts[21] = {0};
    for (int i = 0; i < 10000; i++) {
        int r = roll_d20();
        assert(r >= 1 && r <= 20);
        counts[r]++;
    }

    for (int face = 1; face <= 20; face++) {
        assert(counts[face] > 300 && counts[face] < 700);
    }

    printf("  [OK] Distribuicao estatistica uniforme de 10.000 rolagens de d20\n");
}

static void test_dice_detailed_roll(void) {
    dice_set_seed(987654321);

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

static void test_json_roundtrip(void) {
    T20Sheet original;
    t20_init_default(&original, "Kaelen", T20_RACE_ELFO, "Arcanista");

    original.nivel = 5;
    original.experiencia = 12000;
    original.forca = 8;
    original.destreza = 18;
    original.constituicao = 14;
    original.inteligencia = 20;
    original.sabedoria = 14;
    original.carisma = 10;
    original.bonus_armadura = 3;
    original.bonus_escudo = 1;
    original.bonus_outros_defesa = 1;

    t20_set_skill_trained(&original, T20_SKILL_MISTICISMO, 1);
    t20_set_skill_trained(&original, T20_SKILL_VONTADE, 1);

    t20_recalculate(&original);

    char json_buf[SHEET_JSON_BUFFER_SIZE];
    int bytes = t20_to_json(&original, json_buf, sizeof(json_buf));
    assert(bytes > 0);

    T20Sheet restored;
    int status = t20_from_json(&restored, json_buf);
    assert(status == 0);

    assert(restored.sistema == original.sistema);
    assert(strcmp(restored.nome, original.nome) == 0);
    assert(restored.raca_id == original.raca_id);
    assert(strcmp(restored.raca, original.raca) == 0);
    assert(restored.classe_id == original.classe_id);
    assert(strcmp(restored.classe, original.classe) == 0);
    assert(restored.nivel == original.nivel);
    assert(restored.experiencia == original.experiencia);
    assert(restored.pv_max == original.pv_max);
    assert(restored.pv_atual == original.pv_atual);
    assert(restored.pm_max == original.pm_max);
    assert(restored.pm_atual == original.pm_atual);
    assert(restored.forca == original.forca);
    assert(restored.destreza == original.destreza);
    assert(restored.constituicao == original.constituicao);
    assert(restored.inteligencia == original.inteligencia);
    assert(restored.sabedoria == original.sabedoria);
    assert(restored.carisma == original.carisma);
    assert(restored.bonus_armadura == original.bonus_armadura);
    assert(restored.bonus_escudo == original.bonus_escudo);
    assert(restored.bonus_outros_defesa == original.bonus_outros_defesa);
    assert(restored.defesa == original.defesa);
    assert(restored.pericias_treinadas == original.pericias_treinadas);

    printf("  [OK] Serializacao e desserializacao JSON (Round-trip com 100%% de integridade)\n");
}

int main(void) {
    printf("=== Executando Testes Unitarios do Core C (RPG-SheetC) ===\n");
    test_t20_modifiers();
    test_t20_initialization_and_classes();
    test_t20_progression_and_attributes();
    test_t20_defense_and_armor();
    test_t20_skills();
    test_dice_distribution();
    test_dice_detailed_roll();
    test_json_roundtrip();
    printf("=== Todos os testes passaram com sucesso! ===\n");
    return 0;
}
