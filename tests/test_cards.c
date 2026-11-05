/**
 * test_cards.c — Suite Completa de Testes Unitários do Motor de Cards em C Puro (RPG-SheetC v2.0)
 * C99 Freestanding • Validação Abrangente de Modelos, Fórmulas, Modificadores, JSON e WASM
 */

#include <stdio.h>
#include <assert.h>
#include <string.h>
#include <stdlib.h>
#include "../src/core/card_types.h"
#include "../src/core/card_engine.h"
#include "../src/core/card_eval.h"
#include "../src/core/card_pack.h"

/* Protótipos da API exportada pelo wasm_api.c para validação cruzada */
extern void wasm_deck_init(void);
extern char* wasm_get_str_buffer(void);
extern char* wasm_get_json_buffer(void);
extern int wasm_card_add(int type, int base_val);
extern int wasm_card_remove(unsigned int card_id);
extern int wasm_card_count(void);
extern unsigned int wasm_card_get_id(int idx);
extern int wasm_card_get_type(int idx);
extern const char* wasm_card_get_name_ptr(int idx);
extern int wasm_card_get_val(int idx);
extern int wasm_card_eval_formula(int card_idx);
extern void wasm_card_apply_all(void);
extern int wasm_pack_import(int merge_mode);
extern int wasm_pack_export(void);
extern int wasm_card_get_mod_count(int idx);
extern const char* wasm_card_get_mod_target_ptr(int idx, int mod_idx);
extern int wasm_card_get_mod_val(int idx, int mod_idx);

static char g_test_json_buf[CARD_PACK_JSON_BUFFER_SIZE];
static CardDeck g_test_deck_a;
static CardDeck g_test_deck_b;
static CardDeck g_test_deck_c;

/* =========================================================================
 * 1. Teste de Tipos e Conversões de Strings
 * ========================================================================= */
static void test_card_types_and_strings(void) {
    assert(strcmp(card_type_to_string(CARD_TYPE_ATTRIBUTE), "Atributo") == 0);
    assert(strcmp(card_type_to_string(CARD_TYPE_RESOURCE), "Recurso") == 0);
    assert(strcmp(card_type_to_string(CARD_TYPE_STAT), "Estatistica") == 0);
    assert(strcmp(card_type_to_string(CARD_TYPE_SKILL), "Pericia") == 0);
    assert(strcmp(card_type_to_string(CARD_TYPE_ABILITY), "Habilidade") == 0);
    assert(strcmp(card_type_to_string(CARD_TYPE_EQUIPMENT), "Equipamento") == 0);
    assert(strcmp(card_type_to_string(CARD_TYPE_SPELL), "Magia") == 0);
    assert(strcmp(card_type_to_string(CARD_TYPE_TRAIT), "Traco") == 0);

    assert(card_string_to_type("Atributo") == CARD_TYPE_ATTRIBUTE);
    assert(card_string_to_type("attribute") == CARD_TYPE_ATTRIBUTE);
    assert(card_string_to_type("resource") == CARD_TYPE_RESOURCE);
    assert(card_string_to_type("stat") == CARD_TYPE_STAT);
    assert(card_string_to_type("skill") == CARD_TYPE_SKILL);
    assert(card_string_to_type("ability") == CARD_TYPE_ABILITY);
    assert(card_string_to_type("equipment") == CARD_TYPE_EQUIPMENT);
    assert(card_string_to_type("Magia") == CARD_TYPE_SPELL);
    assert(card_string_to_type("spell") == CARD_TYPE_SPELL);
    assert(card_string_to_type("trait") == CARD_TYPE_TRAIT);
    printf("  [OK] Conversoes bidirecionais string <-> enum de tipos de card\n");
}

/* =========================================================================
 * 2. Teste de Operações CRUD e Mutações de Cards no Deck
 * ========================================================================= */
