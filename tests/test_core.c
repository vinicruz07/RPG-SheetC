/**
 * test_core.c — Suite Completa de Testes Unitários do Core em C (RPG-SheetC)
 * Valida regras de RPG, progressão matemática, cálculo de atributos e perícias,
 * motor pseudoaleatório de dados, serialização JSON e segurança de memória.
 */

#include <stdio.h>
#include <assert.h>
#include <string.h>
#include "../src/core/sheet_types.h"
#include "../src/core/sheet_t20.h"
#include "../src/core/sheet_all.h"
#include "../src/core/dice.h"
#include "../src/core/sheet_json.h"
#include "../src/core/rpg_base.h"

/* -------------------------------------------------------------------------- */
/* 1. Testes de Modificadores de Atributos                                     */
/* -------------------------------------------------------------------------- */
static void test_t20_modifiers(void) {
    /* Regra canônica de Tormenta 20: mod = floor((valor - 10) / 2) */
    assert(t20_calc_modifier(10) == 0);
    assert(t20_calc_modifier(11) == 0);
    assert(t20_calc_modifier(12) == 1);
    assert(t20_calc_modifier(13) == 1);
    assert(t20_calc_modifier(14) == 2);
    assert(t20_calc_modifier(18) == 4);
    assert(t20_calc_modifier(20) == 5);
    assert(t20_calc_modifier(30) == 10);

    /* Negativos */
    assert(t20_calc_modifier(9) == -1);
    assert(t20_calc_modifier(8) == -1);
    assert(t20_calc_modifier(7) == -2);
    assert(t20_calc_modifier(6) == -2);
    assert(t20_calc_modifier(1) == -5);
    assert(t20_calc_modifier(0) == -5);

    printf("  [OK] Calculo de modificadores de atributos (valores positivos, neutros e negativos)\n");
}

/* -------------------------------------------------------------------------- */
/* 2. Catálogo Oficial das 14 Classes de Tormenta 20                           */
/* -------------------------------------------------------------------------- */
static void test_t20_all_14_classes(void) {
    /* Tabela esperada de PV/PM oficiais de Tormenta 20:
     * Arcanista: 8 PV (+2/nv), 6 PM (+6/nv)
     * Bárbaro:   24 PV (+6/nv), 3 PM (+3/nv)
     * Bardo:     12 PV (+3/nv), 4 PM (+4/nv)
     * Bucaneiro: 16 PV (+4/nv), 3 PM (+3/nv)
     * Caçador:   16 PV (+4/nv), 4 PM (+4/nv)
     * Cavaleiro: 20 PV (+5/nv), 3 PM (+3/nv)
     * Clérigo:   16 PV (+4/nv), 5 PM (+5/nv)
     * Druida:    16 PV (+4/nv), 4 PM (+4/nv)
     * Guerreiro: 20 PV (+5/nv), 3 PM (+3/nv)
     * Inventor:  12 PV (+3/nv), 4 PM (+4/nv)
     * Ladino:    12 PV (+3/nv), 4 PM (+4/nv)
     * Lutador:   20 PV (+5/nv), 3 PM (+3/nv)
     * Nobre:     16 PV (+4/nv), 4 PM (+4/nv)
     * Paladino:  20 PV (+5/nv), 3 PM (+3/nv)
     */
    struct {
        T20Class cls;
        const char *name;
        int base_pv;
        int pv_per_lvl;
        int base_pm;
        int pm_per_lvl;
    } table[] = {
        { T20_CLASS_ARCANISTA, "Arcanista", 8,  2, 6, 6 },
        { T20_CLASS_BARBARO,   "Bárbaro",   24, 6, 3, 3 },
        { T20_CLASS_BARDO,     "Bardo",     12, 3, 4, 4 },
        { T20_CLASS_BUCANEIRO, "Bucaneiro", 16, 4, 3, 3 },
        { T20_CLASS_CACADOR,   "Caçador",   16, 4, 4, 4 },
        { T20_CLASS_CAVALEIRO, "Cavaleiro", 20, 5, 3, 3 },
        { T20_CLASS_CLERIGO,   "Clérigo",   16, 4, 5, 5 },
        { T20_CLASS_DRUIDA,    "Druida",    16, 4, 4, 4 },
        { T20_CLASS_GUERREIRO, "Guerreiro", 20, 5, 3, 3 },
        { T20_CLASS_INVENTOR,  "Inventor",  12, 3, 4, 4 },
        { T20_CLASS_LADINO,    "Ladino",    12, 3, 4, 4 },
        { T20_CLASS_LUTADOR,   "Lutador",   20, 5, 3, 3 },
        { T20_CLASS_NOBRE,     "Nobre",     16, 4, 4, 4 },
        { T20_CLASS_PALADINO,  "Paladino",  20, 5, 3, 3 },
    };

    int total_classes = sizeof(table) / sizeof(table[0]);
    assert(total_classes == 14);

    for (int i = 0; i < total_classes; i++) {
        assert(t20_get_class_base_pv(table[i].cls) == table[i].base_pv);
        assert(t20_get_class_pv_per_level(table[i].cls) == table[i].pv_per_lvl);
        assert(t20_get_class_base_pm(table[i].cls) == table[i].base_pm);
        assert(t20_get_class_pm_per_level(table[i].cls) == table[i].pm_per_lvl);

        /* Validação de string <-> enum bidirecional */
        assert(strcmp(t20_class_to_string(table[i].cls), table[i].name) == 0);
        assert(t20_string_to_class(table[i].name) == table[i].cls);

        /* Inicialização default com Con 10 (+0) */
        T20Sheet sheet;
        t20_init_default(&sheet, "Teste", T20_RACE_HUMANO, table[i].name);
        assert((T20Class)sheet.classe_id == table[i].cls);
        assert(sheet.pv_max == table[i].base_pv);
        assert(sheet.pm_max == table[i].base_pm);
    }

    printf("  [OK] Validacao das 14 classes oficiais de Tormenta 20 (PV/PM e conversao string/enum)\n");
}

