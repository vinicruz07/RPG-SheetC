/**
 * test_cards.c — Testes Unitários do Motor de Cards em C Puro (RPG-SheetC v2.0)
 */

#include <stdio.h>
#include <assert.h>
#include <string.h>
#include "../src/core/card_types.h"
#include "../src/core/card_engine.h"
#include "../src/core/card_eval.h"

static void test_card_types_and_strings(void) {
    assert(strcmp(card_type_to_string(CARD_TYPE_ATTRIBUTE), "Atributo") == 0);
    assert(strcmp(card_type_to_string(CARD_TYPE_RESOURCE), "Recurso") == 0);
    assert(strcmp(card_type_to_string(CARD_TYPE_EQUIPMENT), "Equipamento") == 0);

    assert(card_string_to_type("Atributo") == CARD_TYPE_ATTRIBUTE);
    assert(card_string_to_type("resource") == CARD_TYPE_RESOURCE);
    assert(card_string_to_type("Magia") == CARD_TYPE_SPELL);
    printf("  [OK] Conversoes bidirecionais string <-> enum de tipos de card\n");
}

static void test_deck_crud_operations(void) {
    CardDeck deck;
    card_deck_init(&deck, "Aventureiro Livre", "Sistema Generico Aberto");

    assert(strcmp(deck.sheet_name, "Aventureiro Livre") == 0);
    assert(strcmp(deck.system_name, "Sistema Generico Aberto") == 0);
    assert(deck.card_count == 0);

    /* Adiciona Atributo */
    RPGCard forca = card_create_attribute(1, "for", "Forca", 16);
    int idx1 = card_deck_add(&deck, &forca);
    assert(idx1 == 0);
    assert(deck.card_count == 1);

    /* Adiciona Recurso */
    RPGCard vida = card_create_resource(2, "vida", "Pontos de Vida", 30);
    int idx2 = card_deck_add(&deck, &vida);
    assert(idx2 == 1);
    assert(deck.card_count == 2);

    /* Adiciona Estatística */
    RPGCard defesa = card_create_stat(3, "defesa", "Defesa Passiva", 10);
    int idx3 = card_deck_add(&deck, &defesa);
    assert(idx3 == 2);
    assert(deck.card_count == 3);

    /* Busca por id e por chave */
    RPGCard *find_for = card_deck_find_by_key(&deck, "for");
    assert(find_for != NULL && find_for->base_value == 16);

    RPGCard *find_vida = card_deck_find_by_id(&deck, 2);
    assert(find_vida != NULL && strcmp(find_vida->name, "Pontos de Vida") == 0);

    /* Rejeita chave duplicada */
    RPGCard forca_duplicada = card_create_attribute(99, "for", "Forca 2", 10);
    assert(card_deck_add(&deck, &forca_duplicada) == -3);
    assert(deck.card_count == 3);

    /* Remove card por chave */
    int removed = card_deck_remove_by_key(&deck, "for");
    assert(removed == 1);
    assert(deck.card_count == 2);
    assert(card_deck_find_by_key(&deck, "for") == NULL);

    printf("  [OK] Operacoes de criacao, adicao, busca e remocao de cards no Deck\n");
}

static void test_modifiers_and_recalculation(void) {
    CardDeck deck;
    card_deck_init(&deck, "Guerreiro com Equipamentos", "Custom Fantasy");

    /* Cria Defesa Base 10 */
    RPGCard def = card_create_stat(1, "defesa", "Defesa", 10);
    card_deck_add(&deck, &def);

    /* Cria Força Base 12 */
    RPGCard forca = card_create_attribute(2, "for", "Forca", 12);
    card_deck_add(&deck, &forca);

    /* Inicialmente sem equipamentos: valores efetivos = valores base */
    RPGCard *p_def = card_deck_find_by_key(&deck, "defesa");
    RPGCard *p_for = card_deck_find_by_key(&deck, "for");
    assert(p_def->effective_value == 10);
    assert(p_for->effective_value == 12);

    /* Equipa Armadura de Ferro (+6 Defesa) */
    RPGCard armadura = card_create_equipment(10, "armadura", "Armadura de Ferro", "defesa", 6);
    card_deck_add(&deck, &armadura);

    /* Recalculo automático ao adicionar card ativo */
    assert(p_def->effective_value == 16);

    /* Equipa Escudo Pesado (+2 Defesa) */
    RPGCard escudo = card_create_equipment(11, "escudo", "Escudo Pesado", "defesa", 2);
    card_deck_add(&deck, &escudo);
    assert(p_def->effective_value == 18);

    /* Equipa Manoplas de Poder (+2 Força) */
    RPGCard manoplas = card_create_equipment(12, "manoplas", "Manoplas de Poder", "for", 2);
    card_deck_add(&deck, &manoplas);
    assert(p_for->effective_value == 14);

    /* Desequipa o escudo */
    card_deck_set_equipped(&deck, "escudo", 0);
    assert(p_def->effective_value == 16); /* 10 + 6 */

    /* Reequipa o escudo */
    card_deck_set_equipped(&deck, "escudo", 1);
    assert(p_def->effective_value == 18); /* 10 + 6 + 2 */

    printf("  [OK] Aplicacao e recalculo dinâmico de modificadores acumulados de cards\n");
}

