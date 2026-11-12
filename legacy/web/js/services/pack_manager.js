/**
 * pack_manager.js — Gerenciador de Download e Importação de Data Packs Comunitários (RPG-SheetC v2.0)
 * Permite exportar, importar de arquivo e carregar com 1 clique pacotes de regras e compêndios abertos.
 */

// Pacote embutido completo (fallback 100% autossuficiente para offline, file:// e testes Node.js)
const SRD_BASIC_PACK = {
    sheet_name: "SRD Básico / Fantasia Aberta",
    system_name: "Fantasia Aberta d20",
    level: 1,
    xp: 0,
    cards: [
        { id: 1, type: 0, key: "for", name: "Força", desc: "Poder muscular e capacidade de carga.", base: 14, curr: 14, max: 14, equipped: 1 },
        { id: 2, type: 0, key: "des", name: "Destreza", desc: "Agilidade motora e reflexos rápidos.", base: 14, curr: 14, max: 14, equipped: 1 },
        { id: 3, type: 0, key: "con", name: "Constituição", desc: "Vigor biológico e saúde.", base: 14, curr: 14, max: 14, equipped: 1 },
        { id: 4, type: 0, key: "int", name: "Inteligência", desc: "Raciocínio lógico e erudição arcana.", base: 12, curr: 12, max: 12, equipped: 1 },
        { id: 5, type: 0, key: "sab", name: "Sabedoria", desc: "Percepção sensorial e força de vontade.", base: 10, curr: 10, max: 10, equipped: 1 },
        { id: 6, type: 0, key: "car", name: "Carisma", desc: "Presença social e liderança.", base: 10, curr: 10, max: 10, equipped: 1 },
        { id: 7, type: 1, key: "pv", name: "Pontos de Vida", desc: "Vitalidade antes de cair inconsciente.", base: 28, curr: 28, max: 28, equipped: 1 },
        { id: 8, type: 1, key: "pm", name: "Pontos de Mana", desc: "Energia mística para magias e técnicas.", base: 12, curr: 12, max: 12, equipped: 1 },
        { id: 9, type: 1, key: "fadiga", name: "Vigor / Estamina", desc: "Recurso de esforço físico para manobras.", base: 6, curr: 6, max: 6, equipped: 1 },
        { id: 10, type: 2, key: "defesa", name: "Defesa", desc: "Dificuldade para acertar um golpe.", base: 10, curr: 10, max: 10, formula: "10 + (@des - 10) / 2", equipped: 1 },
        { id: 11, type: 2, key: "iniciativa", name: "Iniciativa", desc: "Reação rápida ao combate.", base: 0, curr: 0, max: 0, formula: "(@des - 10) / 2", equipped: 1 },
        { id: 12, type: 2, key: "deslocamento", name: "Deslocamento", desc: "Velocidade em metros por rodada.", base: 9, curr: 9, max: 9, equipped: 1 },
        { id: 13, type: 5, key: "adaga", name: "Adaga de Aço", desc: "Arma leve e rápida para corpo a corpo ou arremesso.", formula: "1d4 + (@des - 10) / 2", equipped: 0 },
        { id: 14, type: 5, key: "espada_curta", name: "Espada Curta", desc: "Lâmina de estocada ágil e equilibrada.", formula: "1d6 + (@des - 10) / 2", equipped: 0 },
        { id: 15, type: 5, key: "espada_longa", name: "Espada Longa Forjada", desc: "Arma marcial versátil de aço.", formula: "1d8 + (@for - 10) / 2", equipped: 1 },
        { id: 16, type: 5, key: "machado_batalha", name: "Machado de Batalha", desc: "Lâmina curva pesada que desmembra defesas.", formula: "1d10 + (@for - 10) / 2", equipped: 0 },
        { id: 17, type: 5, key: "arco_curto", name: "Arco Curto de Caça", desc: "Arco flexível para disparos médios.", formula: "1d6 + (@des - 10) / 2", equipped: 0 },
        { id: 18, type: 5, key: "armadura_couro", name: "Armadura de Couro Fervido", desc: "Couro endurecido (+2 Defesa).", equipped: 1, mods: [{ target: "defesa", val: 2 }] },
        { id: 19, type: 5, key: "cota_malha", name: "Cota de Malha Reforçada", desc: "Entrelaçado de anéis de ferro (+5 Defesa).", equipped: 0, mods: [{ target: "defesa", val: 5 }] },
        { id: 20, type: 5, key: "armadura_placas", name: "Armadura Completa de Placas", desc: "Blindagem de aço maciço (+8 Defesa).", equipped: 0, mods: [{ target: "defesa", val: 8 }] },
        { id: 21, type: 5, key: "escudo_leves", name: "Escudo Redondo de Carvalho", desc: "Escudo leve para defesa ágil (+1 Defesa).", equipped: 0, mods: [{ target: "defesa", val: 1 }] },
        { id: 22, type: 5, key: "escudo_pesado", name: "Escudo de Infantaria Pesado", desc: "Broquel de carvalho e aço (+2 Defesa).", equipped: 0, mods: [{ target: "defesa", val: 2 }] },
        { id: 23, type: 5, key: "anel_tita", name: "Anel do Titã", desc: "Relíquia com runa de força (+2 Força).", equipped: 0, mods: [{ target: "for", val: 2 }] },
        { id: 24, type: 5, key: "amuleto_vida", name: "Amuleto de Vitalidade", desc: "Pedra carmesim que revigora (+10 PV).", equipped: 0, mods: [{ target: "pv", val: 10 }] },
        { id: 25, type: 6, key: "dardos_forca", name: "Dardos de Força Mística", desc: "Projéteis mágicos teleguiados.", cost_res: "pm", cost_val: 1, formula: "3d4 + 3" },
        { id: 26, type: 6, key: "cura_ferimentos", name: "Canalizar Cura Vital", desc: "Restaura vitalidade de aliados.", cost_res: "pm", cost_val: 1, formula: "1d8 + (@sab - 10) / 2" },
        { id: 27, type: 6, key: "esfera_fogo", name: "Esfera Incandescente", desc: "Explosão de chamas ardentes.", cost_res: "pm", cost_val: 2, formula: "3d6 + (@int - 10) / 2" },
        { id: 28, type: 6, key: "escudo_mistico", name: "Barreira Translúcida", desc: "Manto de força arcana (+3 Defesa).", cost_res: "pm", cost_val: 1, equipped: 0, mods: [{ target: "defesa", val: 3 }] },
        { id: 29, type: 6, key: "toque_eletrico", name: "Descarga Fulminante", desc: "Choque elétrico pelo toque.", cost_res: "pm", cost_val: 1, formula: "2d8 + (@int - 10) / 2" },
        { id: 30, type: 6, key: "raio_glacial", name: "Raio Glacial Congelante", desc: "Raio de frio extremo que perfura e retarda.", cost_res: "pm", cost_val: 1, formula: "1d10 + (@int - 10) / 2" },
        { id: 31, type: 4, key: "segundo_folego", name: "Segundo Fôlego", desc: "Recupera vigor no calor da batalha.", cost_res: "fadiga", cost_val: 1, formula: "1d10 + 2" },
        { id: 32, type: 4, key: "postura_furia", name: "Postura de Fúria", desc: "Ira que aumenta força bruta (+2 Força).", cost_res: "fadiga", cost_val: 1, equipped: 0, mods: [{ target: "for", val: 2 }] },
        { id: 33, type: 4, key: "esquiva_agil", name: "Reflexo Acrobático", desc: "Antecipa trajetórias de golpes (+2 Defesa).", cost_res: "fadiga", cost_val: 1, equipped: 0, mods: [{ target: "defesa", val: 2 }] },
        { id: 34, type: 4, key: "ataque_furtivo", name: "Ataque Furtivo de Emboscada", desc: "Dano massivo ao atingir alvo distraído.", formula: "2d6" },
        { id: 35, type: 3, key: "atletismo", name: "Atletismo", desc: "Correr, escalar e nadar.", formula: "(@for - 10) / 2", trained: 1 },
        { id: 36, type: 3, key: "acrobacia", name: "Acrobacia", desc: "Equilíbrio em superfícies e amortecimento de quedas.", formula: "(@des - 10) / 2", trained: 1 },
        { id: 37, type: 3, key: "furtividade", name: "Furtividade", desc: "Mover-se silenciosamente nas sombras.", formula: "(@des - 10) / 2", trained: 0 },
        { id: 38, type: 3, key: "conhecimento", name: "Conhecimento & História", desc: "Lembrança de lendas antigas e geografia.", formula: "(@int - 10) / 2", trained: 0 },
        { id: 39, type: 3, key: "investigacao", name: "Investigação", desc: "Procurar pistas ocultas e deduzir conexões.", formula: "(@int - 10) / 2", trained: 0 },
        { id: 40, type: 3, key: "natureza", name: "Natureza & Sobrevivência", desc: "Rastrear pegadas e fauna.", formula: "(@sab - 10) / 2", trained: 0 },
        { id: 41, type: 3, key: "percepcao", name: "Percepção", desc: "Notar perigos e detalhes visuais.", formula: "(@sab - 10) / 2", trained: 1 },
        { id: 42, type: 3, key: "persuasao", name: "Persuasão & Diplomacia", desc: "Negociar de maneira cortês e empática.", formula: "(@car - 10) / 2", trained: 0 },
        { id: 43, type: 3, key: "intimidacao", name: "Intimidação", desc: "Coagir e impor autoridade por presença.", formula: "(@car - 10) / 2", trained: 0 },
        { id: 44, type: 7, key: "visao_penumbra", name: "Visão na Penumbra", desc: "Enxerga na penumbra e luz fraca.", equipped: 1 },
        { id: 45, type: 7, key: "vigor_anao", name: "Resiliência Pétrea", desc: "Resistência a toxinas e venenos (+1 Constituição).", equipped: 0, mods: [{ target: "con", val: 1 }] },
        { id: 46, type: 7, key: "graca_elfica", name: "Graça Silvestre", desc: "Reflexos apurados e leveza natural (+1 Destreza).", equipped: 0, mods: [{ target: "des", val: 1 }] }
    ]
};