static void test_deck_crud_and_mutations(void) {
    CardDeck *deck = &g_test_deck_a;
    card_deck_init(deck, "Aventureiro Livre", "Sistema Generico Aberto");

    assert(strcmp(deck->sheet_name, "Aventureiro Livre") == 0);
    assert(strcmp(deck->system_name, "Sistema Generico Aberto") == 0);
    assert(deck->card_count == 0);

    /* Adiciona Atributo */
    RPGCard forca = card_create_attribute(1, "for", "Forca", 16);
    int idx1 = card_deck_add(deck, &forca);
    assert(idx1 == 0);
    assert(deck->card_count == 1);

    /* Adiciona Recurso */
    RPGCard vida = card_create_resource(2, "vida", "Pontos de Vida", 30);
    int idx2 = card_deck_add(deck, &vida);
    assert(idx2 == 1);
    assert(deck->card_count == 2);

    /* Adiciona Estatística */
    RPGCard defesa = card_create_stat(3, "defesa", "Defesa Passiva", 10);
    int idx3 = card_deck_add(deck, &defesa);
    assert(idx3 == 2);
    assert(deck->card_count == 3);

    /* Busca por id e por chave */
    RPGCard *find_for = card_deck_find_by_key(deck, "for");
    assert(find_for != NULL && find_for->base_value == 16);

    RPGCard *find_vida = card_deck_find_by_id(deck, 2);
    assert(find_vida != NULL && strcmp(find_vida->name, "Pontos de Vida") == 0);

    /* Rejeita chave duplicada */
    RPGCard forca_duplicada = card_create_attribute(99, "for", "Forca 2", 10);
    assert(card_deck_add(deck, &forca_duplicada) == -3);
    assert(deck->card_count == 3);

    /* Mutações in-place: base_value e recálculo */
    int set_base_ok = card_deck_set_base_value(deck, "for", 18);
    assert(set_base_ok == 1);
    assert(find_for->base_value == 18);
    assert(find_for->effective_value == 18);

    /* Proteção contra estourar o limite de modificadores por card (MAX_CARD_MODIFIERS = 4) */
    RPGCard multi_mod = card_create_equipment(10, "item_multimod", "Item Multimod", "for", 1);
    assert(multi_mod.modifier_count == 1);
    assert(card_add_modifier(&multi_mod, "defesa", 2) == 1);
    assert(card_add_modifier(&multi_mod, "des", 1) == 1);
    assert(card_add_modifier(&multi_mod, "con", 1) == 1);
    assert(multi_mod.modifier_count == 4);
    /* 5º modificador deve ser rejeitado */
    assert(card_add_modifier(&multi_mod, "sab", 1) == 0);
    assert(multi_mod.modifier_count == 4);

    /* Remove card por chave */
    int removed = card_deck_remove_by_key(deck, "for");
    assert(removed == 1);
    assert(deck->card_count == 2);
    assert(card_deck_find_by_key(deck, "for") == NULL);

    /* Remove por ID */
    int rem_id = card_deck_remove(deck, 2); /* remove vida */
    assert(rem_id == 1);
    assert(deck->card_count == 1);

    printf("  [OK] Operacoes de criacao, mutacao, limites e remocao de cards no Deck\n");
}

/* =========================================================================
 * 3. Teste de Modificadores Cumulativos e Recálculo Automático Multi-Alvo
 * ========================================================================= */
