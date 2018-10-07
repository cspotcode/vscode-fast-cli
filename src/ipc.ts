export type IpcFile = EditRequest | ClosedResponse | VscodeEditorPid;

export type IpcType = IpcFile['type'];

export interface EditRequest {
    type: 'editRequest',
    path: string;
    /** request ID */
    uuid: string;
    editorUuid: string;
    line: number;
    column: number;
}

export interface ClosedResponse {
    type: 'closedResponse';
    /** In response to this editor request */
    uuid: string;
}

export  interface VscodeEditorPid {
    type: 'editorPid';
    pid: number;
    workspaceRootAbs: string;
    windowTitle: string;
    uuid: string;
    editorUuid: string;
}
