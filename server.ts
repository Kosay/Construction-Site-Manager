import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API Route to proxy PDF documents and bypass browser CORS restrictions
  app.get("/api/proxy-pdf", async (req, res) => {
    const pdfUrl = req.query.url as string;
    if (!pdfUrl) {
      return res.status(400).send("Missing url parameter");
    }

    try {
      if (!pdfUrl.startsWith("http://") && !pdfUrl.startsWith("https://")) {
        return res.status(400).send("Invalid url format");
      }

      console.log(`[Proxy] Fetching PDF from: ${pdfUrl}`);
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        return res.status(response.status).send(`Failed to fetch PDF: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "application/pdf";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=3600");

      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
      console.error("[Proxy Error] failed to load PDF:", error);
      res.status(500).send(error.message || "Internal Server Error");
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
