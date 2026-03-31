import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";

export interface Env {
  SERPER_API_KEY: string;
}

// Define our MCP agent with tools
export class MyMCP extends McpAgent<Env> {
  server = new McpServer({
    name: "PulseMarket MCP Server",
    version: "1.0.0",
  });

  async init() {
    // Web Search tool using Serper.dev
    this.server.tool(
      "web_search",
      "Search the web for real-time information, news, and facts to resolve prediction markets.",
      {
        query: z.string().describe("The specific search query to execute"),
      },
      async ({ query }) => {
        const apiKey = this.env.SERPER_API_KEY;
        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: "Error: SERPER_API_KEY is not configured.",
              },
            ],
          };
        }

        try {
          const response = await fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: {
              "X-API-KEY": apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ q: query }),
          });

          if (!response.ok) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error: Serper API returned ${response.status}`,
                },
              ],
            };
          }

          const data = (await response.json()) as any;
          let resultText = `Search Results for "${query}":\n\n`;

          if (data.answerBox) {
            resultText += `**Answer Box:** ${
              data.answerBox.answer || data.answerBox.snippet
            }\n\n`;
          }

          if (data.organic && data.organic.length > 0) {
            const topResults = data.organic.slice(0, 5);
            resultText += "**Organic Results:**\n";
            resultText += topResults
              .map((r: any) => `- ${r.title}\n  ${r.snippet}\n  ${r.link}`)
              .join("\n\n");
          } else {
            resultText += "No organic results found.";
          }

          return { content: [{ type: "text", text: resultText }] };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error performing search: ${error.message}`,
              },
            ],
          };
        }
      },
    );
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/mcp") {
      return MyMCP.serve("/mcp").fetch(request, env, ctx);
    }

    return new Response("Not found", { status: 404 });
  },
};
