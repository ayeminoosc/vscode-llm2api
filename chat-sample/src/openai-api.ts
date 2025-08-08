import * as vscode from 'vscode';

// OpenAI-like API types
export interface ChatCompletionMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ChatCompletionRequest {
    model?: string;
    messages: ChatCompletionMessage[];
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
}

export interface ChatCompletionResponse {
    id: string;
    object: 'chat.completion';
    created: number;
    model: string;
    choices: {
        index: number;
        message: ChatCompletionMessage;
        finish_reason: 'stop' | 'length' | 'content_filter';
    }[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface ChatCompletionStreamResponse {
    id: string;
    object: 'chat.completion.chunk';
    created: number;
    model: string;
    choices: {
        index: number;
        delta: {
            role?: 'assistant';
            content?: string;
        };
        finish_reason?: 'stop' | 'length' | 'content_filter' | null;
    }[];
}

/**
 * OpenAI-like API wrapper for VS Code Language Model
 */
export class VSCodeOpenAIAPI {
    private static instance: VSCodeOpenAIAPI;
    private models: vscode.LanguageModelChat[] = [];

    private constructor() {}

    public static getInstance(): VSCodeOpenAIAPI {
        if (!VSCodeOpenAIAPI.instance) {
            VSCodeOpenAIAPI.instance = new VSCodeOpenAIAPI();
        }
        return VSCodeOpenAIAPI.instance;
    }

    /**
     * Initialize the API by loading available models
     */
    public async initialize(): Promise<void> {
        try {
            // Try to get Copilot models first
            this.models = await vscode.lm.selectChatModels({ vendor: 'copilot' });

            // If no Copilot models, try other vendors
            if (this.models.length === 0) {
                this.models = await vscode.lm.selectChatModels();
            }

            console.log(`Initialized with ${this.models.length} language models`);
        } catch (error) {
            console.error('Failed to initialize language models:', error);
            throw new Error('No language models available. Please ensure GitHub Copilot or other LLM extensions are installed.');
        }
    }

    /**
     * List available models
     */
    public listModels(): string[] {
        return this.models.map(model => `${model.vendor}-${model.family}`);
    }

    /**
     * Create a chat completion (non-streaming)
     */
    public async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
        if (this.models.length === 0) {
            await this.initialize();
        }

        const model = this.selectModel(request.model);
        const messages = this.convertMessages(request.messages);
        const token = new vscode.CancellationTokenSource().token;

        try {
            const response = await model.sendRequest(messages, {
                justification: 'OpenAI-like API request'
            }, token);

            let fullContent = '';
            for await (const fragment of response.text) {
                fullContent += fragment;
            }

            const completionResponse: ChatCompletionResponse = {
                id: this.generateId(),
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: `${model.vendor}-${model.family}`,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: fullContent
                    },
                    finish_reason: 'stop'
                }],
                usage: {
                    prompt_tokens: this.estimateTokens(request.messages),
                    completion_tokens: this.estimateTokens([{ role: 'assistant', content: fullContent }]),
                    total_tokens: 0 // Will be calculated
                }
            };

            completionResponse.usage.total_tokens =
                completionResponse.usage.prompt_tokens + completionResponse.usage.completion_tokens;

