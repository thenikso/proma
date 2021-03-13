import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

export async function get(req: Request, res: Response): Promise<void> {
  const { project, func } = req.params;
  const codePath = path.resolve(
    process.cwd(),
    'projects',
    project,
    func,
    'GET.mjs',
  );
  let code = await fs.promises.readFile(codePath, { encoding: 'utf-8' });
  if (code.startsWith('export default')) {
    code = code.substr('export default'.length);
  }
  const makeHandler = new Function('return (' + code + ')');
  const handler = makeHandler();

  res.writeHead(200, {
    'Content-Type': 'application/json',
  });

  res.end(JSON.stringify(await handler(req.query)));
}
