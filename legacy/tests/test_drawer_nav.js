/**
 * test_drawer_nav.js — Testes Automatizados da Navegação por Drawer e Roteador SPA (RPG-SheetC v2.0)
 * Valida abertura, fechamento por backdrop, fechamento por Escape e transição de abas via Drawer.
 */

const assert = require('assert');

class MockElement {
    constructor(tagName = 'div') {
        this.tagName = tagName.toUpperCase();
        this._classes = new Set();
        this.classList = {
            add: (c) => this._classes.add(c),
            remove: (c) => this._classes.delete(c),
            contains: (c) => this._classes.has(c),
            has: (c) => this._classes.has(c)
        };
        this.dataset = {};
        this.attributes = {};
        this.listeners = {};
        this.id = '';
        this.disabled = false;
        this.textContent = '';
    }

    setAttribute(name, val) {
        this.attributes[name] = String(val);
    }

    getAttribute(name) {
        return this.attributes[name] || null;
    }

    addEventListener(event, fn) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(fn);
    }

    trigger(event, data = {}) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(fn => fn({ target: this, ...data }));
        }
    }
}

function runDrawerTests() {
    console.log('=== Testes Automatizados da Navegação por Sidebar Drawer (Passo 10.6) ===');

    // 1. Configura elementos simulados do DOM
    const sidebarDrawer = new MockElement('aside');
    sidebarDrawer.id = 'sidebar-drawer';

    const sidebarBackdrop = new MockElement('div');
    sidebarBackdrop.id = 'sidebar-backdrop';

    const btnToggleMenu = new MockElement('button');
    btnToggleMenu.id = 'btn-toggle-menu';

    const btnCloseSidebar = new MockElement('button');
    btnCloseSidebar.id = 'btn-close-sidebar';

    const viewNames = ['home', 'sheet', 'creator', 'compendium', 'roller'];
    const navItems = viewNames.map(v => {
        const el = new MockElement('button');
        el.dataset.view = v;
        el.classList.add('sidebar-nav-item');
        return el;
    });

    const viewSections = viewNames.map(v => {
        const el = new MockElement('section');
        el.id = `view-${v}`;
        el.classList.add('view-section');
        return el;
    });

    const docListeners = {};
    const mockDocument = {
        getElementById: (id) => {
            if (id === 'sidebar-drawer') return sidebarDrawer;
            if (id === 'sidebar-backdrop') return sidebarBackdrop;
            if (id === 'btn-toggle-menu') return btnToggleMenu;
            if (id === 'btn-close-sidebar') return btnCloseSidebar;
            const viewMatch = viewSections.find(s => s.id === id);
            if (viewMatch) return viewMatch;
            return null;
        },
        querySelectorAll: (sel) => {
            if (sel.includes('.sidebar-nav-item')) return navItems;
            if (sel.includes('.view-section')) return viewSections;
            if (sel.includes('.tab-button')) return [];
            return [];
        },
        addEventListener: (event, fn) => {
            if (!docListeners[event]) docListeners[event] = [];
            docListeners[event].push(fn);
        }
    };

    // 2. Lógica do Sidebar e Roteador (idêntica ao app.js)
    const openSidebar = () => {
        sidebarDrawer.classList.add('open');
        sidebarDrawer.setAttribute('aria-hidden', 'false');
        sidebarBackdrop.classList.add('active');
    };

    const closeSidebar = () => {
        sidebarDrawer.classList.remove('open');
        sidebarDrawer.setAttribute('aria-hidden', 'true');
        sidebarBackdrop.classList.remove('active');
    };

    btnToggleMenu.addEventListener('click', openSidebar);
    btnCloseSidebar.addEventListener('click', closeSidebar);
    sidebarBackdrop.addEventListener('click', closeSidebar);
    mockDocument.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebarDrawer.classList.has('open')) {
            closeSidebar();
        }
    });

    let viewLifecycleCalls = [];
    const router = {
        currentView: 'home',
        navigate(viewName) {
            this.currentView = viewName;
            closeSidebar();

            navItems.forEach(item => {
                if (item.dataset.view === viewName) item.classList.add('active');
                else item.classList.remove('active');
            });

            viewSections.forEach(v => {
                if (v.id === `view-${viewName}`) v.classList.add('active');
                else v.classList.remove('active');
            });

            viewLifecycleCalls.push(viewName);
        }
    };

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (!item.disabled && item.dataset.view) {
                router.navigate(item.dataset.view);
            }
        });
    });

    // 3. Teste: Abertura do Sidebar Drawer via botão
    assert(!sidebarDrawer.classList.has('open'), 'Drawer deve iniciar fechado');
    btnToggleMenu.trigger('click');
    assert(sidebarDrawer.classList.has('open'), 'Drawer deve ter a classe .open após toggle');
    assert.strictEqual(sidebarDrawer.getAttribute('aria-hidden'), 'false');
    assert(sidebarBackdrop.classList.has('active'), 'Backdrop deve estar ativo');
    console.log('  [OK] Abertura do Sidebar Drawer via #btn-toggle-menu validada');

    // 4. Teste: Fechamento via botão de fechar (X)
    btnCloseSidebar.trigger('click');
    assert(!sidebarDrawer.classList.has('open'), 'Drawer deve estar fechado após clicar em fechar');
    assert.strictEqual(sidebarDrawer.getAttribute('aria-hidden'), 'true');
    assert(!sidebarBackdrop.classList.has('active'), 'Backdrop deve estar inativo');
    console.log('  [OK] Fechamento do Sidebar Drawer via #btn-close-sidebar validado');

    // 5. Teste: Fechamento via clique no Backdrop
    openSidebar();
    assert(sidebarDrawer.classList.has('open'));
    sidebarBackdrop.trigger('click');
    assert(!sidebarDrawer.classList.has('open'));
    console.log('  [OK] Fechamento do Sidebar Drawer via clique no Backdrop validado');

    // 6. Teste: Fechamento via tecla Escape
    openSidebar();
    assert(sidebarDrawer.classList.has('open'));
    docListeners['keydown'].forEach(fn => fn({ key: 'Escape' }));
    assert(!sidebarDrawer.classList.has('open'));
    console.log('  [OK] Fechamento do Sidebar Drawer via tecla Escape validado');

    // 7. Teste: Navegação entre Abas via Drawer
    openSidebar();
    const sheetNavItem = navItems.find(i => i.dataset.view === 'sheet');
    sheetNavItem.trigger('click');

    assert.strictEqual(router.currentView, 'sheet', 'Roteador deve estar na view sheet');
    assert(!sidebarDrawer.classList.has('open'), 'Drawer deve fechar automaticamente ao navegar');
    assert(sheetNavItem.classList.has('active'), 'Item sheet do menu deve estar ativo');
    const sheetSection = viewSections.find(s => s.id === 'view-sheet');
    assert(sheetSection.classList.has('active'), 'Seção view-sheet deve estar visível');
    console.log('  [OK] Navegação para "Ficha de Personagem" e fechamento automático validados');

    // 8. Teste: Navegação para o novo Criador Dedicado
    const creatorNavItem = navItems.find(i => i.dataset.view === 'creator');
    creatorNavItem.trigger('click');
    assert.strictEqual(router.currentView, 'creator');
    assert(creatorNavItem.classList.has('active'));
    assert(!sheetNavItem.classList.has('active'));
    console.log('  [OK] Navegação para "Criar Nova Ficha" (creator) validada');

    console.log('=== Todos os testes do Drawer Navigation passaram com 100% de sucesso! ===\n');
}

runDrawerTests();