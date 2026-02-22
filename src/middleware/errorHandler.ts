import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error(`[error] ${err.name}: ${err.message}`);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.code ?? 'AppError',
      message: err.message,
    });
    return;
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    res.status(400).json({
      error: 'ValidationError',
      message: 'Request validation failed',
      details: (err as any).issues,
    });
    return;
  }

  // SQLite constraint errors
  if (err.message?.includes('UNIQUE constraint failed')) {
    const field = err.message.split('.').pop() ?? 'field';
    res.status(409).json({
      error: 'Conflict',
      message: `A record with this ${field} already exists`,
    });
    return;
  }

  // Fallback
  res.status(500).json({
    error: 'InternalServerError',
    message: 'Something went wrong',
  });
}
