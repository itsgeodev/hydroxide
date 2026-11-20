# Hydroxide

Local AI chat for your desktop browser.

## Run

Requires Node.js 22.12+.

```sh
git clone https://github.com/itsgeodev/hydroxide.git
cd hydroxide
npm ci
npm run build
npm start
```

Open [http://127.0.0.1:3001](http://127.0.0.1:3001).

In **Settings & connections → Providers**, add a provider and import its models. Select a model above the chat.

## Features

- Streaming replies and concurrent chats
- OpenAI, Anthropic, and compatible endpoints including Ollama
- Image generation and optional Tavily or Exa web search
- Local chat history and workspace backups