static void test_cumulative_modifiers_and_recalculation(void) {
    CardDeck *deck = &g_test_deck_a;
    card_deck_init(deck, "Paladino Blindado", "Fantasia Aberta");

    /* Atributos e Estatísticas Base */
    RPGCard def = card_create_stat(1, "defesa", "Defesa", 10);
    card_deck_add(deck, &def);

    RPGCard forca = card_create_attribute(2, "for", "Forca", 14);
    card_deck_add(deck, &forca);

    RPGCard des = card_create_attribute(3, "des", "Destreza", 12);
    card_deck_add(deck, &des);

    RPGCard *p_def = card_deck_find_by_key(deck, "defesa");
    RPGCard *p_for = card_deck_find_by_key(deck, "for");
    RPGCard *p_des = card_deck_find_by_key(deck, "des");

    assert(p_def->effective_value == 10);
    assert(p_for->effective_value == 14);
    assert(p_des->effective_value == 12);

    /* 1. Armadura Pesada: +6 Defesa, -1 Destreza */
    RPGCard armadura = card_create_equipment(10, "armadura", "Cota de Malha", "defesa", 6);
    card_add_modifier(&armadura, "des", -1);
    armadura.is_equipped = 1;
    card_deck_add(deck, &armadura);

    assert(p_def->effective_value == 16); /* 10 + 6 */
    assert(p_des->effective_value == 11); /* 12 - 1 */

    /* 2. Escudo Pesado: +2 Defesa */
    RPGCard escudo = card_create_equipment(11, "escudo", "Escudo de Torre", "defesa", 2);
    escudo.is_equipped = 1;
    card_deck_add(deck, &escudo);
    assert(p_def->effective_value == 18); /* 10 + 6 + 2 */

    /* 3. Elmo Rúnico: +1 Defesa, +1 Força */
    RPGCard elmo = card_create_equipment(12, "elmo", "Elmo Rúnico", "defesa", 1);
    card_add_modifier(&elmo, "for", 1);
    elmo.is_equipped = 1;
    card_deck_add(deck, &elmo);

    assert(p_def->effective_value == 19); /* 10 + 6 + 2 + 1 */
    assert(p_for->effective_value == 15); /* 14 + 1 */

    /* 4. Anel do Titã: +2 Força */
    RPGCard anel = card_create_equipment(13, "anel", "Anel do Titã", "for", 2);
    anel.is_equipped = 1;
    card_deck_add(deck, &anel);
    assert(p_for->effective_value == 17); /* 14 + 1 + 2 */

    /* 5. Magia 'Escudo da Fé': +2 Defesa (sustentada/ativa) */
    RPGCard magia;
    memset(&magia, 0, sizeof(RPGCard));
    magia.id = 14;
    magia.type = CARD_TYPE_SPELL;
    strncpy(magia.key, "escudo_da_fe", CARD_KEY_MAX_LEN - 1);
    strncpy(magia.name, "Escudo da Fe", CARD_NAME_MAX_LEN - 1);
    strncpy(magia.cost_resource, "pm", CARD_KEY_MAX_LEN - 1);
    magia.cost_value = 1;
    magia.is_equipped = 1;
    card_add_modifier(&magia, "defesa", 2);
    card_deck_add(deck, &magia);
    assert(p_def->effective_value == 21); /* 19 + 2 */

    /* Desativa a magia */
    card_deck_set_equipped(deck, "escudo_da_fe", 0);
    assert(p_def->effective_value == 19);

    /* Desequipa escudo e armadura */
    card_deck_set_equipped(deck, "escudo", 0);
    assert(p_def->effective_value == 17);

    card_deck_set_equipped(deck, "armadura", 0);
    assert(p_def->effective_value == 11); /* Base 10 + elmo 1 */
    assert(p_des->effective_value == 12); /* Penalidade da armadura removida */

    /* Reequipa tudo */
    card_deck_set_equipped(deck, "armadura", 1);
    card_deck_set_equipped(deck, "escudo", 1);
    card_deck_set_equipped(deck, "escudo_da_fe", 1);
    assert(p_def->effective_value == 21);
    assert(p_des->effective_value == 11);
    assert(p_for->effective_value == 17);

    printf("  [OK] Aplicacao cumulativa de modificadores multi-alvo e alternancia ativa de cards\n");
}

/* =========================================================================
 * 4. Teste de Recursos Dinâmicos e Clamping de Limites
 * ========================================================================= */
