/**
 * Example client showing how to use the OpenAI-compatible API
 * This file is not part of the extension, just for demonstration
 */

// Example using fetch (can be used in browser or Node.js with node-fetch)
async function testOpenAIAPI() {
    const baseURL = 'http://localhost:3000';

    // Test health endpoint
    console.log('Testing health endpoint...');
    const healthResponse = await fetch(`${baseURL}/health`);
    const health = await healthResponse.json();
    console.log('Health:', health);

    // Test models endpoint
    console.log('\nTesting models endpoint...');
    const modelsResponse = await fetch(`${baseURL}/v1/models`);
    const models = await modelsResponse.json();
    console.log('Available models:', models);

    // Test chat completions (non-streaming)
    console.log('\nTesting chat completions (non-streaming)...');
    const chatResponse = await fetch(`${baseURL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'copilot-gpt-4o', // or any available model
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: 'What is the capital of France?' }
            ],
            max_tokens: 100
        })
    });

    const chatResult = await chatResponse.json();
    console.log('Chat response:', chatResult);

    // Test streaming
    console.log('\nTesting chat completions (streaming)...');
    const streamResponse = await fetch(`${baseURL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'copilot-gpt-4o',
            messages: [
                { role: 'user', content: 'Tell me a short joke about programming' }
            ],
            stream: true
        })
    });

    if (streamResponse.body) {
        const reader = streamResponse.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.choices[0].delta.content) {
                            process.stdout.write(data.choices[0].delta.content);
                        }
                    } catch (e) {
                        // Ignore parsing errors for incomplete chunks
                    }
                }
            }
        }
        console.log('\n');
    }
}

// Example using a popular OpenAI SDK-compatible library
async function testWithOpenAISDK() {
    // This would work with the official OpenAI SDK by changing the base URL
    // npm install openai

    /*
    import OpenAI from 'openai';

    const openai = new OpenAI({
        baseURL: 'http://localhost:3000/v1',
        apiKey: 'dummy-key', // Not used but required by the SDK
    });

    // Non-streaming
    const completion = await openai.chat.completions.create({
        model: 'copilot-gpt-4o',
        messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Hello! How can you help me?' }
        ],
    });

    console.log(completion.choices[0].message.content);

    // Streaming
    const stream = await openai.chat.completions.create({
        model: 'copilot-gpt-4o',
        messages: [{ role: 'user', content: 'Tell me a story about a robot' }],
        stream: true,
    });

    for await (const chunk of stream) {
        process.stdout.write(chunk.choices[0]?.delta?.content || '');
    }
    */
}

// Example using curl commands
function curlExamples() {
    console.log(`
    Example curl commands:

    # Health check
    curl http://localhost:3000/health

    # List models
    curl http://localhost:3000/v1/models

    # Chat completion
    curl -X POST http://localhost:3000/v1/chat/completions \\
      -H "Content-Type: application/json" \\
      -d '{
        "model": "copilot-gpt-4o",
        "messages": [
          {"role": "system", "content": "You are a helpful assistant."},
          {"role": "user", "content": "Hello!"}
        ]
      }'

    # Streaming chat completion
    curl -X POST http://localhost:3000/v1/chat/completions \\
      -H "Content-Type: application/json" \\
      -d '{
        "model": "copilot-gpt-4o",
        "messages": [
          {"role": "user", "content": "Count to 10"}
        ],
        "stream": true
      }'
    `);
}

// Run the test if this file is executed directly
if (typeof window === 'undefined' && require.main === module) {
    testOpenAIAPI().catch(console.error);
}

export { testOpenAIAPI, testWithOpenAISDK, curlExamples };
