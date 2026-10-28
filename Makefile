# ==============================================================================
# Makefile — RPG-SheetC (Full C + WebAssembly)
# ==============================================================================

# Compiladores
CC_NATIVE = gcc
CC_WASM   = clang

# Diretórios
SRC_DIR   = src/core
TEST_DIR  = tests
WEB_DIST  = web/dist

# Fontes C do Core
CORE_SRCS = $(SRC_DIR)/sheet_t20.c $(SRC_DIR)/rpg_base.c $(SRC_DIR)/dice.c


# Flags para compilação WebAssembly standalone (Clang + wasm-ld)
WASM_FLAGS = --target=wasm32 -O2 -nostdlib -Wl,--no-entry -Wl,--export-all

# Flags para testes nativos com GCC
NATIVE_FLAGS = -Wall -Wextra -pedantic -std=c99 -I$(SRC_DIR)

# Destinos
WASM_TARGET = $(WEB_DIST)/sheetc_core.wasm
TEST_TARGET = test_runner.exe

.PHONY: all wasm test clean

all: wasm

# Cria o diretório de destino do WebAssembly se não existir
$(WEB_DIST):
	@powershell -NoProfile -Command "if (!(Test-Path '$(WEB_DIST)')) { New-Item -ItemType Directory -Path '$(WEB_DIST)' -Force | Out-Null }"

# Alvo principal: compila o Core C para .wasm
wasm: $(WEB_DIST)
	$(CC_WASM) $(WASM_FLAGS) $(CORE_SRCS) -o $(WASM_TARGET)
	@echo [OK] WebAssembly compilado com sucesso em $(WASM_TARGET)

# Alvo de testes: compila e executa a suite de testes unitarios com GCC nativo
test: $(CORE_SRCS) $(TEST_DIR)/test_core.c
	$(CC_NATIVE) $(NATIVE_FLAGS) $(CORE_SRCS) $(TEST_DIR)/test_core.c -o $(TEST_TARGET)
	@./$(TEST_TARGET)

# Limpeza de artefatos temporários e binários compilados
clean:
	@powershell -NoProfile -Command "Remove-Item -Force -ErrorAction SilentlyContinue '$(TEST_TARGET)', '$(WEB_DIST)/*.wasm'"
	@echo [OK] Limpeza concluida.