static void test_resources_and_clamping(void) {
    CardDeck *deck = &g_test_deck_a;
    card_deck_init(deck, "Mago de Batalha", "Sistema Aberto");

    /* Recurso de Mana com max 20 */
    RPGCard mana = card_create_resource(1, "mana", "Pontos de Mana", 20);
    card_deck_add(deck, &mana);

    RPGCard *p_mana = card_deck_find_by_key(deck, "mana");
    assert(p_mana->current_value == 20);
    assert(p_mana->max_value == 20);

    /* Gasta 7 de mana */
    card_deck_modify_current(deck, "mana", -7);
    assert(p_mana->current_value == 13);

    /* Recupera 5 de mana */
    card_deck_modify_current(deck, "mana", 5);
    assert(p_mana->current_value == 18);

    /* Tenta curar acima do máximo: deve limitar em max_value */
    card_deck_modify_current(deck, "mana", 50);
    assert(p_mana->current_value == 20);

    /* Equipa item que concede +10 de Mana Máxima */
    RPGCard anel = card_create_equipment(2, "anel_mana", "Anel do Infinito", "mana", 10);
    anel.is_equipped = 1;
    card_deck_add(deck, &anel);

    assert(p_mana->max_value == 30);
    assert(p_mana->effective_value == 30);

    /* Agora pode curar até 30 */
    card_deck_modify_current(deck, "mana", 20);
    assert(p_mana->current_value == 30);

    printf("  [OK] Manipulacao de recursos dinâmicos e controle de limites maximos\n");
}

/* =========================================================================
 * 5. Teste Avançado do Avaliador de Fórmulas Matemáticas e Expressões
 * ========================================================================= */
