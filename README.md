# RPG-SheetC (Multi-Target)

Repositório organizado por **targets independentes** que se comunicam com um mesmo servidor central, sem compartilhamento de código-fonte entre clientes.

## Estrutura de Pastas

| Pasta | Target | Stack | Status |
| :--- | :--- | :--- | :--- |
| [`server/`](./server) | Servidor central / API | Rust | Estrutura inicial |
| [`web/`](./web) | Cliente Web | TypeScript | Motor TS + UI ativos |
| [`android/`](./android) | Cliente Android | Dart (Flutter) | Estrutura inicial |
| [`windows/`](./windows) | Cliente Desktop Windows | C# / C++ / C | Estrutura inicial |
| [`linux/`](./linux) | Cliente Desktop Linux | C# / C++ / C | Estrutura inicial |
| [`legacy/`](./legacy) | Versão híbrida anterior | C99 + WebAssembly + Vanilla JS | Preservada |

## Arquitetura

- Cada pasta de cliente (`android/`, `web/`, `windows/`, `linux/`) é um projeto autônomo que consome o contrato de API exposto por `server/`.
- A pasta [`legacy/`](./legacy) preserva integralmente a versão híbrida C99/WASM + Vanilla JS anterior para consulta e execução local.
