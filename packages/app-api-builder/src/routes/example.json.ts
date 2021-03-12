import type { Request, Response } from 'express';

export async function get(req: Request, res: Response): Promise<void> {
  res.writeHead(200, {
    'Content-Type': 'application/json',
  });

  res.end(
    JSON.stringify({
      message: `Ok GET`,
    }),
  );
}

export async function post(req: Request, res: Response): Promise<void> {
  res.writeHead(200, {
    'Content-Type': 'application/json',
  });

  res.end(
    JSON.stringify({
      message: `Ok POST`,
    }),
  );
}
