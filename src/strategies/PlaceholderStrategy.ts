import { VectorDBStrategy } from './VectorDBStrategy';
import * as vscode from 'vscode';

export class PlaceholderStrategy implements VectorDBStrategy {
    constructor(public readonly type: string) {}

    private showUnderDevelopmentMessage(): void {
        vscode.window.showInformationMessage(
            `${this.type.charAt(0).toUpperCase() + this.type.slice(1)} integration is under development. Coming soon!`
        );
    }

    async connect(host: string, port: string, username?: string, password?: string): Promise<void> {
        this.showUnderDevelopmentMessage();
        throw new Error(`${this.type} integration is under development`);
    }

    async disconnect(): Promise<void> {
        this.showUnderDevelopmentMessage();
        throw new Error(`${this.type} integration is under development`);
    }

    async listDatabases(): Promise<Array<{ name: string; [key: string]: any }>> {
        this.showUnderDevelopmentMessage();
        throw new Error(`${this.type} integration is under development`);
    }

    async createDatabase(name: string): Promise<void> {
        this.showUnderDevelopmentMessage();
        throw new Error(`${this.type} integration is under development`);
    }

    async deleteDatabase(name: string): Promise<void> {
        this.showUnderDevelopmentMessage();
        throw new Error(`${this.type} integration is under development`);
    }

    async useDatabase(name: string): Promise<void> {
        this.showUnderDevelopmentMessage();
        throw new Error(`${this.type} integration is under development`);
    }

    async listCollections(): Promise<Array<{ name: string; [key: string]: any }>> {
        this.showUnderDevelopmentMessage();
        throw new Error(`${this.type} integration is under development`);
    }

    async createCollection(name: string, dimension: number, metric: string): Promise<void> {
        this.showUnderDevelopmentMessage();
        throw new Error(`${this.type} integration is under development`);
    }

    async deleteCollection(name: string): Promise<void> {
        this.showUnderDevelopmentMessage();
        throw new Error(`${this.type} integration is under development`);
    }

    async insertVectors(collection: string, vectors: number[][], ids?: string[], metadata?: any[]): Promise<number> {
        this.showUnderDevelopmentMessage();
        throw new Error(`${this.type} integration is under development`);
    }

    async searchVectors(collection: string, vector: number[], topK: number): Promise<Array<{ id: string; distance: number; vector?: number[] }>> {
        this.showUnderDevelopmentMessage();
        throw new Error(`${this.type} integration is under development`);
    }

    async listVectors(collection: string, offset?: number, limit?: number): Promise<{ vectors: Array<{ id: string; vector: number[]; metadata: any }>; total: number; offset: number; limit: number }> {
        this.showUnderDevelopmentMessage();
        throw new Error(`${this.type} integration is under development`);
    }

    async deleteVectors(collection: string, ids: string[]): Promise<number> {
        this.showUnderDevelopmentMessage();
        throw new Error(`${this.type} integration is under development`);
    }
}
