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
