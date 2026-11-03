/**
 * card_types.h — Modelo de Dados Genérico de Cards e Slots (RPG-SheetC v2.0)
 * 100% C Puro (C99 Freestanding) &bull; Agnóstico a Sistemas e Livre de Copyright
 */

#ifndef CARD_TYPES_H
#define CARD_TYPES_H

#include "rpg_base.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Limites de capacidade e segurança de buffer */
#define CARD_KEY_MAX_LEN       24
#define CARD_NAME_MAX_LEN      32
#define CARD_DESC_MAX_LEN      128
#define CARD_FORMULA_MAX_LEN   48
#define MAX_CARD_MODIFIERS     4
#define MAX_DECK_CARDS         256

/**
 * Tipos fundamentais de Card em qualquer sistema de RPG
 */
typedef enum {
    CARD_TYPE_ATTRIBUTE = 0, /* Atributo base (ex: Força, Agilidade, Mente, Vigor) */
    CARD_TYPE_RESOURCE  = 1, /* Recurso dinâmico (ex: Vida, Mana, Sanidade, Estresse) */
    CARD_TYPE_STAT      = 2, /* Estatística derivada (ex: Defesa, Armadura, Iniciativa) */
    CARD_TYPE_SKILL     = 3, /* Perícia ou especialização */
    CARD_TYPE_ABILITY   = 4, /* Habilidade, Poder, Talento ou Feito */
    CARD_TYPE_EQUIPMENT = 5, /* Arma, Armadura, Escudo, Item de Inventário */
    CARD_TYPE_SPELL     = 6, /* Magia, Feitiço, Manobra ou Técnica */
    CARD_TYPE_TRAIT     = 7, /* Origem, Arquétipo, Raça ou Passiva */
    CARD_TYPE_COUNT     = 8
} CardType;

/**
 * Modificador concedido por um Card a outro Card alvo
 */
typedef struct {
    char target_key[CARD_KEY_MAX_LEN]; /* Chave do card que recebe o bônus (ex: "defesa", "forca") */
    int value;                         /* Bônus ou penalidade numérica (ex: +5, -2) */
} CardModifier;

/**
 * Estrutura atômica de um Card de RPG
 */
typedef struct {
    unsigned int id;                   /* ID numérico único do card no deck */
    CardType type;                     /* Tipo/categoria do card */
    char key[CARD_KEY_MAX_LEN];        /* Chave identificadora única (ex: "for", "pv", "escudo") */
    char name[CARD_NAME_MAX_LEN];      /* Nome de exibição */
    char desc[CARD_DESC_MAX_LEN];      /* Descrição do efeito ou regra */

    /* Valores numéricos e limites */
    int base_value;                    /* Valor base original */
    int current_value;                 /* Valor atual (usado para recursos como PV e PM) */
    int max_value;                     /* Valor máximo calculado com modificadores */
    int effective_value;               /* Valor efetivo recalculado (base + todos os modificadores) */

    /* Custo de ativação (opcional) */
    char cost_resource[CARD_KEY_MAX_LEN]; /* Recurso consumido ao usar (ex: "mana", "acao") */
    int cost_value;                       /* Quantidade consumida */

    /* Fórmula de cálculo ou rolagem (ex: "1d20 + @for", "10 + @des + @armadura") */
    char formula[CARD_FORMULA_MAX_LEN];

    /* Bônus que este card concede a outros cards quando ativo/equipado */
    int modifier_count;
    CardModifier modifiers[MAX_CARD_MODIFIERS];

    /* Flags de estado */
    unsigned char is_equipped;         /* 1 se o card estiver ativo na ficha; 0 se inativo */
    unsigned char is_trained;          /* 1 se for perícia treinada / proficiente */
    unsigned char is_favorite;         /* 1 se favoritado para acesso rápido */
} RPGCard;

/**
 * Coleção de Cards que compõem uma ficha de RPG (Deck)
 */
typedef struct {
    char sheet_name[CARD_NAME_MAX_LEN];  /* Nome do personagem */
    char system_name[CARD_NAME_MAX_LEN]; /* Nome do sistema (livre, definido pelo usuário) */
    int level;                           /* Nível do personagem */
    int xp;                              /* Pontos de experiência */
    int card_count;                      /* Quantidade atual de cards no deck */
    RPGCard cards[MAX_DECK_CARDS];       /* Buffer contíguo estático de cards */
} CardDeck;

#ifdef __cplusplus
}
#endif

#endif /* CARD_TYPES_H */
