import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import * as proma from '@proma/core';

const cache = new Map();

// GET :3000/run/<project_name>[@<env_name>]/<func_name>?param=value
export async function get(req: Request, res: Response): Promise<void> {
  // Acquire the JSON reppresentation of the handling chip
  const { project: projectAndEnv, func } = req.params;
  const [project, env] = projectAndEnv.split('@');
  const environment = env || 'prod';
  const codePath = path.resolve(
    process.cwd(),
    'projects',
    project,
    func,
    'GET.json',
  );
  const codeStats = await fs.promises.stat(codePath);
  // Generate cache keys
  const codeCacheKey = `${project}/${func}`;
  const codeCachedAtTime = codeStats.mtimeMs;
  // Get compiled chip from cache
  let hit = cache.get(codeCacheKey);
  // If cache miss, create the chip from the JSON
  if (
    !hit ||
    hit.time !== codeCachedAtTime ||
    hit.environment !== environment
  ) {
    let code = await fs.promises.readFile(codePath, { encoding: 'utf-8' });
    code = JSON.parse(code);
    const Handler = proma.fromJSON(proma.chip, code);
    const makeCompiledHandler = new Function(
      'return (' + Handler.compile() + ')',
    );
    // We can either use the live or compiled version, based on environment
    const handler =
      environment === 'dev' ? new Handler() : new (makeCompiledHandler())();
    // Save in cache
    hit = { handler, time: codeCachedAtTime, environment };
    cache.set(codeCacheKey, hit);
  }
  const handler = hit.handler;

  // Setup handler execution as a promise and execute
  const result = defer();
  handler.in.query = req.query;
  handler.out.then(() => {
    result.resolve(handler.out.result());
  });
  handler.in.exec();
  // Retyrb result json
  res.writeHead(200, {
    'Content-Type': 'application/json',
  });
  res.end(JSON.stringify({ resultFromChip: await result.promise }));
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
