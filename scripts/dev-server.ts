/**
 * Local development server for testing API functions
 * Mimics Vercel's /api routing without the vercel dev CLI
 *
 * Usage: pnpm dev:local
 */
import { createServer } from "node:http";
import { parse } from "node:url";

// Import API handlers
import * as health from "../api/health.js";

const PORT = process.env.PORT || 3000;

const routes: Record<string, { GET?: (req: Request) => Promise<Response> | Response }> = {
  "/api/health": health,
  "/health": health, // Also support /health for convenience
};

const server = createServer(async (req, res) => {
  const { pathname } = parse(req.url || "/");
  const method = req.method || "GET";

  console.log(`${method} ${pathname}`);

  // Find matching route
  const handler = routes[pathname || "/"];
  if (!handler) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  // Get the method handler
  const methodHandler = handler[method as keyof typeof handler];
  if (!methodHandler) {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    // Create a Request object (simplified)
    const url = `http://localhost:${PORT}${req.url}`;
    const request = new Request(url, { method });

    // Call the handler
    const response = await methodHandler(request);

    // Send response
    res.writeHead(response.status, {
      "Content-Type": response.headers.get("Content-Type") || "application/json",
    });
    const body = await response.text();
    res.end(body);
  } catch (error) {
    console.error("Handler error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Local dev server running at http://localhost:${PORT}`);
  console.log("Available routes:");
  for (const route of Object.keys(routes)) {
    console.log(`  - ${route}`);
  }
});
