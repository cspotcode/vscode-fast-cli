#!/usr/bin/env node
import * as Path from 'path';
import * as fs from 'fs';
import * as process from 'process';
import { readJsonGraceful, readdirAbs, ipcPath, isPathIpcType, findMapAsync, writeIpcFileSync, ipcFileAbs, isFileInDirectory, debug } from './util';
import { VscodeEditorPid, ClosedResponse } from './ipc';
import { uuidv4 } from './uuid';
import { spawn } from 'child_process';
import * as __lodash from 'lodash';
const escapeRegExp = require('lodash.escaperegexp') as (typeof __lodash)['escapeRegExp'];
import * as __crossSpawn from 'cross-spawn';
function getCrossSpawn() {
    return require('cross-spawn') as typeof __crossSpawn;
}

async function main() {
    let fileToEdit = null;
    let wait = false;
    let goto = false;
    let line = 1;
    let column = 1;
    for(const arg of process.argv.slice(2)) {
        switch(arg) {
            case '--fcode-debug':
                debug.setEnabled(true);
                break;
            case '-w':
            case '--wait':
                wait = true;
                break;
            case '-g':
            case '--goto':
                goto = true;
                break;
            default:
                fileToEdit = arg;
        }
    }

    if(fileToEdit) {
        if(goto) {
            let s = fileToEdit.split(':');
            if(s.length >= 3) {
                [line, column] = s.slice(-2).map(v => parseInt(v, 10)); fileToEdit = s.slice(0, -2).join(':');
            } else if(s.length >= 2) {
                [line] = s.slice(-1).map(v => parseInt(v, 10)); fileToEdit = s.slice(0, -1).join(':');
            }
        }
        const absFileToEdit = Path.resolve(fileToEdit);
        // try to find an already-open editor to open this file
        const foundTargetEditor = await findMapAsync(readdirAbs(ipcPath), async (ipcMessagePath) => {
            debug(`checking if ${ipcMessagePath} is editor presence`);
            if(isPathIpcType('editorPid', ipcMessagePath)) {
                debug(`reading editor presence file`);
                const ipcMsg = await readJsonGraceful<VscodeEditorPid>(ipcMessagePath);
                // if file is in this editor's workspace
                debug(`checking if ${absFileToEdit} is in workspace ${ipcMsg.workspaceRootAbs}`);
                if(isFileInDirectory(absFileToEdit, ipcMsg.workspaceRootAbs)) {
                    debug(`it is; checking if pid ${ipcMsg.pid} is running`);
                    try {
                        process.kill(ipcMsg.pid, 0);
                        return ipcMsg;
                    } catch(e) {
                        fs.unlink(ipcMessagePath, () => {/* intentionally async */});
                    }
                }
            }
            // cleanup old edit requests
            debug(`checking if is editRequest`);
            if(isPathIpcType('editRequest', ipcMessagePath) || isPathIpcType('closedResponse', ipcMessagePath)) {
                debug(`checking if is old enough`);
                if(+fs.statSync(ipcMessagePath).mtime < (+new Date - 5*60*1000)) {
                    fs.unlink(ipcMessagePath, () => {/* intentionally async */});
                } else {
                    debug(`cannot delete old editRequest`);
                }
            }
        });
        const requestUuid = uuidv4();
        if(foundTargetEditor) {
            debug(`Writing request to editor`);
            writeIpcFileSync({
                type: 'editRequest',
                uuid: requestUuid,
                path: absFileToEdit,
                editorUuid: foundTargetEditor.editorUuid,
                line,
                column
            });
            // Bring file to the front
            spawn(Path.join(__dirname, '../bring-to-front/bring-to-front.exe'), [`- ${ escapeRegExp(foundTargetEditor.windowTitle) } - Visual Studio Code$`]);
            if(wait) {
                const responseMessageExample: ClosedResponse = {
                    type: 'closedResponse',
                    uuid: requestUuid
                };
                debug(`waiting for editor to close file...`);
                const waitForFilePath = ipcFileAbs(responseMessageExample);
                debug(waitForFilePath);
                
                fs.watch(ipcPath, (e, path) => {
                    if(isPathsToSameFile(Path.join(ipcPath, path), waitForFilePath)) {
                        fs.unlinkSync(waitForFilePath);
                        process.exit(0);
                    }
                });
            }
        } else {
            debug('Target editor was not found.  Launching the old-fashioned way.');
            getCrossSpawn().sync('code.cmd', process.argv.slice(2));
        }
    }
}

function isPathsToSameFile(path1: string, path2: string) {
    path1 = Path.normalize(path1);
    path2 = Path.normalize(path2);
    if(process.platform === 'win32') {
        path1 = path1.toLowerCase();
        path2 = path2.toLowerCase();
    }
    return path1 === path2;
}

main();