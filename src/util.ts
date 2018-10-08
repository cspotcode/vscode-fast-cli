import * as fs from "fs";
import * as Path from 'path';
import * as os from 'os';
import { IpcType, IpcFile } from "./ipc";
import {Disposable} from 'vscode';
import {promisify} from 'util';

export const ipcPath = Path.join(os.homedir(), '.vscode-fast-cli');

export function debug(...args: any[]) {
    if(debug.enabled)
        console.log(...args);
}
debug.error = function(...args: any[]) {
    if(debug.enabled)
        console.error(...args);
}
debug.enabled = false;


/**
 * Read a JSON file from disc, retrying for a bit with falloff
 * in case the file is locked or only halfway-written the first
 * time we make the attempt.
 */
export async function readJsonGraceful<T>(path: string): Promise<T> {
    let interval = 0;
    const start = +new Date;
    const timeout = 3e3;
    while(true) {
        try {
            debug(path);
            return JSON.parse(await promisify(fs.readFile)(path, 'utf8'));
        } catch(e) {
            if(start + timeout > +new Date) throw new Error('unable to read JSON from file');
            interval += 100;
            await delay(interval);
        }
    }
}

export function writeJsonSync(path: string, obj: any) {
    fs.writeFileSync(path, JSON.stringify(obj));
}
export async function writeJson(path: string, obj: any) {
    await promisify(fs.writeFile)(path, JSON.stringify(obj));
}

export function delay(ms: number) {
    return new Promise(res => {
        setTimeout(res, ms);
    });
}

export function ipcFileAbs(ipcMsg: IpcFile) {
    return Path.join(ipcPath, `${ ipcMsg.type }-${ ipcMsg.uuid }`);
}

export function isPathIpcType(type: IpcType, path: string) {
    return Path.basename(path).indexOf(type + '-') === 0;
}

export function readdirAbs(path: string) {
    return fs.readdirSync(path).map(name => Path.join(path, name));
}

export async function findMapAsync<T, R>(v: ReadonlyArray<T>, cb: (v: T) => Promise<R | undefined>): Promise<R | undefined> {
    for(const i of v) {
        const result = await cb(i);
        if(result !== undefined) return result;
    }
    return undefined;
}

export async function writeIpcFile(ipcMsg: IpcFile) {
    const path = ipcFileAbs(ipcMsg);
    await writeJson(path, ipcMsg);
    return disposable(() => fs.unlinkSync(path));
}
export function writeIpcFileSync(ipcMsg: IpcFile) {
    const path = ipcFileAbs(ipcMsg);
    writeJsonSync(path, ipcMsg);
    return disposable(() => fs.unlinkSync(path));
}

export function disposable(cb: () => void): Disposable {
    return {
        dispose() {cb();}
    };
}

export function isFileInDirectory(absFile: string, absDirectory: string) {
    if(os.platform() === 'win32') {
        absFile = absFile.toLowerCase();
        absDirectory = absDirectory.toLowerCase();
    }
    if(absDirectory.slice(-1) !== Path.sep) absDirectory += Path.sep;
    return absFile.indexOf(absDirectory) === 0;
}