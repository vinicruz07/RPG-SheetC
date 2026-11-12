/**
 * card_pack.c — Implementação do Serializador e Parser de Pacotes de Cards (.cardpack)
 * RPG-SheetC v2.0 • 100% C Puro (C99 Freestanding)
 */

#include "card_pack.h"

/* =========================================================================
 * 1. Utilitários de Escrita Segura em Buffer (Writer)
 * ========================================================================= */

typedef struct {
    char *buf;
    int cap;
    int len;
    int overflow;
} JsonWriter;

static void jw_init(JsonWriter *w, char *buf, int cap) {
    w->buf = buf;
    w->cap = cap;
    w->len = 0;
    w->overflow = 0;
    if (buf && cap > 0) {
        buf[0] = '\0';
    }
}

static void jw_putc(JsonWriter *w, char c) {
    if (w->overflow) return;
    if (w->len + 1 >= w->cap) {
        w->overflow = 1;
        return;
    }
    w->buf[w->len++] = c;
    w->buf[w->len] = '\0';
}

static void jw_puts(JsonWriter *w, const char *s) {
    if (!s || w->overflow) return;
    while (*s) {
        jw_putc(w, *s++);
        if (w->overflow) return;
    }
}

static void jw_put_int(JsonWriter *w, int val) {
    char tmp[16];
    int i = 0;
    unsigned int uval;

    if (val < 0) {
        jw_putc(w, '-');
        uval = (unsigned int)(-val);
    } else {
        uval = (unsigned int)val;
    }

    if (uval == 0) {
        jw_putc(w, '0');
        return;
    }

    while (uval > 0 && i < 15) {
        tmp[i++] = (char)('0' + (uval % 10));
        uval /= 10;
    }

    while (i > 0) {
        jw_putc(w, tmp[--i]);
    }
}

static void jw_put_uint(JsonWriter *w, unsigned int uval) {
    char tmp[16];
    int i = 0;

    if (uval == 0) {
        jw_putc(w, '0');
        return;
    }

    while (uval > 0 && i < 15) {
        tmp[i++] = (char)('0' + (uval % 10));
        uval /= 10;
    }

    while (i > 0) {
        jw_putc(w, tmp[--i]);
    }
}

static void jw_put_escaped_str(JsonWriter *w, const char *s) {
    jw_putc(w, '"');
    if (s) {
        while (*s) {
            char c = *s++;
            if (c == '"') {
                jw_puts(w, "\\\"");
            } else if (c == '\\') {
                jw_puts(w, "\\\\");
            } else if (c == '\n') {
                jw_puts(w, "\\n");
            } else if (c == '\r') {
                jw_puts(w, "\\r");
            } else if (c == '\t') {
                jw_puts(w, "\\t");
            } else {
                jw_putc(w, c);
            }
        }
    }
    jw_putc(w, '"');
}

/* =========================================================================
 * 2. Exportação de CardDeck para JSON (.cardpack)
 * ========================================================================= */

