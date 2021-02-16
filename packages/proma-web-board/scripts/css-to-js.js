import { createFilter } from '@rollup/pluginutils';

export default function css(options = {}) {
  const filter = createFilter(options.include || ['**/*.css'], options.exclude);
  const styles = {};
  const order = [];
  let changes = 0;

  return {
    name: 'css-to-js',
    transform(code, id) {
      if (!filter(id)) {
        return;
      }

      return `(function(d){
        const style = d.createElement('style');
        style.type = 'text/css';
        style.innerText = \`${code}\`;
        d.head.appendChild(style);
      })(window.document);`;
    },
  };
}
