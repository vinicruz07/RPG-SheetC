# ==============================================================================
# Makefile — RPG-SheetC (Full C + WebAssembly)
# ==============================================================================

# Compiladores
CC_NATIVE = gcc
CC_WASM   = clang

# Diretórios
SRC_DIR   = src/core
WASM_DIR  = src/wasm
TEST_DIR  = tests
WEB_DIST  = web/dist

# Fontes C do Core
CORE_SRCS = $(SRC_DIR)/card_engine.c $(SRC_DIR)/card_eval.c $(SRC_DIR)/card_pack.c $(SRC_DIR)/rpg_base.c $(SRC_DIR)/dice.c

# Fontes específicas do WebAssembly (Core + API bindings)
WASM_SRCS = $(CORE_SRCS) $(WASM_DIR)/wasm_api.c

# Flags para compilação WebAssembly standalone (Clang + wasm-ld)
WASM_FLAGS = --target=wasm32 -O2 -nostdlib -Wl,--no-entry -Wl,--export-all

# Flags para testes nativos com GCC
NATIVE_FLAGS = -Wall -Wextra -pedantic -std=c99 -I$(SRC_DIR)

# Destinos
WASM_TARGET = $(WEB_DIST)/sheetc_core.wasm
TEST_TARGET = test_cards_runner_v2.exe

.PHONY: all wasm test test-c test-js test-all clean

all: wasm

# Cria o diretório de destino do WebAssembly se não existir
$(WEB_DIST):
	@powershell -NoProfile -Command "if (!(Test-Path '$(WEB_DIST)')) { New-Item -ItemType Directory -Path '$(WEB_DIST)' -Force | Out-Null }"

# Alvo principal: compila o Core C + API para .wasm
wasm: $(WEB_DIST)
	$(CC_WASM) $(WASM_FLAGS) $(WASM_SRCS) -o $(WASM_TARGET)
	@echo [OK] WebAssembly compilado com sucesso em $(WASM_TARGET)

# Alvo de testes unitários C nativo com GCC
test-c: $(WASM_SRCS) $(TEST_DIR)/test_cards.c
	$(CC_NATIVE) $(NATIVE_FLAGS) $(WASM_SRCS) $(TEST_DIR)/test_cards.c -o $(TEST_TARGET)
	@./$(TEST_TARGET)

# Alvo de testes JavaScript e integração (Virtual Scroll, Compendium, Editor, SheetView, PackManager, Creator, Drawer Navigation)
test-js:
	@node $(TEST_DIR)/test_virtual_scroll.js
	@node $(TEST_DIR)/test_compendium.js
	@node $(TEST_DIR)/test_card_editor.js
	@node $(TEST_DIR)/test_sheet_view.js
	@node $(TEST_DIR)/test_pack_manager.js
	@node $(TEST_DIR)/test_creator.js
	@node $(TEST_DIR)/test_drawer_nav.js

# Alvo padrão de testes: compila e executa a suíte unitária C e o teste de virtual scroll
test: test-c
	@node $(TEST_DIR)/test_virtual_scroll.js

# Alvo completo de qualidade: executa todos os testes C e JavaScript
test-all: test-c test-js

# Limpeza de artefatos temporários e binários compilados
clean:
	@powershell -NoProfile -Command "Remove-Item -Force -ErrorAction SilentlyContinue '$(TEST_TARGET)', '$(WEB_DIST)/*.wasm'"
	@echo [OK] Limpeza concluida.
