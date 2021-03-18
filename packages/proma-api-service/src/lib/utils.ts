export function defer<T = any>() {
  const result: any = {
    promise: null,
    resolve: null,
    reject: null,
  };
  result.promise = new Promise<T>((res, rej) => {
    result.resolve = res;
    result.reject = rej;
  });
  return result as {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
  };
}

export function ok(data: any) {
  return {
    statusCode: 200,
    body: JSON.stringify(data, null, 2),
  };
}

export function error(code: number, error: Error | string) {
  if (error instanceof Error) {
    error = error.message;
  }
  return {
    statusCode: code,
    body: JSON.stringify({ error }, null, 2),
  };
}

export function atob(data: string): string {
  return Buffer.from(data, 'utf8').toString('base64');
}

export function btoa(data: string): string {
  return Buffer.from(data, 'base64').toString('utf8');
}

export function interceptStdout(
  stdoutIntercept: (str: string) => string | void,
  stderrIntercept: (str: string) => string | void,
): () => void {
  stderrIntercept = stderrIntercept || stdoutIntercept;

  const stdoutWrite = process.stdout.write;
  const stderrWrite = process.stderr.write;

  process.stdout.write = function (str: Uint8Array | string) {
    const args = Array.from(arguments);
    args[0] = interceptor(String(str), stdoutIntercept);
    return stdoutWrite.apply(process.stdout, args);
  };

  process.stderr.write = function (str: Uint8Array | string) {
    const args = Array.from(arguments);
    args[0] = interceptor(String(str), stderrIntercept);
    return stderrWrite.apply(process.stderr, args);
  };

  function interceptor(
    str: string,
    callback: (str: string) => string | void,
  ): string {
    const result = callback(str);
    if (typeof result === 'string') {
      str = result.replace(/\n$/, '') + (result && /\n$/.test(str) ? '\n' : '');
    }
    return str;
  }

  return function unhook() {
    process.stdout.write = stdoutWrite;
    process.stderr.write = stderrWrite;
  };
}
