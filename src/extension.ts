'use strict';
import * as vscode from 'vscode';
import * as Path from 'path';
import { readJsonGraceful, ipcPath, writeIpcFileSync, isPathIpcType, disposable, writeIpcFile, debug } from './util';
import * as fs from 'fs';
import { uuidv4 } from './uuid';
import { EditRequest } from './ipc';

// let config: ConfigAccessor;

export function activate(context: vscode.ExtensionContext) {
    // config = new ConfigAccessor({
    //     ipcPath
    // });

    debug.enabled = true;
    debug(`"vscode-fast-cli" is active. pid = ${ process.pid }`);

    // create the IPC directory if it doesn't exist
    try {fs.mkdirSync(ipcPath);} catch(e) {}

    const editorUuid = uuidv4();
    
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
        reAnnounceEditorPids();
    });
    let editorPidSubscriptions: vscode.Disposable[] = [];
    reAnnounceEditorPids();
    function reAnnounceEditorPids() {
        for(const d of editorPidSubscriptions) d.dispose();
        editorPidSubscriptions = [];
        for(const workspaceFolder of vscode.workspace.workspaceFolders || []) {
            debug(`announcing workspace ${ workspaceFolder.uri.fsPath }`);
            editorPidSubscriptions.push(writeIpcFileSync({
                type: 'editorPid',
                pid: process.pid,
                workspaceRootAbs: workspaceFolder.uri.fsPath,
                windowTitle: vscode.workspace.name!,
                uuid: uuidv4(),
                editorUuid
            }));
        }
    }
    
    const nodeFsWatcher = fs.watch(ipcPath, (e, path) => {
        if(e !== 'rename') return;
        debug(`seeing file ${path}`);
        const absPath = Path.join(ipcPath, path);
        if(isPathIpcType('editRequest', absPath)) {
            fileCreated(absPath).catch(e => {
                debug.error(e);
            });
        }
    });
    autoDispose(disposable(() => nodeFsWatcher.close()));

    async function fileCreated(fsPath: string) {
        debug('noticed an editorRequest');
        const req = await readJsonGraceful<EditRequest>(fsPath);
        debug(req);
        if(req.editorUuid === editorUuid) {
            debug('This request is for us');
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(req.path));
            const cursorPosition = new vscode.Position(req.line, req.column);
            const editor = await vscode.window.showTextDocument(doc, {
                selection: new vscode.Range(cursorPosition, cursorPosition)
            });
            vscode.window.onDidChangeVisibleTextEditors((e) => {
                if(!e.includes(editor)) {
                    // editor was closed
                    debug(`announcing that file is closed`);
                    writeIpcFile({
                        type: 'closedResponse',
                        uuid: req.uuid
                    })
                }
            });
        } else {
            debug('This request is not for us');
        }
    }

    vscode.window.registerUriHandler({
        handleUri(uri) {
            debug(uri.path);
            debug(uri.query);
        }
    });

    function autoDispose(disposable: vscode.Disposable) {
        context.subscriptions.push(disposable);
    }
}

export function deactivate() {
}