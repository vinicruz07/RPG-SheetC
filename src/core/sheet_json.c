#include "sheet_json.h"

/* Helper para adicionar string ao buffer com controle de overflow */
static void append_str(char *dest, size_t max, size_t *pos, const char *src) {
    if (dest == NULL || src == NULL || *pos >= max) {
        return;
    }
    while (*src != '\0' && *pos + 1 < max) {
        dest[(*pos)++] = *src++;
    }
    dest[*pos] = '\0';
}

/* Helper para adicionar inteiro em texto sem depender de sprintf */
static void append_int(char *dest, size_t max, size_t *pos, int val) {
    char tmp[16];
    int i = 0;
    int is_neg = 0;
    unsigned int uval;

    if (val < 0) {
        is_neg = 1;
        uval = (unsigned int)(-val);
    } else {
        uval = (unsigned int)val;
    }

    if (uval == 0) {
        tmp[i++] = '0';
    } else {
        while (uval > 0) {
            tmp[i++] = (char)('0' + (uval % 10));
            uval /= 10;
        }
    }

    if (is_neg) {
        tmp[i++] = '-';
    }

    while (i > 0 && *pos + 1 < max) {
        dest[(*pos)++] = tmp[--i];
    }
    if (*pos < max) {
        dest[*pos] = '\0';
    }
}

/* Helper para adicionar campo chave-valor inteiro no JSON */
static void append_key_int(char *dest, size_t max, size_t *pos, const char *key, int val, int comma) {
    append_str(dest, max, pos, "  \"");
    append_str(dest, max, pos, key);
    append_str(dest, max, pos, "\": ");
    append_int(dest, max, pos, val);
    if (comma) {
        append_str(dest, max, pos, ",\n");
    } else {
        append_str(dest, max, pos, "\n");
    }
}

/* Helper para adicionar campo chave-valor string no JSON */
static void append_key_str(char *dest, size_t max, size_t *pos, const char *key, const char *val, int comma) {
    append_str(dest, max, pos, "  \"");
    append_str(dest, max, pos, key);
    append_str(dest, max, pos, "\": \"");
    append_str(dest, max, pos, val ? val : "");
    append_str(dest, max, pos, "\"");
    if (comma) {
        append_str(dest, max, pos, ",\n");
    } else {
        append_str(dest, max, pos, "\n");
    }
}

int t20_to_json(const T20Sheet *sheet, char *buffer, size_t buffer_size) {
    if (sheet == NULL || buffer == NULL || buffer_size < 128) {
        return -1;
    }

    size_t pos = 0;
    buffer[0] = '\0';

    append_str(buffer, buffer_size, &pos, "{\n");
    append_key_int(buffer, buffer_size, &pos, "sistema", sheet->sistema, 1);
    append_key_str(buffer, buffer_size, &pos, "nome", sheet->nome, 1);
    append_key_int(buffer, buffer_size, &pos, "raca_id", sheet->raca_id, 1);
    append_key_str(buffer, buffer_size, &pos, "raca", sheet->raca, 1);
    append_key_str(buffer, buffer_size, &pos, "classe", sheet->classe, 1);
    append_key_int(buffer, buffer_size, &pos, "nivel", sheet->nivel, 1);
    append_key_int(buffer, buffer_size, &pos, "experiencia", sheet->experiencia, 1);

    append_key_int(buffer, buffer_size, &pos, "pv_max", sheet->pv_max, 1);
    append_key_int(buffer, buffer_size, &pos, "pv_atual", sheet->pv_atual, 1);
    append_key_int(buffer, buffer_size, &pos, "pm_max", sheet->pm_max, 1);
    append_key_int(buffer, buffer_size, &pos, "pm_atual", sheet->pm_atual, 1);

    append_key_int(buffer, buffer_size, &pos, "forca", sheet->forca, 1);
    append_key_int(buffer, buffer_size, &pos, "destreza", sheet->destreza, 1);
    append_key_int(buffer, buffer_size, &pos, "constituicao", sheet->constituicao, 1);
    append_key_int(buffer, buffer_size, &pos, "inteligencia", sheet->inteligencia, 1);
    append_key_int(buffer, buffer_size, &pos, "sabedoria", sheet->sabedoria, 1);
    append_key_int(buffer, buffer_size, &pos, "carisma", sheet->carisma, 1);
    append_key_int(buffer, buffer_size, &pos, "defesa", sheet->defesa, 0);

    append_str(buffer, buffer_size, &pos, "}");

    if (pos >= buffer_size - 1) {
        return -1; /* Buffer truncado */
    }

    return (int)pos;
}

