# VS Code LLM OpenAI-Compatible API

This extension now includes an OpenAI-compatible API server that exposes VS Code's Language Model capabilities through HTTP endpoints.

## Features

- **OpenAI-Compatible API**: Provides `/v1/chat/completions` and `/v1/models` endpoints
- **Streaming Support**: Full support for Server-Sent Events streaming
- **Multiple Models**: Automatically detects available VS Code language models
- **CORS Enabled**: Ready for web applications
- **Easy Integration**: Works with existing OpenAI SDK clients

## Quick Start

1. **Start the Server**
   - Open VS Code Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
   - Run: `Chat Sample: Start OpenAI-compatible LLM Server`
   - Enter a port number (default: 3000)

2. **Test the API**
   ```bash
   # Health check
   curl http://localhost:3000/health

   # List available models
   curl http://localhost:3000/v1/models

   # Chat completion
   curl -X POST http://localhost:3000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "copilot-gpt-4o",
       "messages": [
         {"role": "user", "content": "Hello!"}
       ]
     }'
   ```

3. **Stop the Server**
   - Command Palette → `Chat Sample: Stop OpenAI-compatible LLM Server`

## API Endpoints

### POST `/v1/chat/completions`

OpenAI-compatible chat completions endpoint.

**Request Body:**
```json
{
  "model": "copilot-gpt-4o",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "stream": false,
  "max_tokens": 1000,
  "temperature": 1.0
}
```

**Response (Non-streaming):**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "copilot-gpt-4o",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you today?"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 9,
    "total_tokens": 19
  }
}
```

**Streaming Response:**
```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677652288,"model":"copilot-gpt-4o","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677652288,"model":"copilot-gpt-4o","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: [DONE]
```

### GET `/v1/models`

List available language models.

**Response:**
```json
{
  "data": [
    {
      "id": "copilot-gpt-4o",
      "object": "model",
      "created": 1677652288,
      "owned_by": "vscode"
    }
  ]
}
```

### GET `/health`

Server health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "server": "VS Code LLM API"
}
```

## Integration Examples

### Using with OpenAI SDK

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'http://localhost:3000/v1',
  apiKey: 'dummy-key', // Not used but required
});

// Non-streaming
const completion = await openai.chat.completions.create({
  model: 'copilot-gpt-4o',
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
});

console.log(completion.choices[0].message.content);

// Streaming
const stream = await openai.chat.completions.create({
  model: 'copilot-gpt-4o',
  messages: [{ role: 'user', content: 'Count to 10' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

### Using with Fetch API

```javascript
// Non-streaming
const response = await fetch('http://localhost:3000/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'copilot-gpt-4o',
    messages: [{ role: 'user', content: 'Hello!' }]
  })
});

const result = await response.json();
console.log(result.choices[0].message.content);

// Streaming
const streamResponse = await fetch('http://localhost:3000/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'copilot-gpt-4o',
    messages: [{ role: 'user', content: 'Tell me a story' }],
    stream: true
  })
});

const reader = streamResponse.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  // Process SSE data...
}
```

### Using with Python

```python
import requests
import json

# Non-streaming
response = requests.post('http://localhost:3000/v1/chat/completions',
  headers={'Content-Type': 'application/json'},
  data=json.dumps({
    'model': 'copilot-gpt-4o',
    'messages': [{'role': 'user', 'content': 'Hello!'}]
  })
)

result = response.json()
print(result['choices'][0]['message']['content'])

# With OpenAI Python library
import openai

client = openai.OpenAI(
  base_url='http://localhost:3000/v1',
  api_key='dummy-key'
)

completion = client.chat.completions.create(
  model='copilot-gpt-4o',
  messages=[{'role': 'user', 'content': 'Hello!'}]
)

print(completion.choices[0].message.content)
```

## Architecture

The implementation consists of three main components:

1. **VSCodeOpenAIAPI** (`openai-api.ts`): Core API wrapper that translates OpenAI requests to VS Code LM calls
2. **VSCodeLLMServer** (`http-server.ts`): HTTP server that exposes REST endpoints
3. **Extension Commands**: VS Code commands to start/stop the server

## Requirements

- VS Code with Language Model capabilities (e.g., GitHub Copilot extension)
- The extension needs to be activated in VS Code
- Available language models (check with the models endpoint)

## Limitations

- Token usage estimation is approximate
- Some OpenAI parameters (like temperature) are not fully supported by VS Code LM
- Model availability depends on installed VS Code extensions
- Server runs only while VS Code is open and extension is active

## Troubleshooting

**Server won't start:**
- Check if the port is already in use
- Ensure GitHub Copilot or other LLM extensions are installed and activated

**No models available:**
- Install GitHub Copilot extension
- Sign in to GitHub Copilot
- Check VS Code settings for language model access

**API requests fail:**
- Verify the server is running (`/health` endpoint)
- Check VS Code developer console for errors
- Ensure proper request format (see examples above)
