const browserify = require('browserify')();
browserify.add(process.argv[2]);

const fs = require('fs');
const file = fs.createWriteStream(process.argv[3]);
file.write('const exp = ');

let code = '';
const bundle = browserify.bundle();
bundle.on('data', (chunk) => {
  code += chunk;
  file.write(chunk);
});
bundle.on('end', () => {
  const [, moduleId] = /(\d+)]\);\s*$/s.exec(code);
  file.write(`export default exp(${moduleId});`);
});
