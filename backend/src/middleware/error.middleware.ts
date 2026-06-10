import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error(err);

  const status = (err as any).status ?? (err as any).statusCode ?? 500;
  const message = err.message ?? "Internal server error";

  res.status(status).json({ error: message });
}
