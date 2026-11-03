/**
 * card_engine.c — Implementação do Motor de Gerenciamento e Recálculo de Cards
 * RPG-SheetC v2.0 &bull; C99 Freestanding
 */

#include "card_engine.h"

const char *card_type_to_string(CardType type) {
    switch (type) {
        case CARD_TYPE_ATTRIBUTE: return "Atributo";
        case CARD_TYPE_RESOURCE:  return "Recurso";
        case CARD_TYPE_STAT:      return "Estatistica";
        case CARD_TYPE_SKILL:     return "Pericia";
        case CARD_TYPE_ABILITY:   return "Habilidade";
        case CARD_TYPE_EQUIPMENT: return "Equipamento";
        case CARD_TYPE_SPELL:     return "Magia";
        case CARD_TYPE_TRAIT:     return "Traco";
        default:                  return "Desconhecido";
    }
}

CardType card_string_to_type(const char *str) {
    if (!str) return CARD_TYPE_ATTRIBUTE;
    if (strcmp(str, "Atributo") == 0 || strcmp(str, "attribute") == 0) return CARD_TYPE_ATTRIBUTE;
    if (strcmp(str, "Recurso") == 0  || strcmp(str, "resource") == 0)  return CARD_TYPE_RESOURCE;
    if (strcmp(str, "Estatistica") == 0 || strcmp(str, "stat") == 0)  return CARD_TYPE_STAT;
    if (strcmp(str, "Pericia") == 0  || strcmp(str, "skill") == 0)     return CARD_TYPE_SKILL;
    if (strcmp(str, "Habilidade") == 0 || strcmp(str, "ability") == 0) return CARD_TYPE_ABILITY;
    if (strcmp(str, "Equipamento") == 0 || strcmp(str, "equipment") == 0) return CARD_TYPE_EQUIPMENT;
    if (strcmp(str, "Magia") == 0    || strcmp(str, "spell") == 0)     return CARD_TYPE_SPELL;
    if (strcmp(str, "Traco") == 0    || strcmp(str, "trait") == 0)     return CARD_TYPE_TRAIT;
    return CARD_TYPE_ATTRIBUTE;
}

void card_deck_init(CardDeck *deck, const char *sheet_name, const char *system_name) {
    if (!deck) return;
    memset(deck, 0, sizeof(CardDeck));

    if (sheet_name) {
        strncpy(deck->sheet_name, sheet_name, CARD_NAME_MAX_LEN - 1);
        deck->sheet_name[CARD_NAME_MAX_LEN - 1] = '\0';
    } else {
        strncpy(deck->sheet_name, "Novo Personagem", CARD_NAME_MAX_LEN - 1);
    }

    if (system_name) {
        strncpy(deck->system_name, system_name, CARD_NAME_MAX_LEN - 1);
        deck->system_name[CARD_NAME_MAX_LEN - 1] = '\0';
    } else {
        strncpy(deck->system_name, "Generico", CARD_NAME_MAX_LEN - 1);
    }

    deck->level = 1;
    deck->xp = 0;
    deck->card_count = 0;
}

int card_deck_add(CardDeck *deck, const RPGCard *card) {
    if (!deck || !card || deck->card_count >= MAX_DECK_CARDS) {
        return -1;
    }

    /* Impede chaves vazias ou duplicadas */
    if (card->key[0] == '\0') {
        return -2;
    }
    if (card_deck_find_by_key(deck, card->key) != NULL) {
        return -3; /* Chave já existente */
    }

    int idx = deck->card_count;
    memcpy(&deck->cards[idx], card, sizeof(RPGCard));
    
    /* Garante terminação nula em strings */
    deck->cards[idx].key[CARD_KEY_MAX_LEN - 1] = '\0';
    deck->cards[idx].name[CARD_NAME_MAX_LEN - 1] = '\0';
    deck->cards[idx].desc[CARD_DESC_MAX_LEN - 1] = '\0';
    deck->cards[idx].cost_resource[CARD_KEY_MAX_LEN - 1] = '\0';
    deck->cards[idx].formula[CARD_FORMULA_MAX_LEN - 1] = '\0';

    deck->card_count++;
    card_deck_recalculate(deck);
    return idx;
}

