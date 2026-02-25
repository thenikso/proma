<script>
	import { onMount, createEventDispatcher } from 'svelte';
	import CodeMirror from 'codemirror';
	import 'codemirror/lib/codemirror.css';

	import 'codemirror/mode/javascript/javascript.js';
	import 'codemirror/mode/xml/xml.js';
	import 'codemirror/mode/css/css.js';
	import 'codemirror/mode/htmlmixed/htmlmixed.js';
	import 'codemirror/mode/markdown/markdown.js';

	const dispatch = createEventDispatcher();
	// export let errorLoc = null;

	let editor = $state();
	let mode;
	let theme;
	let textareaEl = $state();
	let updating_externally = false;
	let marker;
	let error_line;
	let destroyed = false;
	let previous_error_line;

	/**
	 * @typedef {Object} Props
	 * @property {string} [value]
	 * @property {boolean} [readonly]
	 * @property {boolean} [lineNumbers] - export let flex = false;
	 * @property {boolean} [tab]
	 * @property {any} [cmdEnter]
	 * @property {any} [ctrlEnter]
	 * @property {any} [shiftEnter]
	 * @property {any} [cmdPeriod]
	 * @property {any} [ctrlPeriod]
	 * @property {any} [cmdHiffen]
	 * @property {any} [ctrlHiffen]
	 * @property {any} [cmdEqual]
	 * @property {any} [ctrlEqual]
	 * @property {any} [cmdOpenSquareBracket]
	 * @property {any} [ctrlOpenSquareBracket]
	 * @property {any} [cmdCloseSquareBracket]
	 * @property {any} [ctrlCloseSquareBracket]
	 * @property {any} [cmdForwardSlash]
	 * @property {any} [ctrlForwardSlash]
	 * @property {any} [useAutocomplete]
	 * @property {any} [snippets]
	 * @property {any} options
	 */

	/** @type {Props} */
	let {
		value = $bindable(''),
		readonly = false,
		lineNumbers = true,
		tab = true,
		cmdEnter = null,
		ctrlEnter = null,
		shiftEnter = null,
		cmdPeriod = null,
		ctrlPeriod = null,
		cmdHiffen = null,
		ctrlHiffen = null,
		cmdEqual = null,
		ctrlEqual = null,
		cmdOpenSquareBracket = null,
		ctrlOpenSquareBracket = null,
		cmdCloseSquareBracket = null,
		ctrlCloseSquareBracket = null,
		cmdForwardSlash = null,
		ctrlForwardSlash = null,
		useAutocomplete = null,
		snippets = null,
		options,
	} = $props();

	const MODE_MAP = {
		html: 'htmlmixed',
		md: 'markdown',
	};

	export function getEditedSource() {
		if (editor) {
			return editor.getValue();
		}
	}

	// [Original Comment] We have to expose set and update methods,
	// rather than making this state-driven through props,
	// because it's difficult to update an editor
	// without resetting scroll otherwise
	export async function set(new_value, new_mode, new_theme) {
		if (new_mode !== mode || new_theme !== theme) {
			await createEditor((mode = new_mode), (theme = new_theme));
		}
		value = new_value;
		updating_externally = true;
		if (editor) editor.setValue(value);
		updating_externally = false;
	}
	export function update(new_value) {
		value = new_value;
		if (editor) {
			const { left, top } = editor.getScrollInfo();
			editor.setValue((value = new_value));
			// editor.scrollTo(left, top);
		}
	}
	export function getValue() {
		if (editor) {
			return editor.getValue();
		}
	}
	export function getLine(lineIndex) {
		if (editor) {
			return editor.getLine(lineIndex);
		}
	}
	export function setSize(w, h) {
		if (editor) {
			return editor.setSize(w, h);
		}
	}
	export function getSelection() {
		if (editor) {
			let expression = editor.getSelection();
			if (expression == '') {
				let cursorInfo = editor.getCursor();
				expression = editor.getDoc().getLine(cursorInfo.line);
			}
			return expression;
		}
	}
	export function getCursorPosition() {
		return editor ? editor.getCursor() : undefined;
	}
	export function getRange(from, to) {
		return editor ? editor.getRange(from, to) : undefined;
	}
	export function commentSelection() {
		if (editor) {
			let expression = editor.getSelection();
			if (expression == '') {
				let cursorInfo = editor.getCursor();
				expression = editor.getDoc().getLine(cursorInfo.line);
			}
			return expression;
		}
	}
	export function getCursor() {
		if (editor) {
			return editor.getDoc().getCursor();
		}
	}
	export function selectAll() {
		if (editor) editor.execCommand('selectAll');
	}
	export function setCursor(pos) {
		if (editor) {
			editor.setCursor(pos);
		}
	}
	export function focus() {
		if (editor) {
			editor.focus();
		}
	}
	/*
	 * Find code between dividers,
	 * const divider = "__________";
	 */
	export function getBlock() {
		if (editor) {
			let cursorInfo = editor.getCursor();
			//find post divider
			let line = cursorInfo.line;
			let linePost = editor.lastLine();
			while (line < linePost) {
				if (/___+/.test(editor.getLine(line))) {
					// Test RegEx at least 3 underscores
					linePost = line - 1;
					break;
				}
				line++;
			}
			line = cursorInfo.line;
			let linePre = -1;
			while (line >= 0) {
				// console.log(editor2.getLine(line));
				if (/___+/.test(editor.getLine(line))) {
					linePre = line;
					break;
				}
				line--;
			}
			if (linePre > -1) {
				linePre++;
			}
			let code = editor.getRange(
				{
					line: linePre,
					ch: 0,
				},
				{
					line: linePost + 1,
					ch: 0,
				},
			);
			return code;
		}
	}
	export function resize() {
		editor.refresh();
	}
	export function autoComplete() {
		if (editor && CodeMirror.showHint && snippets) {
			CodeMirror.showHint(
				editor,
				function () {
					const cursor = editor.getCursor();
					const { start, string: currentWord } = editor.getTokenAt(cursor);
					const { ch: end, line } = cursor;
					const list = snippets
						.filter((snippet) => snippet.text.indexOf(currentWord) >= 0)
						.sort((a, b) => {
							if (a.text > b.text) {
								return 1;
							} else if (a.text < b.text) {
								return -1;
							} else {
								return 0;
							}
						});

					return {
						list: list.length ? list : snippets,
						from: CodeMirror.Pos(line, start),
						to: CodeMirror.Pos(line, end),
					};
				},
				{ completeSingle: false, completeOnSingleClick: false },
			);
		}
	}
	const modes = {
		js: {
			name: 'javascript',
			json: false,
		},
		json: {
			name: 'javascript',
			json: true,
		},
		ebnf: {
			name: 'ebnf',
			base: 'text/html',
		},
		svelte: {
			name: 'handlebars',
			base: 'text/html',
		},
		closure: {
			name: 'clojure',
			base: 'text/x-clojure',
		},
		asn: {
			name: 'asn.1',
			base: 'text/x-ttcn-asn',
		},
		sema: {
			name: 'sema',
			base: 'text/html',
		},
	};
	// $: {
	//   if (marker) marker.clear();
	//   if (errorLoc) {
	//     const line = errorLoc.line - 1;
	//     const ch = errorLoc.column;
	//     marker = editor.markText(
	//       { line, ch },
	//       { line, ch: ch + 1 },
	//       {
	//         className: "error-loc"
	//       }
	//     );
	//     error_line = line;
	//   } else {
	//     error_line = null;
	//   }
	// }
	// $: if (editor) {
	//   if (previous_error_line != null) {
	//     editor.removeLineClass(previous_error_line, "wrap", "error-line");
	//   }
	//   if (error_line && error_line !== previous_error_line) {
	//     editor.addLineClass(error_line, "wrap", "error-line");
	//     previous_error_line = error_line;
	//   }
	// }
	onMount(() => {
		return () => {
			destroyed = true;
			destroyEditor();
		};
	});
	let first = true;

	function destroyEditor() {
		if (!editor) return;
		const wrapper = editor.getWrapperElement?.();
		// CodeMirror's toTextArea assumes wrapper is still mounted.
		// Skip teardown call if already detached to avoid removeChild(null) crashes.
		if (wrapper?.parentNode) {
			editor.toTextArea();
		}
		editor = null;
	}

	async function createEditor(mode, theme) {
		if (destroyed || !CodeMirror) return;
		destroyEditor();
		// console.log("createEditor:", theme);
		const opts = {
			lineNumbers,
			lineWrapping: true,
			indentWithTabs: true,
			indentUnit: 2,
			tabSize: 2,
			value: '',
			mode: modes[mode] || {
				name: mode,
			},
			readOnly: readonly,
			autoCloseBrackets: true,
			autoCloseTags: true,
			extraKeys: {},
		};
		if (theme !== undefined) opts.theme = theme;
		if (!tab)
			opts.extraKeys = {
				Tab: tab,
				'Shift-Tab': tab,
			};
		if (cmdEnter) opts.extraKeys['Cmd-Enter'] = cmdEnter;
		if (ctrlEnter) opts.extraKeys['Ctrl-Enter'] = ctrlEnter;
		if (shiftEnter) opts.extraKeys['Shift-Enter'] = shiftEnter;
		if (cmdPeriod) opts.extraKeys['Cmd-.'] = cmdPeriod;
		if (ctrlPeriod) opts.extraKeys['Ctrl-.'] = ctrlPeriod;
		if (cmdHiffen) opts.extraKeys['Cmd--'] = cmdHiffen;
		if (ctrlHiffen) opts.extraKeys['Ctrl--'] = ctrlHiffen;
		if (cmdEqual) opts.extraKeys['Cmd-='] = cmdEqual;
		if (ctrlEqual) opts.extraKeys['Cmd-='] = ctrlEqual;
		if (cmdCloseSquareBracket) opts.extraKeys['Cmd-]'] = cmdCloseSquareBracket;
		if (cmdOpenSquareBracket) opts.extraKeys['Cmd-['] = cmdOpenSquareBracket;
		if (ctrlCloseSquareBracket) opts.extraKeys['Ctrl-]'] = ctrlCloseSquareBracket;
		if (ctrlOpenSquareBracket) opts.extraKeys['Ctrl-['] = ctrlOpenSquareBracket;
		if (cmdForwardSlash) opts.extraKeys['Cmd-/'] = () => editor.execCommand('toggleComment');
		if (ctrlForwardSlash) opts.extraKeys['Ctrl-/'] = () => editor.execCommand('toggleComment');

		if (useAutocomplete) opts.extraKeys['Ctrl-Space'] = () => autoComplete();
		// if(ctrlForwardSlash)
		//   opts.extraKeys["Ctrl-/"] = (ctrlForwardSlash);
		// if(cmdEnter && !opts.extraKeys["Cmd-Enter"])
		//   opts.extraKeys["Cmd-Enter"] = (cmdEnter);
		// Creating a text editor is a lot of work, so we yield
		// the main thread for a moment. This helps reduce jank
		if (first) await sleep(50);
		if (destroyed) return;
		editor = CodeMirror.fromTextArea(textareaEl, opts);
		editor.on('change', (instance, changeObj) => {
			if (!updating_externally) {
				// const value = instance.getValue();
				dispatch('change', { changeObj });
			}
		});
		editor.on('focus', (instance, event) => {
			if (!updating_externally) {
				dispatch('focus', { event });
			}
		});
		editor.on('blur', (instance, event) => {
			if (!updating_externally) {
				dispatch('blur', { event });
			}
		});
		editor.on('refresh', (instance, event) => {
			if (!updating_externally) {
				dispatch('refresh', { event });
			}
		});
		editor.on('gutterClick', (instance, line, gutter, clickEvent) => {
			if (!updating_externally) {
				dispatch('gutterClick', { line, gutter, clickEvent });
			}
		});
		editor.on('viewportChange', (instance, from, to) => {
			if (!updating_externally) {
				dispatch('viewportChange', { from, to });
			}
		});
		if (first) await sleep(50);
		editor.refresh();
		first = false;
		dispatch('ready', { editor });
	}
	function sleep(ms) {
		return new Promise((fulfil) => setTimeout(fulfil, ms));
	}
	$effect(() => {
		if (options) {
			set(options.value || '', MODE_MAP[options.mode] || options.mode, options.theme);
		}
	});
</script>

<textarea {value} tabindex="0" bind:this={textareaEl} readonly></textarea>
{#if !CodeMirror}
	<pre>{value}</pre>
{/if}

<style>
	:global(.CodeMirror) {
		height: 100%;
	}
	textarea {
		visibility: hidden;
	}
	/*
  pre {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    border: none;
    padding: 4px 4px 4px 60px;
    resize: none;
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.7;
    user-select: none;
    pointer-events: none;
    color: #ccc;
    tab-size: 2;
    -moz-tab-size: 2;
  } */
</style>
