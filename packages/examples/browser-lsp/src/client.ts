/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2018-2022 TypeFox GmbH (http://www.typefox.io). All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import 'monaco-editor/esm/vs/editor/editor.all.js';

// support all editor features
import 'monaco-editor/esm/vs/editor/standalone/browser/accessibilityHelp/accessibilityHelp.js';
import 'monaco-editor/esm/vs/editor/standalone/browser/inspectTokens/inspectTokens.js';
import 'monaco-editor/esm/vs/editor/standalone/browser/iPadShowKeyboard/iPadShowKeyboard.js';
import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneHelpQuickAccess.js';
import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoLineQuickAccess.js';
import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoSymbolQuickAccess.js';
import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneCommandsQuickAccess.js';
import 'monaco-editor/esm/vs/editor/standalone/browser/quickInput/standaloneQuickInputService.js';
import 'monaco-editor/esm/vs/editor/standalone/browser/referenceSearch/standaloneReferenceSearch.js';
import 'monaco-editor/esm/vs/editor/standalone/browser/toggleHighContrast/toggleHighContrast.js';

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import normalizeUrl from 'normalize-url';

import { buildWorkerDefinition } from 'monaco-editor-workers';

import { MonacoLanguageClient, CloseAction, ErrorAction, MonacoServices, MessageTransports } from 'monaco-languageclient';
import { BrowserMessageReader, BrowserMessageWriter } from 'vscode-languageserver-protocol/browser.js';
import { StandaloneServices } from 'vscode/services';
import getMessageServiceOverride from 'vscode/service-override/messages';
import { toSocket, WebSocketMessageReader, WebSocketMessageWriter } from 'vscode-ws-jsonrpc';


StandaloneServices.initialize({
    ...getMessageServiceOverride(document.body)
});

buildWorkerDefinition('dist', new URL('', window.location.href).href, false);

// register Monaco languages
monaco.languages.register({
    id: 'python',
    extensions: ['.py'],
    aliases: ['Python', 'python'],
    //mimetypes: ['text/plain']
});

// create Monaco editor
const editorText = `def myfunc(x):
    return x
`;
monaco.editor.create(document.getElementById('container')!, {
    model: monaco.editor.createModel(editorText, 'python', monaco.Uri.parse('inmemory://model.py')),
    glyphMargin: true,
    lightbulb: {
        enabled: true
    }
});

function createLanguageClient (transports: MessageTransports): MonacoLanguageClient {
    return new MonacoLanguageClient({
        name: 'Sample Language Client',
        clientOptions: {
            // use a language id as a document selector
            documentSelector: [{ language: 'python' }],
            // disable the default error handler
            errorHandler: {
                error: () => ({ action: ErrorAction.Continue }),
                closed: () => ({ action: CloseAction.DoNotRestart })
            }
        },
        // create a language client connection to the server running in the web worker
        connectionProvider: {
            get: () => {
                return Promise.resolve(transports);
            }
        }
    });
}
function createLanguageClient2 (transports: MessageTransports): MonacoLanguageClient {
    return new MonacoLanguageClient({
        name: 'Sample Language Client',
        clientOptions: {
            // use a language id as a document selector
            documentSelector: ['python'],
            // disable the default error handler
            errorHandler: {
                error: () => ({ action: ErrorAction.Continue }),
                closed: () => ({ action: CloseAction.DoNotRestart })
            }
        },
        // create a language client connection from the JSON RPC connection on demand
        connectionProvider: {
            get: () => {
                return Promise.resolve(transports);
            }
        }
    });
}

// install Monaco language client services
MonacoServices.install();
/* 
const worker = new Worker(new URL('./src/serverWorker.ts', window.location.href).href, { type: 'module' });
const reader = new BrowserMessageReader(worker);
const writer = new BrowserMessageWriter(worker);
const languageClient = createLanguageClient({ reader, writer });
languageClient.start();

reader.onClose(() => languageClient.stop()); */



function createUrl (hostname: string, port: number, path: string): string {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    return normalizeUrl(`${protocol}://${hostname}:${port}${path}`);
}


const url = createUrl('localhost', 3001, '/python');
const webSocket = new WebSocket(url);

webSocket.onopen = () => {
    const socket = toSocket(webSocket);
    const reader = new WebSocketMessageReader(socket);
    const writer = new WebSocketMessageWriter(socket);
    const languageClient = createLanguageClient({
        reader,
        writer
    });
    languageClient.start();
    reader.onClose(() => languageClient.stop());
};