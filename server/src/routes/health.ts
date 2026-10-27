import { Router, type Request, type Response } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptimeSec: Number(process.uptime().toFixed(3)),
    db: 'not_connected',
    timestamp: new Date().toISOString(),
  });
});