static void test_advanced_card_eval(void) {
    int res = 0;
    EvalStatus st;

    /* Aritmética pura e precedência de operadores */
    st = card_eval_expression("2 + 3 * 4", NULL, &res);
    assert(st == EVAL_OK && res == 14);

    st = card_eval_expression("(2 + 3) * 4", NULL, &res);
    assert(st == EVAL_OK && res == 20);

    st = card_eval_expression("100 / 10 / 2", NULL, &res);
    assert(st == EVAL_OK && res == 5);

    /* Expressões aninhadas complexas */
    st = card_eval_expression("((10 + 5) * 2 - (40 / 4)) / 2", NULL, &res);
    assert(st == EVAL_OK && res == 10); /* ((15 * 2) - 10) / 2 = 20 / 2 = 10 */

    /* Operadores unários */
    st = card_eval_expression("-5 + 15", NULL, &res);
    assert(st == EVAL_OK && res == 10);

    st = card_eval_expression("-(10 + 20)", NULL, &res);
    assert(st == EVAL_OK && res == -30);

    st = card_eval_expression("+42", NULL, &res);
    assert(st == EVAL_OK && res == 42);

    /* Divisão truncada padrão C */
    st = card_eval_expression("7 / 2", NULL, &res);
    assert(st == EVAL_OK && res == 3);

    /* Proteção contra divisão por zero */
    st = card_eval_expression("10 / 0", NULL, &res);
    assert(st == EVAL_ERR_DIV_BY_ZERO);

    st = card_eval_expression("100 / (5 - 5)", NULL, &res);
    assert(st == EVAL_ERR_DIV_BY_ZERO);

    /* Erros de sintaxe e parênteses desbalanceados */
    st = card_eval_expression("2 + * 3", NULL, &res);
    assert(st == EVAL_ERR_SYNTAX);

    st = card_eval_expression("(2 + 3", NULL, &res);
    assert(st == EVAL_ERR_SYNTAX);

    st = card_eval_expression("2 + 3)", NULL, &res);
    assert(st == EVAL_ERR_SYNTAX);

    /* Expressão vazia ou nula */
    st = card_eval_expression("", NULL, &res);
    assert(st == EVAL_OK && res == 0);

    st = card_eval_expression(NULL, NULL, &res);
    assert(st == EVAL_OK && res == 0);

    /* Avaliação com referências a Cards de um Deck */
    CardDeck *deck = &g_test_deck_a;
    card_deck_init(deck, "Personagem Formula", "Sistema Custom");
    deck->level = 5;
    deck->xp = 1200;

    RPGCard forca = card_create_attribute(1, "for", "Forca", 16);
    card_deck_add(deck, &forca);

    RPGCard des = card_create_attribute(2, "des", "Destreza", 14);
    card_deck_add(deck, &des);

    RPGCard armadura = card_create_stat(3, "armadura", "Cota de Malha", 6);
    card_deck_add(deck, &armadura);

    /* Referência com @ e sem @ */
    st = card_eval_expression("10 + @des + @armadura", deck, &res);
    assert(st == EVAL_OK && res == 30);

    st = card_eval_expression("10 + des + armadura", deck, &res);
    assert(st == EVAL_OK && res == 30);

    /* Modificador clássico D20: (atributo - 10) / 2 */
    st = card_eval_expression("(@for - 10) / 2", deck, &res);
    assert(st == EVAL_OK && res == 3); /* (16 - 10) / 2 = 3 */

    /* Fórmula combinada multi-atributo */
    st = card_eval_expression("((@for - 10) / 2) + ((@des - 10) / 2) * 2", deck, &res);
    assert(st == EVAL_OK && res == (3 + 2 * 2)); /* 3 + 4 = 7 */

    /* Referência a nível e xp do deck */
    st = card_eval_expression("@nivel * 2 + 10", deck, &res);
    assert(st == EVAL_OK && res == 20); /* 5 * 2 + 10 = 20 */

    /* Case-insensitivity de referências */
    st = card_eval_expression("@FOR + @DES", deck, &res);
    assert(st == EVAL_OK && res == 30);

    /* Chave inexistente deve resolver como 0 com segurança */
    st = card_eval_expression("@inexistente + 10", deck, &res);
    assert(st == EVAL_OK && res == 10);

    /* card_eval_simple com fallback */
    int simple_val = card_eval_simple("20 + @des", deck, -1);
    assert(simple_val == 34);

    int fallback_val = card_eval_simple("10 / 0", deck, 999);
    assert(fallback_val == 999);

    /* card_eval_card_formula */
    RPGCard ataque = card_create_ability(4, "ataque_espada", "Ataque com Espada", "@for + 2");
    st = card_eval_card_formula(&ataque, deck, &res);
    assert(st == EVAL_OK && res == 18); /* 16 + 2 */

    printf("  [OK] Avaliador de expressoes matematicas, precedencia, parenteses e referencias @card\n");
}

/* =========================================================================
 * 6. Teste de Serialização, Integridade e Parsing de Pacotes (.cardpack)
 * ========================================================================= */
