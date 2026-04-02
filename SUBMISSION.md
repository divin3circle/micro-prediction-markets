## Initia Hackathon Submission

- **Project Name**: Micro Prediction Markets

### Project Overview

Micro Prediction Markets is a full-stack prediction market appchain demo built on Initia. It lets users create markets, place YES/NO bets, and resolve outcomes with an automated oracle workflow powered by Gemini and live web evidence. The project is valuable because it combines on-chain market logic, off-chain automation, and explainable AI verdicts into a single end-to-end product.

### Implementation Detail

- **The Custom Implementation**: We designed and implemented the full market automation stack, including market lifecycle management, persistent AI verdict storage, and a dedicated MCP evidence server for web search and crypto price checks. This makes the system resilient across restarts and gives the oracle a reliable, auditable path from live evidence to on-chain resolution.
- **The Native Feature**: We used Initia auto-signing in the frontend so transactions can be submitted more smoothly without repeated signing friction. This improves the user experience by making bet placement, market creation, and claim flows faster and more seamless while still keeping wallet control in the user's hands.

### How to Run Locally

1. Start the contracts and appchain environment so the Move module is available at the configured module address.
2. Run the MCP server in `pulsemarket-mcp` with your Serper and CoinGecko credentials in `.dev.vars`.
3. Run the agent in `pulsemarket-agent` after setting `.env` with the oracle mnemonic, Gemini key, and chain URLs.
4. Run the frontend in `pulsemarket-frontend` with the `VITE_*` environment variables pointing to the local agent and chain endpoints.
