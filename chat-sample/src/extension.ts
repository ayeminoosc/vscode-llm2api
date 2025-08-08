import * as vscode from 'vscode';
import { registerChatLibChatParticipant } from './chatUtilsSample';
import { registerSimpleParticipant } from './simple';
import { registerToolUserChatParticipant } from './toolParticipant';
import { registerChatTools } from './tools';
import { registerLLMServerCommands } from './http-server';

export function activate(context: vscode.ExtensionContext) {
    registerSimpleParticipant(context);
    registerToolUserChatParticipant(context);
    registerChatLibChatParticipant(context);

    registerChatTools(context);

    // Register LLM server commands
    registerLLMServerCommands(context);
}

export function deactivate() { }