static void test_card_pack_and_json_integrity(void) {
    CardDeck *src_deck = &g_test_deck_a;
    card_deck_init(src_deck, "Compendio Fantasia", "Sistema Modular v2");
    src_deck->level = 12;
    src_deck->xp = 45000;

    /* Popula 60 cards variados */
    for (int i = 0; i < 60; i++) {
        RPGCard c;
        memset(&c, 0, sizeof(RPGCard));
        c.id = (unsigned int)(i + 1);
        c.type = (CardType)(i % CARD_TYPE_COUNT);
        snprintf(c.key, CARD_KEY_MAX_LEN, "card_%d", i);
        snprintf(c.name, CARD_NAME_MAX_LEN, "Card Especial #%d", i);
        snprintf(c.desc, CARD_DESC_MAX_LEN, "Descricao com \"aspas\" e linha %d", i);
        c.base_value = 10 + i;
        c.max_value = 10 + i;
        c.current_value = 5 + i;
        snprintf(c.cost_resource, CARD_KEY_MAX_LEN, "mana");
        c.cost_value = (i % 5);
        snprintf(c.formula, CARD_FORMULA_MAX_LEN, "10 + @card_0 + %d", i);
        c.is_equipped = (unsigned char)((i % 2 == 0) ? 1 : 0);
        c.is_trained = (unsigned char)((i % 3 == 0) ? 1 : 0);
        c.is_favorite = (unsigned char)((i % 7 == 0) ? 1 : 0);

        card_add_modifier(&c, "card_0", 1);
        if (i % 2 == 0) {
            card_add_modifier(&c, "card_1", -2);
        }

        int added = card_deck_add(src_deck, &c);
        assert(added == i);
    }

    assert(src_deck->card_count == 60);

    /* Exporta os 60 cards para JSON (.cardpack) */
    int bytes_written = card_pack_export_json(src_deck, g_test_json_buf, sizeof(g_test_json_buf));
    assert(bytes_written > 0);

    /* Importa para um novo deck limpo (Round-trip completo) */
    CardDeck *dst_deck = &g_test_deck_b;
    int imported_count = card_pack_import(dst_deck, g_test_json_buf);
    assert(imported_count == 60);
    assert(dst_deck->card_count == 60);
    assert(strcmp(dst_deck->sheet_name, "Compendio Fantasia") == 0);
    assert(strcmp(dst_deck->system_name, "Sistema Modular v2") == 0);
    assert(dst_deck->level == 12);
    assert(dst_deck->xp == 45000);

    /* Verifica 100% de integridade em todos os 60 cards */
    for (int i = 0; i < 60; i++) {
        const RPGCard *orig = &src_deck->cards[i];
        const RPGCard *copy = &dst_deck->cards[i];

        assert(orig->id == copy->id);
        assert(orig->type == copy->type);
        assert(strcmp(orig->key, copy->key) == 0);
        assert(strcmp(orig->name, copy->name) == 0);
        assert(strcmp(orig->desc, copy->desc) == 0);
        assert(orig->base_value == copy->base_value);
        assert(orig->current_value == copy->current_value);
        assert(orig->max_value == copy->max_value);
        assert(orig->effective_value == copy->effective_value);
        assert(strcmp(orig->cost_resource, copy->cost_resource) == 0);
        assert(orig->cost_value == copy->cost_value);
        assert(strcmp(orig->formula, copy->formula) == 0);
        assert(orig->is_equipped == copy->is_equipped);
        assert(orig->is_trained == copy->is_trained);
        assert(orig->is_favorite == copy->is_favorite);
        assert(orig->modifier_count == copy->modifier_count);

        for (int m = 0; m < orig->modifier_count; m++) {
            assert(strcmp(orig->modifiers[m].target_key, copy->modifiers[m].target_key) == 0);
            assert(orig->modifiers[m].value == copy->modifiers[m].value);
        }
    }

    /* Testa merge_mode = 1 (aplicar pacote comunitário sobre ficha existente) */
    const char *community_pack =
        "["
        "  {\"key\":\"espada_flamejante\",\"name\":\"Espada Flamejante\",\"type\":\"Equipamento\",\"formula\":\"@card_0 + 5\",\"mods\":[{\"target\":\"card_0\",\"val\":4}]},"
        "  {\"key\":\"card_0\",\"name\":\"Atributo Primario Tunado\",\"type\":\"Atributo\",\"base\":25}"
        "]";

    int merged = card_pack_import_json(dst_deck, community_pack, 1);
    assert(merged == 2);
    assert(dst_deck->card_count == 61); /* 60 originais + 1 novo */

    RPGCard *espada = card_deck_find_by_key(dst_deck, "espada_flamejante");
    assert(espada != NULL);
    assert(espada->type == CARD_TYPE_EQUIPMENT);
    assert(strcmp(espada->formula, "@card_0 + 5") == 0);

    /* Validação direta do arquivo srd_basic_pack.json no C */
    FILE *fp = fopen("web/data/srd_basic_pack.json", "rb");
    if (fp) {
        fseek(fp, 0, SEEK_END);
        long fsize = ftell(fp);
        fseek(fp, 0, SEEK_SET);
        if (fsize > 0 && fsize < (long)sizeof(g_test_json_buf)) {
            size_t read_bytes = fread(g_test_json_buf, 1, fsize, fp);
            g_test_json_buf[read_bytes] = '\0';
            CardDeck *srd_deck = &g_test_deck_c;
            int srd_count = card_pack_import(srd_deck, g_test_json_buf);
            assert(srd_count == 46);
            assert(srd_deck->card_count == 46);
            assert(strcmp(srd_deck->system_name, "Fantasia Aberta d20") == 0);
        }
        fclose(fp);
    }

    printf("  [OK] Serializador e parser JSON (.cardpack) round-trip 60+ cards, merge e arquivo SRD\n");
}

