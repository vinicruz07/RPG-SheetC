# 🌐 RPG-SheetC — Target Web (TypeScript)

Cliente **Web 100% em TypeScript** do **RPG-SheetC**, totalmente independente da versão `legacy/` (zero binários `.wasm`, zero truncamento de strings C) e preparado para sincronização com o futuro servidor central em Rust (`server/`).

---

## ⚙️ Arquitetura do Motor Agnóstico (`web/src/core/`)

O núcleo em TypeScript replica e amplia todas as capacidades do motor anterior:

- **[`src/core/types.ts`](src/core/types.ts)**: Contratos estritos para os 8 tipos universais de cards (`ATTRIBUTE`, `RESOURCE`, `STAT`, `SKILL`, `ABILITY`, `EQUIPMENT`, `SPELL`, `TRAIT`), modificadores (`CardModifier`), layout dinâmico de ficha (`UiLayoutConfig`), assistentes e modelos (`CreationConfig`) e pacotes `.cardpack` (`CardPackSchema`).
- **[`src/core/card_engine.ts`](src/core/card_engine.ts)**: Classe `SheetEngine` (também exposta como `SheetCWasm` para compatibilidade imediata de API) com:
  - Recálculo em cascata de modificadores de equipamentos/magias/habilidades equipadas sobre atributos, recursos e estatísticas.
  - Avaliação automática de estatísticas derivadas com fórmulas determinísticas (`10 + (@des - 10) / 2`, `10 + 2 * @for`, etc.).
  - Clamping dinâmico de recursos (`current <= max`).
  - Importação e exportação completa de arquivos `.cardpack` preservando `ui_layout`, `creation_config`, `wizard_schema`, `derived_stats`, `currencies`, `category` e `is_mandatory`.
  - Sistema reativo Pub/Sub (`onChange`).
- **[`src/core/formula_eval.ts`](src/core/formula_eval.ts)**: Avaliador descendente recursivo suportando `+`, `-`, `*`, `/`, parênteses, unários, funções matemáticas (`floor`, `ceil`, `round`, `abs`, `min`, `max`), variáveis `@key`, `@nivel`/`@level`, `@xp` e rolagens de dados embutidas (`NdF`).
- **[`src/core/dice.ts`](src/core/dice.ts)**: Gerador pseudoaleatório determinístico `Xorshift32` e rolador poliédrico (`d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`) com detecção de crítico e falha crítica.
- **[`src/core/api_client.ts`](src/core/api_client.ts)**: Cliente HTTP (`ServerApiClient`) para comunicação REST com o servidor Rust (`server/`) e fallback automático offline.

---

## 🚀 Como Compilar, Testar e Executar

A partir da raiz do repositório (ou dentro de `web/`):

### 1. Compilar TypeScript -> JavaScript (`web/dist/`)
```powershell
node web/scripts/build.mjs
```

### 2. Executar as Suítes de Testes (Unitários do Core + Integração Completa de UI)
```powershell
node --no-warnings web/tests/test_core_engine.ts
node --no-warnings web/tests/test_web_integration.ts
```

### 3. Iniciar o Servidor Local para Testar no Navegador
```powershell
node web/scripts/serve.mjs 8000
```
Depois, abra **`http://localhost:8000`** no navegador.
