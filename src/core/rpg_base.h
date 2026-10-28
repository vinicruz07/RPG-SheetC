#ifndef RPG_BASE_H
#define RPG_BASE_H

#ifdef __wasm__

#ifndef NULL
#define NULL ((void*)0)
#endif

typedef unsigned long size_t;

void *memset(void *dest, int c, size_t n);
void *memcpy(void *dest, const void *src, size_t n);
char *strncpy(char *dest, const char *src, size_t n);
int strcmp(const char *s1, const char *s2);
size_t strlen(const char *s);

#else

#include <string.h>
#include <stddef.h>

#endif /* __wasm__ */

#endif /* RPG_BASE_H */
