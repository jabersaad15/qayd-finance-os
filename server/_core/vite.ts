import express, { type Express, type Request, type Response } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

const privateRoutePrefixes = [
  "/app",
  "/accountant",
  "/sales",
  "/billing",
  "/accounting",
  "/accounts",
  "/operations",
  "/tax",
  "/documents",
  "/audit",
  "/settings",
  "/print/",
  "/customer-portal/",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/change-password",
];

function isPrivateRoute(pathname: string) {
  return privateRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

function setNoIndexForPrivateRoute(req: Request, res: Response) {
  const pathname = new URL(req.originalUrl, "http://localhost").pathname;
  if (isPrivateRoute(pathname)) {
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
}

function setMarketingCacheHeaders(res: Response) {
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=600, stale-while-revalidate=86400");
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.get("/", async (_req, res, next) => {
    try {
      const marketingPage = path.resolve(import.meta.dirname, "../..", "client", "public", "landing.html");
      const template = await fs.promises.readFile(marketingPage, "utf-8");
      const page = await vite.transformIndexHtml("/", template);
      setMarketingCacheHeaders(res);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      next(error);
    }
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // Always reload index.html from disk in development in case it changes.
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      setNoIndexForPrivateRoute(req, res);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      next(error);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      "Could not find the build directory: make sure to build the client first"
    );
  }

  app.get("/", (_req, res) => {
    setMarketingCacheHeaders(res);
    res.sendFile(path.resolve(distPath, "landing.html"));
  });

  app.use(express.static(distPath));

  // Fall through to the SPA only when a static SEO file or page does not exist.
  app.use("*", (req, res) => {
    setNoIndexForPrivateRoute(req, res);
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
