export default function css(options = {}) {
	return {
		name: 'css-to-js',
		transform(code, id) {
			if (id.endsWith('.css')) {
				return;
			}

			return `(function(d){
        if (!d) return;
        const style = d.createElement('style');
        style.type = 'text/css';
        style.innerText = \`${code}\`;
        d.head.appendChild(style);
      })(typeof window !== 'undefined' && window.document);`;
		},
	};
}
