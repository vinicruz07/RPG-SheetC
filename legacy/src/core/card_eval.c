/**
 * card_eval.c — Implementação do Avaliador de Expressões e Fórmulas em C Puro
 * RPG-SheetC v2.0 &bull; C99 Freestanding
 */

#include "card_eval.h"

#define MAX_EVAL_RECURSION_DEPTH 32

typedef enum {
    TOK_EOF = 0,
    TOK_NUM,
    TOK_PLUS,
    TOK_MINUS,
    TOK_STAR,
    TOK_SLASH,
    TOK_LPAREN,
    TOK_RPAREN,
    TOK_ERROR
} TokenType;

typedef struct {
    const char *src;
    int pos;
    const CardDeck *deck;
    EvalStatus status;
    int depth;

    TokenType current_tok;
    int tok_num;
} ParserState;

/* -------------------------------------------------------------------------- */
/* Helpers de Caracteres e Comparação Insensível a Maiúsculas/Minúsculas       */
/* -------------------------------------------------------------------------- */

static int is_digit(char c) {
    return (c >= '0' && c <= '9');
}

static int is_whitespace(char c) {
    return (c == ' ' || c == '\t' || c == '\r' || c == '\n');
}

static int is_ident_start(char c) {
    return ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_' || c == '@');
}

static int is_ident_part(char c) {
    return (is_ident_start(c) || is_digit(c));
}

static int str_case_eq(const char *s1, const char *s2) {
    while (*s1 && *s2) {
        char c1 = *s1;
        char c2 = *s2;
        if (c1 >= 'A' && c1 <= 'Z') c1 += ('a' - 'A');
        if (c2 >= 'A' && c2 <= 'Z') c2 += ('a' - 'A');
        if (c1 != c2) return 0;
        s1++;
        s2++;
    }
    return (*s1 == '\0' && *s2 == '\0');
}

static const RPGCard *find_card_in_deck(const CardDeck *deck, const char *key) {
    if (!deck || !key) return NULL;
    for (int i = 0; i < deck->card_count; i++) {
        if (str_case_eq(deck->cards[i].key, key)) {
            return &deck->cards[i];
        }
    }
    return NULL;
}

/* -------------------------------------------------------------------------- */
/* Lexer / Tokenizador                                                        */
/* -------------------------------------------------------------------------- */

static void next_token(ParserState *p) {
    while (p->src[p->pos] && is_whitespace(p->src[p->pos])) {
        p->pos++;
    }

    char c = p->src[p->pos];

    if (c == '\0') {
        p->current_tok = TOK_EOF;
        return;
    }

    /* Operadores e Delimitadores */
    if (c == '+') { p->pos++; p->current_tok = TOK_PLUS; return; }
    if (c == '-') { p->pos++; p->current_tok = TOK_MINUS; return; }
    if (c == '*') { p->pos++; p->current_tok = TOK_STAR; return; }
    if (c == '/') { p->pos++; p->current_tok = TOK_SLASH; return; }
    if (c == '(') { p->pos++; p->current_tok = TOK_LPAREN; return; }
    if (c == ')') { p->pos++; p->current_tok = TOK_RPAREN; return; }

    /* Literais Numéricos */
    if (is_digit(c)) {
        int val = 0;
        while (p->src[p->pos] && is_digit(p->src[p->pos])) {
            val = val * 10 + (p->src[p->pos] - '0');
            p->pos++;
        }
        p->tok_num = val;
        p->current_tok = TOK_NUM;
        return;
    }

    /* Identificadores e Referências a Cards (ex: @for, @des, nivel, xp) */
    if (is_ident_start(c)) {
        char key_buf[CARD_KEY_MAX_LEN];
        int k = 0;

        /* Pula prefixo @ se houver */
        if (c == '@') {
            p->pos++;
        }

        while (p->src[p->pos] && is_ident_part(p->src[p->pos])) {
            if (k < CARD_KEY_MAX_LEN - 1) {
                key_buf[k++] = p->src[p->pos];
            }
            p->pos++;
        }
        key_buf[k] = '\0';

        /* Resolve a referência para o valor numérico */
        int resolved_val = 0;
        if (str_case_eq(key_buf, "nivel") || str_case_eq(key_buf, "level")) {
            resolved_val = p->deck ? p->deck->level : 1;
        } else if (str_case_eq(key_buf, "xp")) {
            resolved_val = p->deck ? p->deck->xp : 0;
        } else {
            const RPGCard *card = find_card_in_deck(p->deck, key_buf);
            if (card) {
                resolved_val = card->effective_value;
            } else {
                resolved_val = 0; /* Card não encontrado é tratado como 0 */
            }
        }

        p->tok_num = resolved_val;
        p->current_tok = TOK_NUM;
        return;
    }

    /* Caractere inválido ou desconhecido */
    p->pos++;
    p->current_tok = TOK_ERROR;
    p->status = EVAL_ERR_SYNTAX;
}

