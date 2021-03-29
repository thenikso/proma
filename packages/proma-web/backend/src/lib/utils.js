export function defer() {
  const result = {
    promise: null,
    resolve: null,
    reject: null,
  };
  result.promise = new Promise((res, rej) => {
    result.resolve = res;
    result.reject = rej;
  });
  return result;
}

export function timeout(ms, err) {
  return new Promise((resolve, reject) => {
    setTimeout(err ? () => reject(err) : resolve, ms);
  });
}

export function ok(data) {
  return {
    statusCode: 200,
    body: JSON.stringify(data, null, 2),
  };
}

export function error(code, error) {
  if (error instanceof Error) {
    error = error.message;
  }
  return {
    statusCode: code,
    body: JSON.stringify({ error }, null, 2),
  };
}

export function atob(data) {
  return Buffer.from(data, 'utf8').toString('base64');
}

export function btoa(data) {
  return Buffer.from(data, 'base64').toString('utf8');
}

export function interceptStdout(stdoutIntercept, stderrIntercept) {
  stderrIntercept = stderrIntercept || stdoutIntercept;

  const stdoutWrite = process.stdout.write;
  const stderrWrite = process.stderr.write;

  process.stdout.write = function (str) {
    const args = Array.from(arguments);
    args[0] = interceptor(String(str), stdoutIntercept);
    return stdoutWrite.apply(process.stdout, args);
  };

  process.stderr.write = function (str) {
    const args = Array.from(arguments);
    args[0] = interceptor(String(str), stderrIntercept);
    return stderrWrite.apply(process.stderr, args);
  };

  function interceptor(str, callback) {
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