/* =========================================================================
 * 7. Teste de Integração com a Ponte WebAssembly (wasm_api.c)
 * ========================================================================= */
static void test_wasm_api_bridge(void) {
    wasm_deck_init();
    assert(wasm_card_count() == 0);

    /* Adiciona card via buffer de string ("chave:Nome") */
    char *str_buf = wasm_get_str_buffer();
    strcpy(str_buf, "for:Forca Bruta");
    int idx = wasm_card_add(CARD_TYPE_ATTRIBUTE, 18);
    assert(idx == 0);
    assert(wasm_card_count() == 1);

    assert(wasm_card_get_id(0) == 1);
    assert(wasm_card_get_type(0) == CARD_TYPE_ATTRIBUTE);
    assert(strcmp(wasm_card_get_name_ptr(0), "Forca Bruta") == 0);
    assert(wasm_card_get_val(0) == 18);

    /* Exporta para o buffer JSON do WASM e reimporta */
    int json_len = wasm_pack_export();
    assert(json_len > 0);

    /* Adiciona um card com fórmula e modificador via import JSON (merge_mode = 1) */
    char *json_buf = wasm_get_json_buffer();
    strcpy(json_buf, "[{\"id\":99,\"type\":\"Equipamento\",\"key\":\"machado\",\"name\":\"Machado Lendario\",\"formula\":\"@for * 2\",\"equipped\":1,\"mods\":[{\"target\":\"for\",\"val\":2}]}]");
    int imported = wasm_pack_import(1);
    assert(imported == 1);
    assert(wasm_card_count() == 2);

    wasm_card_apply_all();
    /* Força subiu de 18 para 20 devido ao modificador do machado equipado */
    assert(wasm_card_get_val(0) == 20);
    assert(wasm_card_eval_formula(1) == 40); /* 20 * 2 */

    /* Testa getters O(1) de modificadores */
    assert(wasm_card_get_mod_count(1) == 1);
    assert(strcmp(wasm_card_get_mod_target_ptr(1, 0), "for") == 0);
    assert(wasm_card_get_mod_val(1, 0) == 2);

    /* Remove card pelo ID */
    assert(wasm_card_remove(99) == 1);
    assert(wasm_card_count() == 1);
    /* Força deve voltar para 18 */
    assert(wasm_card_get_val(0) == 18);

    printf("  [OK] Ponte WebAssembly (wasm_api.c), modificadores O(1) e simbolos exportados\n");
}

int main(void) {
    printf("=== Suite de Testes Unitarios do Motor de Cards C (RPG-SheetC v2.0) ===\n");
    test_card_types_and_strings();
    test_deck_crud_and_mutations();
    test_cumulative_modifiers_and_recalculation();
    test_resources_and_clamping();
    test_advanced_card_eval();
    test_card_pack_and_json_integrity();
    test_wasm_api_bridge();
    printf("=== Todos os testes do Motor de Cards passaram com 100%% de sucesso! ===\n");
    return 0;
}
