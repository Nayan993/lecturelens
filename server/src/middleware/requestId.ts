import type { Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/** Attach a unique requestId to every request so errors can be correlated. */
export function requestId(req: Request, _res: Response, next: NextFunction): void {
  req.requestId = nanoid();
  next();
}