/* -------------------------------------------------------------------------- */
/* Parser Descendente Recursivo                                               */
/* -------------------------------------------------------------------------- */

static int parse_expression(ParserState *p);
static int parse_term(ParserState *p);
static int parse_factor(ParserState *p);

static int parse_factor(ParserState *p) {
    if (p->status != EVAL_OK) return 0;

    /* Operador Unário + */
    if (p->current_tok == TOK_PLUS) {
        next_token(p);
        return parse_factor(p);
    }

    /* Operador Unário - */
    if (p->current_tok == TOK_MINUS) {
        next_token(p);
        return -parse_factor(p);
    }

    /* Número ou Variável já resolvida */
    if (p->current_tok == TOK_NUM) {
        int val = p->tok_num;
        next_token(p);
        return val;
    }

    /* Subexpressão entre Parênteses */
    if (p->current_tok == TOK_LPAREN) {
        next_token(p);
        int val = parse_expression(p);
        if (p->current_tok == TOK_RPAREN) {
            next_token(p);
        } else {
            p->status = EVAL_ERR_SYNTAX;
        }
        return val;
    }

    p->status = EVAL_ERR_SYNTAX;
    return 0;
}

static int parse_term(ParserState *p) {
    int left = parse_factor(p);

    while (p->status == EVAL_OK && (p->current_tok == TOK_STAR || p->current_tok == TOK_SLASH)) {
        TokenType op = p->current_tok;
        next_token(p);
        int right = parse_factor(p);

        if (p->status != EVAL_OK) return 0;

        if (op == TOK_STAR) {
            left = left * right;
        } else {
            if (right == 0) {
                p->status = EVAL_ERR_DIV_BY_ZERO;
                return 0;
            }
            left = left / right;
        }
    }

    return left;
}

static int parse_expression(ParserState *p) {
    if (p->depth >= MAX_EVAL_RECURSION_DEPTH) {
        p->status = EVAL_ERR_MAX_DEPTH;
        return 0;
    }

    p->depth++;
    int left = parse_term(p);

    while (p->status == EVAL_OK && (p->current_tok == TOK_PLUS || p->current_tok == TOK_MINUS)) {
        TokenType op = p->current_tok;
        next_token(p);
        int right = parse_term(p);

        if (p->status != EVAL_OK) {
            p->depth--;
            return 0;
        }

        if (op == TOK_PLUS) {
            left = left + right;
        } else {
            left = left - right;
        }
    }

    p->depth--;
    return left;
}

/* -------------------------------------------------------------------------- */
/* Funções Públicas da API                                                    */
/* -------------------------------------------------------------------------- */

EvalStatus card_eval_expression(const char *expr, const CardDeck *deck, int *out_result) {
    if (!out_result) return EVAL_ERR_NULL_PTR;
    *out_result = 0;

    if (!expr || expr[0] == '\0') {
        return EVAL_OK;
    }

    ParserState state;
    state.src = expr;
    state.pos = 0;
    state.deck = deck;
    state.status = EVAL_OK;
    state.depth = 0;
    state.current_tok = TOK_EOF;
    state.tok_num = 0;

    next_token(&state);

    if (state.current_tok == TOK_EOF) {
        *out_result = 0;
        return EVAL_OK;
    }

    int result = parse_expression(&state);

    if (state.status != EVAL_OK) {
        *out_result = 0;
        return state.status;
    }

    /* Se sobrou token no buffer sem ser EOF, é erro de sintaxe */
    if (state.current_tok != TOK_EOF) {
        *out_result = 0;
        return EVAL_ERR_SYNTAX;
    }

    *out_result = result;
    return EVAL_OK;
}

int card_eval_simple(const char *expr, const CardDeck *deck, int fallback_val) {
    int res = 0;
    EvalStatus st = card_eval_expression(expr, deck, &res);
    return (st == EVAL_OK) ? res : fallback_val;
}

EvalStatus card_eval_card_formula(const RPGCard *card, const CardDeck *deck, int *out_result) {
    if (!card) return EVAL_ERR_NULL_PTR;
    return card_eval_expression(card->formula, deck, out_result);
}