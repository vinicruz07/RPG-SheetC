/**
 * dice.ts — Gerador Pseudoaleatório Xorshift32 e Rolador de Dados Poliédricos
 * 100% TypeScript Nativo • Determinístico e Testável
 */

import type { DiceRollResult } from './types.ts';

export const DICE_MAX_ROLLS = 32;

export class DiceEngine {
    private seed: number = 0x853c49e6;
    private lastRoll: DiceRollResult = {
        count: 1,
        faces: 20,
        modifier: 0,
        subtotal: 10,
        total: 10,
        rolls: [10],
        isCritical: false,
        isFumble: false
    };

    constructor(initialSeed: number = 0x853c49e6) {
        this.setSeed(initialSeed);
    }

    public setSeed(seed: number): void {
        const clean = (seed >>> 0);
        this.seed = clean === 0 ? 0x853c49e6 : clean;
    }

    public getSeed(): number {
        return this.seed >>> 0;
    }

    public nextU32(): number {
        let x = this.seed >>> 0;
        x ^= (x << 13) >>> 0;
        x ^= (x >>> 17) >>> 0;
        x ^= (x << 5) >>> 0;
        this.seed = (x >>> 0) || 0x853c49e6;
        return this.seed;
    }

    public randomRange(min: number, max: number): number {
        const lo = Math.trunc(min);
        const hi = Math.trunc(max);
        if (lo >= hi) return lo;
        const range = (hi - lo + 1) >>> 0;
        const r = this.nextU32();
        return lo + (r % range);
    }

    public rollD20(): number {
        return this.randomRange(1, 20);
    }

    public rollSimple(faces: number, count: number, modifier: number = 0): number {
        return this.roll(count, faces, modifier).total;
    }

    public roll(count: number = 1, faces: number = 20, modifier: number = 0): DiceRollResult {
        const cleanFaces = faces > 0 ? Math.trunc(faces) : 6;
        const cleanCount = Math.min(DICE_MAX_ROLLS, count > 0 ? Math.trunc(count) : 1);
        const cleanMod = Math.trunc(modifier || 0);

        const rolls: number[] = [];
        let subtotal = 0;

        for (let i = 0; i < cleanCount; i++) {
            const die = this.randomRange(1, cleanFaces);
            rolls.push(die);
            subtotal += die;
        }

        const total = subtotal + cleanMod;
        const isCritical = cleanCount === 1 && cleanFaces === 20 && rolls[0] === 20;
        const isFumble = cleanCount === 1 && cleanFaces === 20 && rolls[0] === 1;

        this.lastRoll = {
            count: cleanCount,
            faces: cleanFaces,
            modifier: cleanMod,
            subtotal,
            total,
            rolls,
            isCritical,
            isFumble
        };

        return this.lastRoll;
    }

    public getLastRoll(): DiceRollResult {
        return {
            ...this.lastRoll,
            rolls: [...this.lastRoll.rolls]
        };
    }
}
