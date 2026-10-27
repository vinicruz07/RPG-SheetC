#ifndef SHEET_TYPES_H
#define SHEET_TYPES_H

/**
 * Identificadores universais de sistemas de RPG suportados pelo RPG-SheetC.
 */
typedef enum {
    SYSTEM_NONE = 0,
    SYSTEM_TORMENTA20 = 1,
    SYSTEM_DND5E = 2,
    SYSTEM_FABULA_ULTIMA = 3,
    SYSTEM_3DET_VICTORY = 4
} RPGSystemId;

/**
 * Retorna o nome amigável do sistema de RPG.
 */
static inline const char* get_system_name(RPGSystemId system) {
    switch (system) {
        case SYSTEM_TORMENTA20:
            return "Tormenta 20";
        case SYSTEM_DND5E:
            return "Dungeons & Dragons 5e";
        case SYSTEM_FABULA_ULTIMA:
            return "Fabula Ultima";
        case SYSTEM_3DET_VICTORY:
            return "3D&T Victory";
        default:
            return "Desconhecido";
    }
}

#endif /* SHEET_TYPES_H */
