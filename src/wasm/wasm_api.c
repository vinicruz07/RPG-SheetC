/**
 * wasm_api.c — Camada de Ponte e Exportação WebAssembly do Motor de Cards (RPG-SheetC v2.0)
 * 100% C Puro (C99 Freestanding) &bull; Zero Runtimes Pesados
 */

#include "../core/card_engine.h"
#include "../core/dice.h"
#include "../core/rpg_base.h"

#define WASM_EXPORT __attribute__((visibility("default")))

/* Deck ativo gerenciado na memória linear do WebAssembly */
static CardDeck g_active_deck;

/* Buffers estáticos para troca de dados com JavaScript */
#define WASM_JSON_BUFFER_CAPACITY 8192
#define WASM_STR_BUFFER_CAPACITY  256

static char g_wasm_json_buf[WASM_JSON_BUFFER_CAPACITY];
static char g_wasm_str_buf[WASM_STR_BUFFER_CAPACITY];
static DiceRollResult g_last_roll;

/* =========================================================================
 * 1. Inicialização e Ciclo de Vida do Deck
 * ========================================================================= */

WASM_EXPORT void wasm_init(void) {
    card_deck_init(&g_active_deck, "Novo Personagem", "Sistema Generico Aberto");
    dice_set_seed(0x853c49e6);
}

WASM_EXPORT void wasm_deck_new(void) {
    card_deck_init(&g_active_deck, "Novo Personagem", "Sistema Generico Aberto");
}

/* =========================================================================
 * 2. Buffers de Memória Linear Compartilhada
 * ========================================================================= */

WASM_EXPORT char* wasm_get_str_buffer(void) {
    return g_wasm_str_buf;
}

WASM_EXPORT int wasm_get_str_buffer_size(void) {
    return WASM_STR_BUFFER_CAPACITY;
}

WASM_EXPORT char* wasm_get_json_buffer(void) {
    return g_wasm_json_buf;
}

WASM_EXPORT int wasm_get_json_buffer_capacity(void) {
    return WASM_JSON_BUFFER_CAPACITY;
}

/* =========================================================================
 * 3. Metadados do Deck (Personagem, Sistema, Nível, XP)
 * ========================================================================= */

WASM_EXPORT const char* wasm_deck_get_name_ptr(void) {
    return g_active_deck.sheet_name;
}

WASM_EXPORT void wasm_deck_set_name_from_buffer(void) {
    g_wasm_str_buf[CARD_NAME_MAX_LEN - 1] = '\0';
    strncpy(g_active_deck.sheet_name, g_wasm_str_buf, CARD_NAME_MAX_LEN - 1);
    g_active_deck.sheet_name[CARD_NAME_MAX_LEN - 1] = '\0';
}

WASM_EXPORT const char* wasm_deck_get_system_ptr(void) {
    return g_active_deck.system_name;
}

WASM_EXPORT void wasm_deck_set_system_from_buffer(void) {
    g_wasm_str_buf[CARD_NAME_MAX_LEN - 1] = '\0';
    strncpy(g_active_deck.system_name, g_wasm_str_buf, CARD_NAME_MAX_LEN - 1);
    g_active_deck.system_name[CARD_NAME_MAX_LEN - 1] = '\0';
}

WASM_EXPORT int wasm_deck_get_level(void) {
    return g_active_deck.level;
}

WASM_EXPORT void wasm_deck_set_level(int lvl) {
    g_active_deck.level = lvl;
}

WASM_EXPORT int wasm_deck_get_xp(void) {
    return g_active_deck.xp;
}

WASM_EXPORT void wasm_deck_set_xp(int xp) {
    g_active_deck.xp = xp;
}

WASM_EXPORT int wasm_deck_get_card_count(void) {
    return g_active_deck.card_count;
}

/* =========================================================================
 * 4. Manipulação de Cards no Deck
 * ========================================================================= */

WASM_EXPORT int wasm_card_add_simple(int type, int base_val) {
    /* Formato do buffer de string: "chave:nome" ou apenas "chave" */
    char key[CARD_KEY_MAX_LEN];
    char name[CARD_NAME_MAX_LEN];
    key[0] = '\0';
    name[0] = '\0';

    char *colon = NULL;
    for (int i = 0; i < WASM_STR_BUFFER_CAPACITY && g_wasm_str_buf[i]; i++) {
        if (g_wasm_str_buf[i] == ':') {
            colon = &g_wasm_str_buf[i];
            break;
        }
    }

    if (colon) {
        *colon = '\0';
        strncpy(key, g_wasm_str_buf, CARD_KEY_MAX_LEN - 1);
        key[CARD_KEY_MAX_LEN - 1] = '\0';
        strncpy(name, colon + 1, CARD_NAME_MAX_LEN - 1);
        name[CARD_NAME_MAX_LEN - 1] = '\0';
    } else {
        strncpy(key, g_wasm_str_buf, CARD_KEY_MAX_LEN - 1);
        key[CARD_KEY_MAX_LEN - 1] = '\0';
        strncpy(name, g_wasm_str_buf, CARD_NAME_MAX_LEN - 1);
        name[CARD_NAME_MAX_LEN - 1] = '\0';
    }

    RPGCard card;
    memset(&card, 0, sizeof(RPGCard));
    card.id = (unsigned int)(g_active_deck.card_count + 1);
    card.type = (CardType)type;
    strncpy(card.key, key, CARD_KEY_MAX_LEN - 1);
    strncpy(card.name, name, CARD_NAME_MAX_LEN - 1);
    card.base_value = base_val;
    card.current_value = base_val;
    card.max_value = base_val;
    card.effective_value = base_val;
    card.is_equipped = 1;

    return card_deck_add(&g_active_deck, &card);
}

