import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import * as proma from '@proma/core';

const cache = new Map();

export async function get(req: Request, res: Response): Promise<void> {
  const { project, func } = req.params;
  const codePath = path.resolve(
    process.cwd(),
    'projects',
    project,
    func,
    'GET.json',
  );
  const codeStats = await fs.promises.stat(codePath);

  const codeCacheKey = `${project}/${func}`;
  const codeCachedAtTime = codeStats.mtimeMs;

  let hit = cache.get(codeCacheKey);
  if (!hit || hit.time !== codeCachedAtTime) {
    let code = await fs.promises.readFile(codePath, { encoding: 'utf-8' });
    code = JSON.parse(code);
    const Handler = proma.fromJSON(proma.chip, code);
    const makeCompiledHandler = new Function(
      'return (' + Handler.compile() + ')',
    );
    const handler = new (makeCompiledHandler())();
    hit = { handler, time: codeCachedAtTime };
    cache.set(codeCacheKey, hit);
  }
  const handler = hit.handler;

  const result = defer();
  handler.in.query = req.query;
  handler.out.then(() => {
    result.resolve(handler.out.result());
  });
  handler.in.exec();

  res.writeHead(200, {
    'Content-Type': 'application/json',
  });

  res.end(JSON.stringify({ fromChip: await result.promise }));
}

function defer() {
  let resolve: (value: unknown) => void;
  let reject: (reason?: any) => void;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
