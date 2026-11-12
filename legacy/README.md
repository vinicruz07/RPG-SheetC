# ⚔️ RPG-SheetC v2.0

> **Motor Agnóstico de Fichas de RPG de Alta Performance Baseado em Cards**  
> **Arquitetura Híbrida**: Núcleo de regras, fórmulas dinâmicas e serialização em **C puro (C99 Freestanding)** &bull; Interface Web reativa em **HTML5, CSS3 e Vanilla JS** &bull; Renderização com **Virtual Scrolling O(1)** (60 FPS com 5.000+ cards) &bull; Conectado via **WebAssembly standalone** (`-nostdlib`).

![Badge C99](https://img.shields.io/badge/Core-C99%20Freestanding-blue.svg)
![Badge WASM](https://img.shields.io/badge/Engine-WebAssembly%20(wasm32)-orange.svg)
![Badge Frontend](https://img.shields.io/badge/Frontend-HTML5%20%7C%20CSS3%20%7C%20Vanilla%20JS-yellow.svg)
![Badge Architecture](https://img.shields.io/badge/Architecture-Data--Driven%20%26%20Copyright--Free-purple.svg)
![Badge VirtualScroll](https://img.shields.io/badge/Performance-60%20FPS%20%7C%205000%2B%20Cards-emerald.svg)
![Badge Tests](https://img.shields.io/badge/Tests-100%25%20Passing-brightgreen.svg)
![Badge License](https://img.shields.io/badge/License-MIT-lightgrey.svg)

---

## 📖 Visão Geral

O **RPG-SheetC v2.0** é uma plataforma e motor para fichas de RPG de mesa (TTRPG) construída sobre uma **arquitetura agnóstica baseada em cards (*Card-Driven Data-Driven Architecture*)**.

Diferente de gerenciadores tradicionais com tabelas engessadas e regras hardcoded para um único sistema proprietário, o RPG-SheetC trata **todo elemento de jogo como um Card modular**:
- 🛡️ **Atributos & Estatísticas**: Força, Destreza, Constituição, Sabedoria, Sanidade, etc.
- 🧪 **Recursos Dinâmicos**: Pontos de Vida (PV), Pontos de Mana (PM), Estresse, Fome.
- ⚔️ **Equipamentos & Armaduras**: Espadas, escudos, anéis mágicos, armaduras pesadas.
- 🔮 **Habilidades, Perícias & Magias**: Ataque Furtivo, Bola de Fogo, Atletismo, Percepção.
- 📜 **Traços & Características**: Raça, Linhagem, Antecedente, Peculiaridades.

### 🕊️ 100% Livre de Direitos Autorais (Copyright-Free Core)
O binário compilado em C e o repositório base contêm **zero propriedade intelectual protegida por direitos autorais**. Nenhuma tabela comercial, monstro, classe ou magia patenteada está gravada no código. O motor fornece uma **máquina de estados e cálculo universal**, enquanto o conteúdo dos sistemas de RPG (D&D 5e, Tormenta 20, Pathfinder, Call of Cthulhu, Vampiro, Cyberpunk, 3D&T ou sistemas autorais) é injetado via **Data Packs comunitários (`.cardpack` / `.json`)**.

---

## ⚡ Por que Arquitetura Híbrida (C99 + WebAssembly + Vanilla JS)?

O RPG-SheetC combina a velocidade determinística de linguagens de sistemas de baixo nível com a conveniência e portabilidade do navegador moderno:

```
┌─────────────────────────────────────────────────────────────┐
│                      NAVEGADOR WEB                          │
│                                                             │
│   [ HTML5 + CSS3 + Vanilla JS (Sem frameworks pesados) ]    │
│    • Virtual Scrolling O(1) (~36 nós DOM para 5.000+ cards) │
│    • Visual Card Editor com live preview de fórmulas        │
│    • Gestor de Data Packs (1-Click Import / Export)         │
│    • LocalStorage + I/O de arquivos (.cardpack / .json)     │
│                              │                              │
│         Ponte WebAssembly (Linear Memory Zero-Copy)         │
│                              │                              │
│   [ Núcleo C99 Freestanding compilado para wasm32 ]         │
│    • Card Deck Engine & Mutadores de Estado                 │
│    • Avaliador de Expressões Matemáticas (@chaves)          │
│    • Parser e Serializador JSON Nativo (Sem dependências)   │
│    • PRNG Criptográfico/Determinístico (Xorshift32)         │
└─────────────────────────────────────────────────────────────┘
```

| Responsabilidade do Sistema | Camada de Execução | Tecnologia |
| :--- | :---: | :---: |
| **Estruturas de Dados dos Cards e Decks** | 🧠 Core C | **C99 Freestanding** |
| **Parser e Avaliador de Fórmulas Matemáticas (`@attr`)** | 🧠 Core C | **C99 Freestanding** |
| **Cálculo Cumulativo de Modificadores (Equip / Unequip)** | 🧠 Core C | **C99 Freestanding** |
| **Serialização e Desserialização de Data Packs JSON** | 🧠 Core C | **C99 Freestanding** |
| **Rolagem de Dados Poliédricos (PRNG Xorshift32)** | 🧠 Core C | **C99 Freestanding** |
| **Exportação C <-> WASM via Ponte de Memória Linear** | 🔌 WebAssembly Bridge | **C99 + wasm-ld** |
| **Virtual Scrolling Engine (Janelamento O(1))** | ⚡ Componente UI | **Vanilla JavaScript** |
| **Editor Visual de Cards & Pré-visualização de Fórmulas** | 🎨 Apresentação | **Vanilla JavaScript** |
| **Gerenciador de Data Packs da Comunidade** | 🌐 Gerenciamento | **Vanilla JavaScript** |
| **Persistência Local e I/O de Arquivos** | 💾 I/O Navegador | **Web Storage & File API** |

> **Portabilidade Total**: Todo o código em `src/core/` é 100% livre de dependências da Web (`-nostdlib`). O mesmo código C pode ser compilado nativamente para Desktop (Windows/Linux/macOS) ou Mobile integrado a motores gráficos como Raylib, Dear ImGui, SDL ou Qt sem alterar uma única linha.

---

## 🌟 Principais Recursos

### 1. 🧮 Motor de Fórmulas Dinâmicas (`card_eval.c`)
As fichas não usam números estáticos: qualquer card pode ter seu valor calculado em tempo real através de expressões matemáticas que referenciam outros cards usando a sintaxe `@card_key`:
- **Modificador de Habilidade clássico**: `floor((@forca - 10) / 2)`
- **Defesa Combinada**: `10 + @des_mod + @armadura + @escudo`
- **Pontos de Vida Escaláveis**: `10 + @con_mod + ((@nivel - 1) * (6 + @con_mod))`
- Suporte a parênteses, precedência de operadores (`*`, `/`, `+`, `-`), funções matemáticas nativas (`floor`, `ceil`, `round`, `abs`, `min`, `max`) e resolução recursiva em C.

### 2. 📜 Virtual Scrolling Engine (`virtual_list.js`)
Projetado para renderizar acervos massivos de compêndios sem perda de performance:
- **Janelamento O(1)**: Renderiza apenas os cards visíveis na tela mais um pequeno buffer de tolerância.
- **5.000+ cards a 60 FPS**: Enquanto uma lista HTML tradicional cria milhares de nós que congelam o navegador, o Virtual Scroller do RPG-SheetC mantém fixos apenas **~36 elementos DOM reciclados**, com consumo ínfimo de memória e tempo de rolagem virtual inferior a **0.01 ms** por frame.

### 3. 🛠️ Editor Visual de Cards
Crie e edite cards diretamente no navegador com interface intuitiva:
- Seleção de categoria: Atributo, Recurso, Estatística, Equipamento, Habilidade, Magia ou Traço.
- Tipo de valor: Inteiro, Flutuante, String, Booleano ou Fórmula Dinâmica.
- Pré-visualização de fórmulas em tempo real com teste instantâneo de resolução.
- Gestão de tags, modificadores de alvos e chave de identificação única.

### 4. 📦 Gerenciador de Data Packs da Comunidade
- **1-Click Import**: Botão de importação instantânea que carrega o **SRD Fantasy Pack** (46 cards neutros e equilibrados).
- **Exportação Universal**: Exporte seu compêndio ou deck da ficha em formato `.cardpack` (JSON padronizado).
- **Mesclagem Inteligente (Merge)**: Importe novos pacotes sem apagar os cards já existentes na ficha.

---

## 👥 Guia da Comunidade: Como Criar e Compartilhar Data Packs

A comunidade pode criar pacotes de conteúdo para qualquer sistema de RPG usando qualquer editor de texto ou o próprio **Editor Visual de Cards** do RPG-SheetC.

### Estrutura do Arquivo `.cardpack` (JSON)

Um arquivo `.cardpack` é um documento JSON estruturado contendo metadados do pacote e um array de cards:

```json
{
  "pack_name": "Grimório Arcano & Equipamentos Clássicos",
  "system_name": "Fantasia Medieval OGL",
  "author": "Comunidade RPG",
  "version": "1.0.0",
  "description": "Pacote básico contendo atributos fundamentais, magias e equipamentos.",
  "cards": [
    {
      "key": "forca",
      "name": "Força",
      "type": "attribute",
      "description": "Poder muscular e capacidade física do personagem.",
      "icon": "fist",
      "value_type": "int",
      "base_value": 14,
      "formula": "",
      "tags": ["atributo", "fisico"],
      "is_equipped": false,
      "modifiers": []
    },
    {
      "key": "for_mod",
      "name": "Modificador de Força",
      "type": "stat",
      "description": "Bônus derivado da pontuação de Força.",
      "icon": "plus",
      "value_type": "formula",
      "base_value": 0,
      "formula": "floor((@forca - 10) / 2)",
      "tags": ["modificador"],
      "is_equipped": false,
      "modifiers": []
    },
    {
      "key": "espada_longa",
      "name": "Espada Longa",
      "type": "equipment",
      "description": "Arma marcial versátil de corte.",
      "icon": "sword",
      "value_type": "int",
      "base_value": 0,
      "formula": "",
      "tags": ["arma", "marcial", "versatil"],
      "is_equipped": true,
      "modifiers": [
        {
          "target_key": "ataque_corpo_a_corpo",
          "operation": "add",
          "value": 1
        }
      ]
    }
  ]
}
```

### Especificação dos Campos do Card

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `key` | `string` | Identificador único e legível por máquina (ex: `"destreza"`, `"espada_longa"`). Usado em fórmulas como `@key`. |
| `name` | `string` | Nome visível do card para exibição na interface (ex: `"Espada Longa +1"`). |
| `type` | `string` | Categoria do card: `"attribute"`, `"resource"`, `"stat"`, `"equipment"`, `"ability"`, `"spell"`, `"trait"`. |
| `description`| `string` | Texto descritivo, regras detalhadas e notas de jogo. |
| `icon` | `string` | Nome do ícone visual temático (ex: `"sword"`, `"shield"`, `"heart"`, `"sparkles"`). |
| `value_type` | `string` | Como o valor é tratado: `"int"`, `"float"`, `"string"`, `"bool"` ou `"formula"`. |
| `base_value` | `number` | Valor numérico fixo de base quando não usa fórmula. |
| `formula` | `string` | Expressão dinâmica avaliada pelo motor C (ex: `"10 + @des_mod + @armadura"`). |
| `tags` | `array` | Lista de strings para categorização e busca rápida (ex: `["magia", "fogo", "nivel3"]`). |
| `is_equipped`| `bool` | Indica se o card está ativo/equipado na ficha. Modificadores só surtem efeito quando equipado. |
| `modifiers` | `array` | Lista de modificadores numéricos aplicados a outros cards quando este card está equipado. |

---

## 🏛️ Estrutura do Repositório

```
RPG-SheetC/
├── src/
│   ├── core/                  # Core 100% C Puro (C99 Freestanding, Zero Libc Externa)
│   │   ├── card_types.h       # Definição das estruturas GameCard, CardDeck, Modifier
│   │   ├── card_engine.h/.c   # Motor de criação, mutação, cálculo e busca de cards
│   │   ├── card_eval.h/.c     # Parser e avaliador de fórmulas dinâmicas (@chaves)
│   │   ├── card_pack.h/.c     # Serializador e parser de pacotes .cardpack JSON
│   │   ├── rpg_base.h/.c      # Funções de memória seguras (memset, memcpy, strncpy)
│   │   └── dice.h/.c          # Gerador de números pseudoaleatórios Xorshift32
│   └── wasm/
│       └── wasm_api.c         # Camada de integração C <-> WebAssembly
├── web/                       # Frontend SPA (Vanilla JS + HTML5 + CSS3)
│   ├── index.html             # Estrutura semântica da aplicação
│   ├── data/
│   │   └── srd_basic_pack.json# Data Pack SRD Fantasy aberto da comunidade (46 cards)
│   ├── css/
│   │   ├── tokens.css         # Variáveis de design tokens (cores, espaçamento, tipografia)
│   │   ├── style.css          # Layout global e componentes base
│   │   ├── views.css          # Telas (Home, Ficha, Compêndio, Editor de Cards)
│   │   ├── card_components.css# Estilização de cards, badges e coleções virtuais
│   │   └── dice_roller.css    # Arena e gaveta retrátil de rolagem de dados
│   ├── js/
│   │   ├── wasm_loader.js     # Ponte de memória linear C <-> WebAssembly
│   │   ├── components/
│   │   │   ├── virtual_list.js# Motor de Virtual Scrolling O(1) de alta performance
│   │   │   ├── card_editor.js # Editor visual e modal de criação de cards
│   │   │   └── dice_roller.js # Rolador poliédrico visual
│   │   ├── services/
│   │   │   ├── pack_manager.js# Gerenciador de download/upload e 1-click import
│   │   │   ├── storage.js     # Persistência e gerenciamento de fichas locais
│   │   │   └── export.js      # Exportação de arquivos e impressão de fichas
│   │   ├── views/
│   │   │   ├── sheet_view.js  # Dashboard modular da ficha baseado em cards
│   │   │   ├── compendium_view.js # Compêndio virtualizado de cards
│   │   │   └── home.js        # Hub inicial
│   │   └── app.js             # Ponto de entrada e orquestrador da SPA
│   └── dist/
│       └── sheetc_core.wasm   # Binário WebAssembly standalone compilado pelo Clang
├── tests/
│   ├── test_cards.c           # Suíte de testes unitários do motor de cards em C99 puro
│   ├── test_virtual_scroll.js # Teste automatizado de Virtual Scrolling (5.000 cards)
│   ├── test_compendium.js     # Teste de integração do Compêndio
│   ├── test_card_editor.js    # Teste de integração do Editor de Cards
│   ├── test_sheet_view.js     # Teste de integração do Dashboard da Ficha
│   └── test_pack_manager.js   # Teste de integração do Gerenciador de Data Packs
├── Makefile                   # Automação de compilação (WASM, Testes C, Testes JS)
└── README.md                  # Este documento
```

---

## 🛠️ Pré-requisitos de Compilação

Para compilar o módulo WebAssembly e executar as suítes de testes:

1. **Clang & LLD** (versão 16+ com suporte a `--target=wasm32` e `wasm-ld`).
2. **GCC** (para compilação nativa dos testes unitários em C).
3. **Make** (`mingw32-make` no Windows ou `make` no Linux/macOS).
4. **Node.js** (versão 18+ para executar os testes automatizados de integração).
5. Qualquer servidor HTTP estático local (Python, Node `serve`, Live Server).

---

## 🚀 Como Compilar e Executar

### 1. Compilar o Binário WebAssembly
Compila os fontes C em modo freestanding (`-nostdlib -O2`) gerando `web/dist/sheetc_core.wasm`:

```bash
mingw32-make wasm
# ou no Linux/macOS:
make wasm
```

### 2. Executar os Testes Unitários em C & Virtual Scroll
Compila o motor de testes com flags de rigor estrito (`-Wall -Wextra -pedantic -std=c99`) e executa as asserções de C e o benchmark de 5.000 cards:

```bash
mingw32-make test
# ou no Linux/macOS:
make test
```

### 3. Executar a Suíte Completa de Qualidade (C + JavaScript)
Executa a validação unitária em C e todas as 5 suítes de integração em Node.js:

```bash
mingw32-make test-all
# ou no Linux/macOS:
make test-all
```

### 4. Executar a Aplicação Web Localmente

Para permitir que o navegador carregue o binário WebAssembly via `fetch` streaming sem restrições de CORS locais, inicie um servidor HTTP estático:

**Opção A — Python 3:**
```bash
cd web
python -m http.server 8000
```
Acesse no navegador: [http://localhost:8000](http://localhost:8000)

**Opção B — Node.js:**
```bash
npx serve web
```

**Opção C — VS Code:**
Clique com o botão direito em `web/index.html` e selecione **Open with Live Server**.

---

## 🧪 Suíte de Testes Automatizados

A suíte de testes do RPG-SheetC valida integralmente todas as camadas do projeto:

- **Motor de Cards em C (`test_cards.c`)**:
  - Inicialização de decks e criação segura de cards.
  - Avaliação de fórmulas dinâmicas simples e compostas com referências a outros cards (`@key`).
  - Ordem de precedência matemática e aninhamento de parênteses.
  - Aplicação acumulada de modificadores ao equipar/desequipar itens.
  - Serialização e integridade do parser JSON em pacotes `.cardpack`.
  - Tratamento defensivo de limites de capacidade e memória estática.
- **Virtual Scrolling (`test_virtual_scroll.js`)**:
  - Benchmark de janelamento com **5.000 cards**.
  - Garantia de renderização com **O(1) nós DOM** (~36 nós reciclados).
  - Execução de rolagem em tempo infinitesimal (< 0.05 ms por atualização).
- **Módulos de Apresentação e I/O**:
  - Compêndio, Editor de Cards, Dashboard da Ficha e Gerenciador de Data Packs.

---

## 🔒 Segurança e Confiabilidade em C

- **Freestanding Puro**: Sem vinculação dinâmica a bibliotecas do sistema operacional hospedeiro.
- **Buffers com Limites Rígidos**: Proteção contra buffer overflows e injeções de memória.
- **Alocação Determinística**: Gestão direta de memória linear sem dependência de garbage collectors lentos.
- **Total Desacoplamento**: O núcleo C não possui dependências com interfaces gráficas nem com APIs do navegador.

---

## 📜 Licença

Distribuído sob a **Licença MIT**. O código é livre para uso pessoal, comercial, modificação e redistribuição pela comunidade de RPG de mesa.