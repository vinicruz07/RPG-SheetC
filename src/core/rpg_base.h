#ifndef RPG_BASE_H
#define RPG_BASE_H

#ifdef __wasm__

#ifndef NULL
#define NULL ((void*)0)
#endif

typedef unsigned int size_t;

static inline void *rpg_memset(void *s, int c, size_t n) {
    unsigned char *p = (unsigned char *)s;
    while (n--) {
        *p++ = (unsigned char)c;
    }
    return s;
}

static inline char *rpg_strncpy(char *dest, const char *src, size_t n) {
    size_t i;
    for (i = 0; i < n && src[i] != '\0'; i++) {
        dest[i] = src[i];
    }
    for (; i < n; i++) {
        dest[i] = '\0';
    }
    return dest;
}

static inline int rpg_strcmp(const char *s1, const char *s2) {
    while (*s1 && (*s1 == *s2)) {
        s1++;
        s2++;
    }
    return *(const unsigned char *)s1 - *(const unsigned char *)s2;
}

#define memset rpg_memset
#define strncpy rpg_strncpy
#define strcmp rpg_strcmp

#else

#include <string.h>
#include <stddef.h>

#endif /* __wasm__ */

#endif /* RPG_BASE_H */
