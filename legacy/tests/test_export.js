/**
 * Teste automatizado de exportação (.sheetc / JSON) e importação
 * Valida o serviço CharacterExportService integrado ao binário WebAssembly real
 */

const fs = require('fs');
const path = require('path');

// Mock de localStorage
class LocalStorageMock {
    constructor() { this.store = {}; }
    getItem(key) { return this.store[key] || null; }
    setItem(key, value) { this.store[key] = String(value); }
    removeItem(key) { delete this.store[key]; }
    clear() { this.store = {}; }
}
global.localStorage = new LocalStorageMock();
global.window = global;

// Mock de Blob / URL para ambiente Node.js
class BlobMock {
    constructor(chunks, options) {
        this.content = chunks.join('');
        this.type = options?.type || '';
    }
    text() {
        return Promise.resolve(this.content);
    }
}
global.Blob = BlobMock;

global.URL = {
    createObjectURL: () => 'blob:mock-url',
    revokeObjectURL: () => {}
};

// Carrega scripts
const wasmLoaderCode = fs.readFileSync(path.join(__dirname, '../web/js/wasm_loader.js'), 'utf-8');
eval(wasmLoaderCode);

const storageCode = fs.readFileSync(path.join(__dirname, '../web/js/services/storage.js'), 'utf-8');
eval(storageCode);

const exportCode = fs.readFileSync(path.join(__dirname, '../web/js/services/export.js'), 'utf-8');
eval(exportCode);

async function runExportTests() {
    console.log('=== Teste de Exportação (.sheetc) e Importação (Passo 5.2) ===');

    // 1. Carrega motor WASM real
    const wasmPath = path.join(__dirname, '../web/dist/sheetc_core.wasm');
    const wasmBytes = fs.readFileSync(wasmPath);
    const engine = new SheetCWasm();
    await engine.load(wasmBytes);

    console.log('  [OK] Motor WebAssembly carregado com sucesso!');

    // 2. Configura personagem customizado no motor C
    engine.setCharacterName('Sir Thorgar');
    engine.setLevel(7);
    engine.setAttribute(0, 18); // FOR 18 (+4)
    engine.setAttribute(1, 14); // DES 14 (+2)
    engine.setAttribute(2, 16); // CON 16 (+3)
    engine.setBonusArmadura(6);
    engine.setBonusEscudo(2);
    engine.setSkillTrained(0, true); // Acrobacia treinada
    engine.setSkillTrained(1, true); // Adestramento treinado

    const pvExpected = engine.getPvMax();
    const defenseExpected = engine.getDefesa();

    // 3. Exporta para arquivo
    const { filename, data } = CharacterExportService.exportToFile(engine);
    if (!filename.includes('sir_thorgar') || !filename.endsWith('.sheetc')) {
        throw new Error(`Nome de arquivo inesperado: ${filename}`);
    }
    if (data.format !== 'RPG-SheetC' || !data.sheet || data.sheet.nome !== 'Sir Thorgar') {
        throw new Error('Payload exportado incorreto');
    }
    if (data.sheet.nivel !== 7) {
        throw new Error('Nível exportado incorreto');
    }
    console.log(`  [OK] Exportação gerou "${filename}" com envelope de metadados válido.`);

    // 4. Cria arquivo mock simulando o arquivo baixado
    const fileMock = {
        name: filename,
        text: async () => JSON.stringify(data)
    };

    // 5. Reinicializa o motor C para valores padrão para provar que a importação restaura tudo
    engine.newDefaultCharacter(0, 0); // Humano Arcanista nivel 1
    if (engine.getCharacterName() === 'Sir Thorgar') {
        throw new Error('Reset de teste falhou');
    }

    // 6. Importa o arquivo de volta para o motor C com persistência no storage
    const storage = new CharacterStorage();
    const importResult = await CharacterExportService.importFromFile(fileMock, engine, storage);

    if (!importResult.success || importResult.characterName !== 'Sir Thorgar') {
        throw new Error('Falha no resultado da importação');
    }

    // Valida memória do C após importação
    if (engine.getCharacterName() !== 'Sir Thorgar') {
        throw new Error('Nome no C não foi restaurado');
    }
    if (engine.getLevel() !== 7) {
        throw new Error('Nível no C não foi restaurado');
    }
    if (engine.getAttribute(0) !== 18) {
        throw new Error('Atributo FOR não foi restaurado');
    }
    if (engine.getDefesa() !== defenseExpected) {
        throw new Error(`Defesa esperada ${defenseExpected}, obtida ${engine.getDefesa()}`);
    }
    if (engine.getPvMax() !== pvExpected) {
        throw new Error(`PV Max esperado ${pvExpected}, obtido ${engine.getPvMax()}`);
    }
    if (!engine.isSkillTrained(0) || !engine.isSkillTrained(1)) {
        throw new Error('Perícias treinadas não foram restauradas');
    }
    console.log('  [OK] Importação restaurou 100% dos dados na memória linear do motor C.');

    // 7. Valida persistência automática no storage
    const savedInStorage = storage.getAllSheets();
    if (savedInStorage.length !== 1 || savedInStorage[0].name !== 'Sir Thorgar') {
        throw new Error('Ficha importada não foi salva automaticamente no storage');
    }
    console.log('  [OK] Ficha importada foi persistida no localStorage com sucesso.');

    // 8. Teste de compatibilidade com JSON puro direto (sem wrapper "sheet")
    const rawJsonMock = {
        name: 'raw_hero.json',
        text: async () => JSON.stringify({
            nome: 'Kaelen',
            raca_id: 1,
            classe_id: 2,
            nivel: 3,
            atributos: [12, 16, 14, 10, 10, 12],
            pv_atual: 25,
            pv_max: 25,
            pm_atual: 15,
            pm_max: 15,
            defesa: 13,
            xp: 3000
        })
    };

    const rawImportRes = await CharacterExportService.importFromFile(rawJsonMock, engine, storage);
    if (!rawImportRes.success || engine.getCharacterName() !== 'Kaelen' || engine.getLevel() !== 3) {
        throw new Error('Importação de JSON bruto falhou');
    }
    console.log('  [OK] Compatibilidade bidirecional com JSON bruto validada com sucesso.');

    // 9. Validação de rejeição de arquivos corrompidos
    const corruptFile = {
        name: 'corrupted.json',
        text: async () => '{"invalido": true'
    };
    try {
        await CharacterExportService.importFromFile(corruptFile, engine, storage);
        throw new Error('Deveria ter lançado erro para JSON corrompido');
    } catch (e) {
        if (!e.message.includes('JSON inválido')) throw e;
        console.log('  [OK] Arquivo JSON corrompido rejeitado corretamente com mensagem amigável.');
    }

    console.log('\n=== Todos os testes de Exportação e Importação passaram com 100% de sucesso! ===\n');
}

runExportTests().catch(err => {
    console.error('ERRO NO TESTE:', err);
    process.exit(1);
});