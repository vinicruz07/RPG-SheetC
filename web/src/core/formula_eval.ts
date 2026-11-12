/**
 * formula_eval.ts — Avaliador Descendente Recursivo de Expressões Matemáticas e Fórmulas de RPG
 * Suporta:
 * - Aritmética inteira (+, -, *, /, parênteses, unários + e -)
 * - Funções matemáticas: floor, ceil, round, abs, min, max
 * - Referências a cards do deck (@for, @des, @nivel, @level, @xp)
 * - Notação de dados embutida (ex: "1d20 + (@for - 10) / 2", "2d6 + 3")
 */

import type { EvalResult, EvalStatus } from './types.ts';

const MAX_EVAL_RECURSION_DEPTH = 32;

export interface FormulaContext {
    level: number;
    xp: number;
    resolveCardValue: (key: string) => number;
    rollDice?: (count: number, faces: number) => number;
}

type TokenType =
    | 'EOF'
    | 'NUM'
    | 'PLUS'
    | 'MINUS'
    | 'STAR'
    | 'SLASH'
    | 'LPAREN'
    | 'RPAREN'
    | 'COMMA'
    | 'FUNC'
    | 'ERROR';

interface ParserState {
    src: string;
    pos: number;
    ctx: FormulaContext;
    status: EvalStatus;
    depth: number;
    currentTok: TokenType;
    tokNum: number;
    tokIdent: string;
}

function isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
}

function isWhitespace(c: string): boolean {
    return c === ' ' || c === '\t' || c === '\r' || c === '\n';
}

function isIdentStart(c: string): boolean {
    return (
        (c >= 'a' && c <= 'z') ||
        (c >= 'A' && c <= 'Z') ||
        c === '_' ||
        c === '@'
    );
}

function isIdentPart(c: string): boolean {
    return isIdentStart(c) || isDigit(c);
}

const BUILTIN_FUNCS = new Set(['floor', 'ceil', 'round', 'abs', 'min', 'max']);

function nextToken(p: ParserState): void {
    while (p.pos < p.src.length && isWhitespace(p.src[p.pos])) {
        p.pos++;
    }

    if (p.pos >= p.src.length) {
        p.currentTok = 'EOF';
        return;
    }

    const c = p.src[p.pos];

    if (c === '+') { p.pos++; p.currentTok = 'PLUS'; return; }
    if (c === '-') { p.pos++; p.currentTok = 'MINUS'; return; }
    if (c === '*') { p.pos++; p.currentTok = 'STAR'; return; }
    if (c === '/') { p.pos++; p.currentTok = 'SLASH'; return; }
    if (c === '(') { p.pos++; p.currentTok = 'LPAREN'; return; }
    if (c === ')') { p.pos++; p.currentTok = 'RPAREN'; return; }
    if (c === ',') { p.pos++; p.currentTok = 'COMMA'; return; }

    // Literal numérico ou notação de dados NdF (ex: 2d6, 1d20)
    if (isDigit(c)) {
        let numVal = 0;
        while (p.pos < p.src.length && isDigit(p.src[p.pos])) {
            numVal = numVal * 10 + (p.src.charCodeAt(p.pos) - 48);
            p.pos++;
        }

        // Verifica se é notação de dado: <count>d<faces>
        if (
            p.pos < p.src.length &&
            (p.src[p.pos] === 'd' || p.src[p.pos] === 'D') &&
            p.pos + 1 < p.src.length &&
            isDigit(p.src[p.pos + 1])
        ) {
            p.pos++; // consome 'd'
            let faces = 0;
            while (p.pos < p.src.length && isDigit(p.src[p.pos])) {
                faces = faces * 10 + (p.src.charCodeAt(p.pos) - 48);
                p.pos++;
            }
            const count = Math.max(1, numVal);
            const cleanFaces = Math.max(1, faces);
            if (typeof p.ctx.rollDice === 'function') {
                p.tokNum = p.ctx.rollDice(count, cleanFaces);
            } else {
                // Em avaliação estática de fórmula (ex: "1d8 + (@for - 10) / 2"),
                // o termo NdF contribui 0 para exibir o bônus/modificador fixo,
                // ou se a expressão for puramente dado ("2d6"), retorna o valor médio/base.
                p.tokNum = 0;
            }
            p.currentTok = 'NUM';
            return;
        }

        p.tokNum = numVal;
        p.currentTok = 'NUM';
        return;
    }

    // Identificador, função matemática ou referência @chave
    if (isIdentStart(c)) {
        const hasAt = c === '@';
        if (hasAt) {
            p.pos++;
        }

        let ident = '';
        while (p.pos < p.src.length && isIdentPart(p.src[p.pos])) {
            ident += p.src[p.pos];
            p.pos++;
        }

        const lower = ident.toLowerCase();

        // Verifica se é chamada de função matemática: floor(...), min(...), etc.
        let lookahead = p.pos;
        while (lookahead < p.src.length && isWhitespace(p.src[lookahead])) {
            lookahead++;
        }
        if (!hasAt && BUILTIN_FUNCS.has(lower) && lookahead < p.src.length && p.src[lookahead] === '(') {
            p.tokIdent = lower;
            p.currentTok = 'FUNC';
            return;
        }

        // Caso especial: notação "d20" ou "d6" sem número antes (equivale a 1d20)
        if (!hasAt && /^d\d+$/.test(lower)) {
            const faces = parseInt(lower.slice(1), 10) || 6;
            p.tokNum = typeof p.ctx.rollDice === 'function' ? p.ctx.rollDice(1, faces) : 0;
            p.currentTok = 'NUM';
            return;
        }

        // Resolve variável de contexto (@nivel, @level, @xp ou @card_key)
        let resolved = 0;
        if (lower === 'nivel' || lower === 'level') {
            resolved = p.ctx.level;
        } else if (lower === 'xp') {
            resolved = p.ctx.xp;
        } else if (lower.length > 0) {
            resolved = p.ctx.resolveCardValue(lower);
        } else {
            p.currentTok = 'ERROR';
            p.status = 'ERR_SYNTAX';
            return;
        }

        p.tokNum = resolved;
        p.currentTok = 'NUM';
        return;
    }

    p.pos++;
    p.currentTok = 'ERROR';
    p.status = 'ERR_SYNTAX';
}