int card_deck_remove(CardDeck *deck, unsigned int card_id) {
    if (!deck || deck->card_count == 0) return 0;

    int found_idx = -1;
    for (int i = 0; i < deck->card_count; i++) {
        if (deck->cards[i].id == card_id) {
            found_idx = i;
            break;
        }
    }

    if (found_idx == -1) return 0;

    /* Desloca os cards subsequentes */
    for (int i = found_idx; i < deck->card_count - 1; i++) {
        memcpy(&deck->cards[i], &deck->cards[i + 1], sizeof(RPGCard));
    }
    deck->card_count--;
    memset(&deck->cards[deck->card_count], 0, sizeof(RPGCard));

    card_deck_recalculate(deck);
    return 1;
}

int card_deck_remove_by_key(CardDeck *deck, const char *key) {
    if (!deck || !key || deck->card_count == 0) return 0;

    int found_idx = -1;
    for (int i = 0; i < deck->card_count; i++) {
        if (strcmp(deck->cards[i].key, key) == 0) {
            found_idx = i;
            break;
        }
    }

    if (found_idx == -1) return 0;

    for (int i = found_idx; i < deck->card_count - 1; i++) {
        memcpy(&deck->cards[i], &deck->cards[i + 1], sizeof(RPGCard));
    }
    deck->card_count--;
    memset(&deck->cards[deck->card_count], 0, sizeof(RPGCard));

    card_deck_recalculate(deck);
    return 1;
}

void card_deck_clear(CardDeck *deck) {
    if (!deck) return;
    deck->card_count = 0;
    memset(deck->cards, 0, sizeof(deck->cards));
}

RPGCard *card_deck_find_by_id(CardDeck *deck, unsigned int card_id) {
    if (!deck) return NULL;
    for (int i = 0; i < deck->card_count; i++) {
        if (deck->cards[i].id == card_id) {
            return &deck->cards[i];
        }
    }
    return NULL;
}

RPGCard *card_deck_find_by_key(CardDeck *deck, const char *key) {
    if (!deck || !key) return NULL;
    for (int i = 0; i < deck->card_count; i++) {
        if (strcmp(deck->cards[i].key, key) == 0) {
            return &deck->cards[i];
        }
    }
    return NULL;
}

const RPGCard *card_deck_get_at(const CardDeck *deck, int index) {
    if (!deck || index < 0 || index >= deck->card_count) {
        return NULL;
    }
    return &deck->cards[index];
}

int card_deck_count_by_type(const CardDeck *deck, CardType type) {
    if (!deck) return 0;
    int count = 0;
    for (int i = 0; i < deck->card_count; i++) {
        if (deck->cards[i].type == type) {
            count++;
        }
    }
    return count;
}

int card_deck_set_base_value(CardDeck *deck, const char *key, int value) {
    RPGCard *card = card_deck_find_by_key(deck, key);
    if (!card) return 0;
    card->base_value = value;
    card_deck_recalculate(deck);
    return 1;
}

int card_deck_set_current_value(CardDeck *deck, const char *key, int value) {
    RPGCard *card = card_deck_find_by_key(deck, key);
    if (!card) return 0;
    card->current_value = value;
    if (card->max_value > 0 && card->current_value > card->max_value) {
        card->current_value = card->max_value;
    }
    return 1;
}

int card_deck_modify_current(CardDeck *deck, const char *key, int delta) {
    RPGCard *card = card_deck_find_by_key(deck, key);
    if (!card) return 0;
    card->current_value += delta;
    if (card->max_value > 0 && card->current_value > card->max_value) {
        card->current_value = card->max_value;
    }
    return 1;
}

int card_deck_set_equipped(CardDeck *deck, const char *key, int is_equipped) {
    RPGCard *card = card_deck_find_by_key(deck, key);
    if (!card) return 0;
    card->is_equipped = (unsigned char)(is_equipped ? 1 : 0);
    card_deck_recalculate(deck);
    return 1;
}

int card_deck_set_trained(CardDeck *deck, const char *key, int is_trained) {
    RPGCard *card = card_deck_find_by_key(deck, key);
    if (!card) return 0;
    card->is_trained = (unsigned char)(is_trained ? 1 : 0);
    card_deck_recalculate(deck);
    return 1;
}

int card_add_modifier(RPGCard *card, const char *target_key, int value) {
    if (!card || !target_key || card->modifier_count >= MAX_CARD_MODIFIERS) {
        return 0;
    }
    int idx = card->modifier_count;
    strncpy(card->modifiers[idx].target_key, target_key, CARD_KEY_MAX_LEN - 1);
    card->modifiers[idx].target_key[CARD_KEY_MAX_LEN - 1] = '\0';
    card->modifiers[idx].value = value;
    card->modifier_count++;
    return 1;
}

