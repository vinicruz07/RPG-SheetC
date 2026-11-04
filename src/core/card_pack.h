/**
 * card_pack.h — Serializador e Parser de Pacotes de Cards (.cardpack JSON) em C Puro
 * RPG-SheetC v2.0 • C99 Freestanding • Zero Dependências Externas
 */

#ifndef CARD_PACK_H
#define CARD_PACK_H

#include "card_types.h"
#include "card_engine.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Capacidade recomendada de buffer JSON para compêndios completos (64 KB) */
#define CARD_PACK_JSON_BUFFER_SIZE 1048576

/**
 * Códigos de retorno das operações de serialização/parse de CardPack
 */
typedef enum {
    PACK_OK = 0,
    PACK_ERR_NULL_PTR = -1,
    PACK_ERR_BUFFER_TOO_SMALL = -2,
    PACK_ERR_SYNTAX = -3
} CardPackStatus;

/**
 * Serializa um CardDeck completo (metadados + array de cards, modificadores e fórmulas)
 * para uma string JSON compacta (.cardpack).
 *
 * @param deck Ponteiro para o deck de origem
 * @param out_json Buffer de saída onde o JSON será escrito
 * @param max_len Capacidade máxima do buffer out_json em bytes
 * @return Número de bytes escritos (> 0) em caso de sucesso, ou código negativo CardPackStatus
 */
int card_pack_export_json(const CardDeck *deck, char *out_json, int max_len);

/**
 * Desserializa uma string JSON (.cardpack) para dentro de um CardDeck.
 *
 * @param deck Ponteiro para o deck de destino
 * @param json String JSON contendo o pacote de cards
 * @param merge_mode Se 0, limpa o deck e substitui tudo; se 1, mescla/adiciona os cards ao deck existente
 * @return Quantidade de cards carregados (>= 0) em caso de sucesso, ou código negativo CardPackStatus
 */
int card_pack_import_json(CardDeck *deck, const char *json, int merge_mode);

/**
 * Atalho para importar substituindo o deck inteiro (merge_mode = 0)
 */
int card_pack_import(CardDeck *deck, const char *json);

#ifdef __cplusplus
}
#endif

#endif /* CARD_PACK_H */
