import { Buffer } from "buffer";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@initia/interwovenkit-react/styles.css";
import {
  injectStyles,
  InterwovenKitProvider,
  TESTNET,
} from "@initia/interwovenkit-react";
import InterwovenKitStyles from "@initia/interwovenkit-react/styles.js";
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.jsx";
import "./index.css";
import { customChain } from "./config/chain";

window.Buffer = Buffer;
window.process = { env: { NODE_ENV: "development" } };

// Inject styles for the widget
injectStyles(InterwovenKitStyles);

const queryClient = new QueryClient();
const wagmiConfig = createConfig({
  chains: [mainnet],
  transports: { [mainnet.id]: http() },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <InterwovenKitProvider
          {...TESTNET}
          enableAutoSign={true}
          defaultChainId={customChain.chain_id}
          customChain={customChain}
          customChains={[customChain]}
        >
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </InterwovenKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