static void test_resources_and_clamping(void) {
    CardDeck deck;
    card_deck_init(&deck, "Mago de Batalha", "Sistema Aberto");

    /* Recurso de Mana com max 20 */
    RPGCard mana = card_create_resource(1, "mana", "Pontos de Mana", 20);
    card_deck_add(&deck, &mana);

    RPGCard *p_mana = card_deck_find_by_key(&deck, "mana");
    assert(p_mana->current_value == 20);
    assert(p_mana->max_value == 20);

    /* Gasta 7 de mana */
    card_deck_modify_current(&deck, "mana", -7);
    assert(p_mana->current_value == 13);

    /* Recupera 5 de mana */
    card_deck_modify_current(&deck, "mana", 5);
    assert(p_mana->current_value == 18);

    /* Tenta curar acima do máximo: deve limitar em max_value */
    card_deck_modify_current(&deck, "mana", 50);
    assert(p_mana->current_value == 20);

    /* Equipa item que concede +10 de Mana Máxima */
    RPGCard anel = card_create_equipment(2, "anel_mana", "Anel do Infinito", "mana", 10);
    card_deck_add(&deck, &anel);

    assert(p_mana->max_value == 30);
    assert(p_mana->effective_value == 30);

    printf("  [OK] Manipulacao de recursos dinâmicos e controle de limites maximos\n");
}

static void test_card_eval(void) {
    int res = 0;
    EvalStatus st;

    /* Aritmética pura e precedência de operadores */
    st = card_eval_expression("2 + 3 * 4", NULL, &res);
    assert(st == EVAL_OK && res == 14);

    st = card_eval_expression("(2 + 3) * 4", NULL, &res);
    assert(st == EVAL_OK && res == 20);

    st = card_eval_expression("100 / 10 / 2", NULL, &res);
    assert(st == EVAL_OK && res == 5);

    /* Operadores unários */
    st = card_eval_expression("-5 + 15", NULL, &res);
    assert(st == EVAL_OK && res == 10);

    st = card_eval_expression("-(10 + 20)", NULL, &res);
    assert(st == EVAL_OK && res == -30);

    st = card_eval_expression("+42", NULL, &res);
    assert(st == EVAL_OK && res == 42);

    /* Proteção contra divisão por zero */
    st = card_eval_expression("10 / 0", NULL, &res);
    assert(st == EVAL_ERR_DIV_BY_ZERO);

    /* Erro de sintaxe */
    st = card_eval_expression("2 + * 3", NULL, &res);
    assert(st == EVAL_ERR_SYNTAX);

    st = card_eval_expression("(2 + 3", NULL, &res);
    assert(st == EVAL_ERR_SYNTAX);

    /* Expressão vazia ou nula */
    st = card_eval_expression("", NULL, &res);
    assert(st == EVAL_OK && res == 0);

    st = card_eval_expression(NULL, NULL, &res);
    assert(st == EVAL_OK && res == 0);

    /* Avaliação com referências a Cards de um Deck */
    CardDeck deck;
    card_deck_init(&deck, "Personagem Formula", "Sistema Custom");
    deck.level = 5;
    deck.xp = 1200;

    RPGCard forca = card_create_attribute(1, "for", "Forca", 16);
    card_deck_add(&deck, &forca);

    RPGCard des = card_create_attribute(2, "des", "Destreza", 14);
    card_deck_add(&deck, &des);

    RPGCard armadura = card_create_stat(3, "armadura", "Cota de Malha", 6);
    card_deck_add(&deck, &armadura);

    /* Referência com @ e sem @ */
    st = card_eval_expression("10 + @des + @armadura", &deck, &res);
    assert(st == EVAL_OK && res == (10 + 14 + 6)); /* 30 */

    st = card_eval_expression("10 + des + armadura", &deck, &res);
    assert(st == EVAL_OK && res == 30);

    /* Modificador clássico D&D/T20: (atributo - 10) / 2 */
    st = card_eval_expression("(@for - 10) / 2", &deck, &res);
    assert(st == EVAL_OK && res == 3); /* (16 - 10) / 2 = 3 */

    /* Referência a nível e xp do deck */
    st = card_eval_expression("@nivel * 2 + 10", &deck, &res);
    assert(st == EVAL_OK && res == 20); /* 5 * 2 + 10 = 20 */

    /* Case-insensitivity de referências */
    st = card_eval_expression("@FOR + @DES", &deck, &res);
    assert(st == EVAL_OK && res == 30);

    /* Chave inexistente deve resolver como 0 com segurança */
    st = card_eval_expression("@inexistente + 10", &deck, &res);
    assert(st == EVAL_OK && res == 10);

    /* card_eval_simple com fallback */
    int simple_val = card_eval_simple("20 + @des", &deck, -1);
    assert(simple_val == 34);

    int fallback_val = card_eval_simple("10 / 0", &deck, 999);
    assert(fallback_val == 999);

    /* card_eval_card_formula */
    RPGCard ataque = card_create_ability(4, "ataque_espada", "Ataque com Espada", "@for + 2");
    st = card_eval_card_formula(&ataque, &deck, &res);
    assert(st == EVAL_OK && res == 18); /* 16 + 2 */

    printf("  [OK] Avaliador de expressoes matematicas, precedencia, parenteses e referencias @card\n");
}

int main(void) {
    printf("=== Suite de Testes Unitarios do Motor de Cards C (RPG-SheetC v2.0) ===\n");
    test_card_types_and_strings();
    test_deck_crud_operations();
    test_modifiers_and_recalculation();
    test_resources_and_clamping();
    test_card_eval();
    printf("=== Todos os testes do Motor de Cards passaram com 100%% de sucesso! ===\n");
    return 0;
}
