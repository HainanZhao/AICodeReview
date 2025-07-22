# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure your LLM provider (optional):
   - By default, the app uses the local gemini-cli installation
   - To use a different provider, set `LLM_PROVIDER` in [.env.local](.env.local) to:
     - 'gemini' for Google Gemini API
     - 'anthropic' for Claude API
   - For API-based providers, set `LLM_API_KEY` in [.env.local](.env.local)
3. Run the app:
   `npm run dev`
   - Frontend will be available at http://localhost:5960
   - Backend will be running on http://localhost:5959

Available LLM Providers:
- Gemini CLI (Local gemini-cli installation, default)
- Gemini (Google AI)
- Anthropic (Claude)

Using the Default Provider (Gemini CLI):
1. Make sure the `gemini` command is installed and available in your PATH
2. No configuration needed - it works out of the box
3. No API key required - uses your local gemini configuration

Using Other Providers:
1. Set `LLM_PROVIDER` to your chosen provider ('gemini' or 'anthropic')
2. Set `LLM_API_KEY` to your API key for the chosen provider
3. Restart the application
