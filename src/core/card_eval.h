/**
 * card_eval.h — Avaliador de Expressões Matemáticas e Referências a Cards
 * RPG-SheetC v2.0 &bull; C99 Freestanding &bull; Zero Dependências Externas
 */

#ifndef CARD_EVAL_H
#define CARD_EVAL_H

#include "card_types.h"
#include "card_engine.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Códigos de status da avaliação de fórmulas
 */
typedef enum {
    EVAL_OK = 0,
    EVAL_ERR_SYNTAX,
    EVAL_ERR_DIV_BY_ZERO,
    EVAL_ERR_MAX_DEPTH,
    EVAL_ERR_NULL_PTR
} EvalStatus;

/**
 * Avalia uma expressão aritmética contendo inteiros, operadores (+, -, *, /),
 * parênteses e referências a cards do deck (@chave, @nivel, @xp).
 *
 * @param expr String da fórmula (ex: "10 + @des + @armadura", "(@for - 10) / 2")
 * @param deck Ponteiro para o CardDeck contendo os cards referenciados (pode ser NULL para fórmulas puras)
 * @param out_result Ponteiro onde o resultado inteiro calculado será gravado
 * @return EvalStatus (EVAL_OK em caso de sucesso)
 */
EvalStatus card_eval_expression(const char *expr, const CardDeck *deck, int *out_result);

/**
 * Versão simplificada que retorna o resultado diretamente ou fallback_val em caso de erro
 */
int card_eval_simple(const char *expr, const CardDeck *deck, int fallback_val);

/**
 * Avalia a fórmula configurada no próprio card dentro do contexto do deck
 */
EvalStatus card_eval_card_formula(const RPGCard *card, const CardDeck *deck, int *out_result);

#ifdef __cplusplus
}
#endif

#endif /* CARD_EVAL_H */