class PackManager {
    constructor(engine, logger) {
        this.engine = engine;
        this.logger = logger || console.log;
    }

    /**
     * Retorna a lista de pacotes comunitários abertos pré-configurados
     */
    getAvailablePacks() {
        return [
            {
                id: 'srd_basic',
                name: 'SRD Básico / Fantasia Aberta',
                version: '2.0.0',
                author: 'Comunidade RPG-SheetC (Aberto / CC0)',
                desc: 'Kit completo de fantasia d20 neutro livre de copyright. Contém atributos, recursos de combate, armas, armaduras dinâmicas com recálculo de defesa, magias, técnicas e perícias.',
                url: './data/srd_basic_pack.json',
                cardCount: SRD_BASIC_PACK.cards.length,
                tags: ['D20', 'Fantasia', 'SRD', 'Equipamentos', 'Magias', 'Perícias']
            }
        ];
    }

    /**
     * Exporta o deck ativo no motor C e aciona download de arquivo .cardpack
     * @param {string} customFilename
     * @returns {Object} { filename, bytes, content }
     */
    exportPack(customFilename = null) {
        if (!this.engine || !this.engine.isLoaded) {
            throw new Error('Motor C não está carregado.');
        }

        const rawJson = this.engine.exportCardPack(true);
        if (!rawJson) {
            throw new Error('Falha ao serializar o pacote de cards no motor C.');
        }

        const charName = this.engine.getCharacterName() || 'personagem';
        const sanitized = charName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        const filename = customFilename || `${sanitized}.cardpack`;

        // No navegador, aciona download
        if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof Blob !== 'undefined') {
            try {
                const blob = new Blob([rawJson], { type: 'application/json;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                if (typeof a.click === 'function') {
                    a.click();
                }
                setTimeout(() => URL.revokeObjectURL(url), 2000);
            } catch (err) {
                console.warn('[PackManager] Fallback de download acionado:', err);
            }
        }

        this.logger(`[PackManager] Pacote "${filename}" exportado com sucesso (${rawJson.length} bytes).`, 'success');
        return { filename, bytes: rawJson.length, content: rawJson };
    }

