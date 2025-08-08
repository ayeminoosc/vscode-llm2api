import * as vscode from 'vscode';
import * as http from 'http';
import * as url from 'url';
import { OpenAIAPIServer, ChatCompletionRequest } from './openai-api';

/**
 * HTTP Server that exposes OpenAI-compatible API endpoints
 */
export class VSCodeLLMServer {
    private server: http.Server | null = null;
    private apiServer: OpenAIAPIServer;
    private port: number;

    constructor(port: number = 3000) {
        this.port = port;
        this.apiServer = new OpenAIAPIServer();
    }

    /**
     * Start the HTTP server
     */
    public async start(): Promise<void> {
        this.server = http.createServer(this.handleRequest.bind(this));

        return new Promise((resolve, reject) => {
            this.server!.listen(this.port, () => {
                console.log(`VS Code LLM API Server running on http://localhost:${this.port}`);
                resolve();
            });

            this.server!.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Stop the HTTP server
     */
    public async stop(): Promise<void> {
        if (this.server) {
            return new Promise((resolve) => {
                this.server!.close(() => {
                    console.log('VS Code LLM API Server stopped');
                    resolve();
                });
            });
        }
    }

    /**
     * Handle incoming HTTP requests
     */
    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        // Handle OPTIONS request for CORS
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        const parsedUrl = url.parse(req.url || '', true);
        const pathname = parsedUrl.pathname;

        try {
            // Route requests
            if (pathname === '/v1/chat/completions' && req.method === 'POST') {
                await this.handleChatCompletions(req, res);
            } else if (pathname === '/v1/models' && req.method === 'GET') {
                await this.handleModels(req, res);
            } else if (pathname === '/health' && req.method === 'GET') {
                await this.handleHealth(req, res);
            } else {
                this.sendError(res, 404, 'Not Found', 'The requested endpoint was not found');
            }
        } catch (error) {
            console.error('Request handling error:', error);
            this.sendError(res, 500, 'Internal Server Error', error instanceof Error ? error.message : 'Unknown error');
        }
    }

    /**
     * Handle /v1/chat/completions endpoint
     */
    private async handleChatCompletions(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const body = await this.readRequestBody(req);

        try {
            const request: ChatCompletionRequest = JSON.parse(body);

            // Validate request
            if (!request.messages || !Array.isArray(request.messages)) {
                this.sendError(res, 400, 'Bad Request', 'messages field is required and must be an array');
                return;
            }

            const response = await this.apiServer.handleChatCompletions(request);

            if (request.stream) {
                // Handle streaming response
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                });

                const generator = response as AsyncGenerator<any>;
                for await (const chunk of generator) {
                    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                }
                res.write('data: [DONE]\n\n');
                res.end();
            } else {
                // Handle non-streaming response
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));
            }
        } catch (error) {
            this.sendError(res, 400, 'Bad Request', error instanceof Error ? error.message : 'Invalid request');
        }
    }

    /**
     * Handle /v1/models endpoint
     */
    private async handleModels(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        try {
            const models = await this.apiServer.handleModels();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(models));
        } catch (error) {
            this.sendError(res, 500, 'Internal Server Error', error instanceof Error ? error.message : 'Failed to get models');
        }
    }

    /**
     * Handle /health endpoint
     */
    private async handleHealth(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            server: 'VS Code LLM API'
        }));
    }

    /**
     * Read request body
     */
    private readRequestBody(req: http.IncomingMessage): Promise<string> {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', () => {
                resolve(body);
            });
            req.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Send error response
     */
    private sendError(res: http.ServerResponse, statusCode: number, error: string, message: string): void {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: {
                type: error.toLowerCase().replace(' ', '_'),
                message: message
            }
        }));
    }
}

/**
 * VS Code command to start/stop the LLM server
 */
export function registerLLMServerCommands(context: vscode.ExtensionContext): void {
    let server: VSCodeLLMServer | null = null;

    // Command to start the server
    const startCommand = vscode.commands.registerCommand('chatSample.startLLMServer', async () => {
        if (server) {
            vscode.window.showWarningMessage('LLM Server is already running');
            return;
        }

        try {
            // Get port from user or use default
            const portInput = await vscode.window.showInputBox({
                prompt: 'Enter port number for LLM API server',
                value: '3000',
                validateInput: (value) => {
                    const port = parseInt(value);
                    if (isNaN(port) || port < 1 || port > 65535) {
                        return 'Please enter a valid port number (1-65535)';
                    }
                    return null;
                }
            });

            if (!portInput) return;

            const port = parseInt(portInput);
            server = new VSCodeLLMServer(port);
            await server.start();

            vscode.window.showInformationMessage(
                `LLM API Server started on http://localhost:${port}`,
                'Open in Browser'
            ).then(selection => {
                if (selection === 'Open in Browser') {
                    vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${port}/health`));
                }
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start LLM server: ${error instanceof Error ? error.message : 'Unknown error'}`);
            server = null;
        }
    });

    // Command to stop the server
    const stopCommand = vscode.commands.registerCommand('chatSample.stopLLMServer', async () => {
        if (!server) {
            vscode.window.showWarningMessage('LLM Server is not running');
            return;
        }

        try {
            await server.stop();
            server = null;
            vscode.window.showInformationMessage('LLM API Server stopped');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to stop LLM server: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });

    context.subscriptions.push(startCommand, stopCommand);

    // Clean up on extension deactivation
    context.subscriptions.push({
        dispose: async () => {
            if (server) {
                await server.stop();
            }
        }
    });
}
