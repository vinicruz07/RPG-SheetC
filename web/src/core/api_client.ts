/**
 * api_client.ts — Cliente HTTP para Sincronização com o Servidor Central (Rust)
 * Opera em modo híbrido/offline-first: se o servidor Rust estiver acessível, sincroniza via REST;
 * caso contrário, opera de forma 100% autônoma no navegador.
 */

import type { CardPackSchema } from './types.ts';

export interface ServerConfig {
    baseUrl: string;
    timeoutMs?: number;
}

export interface RemoteSheetSummary {
    id: string;
    name: string;
    system: string;
    level: number;
    updatedAt: number;
}

export class ServerApiClient {
    private baseUrl: string;
    private timeoutMs: number;
    public isOnline: boolean = false;

    constructor(config?: Partial<ServerConfig>) {
        this.baseUrl = (config?.baseUrl || 'http://localhost:8080/api/v1').replace(/\/+$/, '');
        this.timeoutMs = config?.timeoutMs || 3000;
    }

    public setBaseUrl(url: string): void {
        this.baseUrl = url.replace(/\/+$/, '');
    }

    public getBaseUrl(): string {
        return this.baseUrl;
    }

    public async checkHealth(): Promise<boolean> {
        if (typeof fetch !== 'function') {
            this.isOnline = false;
            return false;
        }
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;
        try {
            const res = await fetch(`${this.baseUrl}/health`, {
                method: 'GET',
                signal: controller?.signal
            });
            this.isOnline = res.ok;
            return this.isOnline;
        } catch {
            this.isOnline = false;
            return false;
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    public async listSheets(): Promise<RemoteSheetSummary[] | null> {
        if (!this.isOnline) return null;
        try {
            const res = await fetch(`${this.baseUrl}/sheets`);
            if (!res.ok) return null;
            return await res.json();
        } catch {
            return null;
        }
    }

    public async saveSheet(id: string, payload: CardPackSchema): Promise<boolean> {
        if (!this.isOnline) return false;
        try {
            const res = await fetch(`${this.baseUrl}/sheets/${encodeURIComponent(id)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            return res.ok;
        } catch {
            return false;
        }
    }

    public async listCardPacks(): Promise<CardPackSchema[] | null> {
        if (!this.isOnline) return null;
        try {
            const res = await fetch(`${this.baseUrl}/cardpacks`);
            if (!res.ok) return null;
            return await res.json();
        } catch {
            return null;
        }
    }
}
