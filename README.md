# ⚔️ RPG-SheetC

> **Gerenciador de Fichas de RPG de Alta Performance**  
> **Arquitetura Híbrida**: Motor de regras, cálculos e dados 100% em **C puro (C99 Freestanding)** &bull; Interface Web moderna em **HTML5, CSS3 e Vanilla JS** conectada via **WebAssembly standalone**.

![Badge C99](https://img.shields.io/badge/Core-C99%20Freestanding-blue.svg)
![Badge WASM](https://img.shields.io/badge/Engine-WebAssembly%20(wasm32)-orange.svg)
![Badge Frontend](https://img.shields.io/badge/Frontend-HTML5%20%7C%20CSS3%20%7C%20Vanilla%20JS-yellow.svg)
![Badge Tormenta20](https://img.shields.io/badge/System-Tormenta%2020%20Oficial-red.svg)
![Badge Tests](https://img.shields.io/badge/Tests-100%25%20Passing-brightgreen.svg)
![Badge License](https://img.shields.io/badge/License-MIT-lightgrey.svg)

---

## 📖 Visão Geral

O **RPG-SheetC** é uma aplicação construída sob uma **arquitetura híbrida intencional**: une a robustez, velocidade determinística e segurança de tipos do **C puro (C99)** à facilidade de distribuição, portabilidade e riqueza visual da **Web moderna**.

- Todo o motor de regras — cálculo de modificadores de atributos, progressão multinível de PV e PM, regras de combate e defesa, catálogo oficial de 29 perícias treinadas, gerador pseudoaleatório de dados poliédricos (PRNG Xorshift32) e serialização/desserialização JSON — é escrito em **C99 puro freestanding**, sem dependência de runtimes pesados ou libc externa (`-nostdlib`), compilado diretamente para bytecode WebAssembly (`clang --target=wasm32` + `wasm-ld`).
- A interface com o usuário (UI) é uma aplicação web (SPA) construída em **HTML5 semântico, CSS3 temático de RPG e Vanilla JavaScript (sem frameworks pesados)**. O JavaScript atua estritamente como camada de apresentação visual e ponte de I/O (*glue code*), sincronizando o DOM e os eventos do navegador com a memória linear do C.

---

## 🧩 Por que uma Arquitetura Híbrida (C + WebAssembly + JavaScript)?

Uma pergunta frequente em projetos WebAssembly é: *“Se o core é em C, por que o repositório também possui código JavaScript?”*

A resposta reside nas especificações fundamentais do padrão WebAssembly definido pela W3C:

1. **WebAssembly não manipula o DOM diretamente**: Um binário `.wasm` executa código de baixo nível em uma máquina virtual isolada. Ele não pode, por si só, criar elementos HTML (`<div>`, `<button>`, `<input>`), renderizar janelas ou ouvir eventos de clique de mouse, toque ou digitação no navegador.
2. **WebAssembly não acessa Web APIs nativas**: O C compilado para WebAssembly não tem acesso direto a recursos do navegador como `localStorage` (armazenamento persistente de fichas), download de arquivos (`Blob` / `URL.createObjectURL`) ou diálogos de impressão (`window.print()`).
3. **Divisão de Responsabilidades Rigorosa**: Para manter o código desacoplado e manutenível, o projeto adota uma fronteira estrita:

| Responsabilidade do Sistema | Camada de Execução | Tecnologia |
| :--- | :---: | :---: |
| **Cálculo de Modificadores de Atributos** | 🧠 Core C | **C99 Puro** |
| **Bases e Progressão de PV e PM por Nível** | 🧠 Core C | **C99 Puro** |
| **Cálculo da Defesa Total (DES + Armadura + Escudo)** | 🧠 Core C | **C99 Puro** |
| **Catálogo e Bônus de 29 Perícias Oficiais** | 🧠 Core C | **C99 Puro** |
| **Sorteio de Dados Poliédricos (PRNG Xorshift32)** | 🧠 Core C | **C99 Puro** |
| **Parser e Serializador JSON** | 🧠 Core C | **C99 Puro** |
| **Rotinas de Segurança de Buffer e Strings** | 🧠 Core C | **C99 Freestanding** |
| *Instanciar o binário `.wasm` no navegador* | 🔌 Ponte (*Glue code*) | Vanilla JavaScript |
| *Passar ponteiros e ler strings na memória do C* | 🔌 Ponte (*Glue code*) | Vanilla JavaScript |
| *Renderização de Telas, Wizard, Drawer e Modais* | 🎨 Apresentação Visual | HTML5 + CSS3 + JS |
| *Persistência em `localStorage` e I/O de arquivos* | 🌐 I/O do Navegador | Vanilla JavaScript |

> **Portabilidade Futura**: O código C em `src/core/` não possui **nenhum acoplamento** com a Web ou com JavaScript. Caso você decida no futuro criar um aplicativo nativo para desktop ou mobile (usando Raylib, Dear ImGui, Qt ou GTK), todo o núcleo em `src/core/` pode ser reaproveitado diretamente sem modificar uma única linha de código.

---

## 🌟 Principais Recursos

- **Motor de Regras Oficial de Tormenta 20**:
  - **14 Classes Oficiais**: Arcanista, Bárbaro, Bardo, Bucaneiro, Caçador, Cavaleiro, Clérigo, Druida, Guerreiro, Inventor, Ladino, Lutador, Nobre e Paladino, com progressão canônica de PV e PM por nível.
  - **29 Perícias Oficiais**: Mapeamento dos atributos-chave canônicos e escalação dos bônus de treino (+2 do 1º ao 6º nível, +4 do 7º ao 14º e +6 do 15º ao 20º).
  - **Defesa Dinâmica**: Cálculo automático `10 + Mod DES + Armadura + Escudo + Outros`.
  - **6 Raças Canônicas**: Humano, Elfo, Anão, Goblin, Minotauro e Draconato com bônus de atributos e habilidades.
- **Motor de Dados Pseudoaleatórios em C (PRNG Xorshift32)**:
  - Suporte completo a dados poliédricos: **d4, d6, d8, d10, d12, d20 e d100**.
  - Rolar múltiplos dados com modificador positivo ou negativo.
  - Detecção automática de **Sucesso Crítico** (20 natural) e **Falha Crítica** (1 natural) no d20.
  - Distribuição estatística uniforme comprovada por suítes de testes automatizados.
- **Serializador & Parser JSON em C Puro**:
  - Conversão bidirecional entre structs em memória e strings JSON sem acoplamento a bibliotecas externas.
  - Tolerância a chaves em ordens arbitrárias, campos opcionais e números negativos.
- **Scaffolding Multissistemas**:
  - Arquitetura pronta para múltiplos sistemas com união polimórfica universal `RPGSheet` (Tormenta 20, D&D 5e, Fabula Ultima e 3D&T Victory).
- **Interface Web Temática (SPA)**:
  - **Tela Inicial & Sistemas**: Catálogo dinâmico de sistemas com cards e atalhos rápidos.
  - **Assistente de Criação (Wizard)**: Criação passo-a-passo com gerador de nomes de fantasia, cards descritivos de raças/classes, rolagem de atributos 4d6 descartando o menor (calculado no C) e Array Padrão heroico.
  - **Painel Interativo da Ficha**: Edição in-place com recálculos reativos instantâneos em C para atributos, PV, PM, Defesa e tabela filtrável de 29 perícias com rolagem direta de testes.
  - **Rolador de Dados Poliédricos Visual**: Gaveta lateral retrátil (*drawer*) e arena dedicada de rolagens com histórico detalhado e timestamps.
  - **Persistência Local (`CharacterStorage`)**: Armazenamento no `localStorage` do navegador com modal completo de gerenciamento (abrir, renomear, duplicar e excluir fichas), além de auto-save e auto-restore.
  - **Exportação & Impressão**:
    - Download da ficha como arquivo `.sheetc` (JSON estruturado com envelope de metadados).
    - Importação de arquivos `.sheetc` ou `.json` com restauração direta na memória do C.
    - Folha de estilo de impressão física (`@media print`) formatada para fichas de papel A4 / Carta sem desperdício de tinta.

---

## 🏛️ Arquitetura do Sistema

```
RPG-SheetC/
├── src/
│   ├── core/                  # Core 100% C Puro (C99 Freestanding)
│   │   ├── sheet_types.h      # Enums universais de sistemas e tipos base
│   │   ├── sheet_types.c      # Funções de despacho polimórfico (RPGSheet)
│   │   ├── sheet_t20.h        # Definições oficiais de Tormenta 20 (atributos, perícias, classes)
│   │   ├── sheet_t20.c        # Regras, tabelas de PV/PM e cálculos de modificadores
│   │   ├── sheet_dnd5e.h / .c # Scaffolding para Dungeons & Dragons 5e
│   │   ├── sheet_fabula.h / .c# Scaffolding para Fabula Ultima
│   │   ├── sheet_3det.h / .c  # Scaffolding para 3D&T Victory
│   │   ├── sheet_all.h        # União polimórfica universal RPGSheet
│   │   ├── sheet_json.h / .c  # Parser e gerador JSON de alta performance
│   │   ├── dice.h / .c        # Gerador pseudoaleatório Xorshift32 e rolagens poliédricas
│   │   └── rpg_base.h / .c    # Funções seguras freestanding (memset, memcpy, strncpy, etc.)
│   └── wasm/
│       └── wasm_api.c         # Camada de ponte C <-> WebAssembly (símbolos exportados)
├── web/                       # Frontend Web Moderno (Vanilla JS + HTML5 + CSS3)
│   ├── index.html             # Casca semântica da aplicação SPA
│   ├── css/
│   │   ├── tokens.css         # Variáveis e design tokens (cores de RPG, tipografia, espaçamento)
│   │   ├── style.css          # Design system global e layout
│   │   ├── views.css          # Estilos de telas (Home, Wizard, Ficha)
│   │   ├── dice_roller.css    # Estilização da gaveta e arena de rolagem de dados
│   │   ├── storage.css        # Modal e cards do gerenciador de fichas locais
│   │   └── print.css          # Layout de impressão de alta fidelidade para PDF/A4
│   ├── js/
│   │   ├── wasm_loader.js     # Carregador do binário WASM e manipulador de memória linear
│   │   ├── services/
│   │   │   ├── storage.js     # Persistência em localStorage e CharacterManagerModal
│   │   │   └── export.js      # Serviço de exportação (.sheetc), importação e impressão
│   │   ├── components/
│   │   │   └── dice_roller.js # Componente visual de rolagem de dados poliédricos
│   │   ├── views/
│   │   │   ├── home.js        # View inicial e seleção de sistemas
│   │   │   ├── wizard.js      # Assistente de criação de personagem
│   │   │   └── sheet_view.js  # Painel principal interativo da ficha
│   │   └── app.js             # Ponto de entrada e controlador da SPA
│   └── dist/
│       └── sheetc_core.wasm   # Binário WebAssembly compilado pelo Clang
├── tests/
│   ├── test_core.c            # Suíte oficial de testes unitários nativos em C99
│   ├── test_storage.js        # Teste automatizado de persistência local (Node.js)
│   └── test_export.js         # Teste automatizado de exportação/importação (Node.js)
├── Makefile                   # Build automatizado (alvos wasm, test, clean)
└── README.md                  # Este documento
```

---

## 🛠️ Pré-requisitos de Compilação

Para compilar o código C nativo e gerar o módulo WebAssembly, certifique-se de possuir em seu ambiente:

1. **Clang** & **LLD** (versão 16+ com suporte a `--target=wasm32` e `wasm-ld`).
2. **GCC** (para compilação dos testes unitários nativos de console).
3. **Make** (`mingw32-make` no Windows ou `make` no Linux/macOS).
4. **Node.js** (opcional, para execução das suítes de testes de integração do frontend).
5. Qualquer servidor HTTP estático local (Python, Live Server, `npx serve`, etc.).

---

## 🚀 Como Compilar e Executar

### 1. Compilar o Módulo WebAssembly

Gera o arquivo `web/dist/sheetc_core.wasm` otimizado em modo freestanding a partir dos fontes C:

```bash
mingw32-make wasm
# ou no Linux/macOS:
make wasm
```

### 2. Executar os Testes Unitários em C

Compila os fontes em C puro com GCC com flags de rigor (`-Wall -Wextra -pedantic -std=c99`) e executa todas as suítes de asserções:

```bash
mingw32-make test
# ou no Linux/macOS:
make test
```

### 3. Executar Testes Automatizados de Integração (Node.js)

```bash
node tests/test_storage.js
node tests/test_export.js
```

### 4. Executar a Aplicação Web Localmente

Por questões de segurança dos navegadores para carregamento de binários WebAssembly via streaming (`fetch`), a aplicação deve ser aberta através de um servidor HTTP local simples:

**Opção A — Python 3:**
```bash
cd web
python -m http.server 8000
```
Em seguida, acesse no navegador: `http://localhost:8000`

**Opção B — Node.js (npx serve):**
```bash
npx serve web
```

**Opção C — VS Code / IDE:**
Utilize a extensão **Live Server** apontando para o arquivo `web/index.html`.

---

## 🧪 Cobertura da Suíte de Testes do Core C

A suíte em [`tests/test_core.c`](file:///d:/Arquivos%20para%20Arte%20Grafica/Vini/Vini/RPG-SheetC/tests/test_core.c) cobre 9 áreas críticas:

1. **Cálculo de Modificadores de Atributos**: Asserções de atributos 0 a 30 (modificadores negativos, neutros e positivos).
2. **14 Classes Oficiais de Tormenta 20**: PV/PM base, PV/PM por nível e conversão string <-> enum.
3. **Progressão Multinível**: Recálculos matemáticos para Níveis 1 a 20 combinados com modificadores de Constituição.
4. **Decomposição da Defesa**: Bônus de Destreza, armaduras pesadas/leves, escudos e bônus diversos.
5. **29 Perícias Oficiais**: Atributos-chave e bônus de treino (+2, +4 e +6) por faixa de nível.
6. **Motor Pseudoaleatório Xorshift32**: Sementes determinísticas, limites exatos de d4 a d100 e distribuição uniforme em 10.000 rolagens.
7. **Serialização e Desserialização JSON**: Round-trip de integridade com 100% de preservação dos dados.
8. **Scaffolding Multissistemas**: União polimórfica `RPGSheet` para Tormenta 20, D&D 5e, Fabula Ultima e 3D&T Victory.
9. **Segurança de Strings e Memória**: Testes de rotinas de buffer `memset`, `memcpy`, `strncpy`, `strcmp` e `strlen`.

---

## 🔒 Segurança e Robustez em C

O desenvolvimento do núcleo C seguiu padrões defensivos estritos:
- **Buffers com limites explícitos**: Prevenção total de estouros de buffer através de tamanhos predefinidos e cópias seguras.
- **Modo Freestanding**: Zero acoplamento a runtimes externos pesados (`-nostdlib`).
- **Sem Memory Leaks**: Alocação estática e controle determinístico de memória linear.
- **Desacoplamento Completo**: Nenhuma dependência de interfaces gráficas legadas (Raylib) no core de regras.

---

## 📜 Licença

Distribuído sob a licença MIT. Consulte `LICENSE` para mais informações.
