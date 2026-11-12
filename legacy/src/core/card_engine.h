/**
 * card_engine.h — Motor de Gerenciamento e Recálculo de Cards (RPG-SheetC v2.0)
 * 100% C Puro (C99 Freestanding) &bull; Zero Dependências Externas
 */

#ifndef CARD_ENGINE_H
#define CARD_ENGINE_H

#include "card_types.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Conversões de tipo string <-> enum */
const char *card_type_to_string(CardType type);
CardType card_string_to_type(const char *str);

/* Ciclo de vida e gerenciamento do Deck */
void card_deck_init(CardDeck *deck, const char *sheet_name, const char *system_name);
int card_deck_add(CardDeck *deck, const RPGCard *card);
int card_deck_remove(CardDeck *deck, unsigned int card_id);
int card_deck_remove_by_key(CardDeck *deck, const char *key);
void card_deck_clear(CardDeck *deck);

/* Consultas e buscas */
RPGCard *card_deck_find_by_id(CardDeck *deck, unsigned int card_id);
RPGCard *card_deck_find_by_key(CardDeck *deck, const char *key);
const RPGCard *card_deck_get_at(const CardDeck *deck, int index);
int card_deck_count_by_type(const CardDeck *deck, CardType type);

/* Manipulação de valores */
int card_deck_set_base_value(CardDeck *deck, const char *key, int value);
int card_deck_set_current_value(CardDeck *deck, const char *key, int value);
int card_deck_modify_current(CardDeck *deck, const char *key, int delta);
int card_deck_set_equipped(CardDeck *deck, const char *key, int is_equipped);
int card_deck_set_trained(CardDeck *deck, const char *key, int is_trained);

/* Adição de modificador em um card existente */
int card_add_modifier(RPGCard *card, const char *target_key, int value);

/* Motor de Recálculo: aplica todos os modificadores de cards ativos */
void card_deck_recalculate(CardDeck *deck);

/* Criação rápida de cards comuns via factory */
RPGCard card_create_attribute(unsigned int id, const char *key, const char *name, int base_val);
RPGCard card_create_resource(unsigned int id, const char *key, const char *name, int max_val);
RPGCard card_create_stat(unsigned int id, const char *key, const char *name, int base_val);
RPGCard card_create_skill(unsigned int id, const char *key, const char *name, const char *attr_key);
RPGCard card_create_ability(unsigned int id, const char *key, const char *name, const char *formula);
RPGCard card_create_equipment(unsigned int id, const char *key, const char *name, const char *target_key, int bonus);

#ifdef __cplusplus
}
#endif

#endif /* CARD_ENGINE_H */