/**
 * Test file to verify the OpenAI-compatible API functionality
 * Run this after starting the LLM server in VS Code
 */

import { VSCodeOpenAIAPI, OpenAIAPIServer } from './src/openai-api';

async function testAPI() {
    console.log('🚀 Testing VS Code OpenAI-compatible API...\n');

    try {
        // Test the core API
        console.log('1. Initializing API...');
        const api = VSCodeOpenAIAPI.getInstance();
        await api.initialize();
        console.log('✅ API initialized successfully\n');

        // Test listing models
        console.log('2. Listing available models...');
        const models = api.listModels();
        console.log('Available models:', models);
        console.log('✅ Models listed successfully\n');

        // Test non-streaming chat completion
        console.log('3. Testing non-streaming chat completion...');
        const response = await api.createChatCompletion({
            messages: [
                { role: 'system', content: 'You are a helpful assistant. Keep your response brief.' },
                { role: 'user', content: 'What is 2+2? Just give the number.' }
            ]
        });

        console.log('Response:', response.choices[0].message.content);
        console.log('✅ Non-streaming completion successful\n');

        // Test streaming chat completion
        console.log('4. Testing streaming chat completion...');
        console.log('Streaming response: ');
        
        const streamResponse = api.createChatCompletionStream({
            messages: [
                { role: 'user', content: 'Count from 1 to 5, one number per line.' }
            ]
        });

        for await (const chunk of streamResponse) {
            if (chunk.choices[0].delta.content) {
                process.stdout.write(chunk.choices[0].delta.content);
            }
        }
        console.log('\n✅ Streaming completion successful\n');

        // Test the HTTP server wrapper
        console.log('5. Testing HTTP server wrapper...');
        const server = new OpenAIAPIServer();
        
        const modelsResponse = await server.handleModels();
        console.log('Models via server:', modelsResponse.data.length, 'models found');
        
        const chatResponse = await server.handleChatCompletions({
            messages: [
                { role: 'user', content: 'Say "Hello from VS Code LLM!"' }
            ]
        });
        
        if ('choices' in chatResponse) {
            console.log('Server response:', chatResponse.choices[0].message.content);
        }
        console.log('✅ HTTP server wrapper successful\n');

        console.log('🎉 All tests passed! The OpenAI-compatible API is working correctly.');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        
        if (error instanceof Error && error.message.includes('No language models available')) {
            console.log('\n💡 Make sure you have:');
            console.log('   - GitHub Copilot extension installed and activated');
            console.log('   - Signed in to GitHub Copilot');
            console.log('   - VS Code language model access enabled');
        }
    }
}

// Only run if this file is executed directly
if (require.main === module) {
    testAPI();
}

export { testAPI };