    /**
     * Importa um pacote a partir de string JSON ou objeto JS
     * @param {string|Object} packData
     * @param {boolean} mergeMode Se true, mescla sobre os cards atuais; se false, substitui o deck
     * @returns {Object} { success, count, message }
     */
    importFromText(packData, mergeMode = true) {
        if (!this.engine || !this.engine.isLoaded) {
            throw new Error('Motor C não está carregado.');
        }

        let parsed = packData;
        if (typeof packData === 'string') {
            try {
                parsed = JSON.parse(packData);
            } catch (err) {
                const msg = `JSON inválido no arquivo de pacote: ${err.message}`;
                this.logger(`[PackManager Error] ${msg}`, 'error');
                return { success: false, count: 0, error: msg };
            }
        }

        const count = this.engine.importCardPack(parsed, mergeMode);
        if (count >= 0) {
            this.engine.recalculate();
            const msg = `Pacote comunitário importado com sucesso! ${count} cards integrados na memória do C.`;
            this.logger(`[PackManager] ${msg}`, 'success');
            return { success: true, count, message: msg };
        } else {
            const msg = `Falha ao importar pacote no motor C (Código de erro: ${count}).`;
            this.logger(`[PackManager Error] ${msg}`, 'error');
            return { success: false, count: 0, error: msg };
        }
    }

