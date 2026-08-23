import "dotenv/config";
import express from "express";
import cors from "cors";
import compression from "compression";
import path from "path";
import { initDb } from "./db";
import menuRouter from "./routes/menu";
import ordersRouter from "./routes/orders";
import uploadRouter from "./routes/upload";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(compression());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Photos are uploaded directly to Cloudinary (see routes/upload.ts), so no
// local file storage is needed — this keeps the server stateless, which
// matters on hosts with an ephemeral filesystem (e.g. Render).
app.use("/api/menu", menuRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/upload", uploadRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Serve the frontend as static files in production/dev
const frontendPath = path.join(__dirname, "..", "..", "frontend");
app.use(express.static(frontendPath));

// Final safety net: any error that reaches here (from asyncHandler, or a
// synchronous throw) gets a clean JSON response instead of an unhandled
// exception. The network to the database is unreliable enough that we'd
// rather degrade gracefully on a bad request than take the whole app down.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled request error:", err.message);
  if (!res.headersSent) {
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection (ignored to keep the server alive):", reason);
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Restaurant POS server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