/* -------------------------------------------------------------------------- */
/* 3. Progressão Multinível e Ajuste de Constituição                         */
/* -------------------------------------------------------------------------- */
static void test_t20_multilevel_progression(void) {
    T20Sheet sheet;
    t20_init_default(&sheet, "Guerreiro Forte", T20_RACE_HUMANO, "Guerreiro");

    /* Con 16 (+3) no nível 1: 20 + 3 = 23 PV */
    sheet.constituicao = 16;
    t20_recalculate(&sheet);
    assert(sheet.pv_max == 23);
    assert(sheet.pm_max == 3);

    /* Progressão até o nível 20:
     * PV = (20 + 3) + 19 * (5 + 3) = 23 + 19 * 8 = 23 + 152 = 175 PV
     * PM = 3 + 19 * 3 = 60 PM
     */
    sheet.nivel = 20;
    t20_recalculate(&sheet);
    assert(sheet.pv_max == 175);
    assert(sheet.pm_max == 60);

    /* Arcanista nível 10 com Con 8 (-1):
     * PV = (8 - 1) + 9 * (2 - 1) = 7 + 9 * 1 = 16 PV
     * PM = 6 + 9 * 6 = 60 PM
     */
    sheet.classe_id = T20_CLASS_ARCANISTA;
    sheet.constituicao = 8;
    sheet.nivel = 10;
    t20_recalculate(&sheet);
    assert(sheet.pv_max == 16);
    assert(sheet.pm_max == 60);

    printf("  [OK] Formulas de progressao multinivel (Niveis 1 a 20) com modificadores de Constituicao\n");
}