    /**
     * Lê um arquivo local via FileReader e realiza a importação
     * @param {File|Blob} file
     * @param {boolean} mergeMode
     * @returns {Promise<Object>}
     */
    async importFromFile(file, mergeMode = true) {
        if (!file) {
            return { success: false, count: 0, error: 'Nenhum arquivo fornecido.' };
        }

        try {
            let text = '';
            if (typeof file.text === 'function') {
                text = await file.text();
            } else {
                text = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(reader.error);
                    reader.readAsText(file);
                });
            }
            return this.importFromText(text, mergeMode);
        } catch (err) {
            const msg = `Erro ao ler arquivo: ${err.message}`;
            this.logger(`[PackManager Error] ${msg}`, 'error');
            return { success: false, count: 0, error: msg };
        }
    }

    /**
     * Abre a caixa de diálogo nativa do navegador para seleção de arquivo .cardpack / .json
     */
    promptImportFile(callback, mergeMode = true) {
        if (typeof document === 'undefined') return;

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.cardpack,.json';
        input.style.display = 'none';

        input.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) {
                const res = await this.importFromFile(file, mergeMode);
                if (typeof callback === 'function') {
                    callback(res);
                }
            }
            input.remove();
        });

        document.body.appendChild(input);
        if (typeof input.click === 'function') {
            input.click();
        }
    }

    /**
     * Importação com 1 clique de um pacote comunitário aberto (ex: SRD Básico)
     * @param {string} packId 'srd_basic' ou caminho de arquivo
     * @param {boolean} mergeMode
     * @returns {Promise<Object>}
     */
    async loadCommunityPack(packId = 'srd_basic', mergeMode = true) {
        this.logger(`[PackManager] Baixando e importando pacote comunitário "${packId}"...`, 'info');

        let packJson = null;

        // 1. Em Node.js com fs disponível, lê o arquivo local do disco
        if (typeof require !== 'undefined' && typeof process !== 'undefined') {
            try {
                const fs = require('fs');
                const path = require('path');
                const targetPath = path.resolve(__dirname, '../../data/srd_basic_pack.json');
                if (fs.existsSync(targetPath)) {
                    packJson = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
                }
            } catch (fsErr) {
                // continua com fallback
            }
        }

        // 2. No navegador, tenta carregar via fetch HTTP
        if (!packJson && typeof window !== 'undefined' && typeof fetch === 'function') {
            try {
                const url = packId.endsWith('.json') ? packId : './data/srd_basic_pack.json';
                const res = await fetch(url);
                if (res.ok) {
                    packJson = await res.json();
                }
            } catch (fetchErr) {
                console.warn('[PackManager] fetch indisponível ou offline, usando pacote embutido:', fetchErr.message);
            }
        }

        // 3. Fallback embutido com integridade total
        if (!packJson) {
            packJson = SRD_BASIC_PACK;
        }

        const result = this.importFromText(packJson, mergeMode);
        if (result.success) {
            const packName = packJson.sheet_name || 'SRD Básico / Fantasia Aberta';
            this.logger(`[PackManager] Pacote "${packName}" aplicado com 1 clique! (${result.count} cards no Compêndio).`, 'success');

            // Sincroniza com a coleção do Compêndio para listagem e seleção no Criador
            if (typeof window !== 'undefined' && window.compendiumView && typeof window.compendiumView.addOrUpdatePack === 'function') {
                const compPack = {
                    id: packJson.pack_id || 'srd_community_pack',
                    name: packName,
                    system: packJson.system_name || packJson.system || 'Fantasia Aberta d20',
                    author: packJson.author || 'Comunidade RPG-SheetC',
                    version: packJson.version || '2.0.0',
                    desc: packJson.desc || 'Pacote importado de Data Pack Comunitário.',
                    cards: Array.isArray(packJson.cards) ? packJson.cards : [],
                    createdAt: Date.now()
                };
                window.compendiumView.addOrUpdatePack(compPack);
            }

            return { ...result, packName };
        }
        return result;
    }

    /**
     * Renderiza e exibe modal interativo de Data Packs Comunitários
     */
    openPackModal(onImportSuccess = null) {
        if (typeof document === 'undefined') return;

        let modal = document.getElementById('community-packs-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'community-packs-modal';
            modal.className = 'modal-backdrop';
            modal.style.display = 'flex';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100vw';
            modal.style.height = '100vh';
            modal.style.backgroundColor = 'rgba(0,0,0,0.75)';
            modal.style.zIndex = '10000';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.padding = '20px';
            modal.style.boxSizing = 'border-box';
            document.body.appendChild(modal);
        }

        const packs = this.getAvailablePacks();

        modal.innerHTML = `
            <div class="card modal-content" style="max-width: 680px; width: 100%; max-height: 90vh; overflow-y: auto; background: var(--color-surface-card, #1a1e27); border: 1px solid var(--color-border-subtle, #2a303d); border-radius: 12px; padding: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.6);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px;">
                    <div>
                        <h3 style="font-family: var(--font-heading); color: var(--color-gold-primary, #d4a373); margin: 0; font-size: 1.3rem;">
                            📦 Data Packs Comunitários
                        </h3>
                        <span style="font-size: 0.8rem; color: var(--color-text-dim, #94a3b8);">
                            Importe compêndios e conjuntos completos de regras com 1 clique
                        </span>
                    </div>
                    <button type="button" id="btn-close-packs-modal" class="btn btn-sm" style="font-size: 1.1rem; padding: 4px 10px;">✕</button>
                </div>

                <div class="packs-list" style="display: flex; flex-direction: column; gap: 14px;">
                    ${packs.map(p => `
                        <div class="card" style="background: var(--color-surface-inset, #111318); border: 1px solid var(--color-border-subtle, #2a303d); border-radius: 8px; padding: 16px;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px;">
                                <div>
                                    <strong style="font-size: 1.05rem; color: var(--color-parchment-light, #f1f5f9);">${p.name}</strong>
                                    <span style="font-size: 0.72rem; color: #4ade80; background: rgba(34,197,94,0.12); padding: 2px 6px; border-radius: 4px; margin-left: 6px;">v${p.version}</span>
                                </div>
                                <span style="font-size: 0.75rem; color: var(--color-gold-primary, #d4a373); font-weight: 700;">
                                    🃏 ${p.cardCount} Cards
                                </span>
                            </div>
                            <p style="font-size: 0.82rem; color: var(--color-text-muted, #94a3b8); line-height: 1.4; margin: 0 0 12px 0;">
                                ${p.desc}
                            </p>
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                                <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                                    ${p.tags.map(t => `<span class="card-chip" style="font-size: 0.65rem;">#${t}</span>`).join('')}
                                </div>
                                <button type="button" class="btn btn-primary btn-sm btn-install-pack" data-pack-id="${p.id}" style="font-weight: 700; padding: 6px 14px;">
                                    ⚡ Importar com 1 Clique
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center;">
                    <button type="button" id="btn-import-custom-file" class="btn" style="font-size: 0.82rem;">
                        📁 Carregar Arquivo do Meu Computador (.cardpack)
                    </button>
                    <button type="button" id="btn-cancel-packs-modal" class="btn btn-sm">Fechar</button>
                </div>
            </div>
        `;

        modal.style.display = 'flex';

        // Ouvintes de fechamento
        const closeModal = () => { modal.style.display = 'none'; };
        const btnClose = modal.querySelector('#btn-close-packs-modal');
        const btnCancel = modal.querySelector('#btn-cancel-packs-modal');
        if (btnClose) btnClose.onclick = closeModal;
        if (btnCancel) btnCancel.onclick = closeModal;

        // Ouvinte do botão de 1 clique
        modal.querySelectorAll('.btn-install-pack').forEach(btn => {
            btn.onclick = async () => {
                const packId = btn.dataset.packId;
                btn.disabled = true;
                btn.textContent = '⏳ Importando...';
                try {
                    const res = await this.loadCommunityPack(packId, true);
                    if (res.success) {
                        btn.textContent = '✅ Importado!';
                        setTimeout(() => {
                            closeModal();
                            if (window.sheetView) {
                                window.sheetView.showingRoster = false;
                                window.sheetView.render();
                            }
                            if (typeof onImportSuccess === 'function') {
                                onImportSuccess(res);
                            }
                        }, 800);
                    } else {
                        btn.textContent = '❌ Erro ao Importar';
                        alert(`Erro: ${res.error}`);
                        btn.disabled = false;
                    }
                } catch (err) {
                    btn.textContent = '❌ Falha';
                    alert(`Falha: ${err.message}`);
                    btn.disabled = false;
                }
            };
        });

        // Ouvinte para arquivo customizado do computador
        const btnCustom = modal.querySelector('#btn-import-custom-file');
        if (btnCustom) {
            btnCustom.onclick = () => {
                this.promptImportFile((res) => {
                    if (res.success) {
                        closeModal();
                        if (typeof onImportSuccess === 'function') {
                            onImportSuccess(res);
                        }
                    } else {
                        alert(`Erro ao importar arquivo: ${res.error}`);
                    }
                }, true);
            };
        }
    }
}

// Expõe globalmente no navegador e no Node.js
if (typeof window !== 'undefined') {
    window.PackManager = PackManager;
    window.SRD_BASIC_PACK = SRD_BASIC_PACK;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PackManager, SRD_BASIC_PACK };
}