#include "dice.h"

/* Semente global do gerador Xorshift32 (inicializada com valor padrão não-nulo) */
static unsigned int g_dice_seed = 0x853c49e6;

void dice_set_seed(unsigned int seed) {
    if (seed == 0) {
        seed = 0x853c49e6;
    }
    g_dice_seed = seed;
}

unsigned int dice_get_random_u32(void) {
    unsigned int x = g_dice_seed;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    g_dice_seed = x;
    return x;
}

int dice_random_range(int min, int max) {
    if (min >= max) {
        return min;
    }

    unsigned int range = (unsigned int)(max - min + 1);
    unsigned int x = dice_get_random_u32();
    return min + (int)(x % range);
}

int roll_d20(void) {
    return dice_random_range(1, 20);
}

int roll_dice_simple(int faces, int count, int modifier) {
    if (faces <= 0) {
        faces = 6;
    }
    if (count <= 0) {
        count = 1;
    }

    int sum = 0;
    for (int i = 0; i < count; i++) {
        sum += dice_random_range(1, faces);
    }
    return sum + modifier;
}

DiceRollResult roll_dice(int faces, int count, int modifier) {
    DiceRollResult result;
    memset(&result, 0, sizeof(DiceRollResult));

    if (faces <= 0) {
        faces = 6;
    }
    if (count <= 0) {
        count = 1;
    }
    if (count > DICE_MAX_ROLLS) {
        count = DICE_MAX_ROLLS;
    }

    result.faces = faces;
    result.count = count;
    result.modifier = modifier;
    result.subtotal = 0;

    for (int i = 0; i < count; i++) {
        result.rolls[i] = dice_random_range(1, faces);
        result.subtotal += result.rolls[i];
    }

    result.total = result.subtotal + modifier;

    /* Verificação de sucesso/falha crítica padrão de d20 */
    if (count == 1 && faces == 20) {
        if (result.rolls[0] == 20) {
            result.is_critical = 1;
        } else if (result.rolls[0] == 1) {
            result.is_fumble = 1;
        }
    }

    return result;
}
