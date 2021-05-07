import lz from 'lz-string';

export function encodeURISource(source) {
  source = JSON.stringify(source);
  const ids = Array.from(source.matchAll(/"id":\s*"(.+?)"/g)).map((x) => x[1]);
  const idExp = /^c(\d+)$/;
  let shortId = Math.max(
    0,
    ...ids
      .map((id) => id.match(idExp))
      .filter((x) => !!x)
      .map((r) => parseInt(r[1])),
  );
  for (const id of ids) {
    if (!idExp.test(id)) {
      source = source.replaceAll(id, 'c' + shortId++);
    }
  }
  // TODO shortned props
  source = lz.compressToEncodedURIComponent(source);
  return source;
}

export function decodeURISource(source) {
  source = lz.decompressFromEncodedURIComponent(source);
  source = JSON.parse(source);
  // TODO expand props
  return source;
}