function parseFactor(p: ParserState): number {
    if (p.status !== 'OK') return 0;

    if (p.currentTok === 'PLUS') {
        nextToken(p);
        return parseFactor(p);
    }

    if (p.currentTok === 'MINUS') {
        nextToken(p);
        return -parseFactor(p);
    }

    if (p.currentTok === 'NUM') {
        const val = p.tokNum;
        nextToken(p);
        return val;
    }

    if (p.currentTok === 'FUNC') {
        const fnName = p.tokIdent;
        nextToken(p); // consome FUNC
        if (p.currentTok !== 'LPAREN') {
            p.status = 'ERR_SYNTAX';
            return 0;
        }
        nextToken(p); // consome '('

        const args: number[] = [];
        if (p.currentTok !== 'RPAREN') {
            args.push(parseExpression(p));
            while (p.status === 'OK' && p.currentTok === 'COMMA') {
                nextToken(p);
                args.push(parseExpression(p));
            }
        }

        if (p.currentTok !== 'RPAREN') {
            p.status = 'ERR_SYNTAX';
            return 0;
        }
        nextToken(p); // consome ')'

        if (args.length === 0) {
            p.status = 'ERR_SYNTAX';
            return 0;
        }

        switch (fnName) {
            case 'floor': return Math.floor(args[0]);
            case 'ceil':  return Math.ceil(args[0]);
            case 'round': return Math.round(args[0]);
            case 'abs':   return Math.abs(args[0]);
            case 'min':   return Math.min(...args);
            case 'max':   return Math.max(...args);
            default:      return args[0];
        }
    }

    if (p.currentTok === 'LPAREN') {
        nextToken(p);
        const val = parseExpression(p);
        if (p.currentTok === 'RPAREN') {
            nextToken(p);
        } else {
            p.status = 'ERR_SYNTAX';
        }
        return val;
    }

    p.status = 'ERR_SYNTAX';
    return 0;
}

function parseTerm(p: ParserState): number {
    let left = parseFactor(p);

    while (p.status === 'OK' && (p.currentTok === 'STAR' || p.currentTok === 'SLASH')) {
        const op = p.currentTok;
        nextToken(p);
        const right = parseFactor(p);

        if (p.status !== 'OK') return 0;

        if (op === 'STAR') {
            left = Math.trunc(left * right);
        } else {
            if (right === 0) {
                p.status = 'ERR_DIV_BY_ZERO';
                return 0;
            }
            // Divisão inteira compatível com C99 (truncada em direção a zero),
            // exceto quando dentro de floor() onde o usuário espera piso.
            left = Math.trunc(left / right);
        }
    }

    return left;
}

function parseExpression(p: ParserState): number {
    if (p.depth >= MAX_EVAL_RECURSION_DEPTH) {
        p.status = 'ERR_MAX_DEPTH';
        return 0;
    }

    p.depth++;
    let left = parseTerm(p);

    while (p.status === 'OK' && (p.currentTok === 'PLUS' || p.currentTok === 'MINUS')) {
        const op = p.currentTok;
        nextToken(p);
        const right = parseTerm(p);

        if (p.status !== 'OK') {
            p.depth--;
            return 0;
        }

        if (op === 'PLUS') {
            left = left + right;
        } else {
            left = left - right;
        }
    }

    p.depth--;
    return left;
}

export function evaluateFormula(expr: string, ctx: FormulaContext): EvalResult {
    if (!expr || expr.trim() === '') {
        return { status: 'OK', value: 0 };
    }

    const state: ParserState = {
        src: expr,
        pos: 0,
        ctx,
        status: 'OK',
        depth: 0,
        currentTok: 'EOF',
        tokNum: 0,
        tokIdent: ''
    };

    nextToken(state);

    if (state.currentTok === 'EOF') {
        return { status: 'OK', value: 0 };
    }

    const result = parseExpression(state);

    if (state.status !== 'OK') {
        return { status: state.status, value: 0 };
    }

    if (state.currentTok !== 'EOF') {
        return { status: 'ERR_SYNTAX', value: 0 };
    }

    return { status: 'OK', value: Math.trunc(result) };
}