/* -------------------------------------------------------------------------- */
/* 4. Defesa, Armaduras, Escudos e Bônus Diversos                            */
/* -------------------------------------------------------------------------- */
static void test_t20_defense_breakdown(void) {
    T20Sheet sheet;
    t20_init_default(&sheet, "Defensor", T20_RACE_ANAO, "Cavaleiro");

    /* Base sem bônus: 10 + ModDes(0) = 10 */
    assert(sheet.defesa == 10);

    /* Com Destreza 16 (+3): 10 + 3 = 13 */
    sheet.destreza = 16;
    t20_recalculate(&sheet);
    assert(sheet.defesa == 13);

    /* Armadura Completa (+8): 13 + 8 = 21 */
    sheet.bonus_armadura = 8;
    t20_recalculate(&sheet);
    assert(sheet.defesa == 21);

    /* Escudo Pesado (+2): 21 + 2 = 23 */
    sheet.bonus_escudo = 2;
    t20_recalculate(&sheet);
    assert(sheet.defesa == 23);

    /* Bônus de Magia/Outros (+3): 23 + 3 = 26 */
    sheet.bonus_outros_defesa = 3;
    t20_recalculate(&sheet);
    assert(sheet.defesa == 26);

    printf("  [OK] Decomposicao de Defesa (10 + DES + Armadura + Escudo + Outros)\n");
}

/* -------------------------------------------------------------------------- */
/* 5. Catálogo Completo das 29 Perícias e Escalação de Treino                */
/* -------------------------------------------------------------------------- */
static void test_t20_all_29_skills(void) {
    T20Sheet sheet;
    t20_init_default(&sheet, "Especialista", T20_RACE_GOBLIN, "Ladino");

    /* Configura atributos específicos para testes */
    sheet.forca = 14;        /* Mod: +2 */
    sheet.destreza = 16;     /* Mod: +3 */
    sheet.constituicao = 12; /* Mod: +1 */
    sheet.inteligencia = 18; /* Mod: +4 */
    sheet.sabedoria = 10;    /* Mod: +0 */
    sheet.carisma = 8;       /* Mod: -1 */
    t20_recalculate(&sheet);

    /* Todas as 29 perícias canônicas */
    assert(T20_SKILL_COUNT == 29);

    /* Valida mapeamento de atributos-chave */
    assert(t20_skill_get_attribute(T20_SKILL_LUTA) == T20_ATTR_FORCA);
    assert(t20_skill_get_attribute(T20_SKILL_ATLETISMO) == T20_ATTR_FORCA);

    assert(t20_skill_get_attribute(T20_SKILL_ACROBACIA) == T20_ATTR_DESTREZA);
    assert(t20_skill_get_attribute(T20_SKILL_CAVALGAR) == T20_ATTR_DESTREZA);
    assert(t20_skill_get_attribute(T20_SKILL_FURTIVIDADE) == T20_ATTR_DESTREZA);
    assert(t20_skill_get_attribute(T20_SKILL_INICIATIVA) == T20_ATTR_DESTREZA);
    assert(t20_skill_get_attribute(T20_SKILL_PONTARIA) == T20_ATTR_DESTREZA);
    assert(t20_skill_get_attribute(T20_SKILL_LADINAGEM) == T20_ATTR_DESTREZA);
    assert(t20_skill_get_attribute(T20_SKILL_PILOTAGEM) == T20_ATTR_DESTREZA);
    assert(t20_skill_get_attribute(T20_SKILL_REFLEXOS) == T20_ATTR_DESTREZA);

    assert(t20_skill_get_attribute(T20_SKILL_FORTITUDE) == T20_ATTR_CONSTITUICAO);

    assert(t20_skill_get_attribute(T20_SKILL_CONHECIMENTO) == T20_ATTR_INTELIGENCIA);
    assert(t20_skill_get_attribute(T20_SKILL_INVESTIGACAO) == T20_ATTR_INTELIGENCIA);
    assert(t20_skill_get_attribute(T20_SKILL_MISTICISMO) == T20_ATTR_INTELIGENCIA);
    assert(t20_skill_get_attribute(T20_SKILL_NOBREZA) == T20_ATTR_INTELIGENCIA);
    assert(t20_skill_get_attribute(T20_SKILL_OFICIO) == T20_ATTR_INTELIGENCIA);
    assert(t20_skill_get_attribute(T20_SKILL_GUERRA) == T20_ATTR_INTELIGENCIA);

    assert(t20_skill_get_attribute(T20_SKILL_CURA) == T20_ATTR_SABEDORIA);
    assert(t20_skill_get_attribute(T20_SKILL_PERCEPCAO) == T20_ATTR_SABEDORIA);
    assert(t20_skill_get_attribute(T20_SKILL_INTUICAO) == T20_ATTR_SABEDORIA);
    assert(t20_skill_get_attribute(T20_SKILL_SOBREVIVENCIA) == T20_ATTR_SABEDORIA);
    assert(t20_skill_get_attribute(T20_SKILL_RELIGIAO) == T20_ATTR_SABEDORIA);
    assert(t20_skill_get_attribute(T20_SKILL_VONTADE) == T20_ATTR_SABEDORIA);

    assert(t20_skill_get_attribute(T20_SKILL_ADESTRAMENTO) == T20_ATTR_CARISMA);
    assert(t20_skill_get_attribute(T20_SKILL_ATUACAO) == T20_ATTR_CARISMA);
    assert(t20_skill_get_attribute(T20_SKILL_DIPLOMACIA) == T20_ATTR_CARISMA);
    assert(t20_skill_get_attribute(T20_SKILL_ENGANACAO) == T20_ATTR_CARISMA);
    assert(t20_skill_get_attribute(T20_SKILL_INTIMIDACAO) == T20_ATTR_CARISMA);
    assert(t20_skill_get_attribute(T20_SKILL_JOGATINA) == T20_ATTR_CARISMA);

    /* Teste de escalação do bônus de treino por faixa de nível oficial de T20:
     * - Níveis 1 a 6: +2 de treino
     * - Níveis 7 a 14: +4 de treino
     * - Níveis 15 a 20: +6 de treino
     */
    t20_set_skill_trained(&sheet, T20_SKILL_MISTICISMO, 1);

    /* Nível 1: Mod INT (+4) + Metade Lvl (0) + Treino (+2) = +6 */
    sheet.nivel = 1;
    assert(t20_calc_skill_total(&sheet, T20_SKILL_MISTICISMO, 0) == 6);

    /* Nível 6: Mod INT (+4) + Metade Lvl (3) + Treino (+2) = +9 */
    sheet.nivel = 6;
    assert(t20_calc_skill_total(&sheet, T20_SKILL_MISTICISMO, 0) == 9);

    /* Nível 7: Mod INT (+4) + Metade Lvl (3) + Treino (+4) = +11 */
    sheet.nivel = 7;
    assert(t20_calc_skill_total(&sheet, T20_SKILL_MISTICISMO, 0) == 11);

    /* Nível 14: Mod INT (+4) + Metade Lvl (7) + Treino (+4) = +15 */
    sheet.nivel = 14;
    assert(t20_calc_skill_total(&sheet, T20_SKILL_MISTICISMO, 0) == 15);

    /* Nível 15: Mod INT (+4) + Metade Lvl (7) + Treino (+6) = +17 */
    sheet.nivel = 15;
    assert(t20_calc_skill_total(&sheet, T20_SKILL_MISTICISMO, 0) == 17);

    /* Nível 20: Mod INT (+4) + Metade Lvl (10) + Treino (+6) = +20 */
    sheet.nivel = 20;
    assert(t20_calc_skill_total(&sheet, T20_SKILL_MISTICISMO, 0) == 20);

    printf("  [OK] Mapeamento das 29 pericias oficiais e escalacao de treino (+2 / +4 / +6)\n");
}