int card_pack_export_json(const CardDeck *deck, char *out_json, int max_len) {
    if (!deck || !out_json) return PACK_ERR_NULL_PTR;
    if (max_len <= 2) return PACK_ERR_BUFFER_TOO_SMALL;

    JsonWriter w;
    jw_init(&w, out_json, max_len);

    jw_puts(&w, "{\"sheet_name\":");
    jw_put_escaped_str(&w, deck->sheet_name);
    jw_puts(&w, ",\"system_name\":");
    jw_put_escaped_str(&w, deck->system_name);
    jw_puts(&w, ",\"level\":");
    jw_put_int(&w, deck->level);
    jw_puts(&w, ",\"xp\":");
    jw_put_int(&w, deck->xp);
    jw_puts(&w, ",\"cards\":[");

    for (int i = 0; i < deck->card_count; i++) {
        const RPGCard *c = &deck->cards[i];
        if (i > 0) jw_putc(&w, ',');

        jw_puts(&w, "{\"id\":");
        jw_put_uint(&w, c->id);
        jw_puts(&w, ",\"type\":");
        jw_put_int(&w, (int)c->type);
        jw_puts(&w, ",\"key\":");
        jw_put_escaped_str(&w, c->key);
        jw_puts(&w, ",\"name\":");
        jw_put_escaped_str(&w, c->name);
        jw_puts(&w, ",\"desc\":");
        jw_put_escaped_str(&w, c->desc);
        jw_puts(&w, ",\"base\":");
        jw_put_int(&w, c->base_value);
        jw_puts(&w, ",\"curr\":");
        jw_put_int(&w, c->current_value);
        jw_puts(&w, ",\"max\":");
        jw_put_int(&w, c->max_value);
        jw_puts(&w, ",\"cost_res\":");
        jw_put_escaped_str(&w, c->cost_resource);
        jw_puts(&w, ",\"cost_val\":");
        jw_put_int(&w, c->cost_value);
        jw_puts(&w, ",\"formula\":");
        jw_put_escaped_str(&w, c->formula);
        jw_puts(&w, ",\"equipped\":");
        jw_put_int(&w, (int)c->is_equipped);
        jw_puts(&w, ",\"trained\":");
        jw_put_int(&w, (int)c->is_trained);
        jw_puts(&w, ",\"fav\":");
        jw_put_int(&w, (int)c->is_favorite);
        jw_puts(&w, ",\"mods\":[");

        for (int m = 0; m < c->modifier_count && m < MAX_CARD_MODIFIERS; m++) {
            if (m > 0) jw_putc(&w, ',');
            jw_puts(&w, "{\"target\":");
            jw_put_escaped_str(&w, c->modifiers[m].target_key);
            jw_puts(&w, ",\"val\":");
            jw_put_int(&w, c->modifiers[m].value);
            jw_putc(&w, '}');
        }

        jw_puts(&w, "]}");
        if (w.overflow) return PACK_ERR_BUFFER_TOO_SMALL;
    }

    jw_puts(&w, "]}");

    if (w.overflow) {
        return PACK_ERR_BUFFER_TOO_SMALL;
    }
    return w.len;
}

/* =========================================================================
 * 3. Parser Descendente de JSON (.cardpack) em C Puro
 * ========================================================================= */

typedef struct {
    const char *src;
    int pos;
    int err;
} JsonReader;

static void jr_skip_ws(JsonReader *r) {
    while (r->src[r->pos]) {
        char c = r->src[r->pos];
        if (c == ' ' || c == '\t' || c == '\r' || c == '\n') {
            r->pos++;
        } else {
            break;
        }
    }
}

static char jr_peek(JsonReader *r) {
    jr_skip_ws(r);
    return r->src[r->pos];
}

static int jr_consume(JsonReader *r, char expected) {
    jr_skip_ws(r);
    if (r->src[r->pos] == expected) {
        r->pos++;
        return 1;
    }
    r->err = 1;
    return 0;
}

static int jr_parse_string(JsonReader *r, char *out, int max_len) {
    jr_skip_ws(r);
    if (r->src[r->pos] != '"') {
        r->err = 1;
        return 0;
    }
    r->pos++; /* pula '"' inicial */

    int k = 0;
    while (r->src[r->pos] && r->src[r->pos] != '"') {
        char c = r->src[r->pos++];
        if (c == '\\') {
            char esc = r->src[r->pos];
            if (esc == '\0') {
                r->err = 1;
                return 0;
            }
            r->pos++;
            if (esc == 'n') c = '\n';
            else if (esc == 'r') c = '\r';
            else if (esc == 't') c = '\t';
            else if (esc == '"') c = '"';
            else if (esc == '\\') c = '\\';
            else c = esc;
        }
        if (out && k < max_len - 1) {
            out[k++] = c;
        }
    }

    if (out && max_len > 0) {
        out[k] = '\0';
    }

    if (r->src[r->pos] == '"') {
        r->pos++;
        return 1;
    }

    r->err = 1;
    return 0;
}

