#include "../core/sheet_all.h"
#include "../core/sheet_json.h"
#include "../core/dice.h"
#include "../core/rpg_base.h"

#define WASM_EXPORT __attribute__((visibility("default")))

/* Ficha ativa gerenciada na memória linear do WebAssembly */
static T20Sheet g_active_t20;

/* Buffers estáticos para troca de strings e JSON com JavaScript */
#define WASM_JSON_BUFFER_CAPACITY 2048
#define WASM_STR_BUFFER_CAPACITY 128

static char g_wasm_json_buf[WASM_JSON_BUFFER_CAPACITY];
static char g_wasm_str_buf[WASM_STR_BUFFER_CAPACITY];
static DiceRollResult g_last_roll;

/* =========================================================================
 * 1. Inicialização e Criação de Personagem
 * ========================================================================= */

WASM_EXPORT void wasm_init(void) {
    t20_init_default(&g_active_t20, "Valeros", T20_RACE_HUMANO, "Guerreiro");
    dice_set_seed(0x853c49e6);
}

WASM_EXPORT void wasm_t20_new_default(int raca_id, int classe_id) {
    const char *raca = t20_race_to_string((T20Race)raca_id);
    const char *classe = t20_class_to_string((T20Class)classe_id);
    t20_init_default(&g_active_t20, "Novo Herói", (T20Race)raca_id, classe);
    g_active_t20.classe_id = classe_id;
    strncpy(g_active_t20.raca, raca, sizeof(g_active_t20.raca) - 1);
    t20_recalculate(&g_active_t20);
}

/* =========================================================================
 * 2. Manipulação de Nome e Nível
 * ========================================================================= */

WASM_EXPORT char* wasm_get_str_buffer(void) {
    return g_wasm_str_buf;
}

WASM_EXPORT int wasm_get_str_buffer_size(void) {
    return WASM_STR_BUFFER_CAPACITY;
}

WASM_EXPORT void wasm_t20_set_name_from_buffer(void) {
    g_wasm_str_buf[WASM_STR_BUFFER_CAPACITY - 1] = '\0';
    strncpy(g_active_t20.nome, g_wasm_str_buf, sizeof(g_active_t20.nome) - 1);
    g_active_t20.nome[sizeof(g_active_t20.nome) - 1] = '\0';
}

WASM_EXPORT const char* wasm_t20_get_name_ptr(void) {
    return g_active_t20.nome;
}

WASM_EXPORT void wasm_t20_set_level(int level) {
    if (level < 1) level = 1;
    if (level > 20) level = 20;
    g_active_t20.nivel = level;
    t20_recalculate(&g_active_t20);
}

WASM_EXPORT int wasm_t20_get_level(void) {
    return g_active_t20.nivel;
}

WASM_EXPORT int wasm_t20_get_raca_id(void) {
    return g_active_t20.raca_id;
}

WASM_EXPORT int wasm_t20_get_classe_id(void) {
    return g_active_t20.classe_id;
}

/* =========================================================================
 * 3. Atributos e Modificadores
 * ========================================================================= */

WASM_EXPORT void wasm_t20_set_attribute(int attr_id, int valor) {
    t20_set_attribute_by_id(&g_active_t20, (T20Attribute)attr_id, valor);
}

WASM_EXPORT int wasm_t20_get_attribute(int attr_id) {
    return t20_get_attribute_by_id(&g_active_t20, (T20Attribute)attr_id);
}

WASM_EXPORT int wasm_t20_get_modifier(int attr_id) {
    int val = t20_get_attribute_by_id(&g_active_t20, (T20Attribute)attr_id);
    return t20_calc_modifier(val);
}

/* =========================================================================
 * 4. Pontos de Vida, Mana e Defesa
 * ========================================================================= */

WASM_EXPORT int wasm_t20_get_pv_atual(void) {
    return g_active_t20.pv_atual;
}

WASM_EXPORT int wasm_t20_get_pv_max(void) {
    return g_active_t20.pv_max;
}

WASM_EXPORT void wasm_t20_set_pv_atual(int pv) {
    if (pv < 0) pv = 0;
    if (pv > g_active_t20.pv_max) pv = g_active_t20.pv_max;
    g_active_t20.pv_atual = pv;
}

WASM_EXPORT void wasm_t20_modify_pv(int delta) {
    int novo = g_active_t20.pv_atual + delta;
    wasm_t20_set_pv_atual(novo);
}

WASM_EXPORT int wasm_t20_get_pm_atual(void) {
    return g_active_t20.pm_atual;
}

WASM_EXPORT int wasm_t20_get_pm_max(void) {
    return g_active_t20.pm_max;
}

WASM_EXPORT void wasm_t20_set_pm_atual(int pm) {
    if (pm < 0) pm = 0;
    if (pm > g_active_t20.pm_max) pm = g_active_t20.pm_max;
    g_active_t20.pm_atual = pm;
}

WASM_EXPORT void wasm_t20_modify_pm(int delta) {
    int novo = g_active_t20.pm_atual + delta;
    wasm_t20_set_pm_atual(novo);
}

WASM_EXPORT int wasm_t20_get_defesa(void) {
    return g_active_t20.defesa;
}

WASM_EXPORT void wasm_t20_set_bonus_armadura(int bonus) {
    g_active_t20.bonus_armadura = bonus;
    t20_recalculate(&g_active_t20);
}

WASM_EXPORT void wasm_t20_set_bonus_escudo(int bonus) {
    g_active_t20.bonus_escudo = bonus;
    t20_recalculate(&g_active_t20);
}

/* =========================================================================
 * 5. Perícias
 * ========================================================================= */

WASM_EXPORT int wasm_t20_is_skill_trained(int skill_id) {
    return t20_is_skill_trained(&g_active_t20, (T20Skill)skill_id);
}

WASM_EXPORT void wasm_t20_set_skill_trained(int skill_id, int trained) {
    t20_set_skill_trained(&g_active_t20, (T20Skill)skill_id, trained);
}

WASM_EXPORT int wasm_t20_calc_skill(int skill_id, int outros_bonus) {
    return t20_calc_skill_total(&g_active_t20, (T20Skill)skill_id, outros_bonus);
}

/* =========================================================================
 * 6. Motor de Rolagem de Dados
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

/* =========================================================================
 * 7. Serialização e Desserialização JSON via Memória Linear
 * ========================================================================= */

WASM_EXPORT char* wasm_get_json_buffer(void) {
    return g_wasm_json_buf;
}

WASM_EXPORT int wasm_get_json_buffer_capacity(void) {
    return WASM_JSON_BUFFER_CAPACITY;
}

WASM_EXPORT int wasm_export_json(void) {
    int bytes = t20_to_json(&g_active_t20, g_wasm_json_buf, sizeof(g_wasm_json_buf));
    return bytes;
}

WASM_EXPORT int wasm_import_json_from_buffer(void) {
    g_wasm_json_buf[WASM_JSON_BUFFER_CAPACITY - 1] = '\0';
    int status = t20_from_json(&g_active_t20, g_wasm_json_buf);
    return status;
}