/* -------------------------------------------------------------------------- */
/* 6. Motor Pseudoaleatório (Xorshift32) e Distribuição Uniforme             */
/* -------------------------------------------------------------------------- */
static void test_dice_engine_and_bounds(void) {
    /* 1. Determinismo via seed explícita */
    dice_set_seed(42);
    int roll1 = roll_d20();
    int roll2 = roll_d20();

    dice_set_seed(42);
    assert(roll_d20() == roll1);
    assert(roll_d20() == roll2);

    /* 2. Limites exatos para todos os dados poliédricos padrão */
    int faces[] = { 4, 6, 8, 10, 12, 20, 100 };
    for (size_t f = 0; f < sizeof(faces)/sizeof(faces[0]); f++) {
        int face = faces[f];
        for (int i = 0; i < 500; i++) {
            int r = roll_dice_simple(face, 1, 0);
            assert(r >= 1 && r <= face);
        }
    }

    /* 3. Distribuição de 10.000 rolagens de d20 */
    dice_set_seed(123456789);
    int counts[21] = {0};
    for (int i = 0; i < 10000; i++) {
        int r = roll_d20();
        assert(r >= 1 && r <= 20);
        counts[r]++;
    }
    for (int face = 1; face <= 20; face++) {
        /* Média esperada: 500 por face; tolerância estatística 300 a 700 */
        assert(counts[face] > 300 && counts[face] < 700);
    }

    /* 4. Flags de crítico (20) e falha (1) */
    DiceRollResult crit_test;
    int saw_crit = 0, saw_fumble = 0;
    for (int i = 0; i < 1000; i++) {
        crit_test = roll_dice(20, 1, 0);
        if (crit_test.rolls[0] == 20) {
            assert(crit_test.is_critical == 1);
            saw_crit = 1;
        }
        if (crit_test.rolls[0] == 1) {
            assert(crit_test.is_fumble == 1);
            saw_fumble = 1;
        }
    }
    assert(saw_crit && saw_fumble);

    printf("  [OK] Motor Xorshift32: determinismo com seed, limites de faces e distribuicao estatistica\n");
}