static int jr_parse_int(JsonReader *r, int *out_val) {
    jr_skip_ws(r);
    char c = r->src[r->pos];

    /* Suporte a booleanos true / false como 1 / 0 */
    if (c == 't') {
        if (r->src[r->pos + 1] == 'r' && r->src[r->pos + 2] == 'u' && r->src[r->pos + 3] == 'e') {
            r->pos += 4;
            if (out_val) *out_val = 1;
            return 1;
        }
    } else if (c == 'f') {
        if (r->src[r->pos + 1] == 'a' && r->src[r->pos + 2] == 'l' &&
            r->src[r->pos + 3] == 's' && r->src[r->pos + 4] == 'e') {
            r->pos += 5;
            if (out_val) *out_val = 0;
            return 1;
        }
    }

    int sign = 1;
    if (c == '-') {
        sign = -1;
        r->pos++;
    } else if (c == '+') {
        r->pos++;
    }

    if (r->src[r->pos] < '0' || r->src[r->pos] > '9') {
        r->err = 1;
        return 0;
    }

    unsigned int val = 0;
    while (r->src[r->pos] >= '0' && r->src[r->pos] <= '9') {
        val = val * 10 + (unsigned int)(r->src[r->pos] - '0');
        r->pos++;
    }

    if (out_val) {
        *out_val = (int)val * sign;
    }
    return 1;
}

/* Pula qualquer valor JSON desconhecido (objeto, array, string, número ou literal) */
static void jr_skip_value(JsonReader *r) {
    jr_skip_ws(r);
    char c = r->src[r->pos];

    if (c == '"') {
        jr_parse_string(r, NULL, 0);
    } else if (c == '{') {
        r->pos++;
        while (jr_peek(r) && jr_peek(r) != '}') {
            jr_parse_string(r, NULL, 0);
            if (!jr_consume(r, ':')) return;
            jr_skip_value(r);
            if (jr_peek(r) == ',') r->pos++;
        }
        jr_consume(r, '}');
    } else if (c == '[') {
        r->pos++;
        while (jr_peek(r) && jr_peek(r) != ']') {
            jr_skip_value(r);
            if (jr_peek(r) == ',') r->pos++;
        }
        jr_consume(r, ']');
    } else {
        /* Número, true, false, null */
        while (r->src[r->pos]) {
            char ch = r->src[r->pos];
            if (ch == ',' || ch == '}' || ch == ']' ||
                ch == ' ' || ch == '\t' || ch == '\r' || ch == '\n') {
                break;
            }
            r->pos++;
        }
    }
}

static void jr_parse_modifier_obj(JsonReader *r, RPGCard *card) {
    if (!jr_consume(r, '{')) return;

    char target[CARD_KEY_MAX_LEN];
    target[0] = '\0';
    int val = 0;

    while (!r->err && jr_peek(r) && jr_peek(r) != '}') {
        char field[32];
        if (!jr_parse_string(r, field, sizeof(field))) return;
        if (!jr_consume(r, ':')) return;

        if (strcmp(field, "target") == 0 || strcmp(field, "target_key") == 0) {
            jr_parse_string(r, target, sizeof(target));
        } else if (strcmp(field, "val") == 0 || strcmp(field, "value") == 0 || strcmp(field, "bonus") == 0) {
            jr_parse_int(r, &val);
        } else {
            jr_skip_value(r);
        }

        if (jr_peek(r) == ',') {
            r->pos++;
        }
    }

    jr_consume(r, '}');

    if (!r->err && target[0] != '\0') {
        card_add_modifier(card, target, val);
    }
}

