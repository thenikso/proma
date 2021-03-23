const fs = require('fs');
const browserify = require('browserify')();
browserify.add(process.argv[2]);

const file = fs.createWriteStream(process.argv[3]);
let bundle = '';

file.write('const exp = ');

const bundleStream = browserify.bundle();
bundleStream.on('data', chunk => {
  bundle += chunk;
  file.write(chunk);
});
bundleStream.on('end', () => {
  const moduleId = bundle.match(/(\d+)]\);\s*$/s)[1];
  file.write(`export default exp(${moduleId});`);
});