/* -------------------------------------------------------------------------- */
/* 7. Serialização e Desserialização JSON de Alta Performance                 */
/* -------------------------------------------------------------------------- */
static void test_json_serialization_roundtrip(void) {
    T20Sheet original;
    t20_init_default(&original, "Lord Valeros de Deheon", T20_RACE_HUMANO, "Paladino");

    original.nivel = 9;
    original.experiencia = 36000;
    original.forca = 19;
    original.destreza = 12;
    original.constituicao = 16;
    original.inteligencia = 10;
    original.sabedoria = 14;
    original.carisma = 16;
    original.bonus_armadura = 9;
    original.bonus_escudo = 3;
    original.bonus_outros_defesa = 2;

    /* Perícias treinadas */
    t20_set_skill_trained(&original, T20_SKILL_LUTA, 1);
    t20_set_skill_trained(&original, T20_SKILL_VONTADE, 1);
    t20_set_skill_trained(&original, T20_SKILL_DIPLOMACIA, 1);
    t20_set_skill_trained(&original, T20_SKILL_RELIGIAO, 1);

    t20_recalculate(&original);

    /* Serializa para string JSON */
    char json_buf[SHEET_JSON_BUFFER_SIZE];
    int bytes = t20_to_json(&original, json_buf, sizeof(json_buf));
    assert(bytes > 0 && bytes < SHEET_JSON_BUFFER_SIZE);

    /* Desserializa para nova struct */
    T20Sheet restored;
    int status = t20_from_json(&restored, json_buf);
    assert(status == 0);

    /* Validação campo por campo de 100% dos dados */
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

    /* Teste de JSON com campos em ordem arbitrária e números negativos */
    const char *custom_json = "{\"sistema_id\":1,\"nome\":\"Sombra\",\"nivel\":3,\"forca\":7,\"pericias_treinadas\":4}";
    T20Sheet custom_sheet;
    int custom_status = t20_from_json(&custom_sheet, custom_json);
    assert(custom_status == 0);
    assert(strcmp(custom_sheet.nome, "Sombra") == 0);
    assert(custom_sheet.nivel == 3);
    assert(custom_sheet.forca == 7);
    assert(custom_sheet.pericias_treinadas == 4);

    printf("  [OK] Serializacao e desserializacao JSON (round-trip com 100%% de integridade e tolerância)\n");
}

