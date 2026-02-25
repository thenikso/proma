import fetch from 'node-fetch';

function makeGlobal(overrides) {
	const entrypointGlobal = {};
	for (const globalKey of Object.getOwnPropertyNames(global)) {
		entrypointGlobal[globalKey] = global[globalKey];
	}
	entrypointGlobal.global = entrypointGlobal;
	entrypointGlobal.globalThis = entrypointGlobal;
	entrypointGlobal.fetch = fetch;
	entrypointGlobal.process = {};
	entrypointGlobal.module = {};
	entrypointGlobal.require = () => {};
	entrypointGlobal.child_process = {};
	// TODO mask more keys in a better way

	if (overrides) {
		Object.assign(entrypointGlobal, overrides);
	}

	return entrypointGlobal;
}

// All `global` keys:
// Object
// Function
// Array
// Number
// parseFloat
// parseInt
// Infinity
// NaN
// undefined
// Boolean
// String
// Symbol
// Date
// Promise
// RegExp
// Error
// EvalError
// RangeError
// ReferenceError
// SyntaxError
// TypeError
// URIError
// globalThis
// JSON
// Math
// console
// Intl
// ArrayBuffer
// Uint8Array
// Int8Array
// Uint16Array
// Int16Array
// Uint32Array
// Int32Array
// Float32Array
// Float64Array
// Uint8ClampedArray
// BigUint64Array
// BigInt64Array
// DataView
// Map
// BigInt
// Set
// WeakMap
// WeakSet
// Proxy
// Reflect
// decodeURI
// decodeURIComponent
// encodeURI
// encodeURIComponent
// escape
// unescape
// eval
// isFinite
// isNaN
// global
// process
// Buffer
// URL
// URLSearchParams
// TextEncoder
// TextDecoder
// AbortController
// AbortSignal
// EventTarget
// Event
// MessageChannel
// MessagePort
// MessageEvent
// clearInterval
// clearTimeout
// setInterval
// setTimeout
// queueMicrotask
// clearImmediate
// setImmediate
// SharedArrayBuffer
// Atomics
// AggregateError
// FinalizationRegistry
// WeakRef
// WebAssembly
// module
// require
// assert
// async_hooks
// buffer
// child_process
// cluster
// constants
// crypto
// dgram
// diagnostics_channel
// dns
// domain
// events
// fs
// http
// http2
// https
// inspector
// net
// os
// path
// perf_hooks
// punycode
// querystring
// readline
// repl
// stream
// string_decoder
// sys
// timers
// tls
// trace_events
// tty
// url
// v8
// vm
// wasi
// worker_threads
// zlib
// _
// _error
// util
