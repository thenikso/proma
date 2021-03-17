export function defer<T>() {
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

export function error(code: number, error: Error) {
  return {
    statusCode: code,
    body: JSON.stringify({ error: error.message }, null, 2),
  };
}
