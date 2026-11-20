# Hydroxide

Hydroxide is an account-free AI chat workspace for your desktop browser. A local Node.js server connects to the model and search providers you configure.

## Run locally

Requires Node.js 22.12 or later.

```sh
npm ci
npm run build
npm start
```

Open [http://127.0.0.1:3001](http://127.0.0.1:3001). The server binds to loopback by default. Use `PORT` to choose a different port.

For development, run `npm run dev` and open [http://127.0.0.1:5173](http://127.0.0.1:5173). Vite proxies API requests to the local Node server on port 3001.

## Connect a provider

Open **Settings & connections → Providers**. Choose a preset or add a custom endpoint, configure its URL and credentials, then click **Import models** or add model IDs manually. Choose an enabled model above the chat.

Hydroxide supports OpenAI Chat Completions, OpenAI Responses, and Anthropic Messages. Compatible local endpoints such as Ollama can use HTTP. Custom headers support gateways that use their own authentication.

Responses stream into the chat. You can start new conversations while other chats are generating and stop each request from its own conversation. Configure Tavily or Exa under **Web search**, and use **Image Studio** to generate images with an enabled image model.

## Storage and backups

Chats, settings, and provider credentials live in browser storage. Generated images use IndexedDB. Use **Settings → Data & backups** to import or export the workspace, or choose chats and images, providers, or preferences. JSON exports omit API keys and custom header values.

## Bundled assets

Provider icons are from Lobe Icons under the [MIT license](public/icons/LICENSE). Geist and Geist Mono are bundled under the SIL Open Font License. [Geist license](public/fonts/geist-LICENSE) · [Geist Mono license](public/fonts/geist-mono-LICENSE)