WASM_EXPORT int wasm_card_remove_by_key(void) {
    g_wasm_str_buf[CARD_KEY_MAX_LEN - 1] = '\0';
    return card_deck_remove_by_key(&g_active_deck, g_wasm_str_buf);
}

WASM_EXPORT int wasm_card_get_effective_val(void) {
    g_wasm_str_buf[CARD_KEY_MAX_LEN - 1] = '\0';
    RPGCard *c = card_deck_find_by_key(&g_active_deck, g_wasm_str_buf);
    return c ? c->effective_value : 0;
}

WASM_EXPORT int wasm_card_get_current_val(void) {
    g_wasm_str_buf[CARD_KEY_MAX_LEN - 1] = '\0';
    RPGCard *c = card_deck_find_by_key(&g_active_deck, g_wasm_str_buf);
    return c ? c->current_value : 0;
}

WASM_EXPORT int wasm_card_get_max_val(void) {
    g_wasm_str_buf[CARD_KEY_MAX_LEN - 1] = '\0';
    RPGCard *c = card_deck_find_by_key(&g_active_deck, g_wasm_str_buf);
    return c ? c->max_value : 0;
}

WASM_EXPORT int wasm_card_modify_current(int delta) {
    g_wasm_str_buf[CARD_KEY_MAX_LEN - 1] = '\0';
    return card_deck_modify_current(&g_active_deck, g_wasm_str_buf, delta);
}

WASM_EXPORT int wasm_card_set_base_val(int val) {
    g_wasm_str_buf[CARD_KEY_MAX_LEN - 1] = '\0';
    return card_deck_set_base_value(&g_active_deck, g_wasm_str_buf, val);
}

WASM_EXPORT int wasm_card_set_equipped(int equipped) {
    g_wasm_str_buf[CARD_KEY_MAX_LEN - 1] = '\0';
    return card_deck_set_equipped(&g_active_deck, g_wasm_str_buf, equipped);
}

WASM_EXPORT const char* wasm_card_get_key_at(int idx) {
    const RPGCard *c = card_deck_get_at(&g_active_deck, idx);
    return c ? c->key : "";
}

WASM_EXPORT const char* wasm_card_get_name_at(int idx) {
    const RPGCard *c = card_deck_get_at(&g_active_deck, idx);
    return c ? c->name : "";
}

WASM_EXPORT int wasm_card_get_type_at(int idx) {
    const RPGCard *c = card_deck_get_at(&g_active_deck, idx);
    return c ? (int)c->type : -1;
}

WASM_EXPORT int wasm_card_get_effective_at(int idx) {
    const RPGCard *c = card_deck_get_at(&g_active_deck, idx);
    return c ? c->effective_value : 0;
}

WASM_EXPORT int wasm_card_get_current_at(int idx) {
    const RPGCard *c = card_deck_get_at(&g_active_deck, idx);
    return c ? c->current_value : 0;
}

WASM_EXPORT int wasm_card_get_max_at(int idx) {
    const RPGCard *c = card_deck_get_at(&g_active_deck, idx);
    return c ? c->max_value : 0;
}

WASM_EXPORT int wasm_card_get_equipped_at(int idx) {
    const RPGCard *c = card_deck_get_at(&g_active_deck, idx);
    return c ? (int)c->is_equipped : 0;
}

WASM_EXPORT void wasm_card_recalculate(void) {
    card_deck_recalculate(&g_active_deck);
}

/* =========================================================================
 * 5. Motor de Rolagem de Dados Poliédricos (Xorshift32)
 * ========================================================================= */

WASM_EXPORT void wasm_dice_seed(unsigned int seed) {
    dice_set_seed(seed);
}

WASM_EXPORT int wasm_roll_dice(int count, int faces, int modifier) {
    g_last_roll = roll_dice(faces, count, modifier);
    return g_last_roll.total;
}

WASM_EXPORT int wasm_get_last_roll_total(void) {
    return g_last_roll.total;
}

WASM_EXPORT int wasm_get_last_roll_subtotal(void) {
    return g_last_roll.subtotal;
}

WASM_EXPORT int wasm_get_last_roll_count(void) {
    return g_last_roll.count;
}

WASM_EXPORT int wasm_get_last_roll_die(int index) {
    if (index >= 0 && index < g_last_roll.count) {
        return g_last_roll.rolls[index];
    }
    return 0;
}

WASM_EXPORT int wasm_get_last_roll_is_critical(void) {
    return g_last_roll.is_critical;
}

WASM_EXPORT int wasm_get_last_roll_is_fumble(void) {
    return g_last_roll.is_fumble;
}