/* Localiza o valor correspondente a uma chave JSON */
static const char* json_find_key(const char *json, const char *key) {
    if (json == NULL || key == NULL) {
        return NULL;
    }

    size_t klen = strlen(key);
    const char *p = json;

    while (*p != '\0') {
        if (*p == '"') {
            p++;
            const char *k = key;
            size_t match = 0;
            while (*p != '\0' && *k != '\0' && *p == *k) {
                p++;
                k++;
                match++;
            }
            if (match == klen && *p == '"') {
                p++; /* Pula aspa de fechamento */
                while (*p != '\0' && (*p == ' ' || *p == '\t' || *p == '\r' || *p == '\n')) {
                    p++;
                }
                if (*p == ':') {
                    p++;
                    while (*p != '\0' && (*p == ' ' || *p == '\t' || *p == '\r' || *p == '\n')) {
                        p++;
                    }
                    return p;
                }
            }
        }
        if (*p != '\0') {
            p++;
        }
    }
    return NULL;
}

/* Extrai valor inteiro de chave no JSON */
static int json_get_int(const char *json, const char *key, int *out) {
    const char *p = json_find_key(json, key);
    if (p == NULL) {
        return 0;
    }

    int is_neg = 0;
    if (*p == '-') {
        is_neg = 1;
        p++;
    }

    int val = 0;
    int has_digits = 0;
    while (*p >= '0' && *p <= '9') {
        val = val * 10 + (*p - '0');
        p++;
        has_digits = 1;
    }

    if (!has_digits) {
        return 0;
    }

    *out = is_neg ? -val : val;
    return 1;
}

/* Extrai valor string de chave no JSON */
static int json_get_str(const char *json, const char *key, char *out, size_t max_len) {
    const char *p = json_find_key(json, key);
    if (p == NULL || *p != '"') {
        return 0;
    }

    p++; /* Pula aspa de abertura */
    size_t i = 0;
    while (*p != '\0' && *p != '"' && i + 1 < max_len) {
        out[i++] = *p++;
    }
    out[i] = '\0';
    return 1;
}

int t20_from_json(T20Sheet *sheet, const char *json) {
    if (sheet == NULL || json == NULL) {
        return -1;
    }

    memset(sheet, 0, sizeof(T20Sheet));

    json_get_int(json, "sistema", &sheet->sistema);
    if (sheet->sistema == 0) {
        sheet->sistema = SYSTEM_TORMENTA20;
    }

    json_get_str(json, "nome", sheet->nome, sizeof(sheet->nome));
    json_get_int(json, "raca_id", &sheet->raca_id);
    json_get_str(json, "raca", sheet->raca, sizeof(sheet->raca));
    json_get_str(json, "classe", sheet->classe, sizeof(sheet->classe));
    json_get_int(json, "nivel", &sheet->nivel);
    json_get_int(json, "experiencia", &sheet->experiencia);

    json_get_int(json, "pv_max", &sheet->pv_max);
    json_get_int(json, "pv_atual", &sheet->pv_atual);
    json_get_int(json, "pm_max", &sheet->pm_max);
    json_get_int(json, "pm_atual", &sheet->pm_atual);

    json_get_int(json, "forca", &sheet->forca);
    json_get_int(json, "destreza", &sheet->destreza);
    json_get_int(json, "constituicao", &sheet->constituicao);
    json_get_int(json, "inteligencia", &sheet->inteligencia);
    json_get_int(json, "sabedoria", &sheet->sabedoria);
    json_get_int(json, "carisma", &sheet->carisma);
    json_get_int(json, "defesa", &sheet->defesa);

    /* Recalcula valores para garantir coerência */
    t20_recalculate(sheet);

    return 0;
}