void card_deck_recalculate(CardDeck *deck) {
    if (!deck) return;

    /* 1. Inicializa os valores efetivos e máximos com base nos valores base */
    for (int i = 0; i < deck->card_count; i++) {
        deck->cards[i].effective_value = deck->cards[i].base_value;
        deck->cards[i].max_value = deck->cards[i].base_value;
    }

    /* 2. Acumula todos os modificadores de cards ativos (is_equipped == 1) */
    for (int i = 0; i < deck->card_count; i++) {
        if (!deck->cards[i].is_equipped) {
            continue;
        }

        for (int m = 0; m < deck->cards[i].modifier_count; m++) {
            const char *target_key = deck->cards[i].modifiers[m].target_key;
            int mod_val = deck->cards[i].modifiers[m].value;

            RPGCard *target = card_deck_find_by_key(deck, target_key);
            if (target) {
                target->effective_value += mod_val;
                target->max_value += mod_val;
            }
        }
    }

    /* 3. Ajusta limites de recursos dinâmicos (não ultrapassar max_value) */
    for (int i = 0; i < deck->card_count; i++) {
        if (deck->cards[i].type == CARD_TYPE_RESOURCE) {
            if (deck->cards[i].max_value > 0 && deck->cards[i].current_value > deck->cards[i].max_value) {
                deck->cards[i].current_value = deck->cards[i].max_value;
            }
        }
    }
}

/* -------------------------------------------------------------------------- */
/* Factories de Cards Comuns                                                  */
/* -------------------------------------------------------------------------- */
RPGCard card_create_attribute(unsigned int id, const char *key, const char *name, int base_val) {
    RPGCard c;
    memset(&c, 0, sizeof(RPGCard));
    c.id = id;
    c.type = CARD_TYPE_ATTRIBUTE;
    strncpy(c.key, key ? key : "attr", CARD_KEY_MAX_LEN - 1);
    strncpy(c.name, name ? name : "Atributo", CARD_NAME_MAX_LEN - 1);
    c.base_value = base_val;
    c.effective_value = base_val;
    c.max_value = base_val;
    c.current_value = base_val;
    c.is_equipped = 1;
    return c;
}

RPGCard card_create_resource(unsigned int id, const char *key, const char *name, int max_val) {
    RPGCard c;
    memset(&c, 0, sizeof(RPGCard));
    c.id = id;
    c.type = CARD_TYPE_RESOURCE;
    strncpy(c.key, key ? key : "res", CARD_KEY_MAX_LEN - 1);
    strncpy(c.name, name ? name : "Recurso", CARD_NAME_MAX_LEN - 1);
    c.base_value = max_val;
    c.max_value = max_val;
    c.effective_value = max_val;
    c.current_value = max_val;
    c.is_equipped = 1;
    return c;
}

RPGCard card_create_stat(unsigned int id, const char *key, const char *name, int base_val) {
    RPGCard c;
    memset(&c, 0, sizeof(RPGCard));
    c.id = id;
    c.type = CARD_TYPE_STAT;
    strncpy(c.key, key ? key : "stat", CARD_KEY_MAX_LEN - 1);
    strncpy(c.name, name ? name : "Estatistica", CARD_NAME_MAX_LEN - 1);
    c.base_value = base_val;
    c.max_value = base_val;
    c.effective_value = base_val;
    c.is_equipped = 1;
    return c;
}

RPGCard card_create_skill(unsigned int id, const char *key, const char *name, const char *attr_key) {
    RPGCard c;
    memset(&c, 0, sizeof(RPGCard));
    c.id = id;
    c.type = CARD_TYPE_SKILL;
    strncpy(c.key, key ? key : "skill", CARD_KEY_MAX_LEN - 1);
    strncpy(c.name, name ? name : "Pericia", CARD_NAME_MAX_LEN - 1);
    c.is_equipped = 1;
    if (attr_key) {
        strncpy(c.cost_resource, attr_key, CARD_KEY_MAX_LEN - 1);
    }
    return c;
}

RPGCard card_create_equipment(unsigned int id, const char *key, const char *name, const char *target_key, int bonus) {
    RPGCard c;
    memset(&c, 0, sizeof(RPGCard));
    c.id = id;
    c.type = CARD_TYPE_EQUIPMENT;
    strncpy(c.key, key ? key : "equip", CARD_KEY_MAX_LEN - 1);
    strncpy(c.name, name ? name : "Equipamento", CARD_NAME_MAX_LEN - 1);
    c.is_equipped = 1;
    if (target_key && bonus != 0) {
        card_add_modifier(&c, target_key, bonus);
    }
    return c;
}