static int jr_parse_card_obj(JsonReader *r, RPGCard *out_card, unsigned int fallback_id) {
    if (!jr_consume(r, '{')) return 0;

    memset(out_card, 0, sizeof(RPGCard));
    out_card->id = fallback_id;
    out_card->is_equipped = 1; /* Por padrão ativo se não especificado */

    int has_curr = 0;
    int has_max = 0;

    while (!r->err && jr_peek(r) && jr_peek(r) != '}') {
        char field[32];
        if (!jr_parse_string(r, field, sizeof(field))) return 0;
        if (!jr_consume(r, ':')) return 0;

        if (strcmp(field, "id") == 0) {
            int id_val = 0;
            jr_parse_int(r, &id_val);
            out_card->id = (unsigned int)id_val;
        } else if (strcmp(field, "type") == 0) {
            if (jr_peek(r) == '"') {
                char type_str[32];
                jr_parse_string(r, type_str, sizeof(type_str));
                out_card->type = card_string_to_type(type_str);
            } else {
                int t_val = 0;
                jr_parse_int(r, &t_val);
                if (t_val >= 0 && t_val < CARD_TYPE_COUNT) {
                    out_card->type = (CardType)t_val;
                }
            }
        } else if (strcmp(field, "key") == 0) {
            jr_parse_string(r, out_card->key, CARD_KEY_MAX_LEN);
        } else if (strcmp(field, "name") == 0) {
            jr_parse_string(r, out_card->name, CARD_NAME_MAX_LEN);
        } else if (strcmp(field, "desc") == 0 || strcmp(field, "description") == 0) {
            jr_parse_string(r, out_card->desc, CARD_DESC_MAX_LEN);
        } else if (strcmp(field, "base") == 0 || strcmp(field, "base_value") == 0) {
            jr_parse_int(r, &out_card->base_value);
        } else if (strcmp(field, "curr") == 0 || strcmp(field, "current_value") == 0) {
            jr_parse_int(r, &out_card->current_value);
            has_curr = 1;
        } else if (strcmp(field, "max") == 0 || strcmp(field, "max_value") == 0) {
            jr_parse_int(r, &out_card->max_value);
            has_max = 1;
        } else if (strcmp(field, "cost_res") == 0 || strcmp(field, "cost_resource") == 0) {
            jr_parse_string(r, out_card->cost_resource, CARD_KEY_MAX_LEN);
        } else if (strcmp(field, "cost_val") == 0 || strcmp(field, "cost_value") == 0) {
            jr_parse_int(r, &out_card->cost_value);
        } else if (strcmp(field, "formula") == 0) {
            jr_parse_string(r, out_card->formula, CARD_FORMULA_MAX_LEN);
        } else if (strcmp(field, "equipped") == 0 || strcmp(field, "is_equipped") == 0) {
            int v = 1;
            jr_parse_int(r, &v);
            out_card->is_equipped = (unsigned char)(v ? 1 : 0);
        } else if (strcmp(field, "trained") == 0 || strcmp(field, "is_trained") == 0) {
            int v = 0;
            jr_parse_int(r, &v);
            out_card->is_trained = (unsigned char)(v ? 1 : 0);
        } else if (strcmp(field, "fav") == 0 || strcmp(field, "is_favorite") == 0) {
            int v = 0;
            jr_parse_int(r, &v);
            out_card->is_favorite = (unsigned char)(v ? 1 : 0);
        } else if (strcmp(field, "mods") == 0 || strcmp(field, "modifiers") == 0) {
            if (!jr_consume(r, '[')) return 0;
            while (!r->err && jr_peek(r) && jr_peek(r) != ']') {
                jr_parse_modifier_obj(r, out_card);
                if (jr_peek(r) == ',') r->pos++;
            }
            jr_consume(r, ']');
        } else {
            jr_skip_value(r);
        }

        if (jr_peek(r) == ',') {
            r->pos++;
        }
    }

    if (!jr_consume(r, '}')) return 0;

    /* Sincroniza valores default se omitidos no JSON do pacote */
    if (!has_max) {
        out_card->max_value = out_card->base_value;
    }
    if (!has_curr) {
        out_card->current_value = (out_card->type == CARD_TYPE_RESOURCE)
            ? out_card->max_value
            : out_card->base_value;
    }
    out_card->effective_value = out_card->base_value;

    return !r->err;
}

/* Insere ou mescla um card carregado no deck sem recalcular a cada passo */
static int pack_insert_card(CardDeck *deck, const RPGCard *card, int merge_mode) {
    if (card->key[0] == '\0') return 0;

    if (merge_mode) {
        RPGCard *existing = card_deck_find_by_key(deck, card->key);
        if (existing) {
            unsigned int keep_id = existing->id;
            *existing = *card;
            existing->id = keep_id;
            return 1;
        }
    } else {
        /* Evita duplicata mesmo em modo replace se o JSON tiver chaves repetidas */
        if (card_deck_find_by_key(deck, card->key) != NULL) {
            return 0;
        }
    }

    if (deck->card_count >= MAX_DECK_CARDS) {
        return 0;
    }

    RPGCard *dst = &deck->cards[deck->card_count];
    *dst = *card;
    if (dst->id == 0) {
        dst->id = (unsigned int)(deck->card_count + 1);
    }
    deck->card_count++;
    return 1;
}

