export function shortUID() {
  return Math.abs(Date.now() ^ (Math.random() * 10000000000000)).toString(32);
}