/* -------------------------------------------------------------------------- */
/* 8. Suporte Multissistemas e União Polimórfica (RPGSheet)                  */
/* -------------------------------------------------------------------------- */
static void test_multisystem_architecture(void) {
    /* D&D 5e */
    DnD5eSheet dnd;
    dnd5e_init_default(&dnd, "Tordek", "Anão", "Fighter");
    assert(dnd.sistema == SYSTEM_DND5E);
    assert(dnd.hp_max == 10);
    assert(dnd.bonus_proficiencia == 2);
    assert(dnd.classe_armadura == 10);

    /* Fabula Ultima */
    FabulaSheet fabula;
    fabula_init_default(&fabula, "Reisen", "Elementalista");
    assert(fabula.sistema == SYSTEM_FABULA_ULTIMA);
    assert(fabula.nivel == 5);
    assert(fabula.hp_max == 45);
    assert(fabula.mp_max == 45);
    assert(fabula.ip_max == 6);
    assert(fabula.pontos_fabula == 3);

    /* 3D&T Victory */
    ThreeDetSheet td;
    threedet_init_default(&td, "Defensor", "Lutador");
    assert(td.sistema == SYSTEM_3DET_VICTORY);
    assert(td.pv_max == 10);
    assert(td.pm_max == 10);
    assert(td.pa_max == 1);
    assert(td.defesa == 4);

    /* União Polimórfica Universal RPGSheet */
    RPGSheet r1, r2, r3, r4;
    r1.sistema = SYSTEM_TORMENTA20;
    t20_init_default(&r1.data.t20, "Valeros", T20_RACE_HUMANO, "Guerreiro");
    assert(strcmp(rpg_sheet_get_name(&r1), "Valeros") == 0);
    assert(rpg_sheet_get_pv_atual(&r1) == 20);

    r2.sistema = SYSTEM_DND5E;
    dnd5e_init_default(&r2.data.dnd5e, "Lidda", "Halfling", "Rogue");
    assert(strcmp(rpg_sheet_get_name(&r2), "Lidda") == 0);
    assert(rpg_sheet_get_defesa(&r2) == 10);

    r3.sistema = SYSTEM_FABULA_ULTIMA;
    fabula_init_default(&r3.data.fabula, "Noctis", "Príncipe");
    assert(strcmp(rpg_sheet_get_name(&r3), "Noctis") == 0);
    assert(rpg_sheet_get_pv_max(&r3) == 45);

    r4.sistema = SYSTEM_3DET_VICTORY;
    threedet_init_default(&r4.data.threedet, "Megaman", "Androide");
    assert(strcmp(rpg_sheet_get_name(&r4), "Megaman") == 0);
    assert(rpg_sheet_get_pv_atual(&r4) == 10);

    printf("  [OK] Suporte multissistemas (D&D 5e, Fabula Ultima, 3D&T e despacho polimorfico RPGSheet)\n");
}

/* -------------------------------------------------------------------------- */
/* 9. Rotinas de Manipulação de Strings e Memória                            */
/* -------------------------------------------------------------------------- */
static void test_freestanding_string_routines(void) {
    char dest[64];

    /* memset */
    memset(dest, 'A', 5);
    dest[5] = '\0';
    assert(dest[0] == 'A' && dest[4] == 'A');

    /* strncpy */
    strncpy(dest, "Tormenta20", sizeof(dest));
    assert(strcmp(dest, "Tormenta20") == 0);
    assert(strlen(dest) == 10);

    /* strcmp */
    assert(strcmp("abc", "abc") == 0);
    assert(strcmp("abc", "abd") < 0);
    assert(strcmp("xyz", "abc") > 0);

    /* memcpy */
    char copy[16];
    memcpy(copy, dest, 11);
    assert(strcmp(copy, "Tormenta20") == 0);

    printf("  [OK] Rotinas de seguranca de memoria e strings (memset, memcpy, strncpy, strcmp, strlen)\n");
}

/* -------------------------------------------------------------------------- */
/* Main Runner                                                                */
/* -------------------------------------------------------------------------- */
int main(void) {
    printf("=== Suite Oficial de Testes Unitarios do Core C (RPG-SheetC) ===\n");
    test_t20_modifiers();
    test_t20_all_14_classes();
    test_t20_multilevel_progression();
    test_t20_defense_breakdown();
    test_t20_all_29_skills();
    test_dice_engine_and_bounds();
    test_json_serialization_roundtrip();
    test_multisystem_architecture();
    test_freestanding_string_routines();
    printf("=== Todos os testes do Core C passaram com 100%% de sucesso! ===\n");
    return 0;
}
