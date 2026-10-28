#ifndef SHEET_JSON_H
#define SHEET_JSON_H

#include "sheet_t20.h"
#include "rpg_base.h"

#define SHEET_JSON_BUFFER_SIZE 2048

/**
 * Serializa uma estrutura T20Sheet para uma string no formato JSON.
 * Retorna o número de bytes gravados no buffer (excluindo '\0') ou -1 se o buffer for insuficiente.
 */
int t20_to_json(const T20Sheet *sheet, char *buffer, size_t buffer_size);

/**
 * Desserializa uma string JSON preenchendo os dados da estrutura T20Sheet.
 * Retorna 0 em caso de sucesso ou -1 se o JSON for inválido ou nulo.
 */
int t20_from_json(T20Sheet *sheet, const char *json);

#endif /* SHEET_JSON_H */