            return completionResponse;

        } catch (error) {
            if (error instanceof vscode.LanguageModelError) {
                throw new Error(`Language Model Error: ${error.message} (${error.code})`);
            }
            throw error;
        }
    }

    /**
     * Create a chat completion (streaming)
     */
    public async *createChatCompletionStream(request: ChatCompletionRequest): AsyncGenerator<ChatCompletionStreamResponse> {
        if (this.models.length === 0) {
            await this.initialize();
        }

        const model = this.selectModel(request.model);
        const messages = this.convertMessages(request.messages);
        const token = new vscode.CancellationTokenSource().token;
        const id = this.generateId();
        const created = Math.floor(Date.now() / 1000);

        try {
            const response = await model.sendRequest(messages, {
                justification: 'OpenAI-like API streaming request'
            }, token);

            // First chunk with role
            yield {
                id,
                object: 'chat.completion.chunk',
                created,
                model: `${model.vendor}-${model.family}`,
                choices: [{
                    index: 0,
                    delta: { role: 'assistant' },
                    finish_reason: null
                }]
            };

            // Content chunks
            for await (const fragment of response.text) {
                yield {
                    id,
                    object: 'chat.completion.chunk',
                    created,
                    model: `${model.vendor}-${model.family}`,
                    choices: [{
                        index: 0,
                        delta: { content: fragment },
                        finish_reason: null
                    }]
                };
            }

            // Final chunk
            yield {
                id,
                object: 'chat.completion.chunk',
                created,
                model: `${model.vendor}-${model.family}`,
                choices: [{
                    index: 0,
                    delta: {},
                    finish_reason: 'stop'
                }]
            };

        } catch (error) {
            if (error instanceof vscode.LanguageModelError) {
                throw new Error(`Language Model Error: ${error.message} (${error.code})`);
            }
            throw error;
        }
    }

    /**
     * Select the appropriate model based on request
     */
    private selectModel(modelName?: string): vscode.LanguageModelChat {
        if (!modelName) {
            return this.models[0];
        }

        // Try to find exact match
        const exactMatch = this.models.find(model =>
            `${model.vendor}-${model.family}` === modelName ||
            model.family === modelName
        );

        if (exactMatch) {
            return exactMatch;
        }

        // Fallback to first available model
        return this.models[0];
    }

    /**
     * Convert OpenAI messages to VS Code messages
     */
    private convertMessages(messages: ChatCompletionMessage[]): vscode.LanguageModelChatMessage[] {
        return messages.map(msg => {
            switch (msg.role) {
                case 'system':
                case 'user':
                    return vscode.LanguageModelChatMessage.User(msg.content);
                case 'assistant':
                    return vscode.LanguageModelChatMessage.Assistant(msg.content);
                default:
                    return vscode.LanguageModelChatMessage.User(msg.content);
            }
        });
    }

    /**
     * Generate a unique ID for responses
     */
    private generateId(): string {
        return 'chatcmpl-' + Math.random().toString(36).substring(2, 15);
    }

    /**
     * Estimate token count (rough approximation)
     */
    private estimateTokens(messages: ChatCompletionMessage[]): number {
        const text = messages.map(m => m.content).join(' ');
        // Rough estimation: ~4 characters per token
        return Math.ceil(text.length / 4);
    }
}

/**
 * Express-like middleware for handling OpenAI API requests
 */
export class OpenAIAPIServer {
    private api: VSCodeOpenAIAPI;

    constructor() {
        this.api = VSCodeOpenAIAPI.getInstance();
    }

    /**
     * Handle chat completions endpoint
     */
    public async handleChatCompletions(request: ChatCompletionRequest): Promise<ChatCompletionResponse | AsyncGenerator<ChatCompletionStreamResponse>> {
        await this.api.initialize();

        if (request.stream) {
            return this.api.createChatCompletionStream(request);
        } else {
            return this.api.createChatCompletion(request);
        }
    }

    /**
     * Handle models endpoint
     */
    public async handleModels(): Promise<{ data: { id: string; object: string; created: number; owned_by: string; }[] }> {
        await this.api.initialize();
        const models = this.api.listModels();

        return {
            data: models.map(modelId => ({
                id: modelId,
                object: 'model',
                created: Math.floor(Date.now() / 1000),
                owned_by: 'vscode'
            }))
        };
    }
}

/**
 * Simple usage example
 */
export async function exampleUsage() {
    const api = VSCodeOpenAIAPI.getInstance();
    await api.initialize();

    // Non-streaming example
    const response = await api.createChatCompletion({
        messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Hello, how are you?' }
        ]
    });

    console.log('Response:', response.choices[0].message.content);

    // Streaming example
    const streamResponse = api.createChatCompletionStream({
        messages: [
            { role: 'user', content: 'Tell me a short joke' }
        ],
        stream: true
    });

    console.log('Streaming response:');
    for await (const chunk of streamResponse) {
        if (chunk.choices[0].delta.content) {
            process.stdout.write(chunk.choices[0].delta.content);
        }
    }
    console.log('\n');
}
