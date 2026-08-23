import { Request, Response, NextFunction, RequestHandler } from "express";

// Wraps an async Express route handler so a rejected promise (e.g. a DB
// query failing because the network dropped mid-request) is turned into a
// clean error response instead of an unhandled rejection — which would
// otherwise crash the entire Node process by default.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch((err: Error) => {
      console.error(`Request failed (${req.method} ${req.originalUrl}):`, err.message);
      if (!res.headersSent) {
        res.status(503).json({ error: "Database temporarily unavailable. Please try again." });
      }
    });
  };
}
