/**
 * export.js — Serviço de Exportação (.sheetc / JSON), Importação e Impressão em PDF
 * RPG-SheetC — Conectado ao Motor C99 via WebAssembly
 */

class CharacterExportService {
    /**
     * Exporta o personagem ativo no motor C para download como arquivo .sheetc (JSON)
     * @param {Object} engine - Instância SheetCWasm
     * @param {string|null} customFilename - Nome customizado opcional
     * @returns {Object} { filename, data }
     */
    static exportToFile(engine, customFilename = null) {
        if (!engine || !engine.isLoaded) {
            throw new Error('Motor C não está carregado.');
        }

        const sheetData = engine.exportJson();
        if (!sheetData) {
            throw new Error('Não foi possível obter dados da ficha do motor C.');
        }

        const charName = sheetData.nome || engine.getCharacterName() || 'heroi';
        const systemName = (sheetData.sistema_id === 1) ? 'Agnostico_v2' : 'RPG';

        // Prepara envelope completo com metadados de exportação
        const payload = {
            format: 'RPG-SheetC',
            version: '2.0.0',
            exportedAt: new Date().toISOString(),
            engine: 'C99 Freestanding WebAssembly',
            system: systemName,
            systemId: sheetData.sistema_id || 1,
            sheet: sheetData
        };

        const jsonString = JSON.stringify(payload, null, 2);

        // Gera nome de arquivo amigável e higienizado
        const sanitizedName = charName.toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
        const filename = customFilename || `${sanitizedName}.sheetc`;

        // Dispara o download no navegador
        if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
            try {
                const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = filename;
                anchor.style.display = 'none';
                document.body.appendChild(anchor);
                anchor.click();
                document.body.removeChild(anchor);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            } catch (e) {}
        }

        return { filename, data: payload, jsonString };
    }

    /**
     * Processa um arquivo (.sheetc ou .json) e importa para o motor C e storage
     * @param {File} file 
     * @param {Object} engine 
     * @param {Object|null} storage 
     * @returns {Promise<Object>}
     */
    static async importFromFile(file, engine, storage = null) {
        if (!file) {
            throw new Error('Nenhum arquivo fornecido para importação.');
        }
        if (!engine || !engine.isLoaded) {
            throw new Error('Motor C não está pronto para receber dados.');
        }

        const text = await file.text();
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (err) {
            throw new Error('Arquivo corrompido: formato JSON inválido.');
        }

        // Suporta tanto o envelope com metadados { sheet: { ... } } quanto JSON puro { nome: ... }
        const sheetData = parsed.sheet ? parsed.sheet : parsed;

        if (!sheetData || typeof sheetData !== 'object') {
            throw new Error('Conteúdo da ficha inválido ou ausente no arquivo.');
        }

        // Validação mínima de sanidade de dados para ficha C
        if (typeof sheetData.nome !== 'string' && !Array.isArray(sheetData.atributos)) {
            throw new Error('O arquivo não parece ser uma ficha válida do RPG-SheetC.');
        }

        // Importa para o motor C
        const success = engine.importJson(sheetData);
        if (!success) {
            throw new Error('O motor C rejeitou os dados da ficha.');
        }

        // Se storage foi passado, salva a nova ficha no navegador e a define como ativa
        let savedRecord = null;
        if (storage && typeof storage.saveCurrent === 'function') {
            try {
                savedRecord = storage.saveCurrent(engine, sheetData.nome, true);
            } catch (saveErr) {
                console.warn('Aviso ao salvar ficha importada no storage:', saveErr);
            }
        }

        return {
            success: true,
            characterName: sheetData.nome || engine.getCharacterName(),
            sheetData: sheetData,
            storageRecord: savedRecord
        };
    }

    /**
     * Abre caixa de seleção de arquivo do navegador para importar
     * @param {Object} engine 
     * @param {Object|null} storage 
     * @param {Function|null} onComplete Callback({ success, characterName, error })
     */
    static promptImportFile(engine, storage = null, onComplete = null) {
        if (typeof document === 'undefined') return;

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.sheetc,.json';
        input.style.display = 'none';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const res = await CharacterExportService.importFromFile(file, engine, storage);
                if (typeof onComplete === 'function') {
                    onComplete(res);
                }
            } catch (err) {
                if (typeof onComplete === 'function') {
                    onComplete({ success: false, error: err.message });
                } else {
                    alert(`Erro na importação: ${err.message}`);
                }
            } finally {
                if (input.parentNode) {
                    input.parentNode.removeChild(input);
                }
            }
        };

        document.body.appendChild(input);
        input.click();
    }

    /**
     * Prepara a tela e aciona a impressão do navegador (geração de PDF nativo)
     * @param {Object|null} router - Roteador SPA opcional para garantir que a aba da ficha esteja visível
     */
    static printSheet(router = null) {
        if (router && typeof router.navigate === 'function') {
            router.navigate('sheet');
        }
        // Pequeno atraso para garantir renderização do DOM antes da impressão
        setTimeout(() => {
            if (typeof window !== 'undefined' && typeof window.print === 'function') {
                window.print();
            }
        }, 150);
    }
}

// Expõe globalmente e para Node.js
if (typeof window !== 'undefined') {
    window.CharacterExportService = CharacterExportService;
    window.SheetExporter = CharacterExportService;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CharacterExportService, SheetExporter: CharacterExportService };
}