int card_pack_import_json(CardDeck *deck, const char *json, int merge_mode) {
    if (!deck || !json) return PACK_ERR_NULL_PTR;

    JsonReader r;
    r.src = json;
    r.pos = 0;
    r.err = 0;

    if (jr_peek(&r) == '\0') {
        return PACK_ERR_SYNTAX;
    }

    if (!merge_mode) {
        card_deck_init(deck, "Novo Personagem", "Sistema Generico Aberto");
    }

    int loaded_cards = 0;

    /* Suporta tanto objeto raiz {"sheet_name":..., "cards":[...]} quanto array direto [...] */
    if (jr_peek(&r) == '[') {
        jr_consume(&r, '[');
        while (!r.err && jr_peek(&r) && jr_peek(&r) != ']') {
            RPGCard c;
            if (!jr_parse_card_obj(&r, &c, (unsigned int)(deck->card_count + 1))) {
                return PACK_ERR_SYNTAX;
            }
            if (pack_insert_card(deck, &c, merge_mode)) {
                loaded_cards++;
            }
            if (jr_peek(&r) == ',') r.pos++;
        }
        if (!jr_consume(&r, ']')) return PACK_ERR_SYNTAX;
    } else if (jr_peek(&r) == '{') {
        jr_consume(&r, '{');
        while (!r.err && jr_peek(&r) && jr_peek(&r) != '}') {
            char key[32];
            if (!jr_parse_string(&r, key, sizeof(key))) return PACK_ERR_SYNTAX;
            if (!jr_consume(&r, ':')) return PACK_ERR_SYNTAX;

            if (strcmp(key, "sheet_name") == 0 || strcmp(key, "pack_name") == 0) {
                char tmp[CARD_NAME_MAX_LEN];
                if (jr_parse_string(&r, tmp, sizeof(tmp)) && (!merge_mode || strcmp(key, "sheet_name") == 0)) {
                    strncpy(deck->sheet_name, tmp, CARD_NAME_MAX_LEN - 1);
                    deck->sheet_name[CARD_NAME_MAX_LEN - 1] = '\0';
                }
            } else if (strcmp(key, "system_name") == 0 || strcmp(key, "system") == 0) {
                char tmp[CARD_NAME_MAX_LEN];
                if (jr_parse_string(&r, tmp, sizeof(tmp))) {
                    strncpy(deck->system_name, tmp, CARD_NAME_MAX_LEN - 1);
                    deck->system_name[CARD_NAME_MAX_LEN - 1] = '\0';
                }
            } else if (strcmp(key, "level") == 0) {
                int lvl = 1;
                if (jr_parse_int(&r, &lvl) && !merge_mode) {
                    deck->level = lvl;
                }
            } else if (strcmp(key, "xp") == 0) {
                int xp_val = 0;
                if (jr_parse_int(&r, &xp_val) && !merge_mode) {
                    deck->xp = xp_val;
                }
            } else if (strcmp(key, "cards") == 0) {
                if (!jr_consume(&r, '[')) return PACK_ERR_SYNTAX;
                while (!r.err && jr_peek(&r) && jr_peek(&r) != ']') {
                    RPGCard c;
                    if (!jr_parse_card_obj(&r, &c, (unsigned int)(deck->card_count + 1))) {
                        return PACK_ERR_SYNTAX;
                    }
                    if (pack_insert_card(deck, &c, merge_mode)) {
                        loaded_cards++;
                    }
                    if (jr_peek(&r) == ',') r.pos++;
                }
                if (!jr_consume(&r, ']')) return PACK_ERR_SYNTAX;
            } else {
                jr_skip_value(&r);
            }

            if (jr_peek(&r) == ',') r.pos++;
        }
        if (!jr_consume(&r, '}')) return PACK_ERR_SYNTAX;
    } else {
        return PACK_ERR_SYNTAX;
    }

    if (r.err) {
        return PACK_ERR_SYNTAX;
    }

    /* Recalcula todos os modificadores acumulados do deck após importar o pacote */
    card_deck_recalculate(deck);
    return loaded_cards;
}

int card_pack_import(CardDeck *deck, const char *json) {
    return card_pack_import_json(deck, json, 0);
}