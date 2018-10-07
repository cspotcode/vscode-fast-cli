import * as vscode from 'vscode';
export const configPrefix = 'faster-editor-launcher';
export interface Config {
    // ipcPath: string;
}
export class ConfigAccessor {
    constructor(public defaults: Config) {}
    config = vscode.workspace.getConfiguration(configPrefix);
    get<T extends keyof Config>(key: T): Config[T] {
        return this.config.get(key) || this.defaults[key];
    }
    set<T extends keyof Config>(key: T, value: Config[T]): void {
        this.config.set(key, value);
    }
}
