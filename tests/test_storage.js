/**
 * Teste automatizado de persistência e gerenciamento local (storage.js)
 * Simula localStorage e valida a integração com o binário WebAssembly real (sheetc_core.wasm)
 */

const fs = require('fs');
const path = require('path');

// Mock simples e fiel de localStorage
class LocalStorageMock {
    constructor() {
        this.store = {};
    }
    getItem(key) {
        return this.store[key] || null;
    }
    setItem(key, value) {
        this.store[key] = String(value);
    }
    removeItem(key) {
        delete this.store[key];
    }
    clear() {
        this.store = {};
    }
}

global.localStorage = new LocalStorageMock();
global.window = global;

// Carrega o carregador WASM
const wasmLoaderCode = fs.readFileSync(path.join(__dirname, '../web/js/wasm_loader.js'), 'utf-8');
eval(wasmLoaderCode);

// Carrega o storage.js
const storageCode = fs.readFileSync(path.join(__dirname, '../web/js/services/storage.js'), 'utf-8');
eval(storageCode);

async function runStorageTests() {
    console.log('=== Teste de Persistência Local (Passo 5.1) ===');

    // 1. Inicializa o motor WASM real
    const wasmPath = path.join(__dirname, '../web/dist/sheetc_core.wasm');
    const wasmBytes = fs.readFileSync(wasmPath);
    const engine = new SheetCWasm();
    await engine.load(wasmBytes);

    console.log('  [OK] Motor WebAssembly carregado com sucesso!');

    // 2. Instancia o CharacterStorage
    const storage = new CharacterStorage();
    let changeNotified = false;
    storage.onChange(() => { changeNotified = true; });

    // Estado inicial vazio
    if (storage.getAllSheets().length !== 0) {
        throw new Error('Storage deveria iniciar vazio');
    }
    console.log('  [OK] Storage inicializa vazio');

    // 3. Salva a ficha padrão atual do motor C
    const sheet1 = storage.saveCurrent(engine, 'Valeros, o Guerreiro');
    if (!sheet1.id || sheet1.name !== 'Valeros, o Guerreiro') {
        throw new Error('Falha ao salvar ficha 1');
    }
    if (storage.getAllSheets().length !== 1) {
        throw new Error('Deveria conter 1 ficha');
    }
    if (storage.getActiveSheetId() !== sheet1.id) {
        throw new Error('Ficha 1 deveria ser a ativa');
    }
    if (!changeNotified) {
        throw new Error('Deveria disparar notificação onChange');
    }
    console.log('  [OK] Ficha 1 salva no localStorage com sucesso');

    // 4. Modifica o personagem no motor C e salva como nova ficha (forceNew = true)
    engine.setCharacterName('Lorian, o Arcanista');
    engine.setLevel(5);
    engine.setAttribute(3, 18); // INT 18
    engine.modifyPv(-10);

    const sheet2 = storage.saveCurrent(engine, 'Lorian, o Arcanista', true);
    if (!sheet2.id || sheet2.name !== 'Lorian, o Arcanista') {
        throw new Error('Falha ao salvar ficha 2');
    }
    if (storage.getAllSheets().length !== 2) {
        throw new Error('Deveria conter 2 fichas');
    }
    console.log('  [OK] Ficha 2 criada e salva com sucesso');

    // 5. Alterna entre fichas: carrega a Ficha 1 de volta no motor C
    const loaded1 = storage.loadSheet(sheet1.id, engine);
    if (!loaded1 || loaded1.id !== sheet1.id) {
        throw new Error('Falha ao recarregar ficha 1');
    }
    // Verifica se a memória do C foi restaurada
    const currentNameInC = engine.getCharacterName();
    if (currentNameInC !== 'Valeros, o Guerreiro') {
        throw new Error(`Esperado nome "Valeros, o Guerreiro", obtido "${currentNameInC}"`);
    }
    console.log('  [OK] Alternância de fichas com importação direta na memória linear do C');

    // 6. Renomear ficha
    const renamed = storage.renameSheet(sheet1.id, 'Valeros, Lorde de Deheon', engine);
    if (!renamed || renamed.name !== 'Valeros, Lorde de Deheon') {
        throw new Error('Falha ao renomear ficha');
    }
    if (engine.getCharacterName() !== 'Valeros, Lorde de Deheon') {
        throw new Error('Nome no C não foi sincronizado ao renomear');
    }
    console.log('  [OK] Renomeação sincronizada com o motor C');

    // 7. Duplicar ficha
    const clone = storage.duplicateSheet(sheet1.id);
    if (!clone || clone.id === sheet1.id || clone.name !== 'Cópia de Valeros, Lorde de Deheon') {
        throw new Error('Falha ao duplicar ficha');
    }
    if (storage.getAllSheets().length !== 3) {
        throw new Error('Deveria conter 3 fichas após duplicação');
    }
    console.log('  [OK] Duplicação de ficha com ID único e clone profundo');

    // 8. Excluir ficha
    const deleted = storage.deleteSheet(clone.id);
    if (!deleted || storage.getAllSheets().length !== 2) {
        throw new Error('Falha ao excluir ficha');
    }
    console.log('  [OK] Exclusão de ficha com remoção correta do localStorage');

    // 9. AutoRestore na inicialização
    storage.setActiveSheetId(sheet2.id);
    const restored = storage.autoRestore(engine);
    if (!restored) {
        throw new Error('Falha no autoRestore');
    }
    if (engine.getCharacterName() !== 'Lorian, o Arcanista') {
        throw new Error('autoRestore não restaurou a ficha ativa correta');
    }
    console.log('  [OK] AutoRestore restaurou com sucesso a ficha ativa no motor C');

    console.log('\n=== Todos os testes de persistência local passaram com 100% de sucesso! ===\n');
}

runStorageTests().catch(err => {
    console.error('ERRO NO TESTE:', err);
    process.exit(1);
});
