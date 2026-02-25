<script>
	/**
	 * @typedef {Object} Props
	 * @property {any} fromPoint
	 * @property {any} toPoint
	 * @property {string} [type]
	 */

	/** @type {Props} */
	let { fromPoint, toPoint, type = 'any' } = $props();

	// SVG do not render gradients for elements with 0 with or height. When
	// a path is straight, it has 0 height. This workaround tweaks the path
	// endpoint a little to make it not exactly staright so that the gradient
	// can work as intended
	let shouldWorkaroundStraightLine = $derived(type && type.indexOf('-') >= 0);

	function connectionMakePath(fromPoint, toPoint) {
		const { x: x1, y: y1 } = toPoint;
		const { x: x4, y: y4 } = fromPoint;

		let dx = x1 - x4;
		const bezierWeight = dx > 0 ? 0.675 : 1.1;
		dx = Math.max(Math.abs(dx) * bezierWeight, 80);

		const p1x = x1;
		const p1y = y1;

		const p2x = x1 - dx;
		const p2y = y1;

		const p4x = x4;
		const p4y = y4 + (shouldWorkaroundStraightLine && p1y === y4 ? 0.0001 : 0);

		const p3x = x4 + dx;
		const p3y = y4;

		return {
			d: `M${p1x} ${p1y} C ${p2x} ${p2y} ${p3x} ${p3y} ${p4x} ${p4y}`,
			inverted: p1x < p4x,
		};
	}

	const emptyPath = { d: '', inverted: false };
	let { d, inverted } = $derived(
		(fromPoint && toPoint && connectionMakePath(fromPoint, toPoint)) || emptyPath,
	);
</script>

<path
	{d}
	class="WirePath WirePath-type-{type}"
	class:WirePath-inverted={inverted}
	stroke-width="3"
	fill="none"
/>

<style>
	.WirePath {
		stroke: var(--proma-board--type-any, #00a7ef);
	}

	.WirePath.WirePath-type-exec {
		stroke: var(--proma-board--type-exec, #e7e7e7);
	}

	.WirePath.WirePath-type-string {
		stroke: var(--proma-board--type-string, #55d67c);
	}

	.WirePath.WirePath-type-number {
		stroke: var(--proma-board--type-number, #57acee);
	}

	.WirePath.WirePath-type-boolean {
		stroke: var(--proma-board--type-boolean, #eeac57);
	}

	.WirePath.WirePath-type-object {
		stroke: var(--proma-board--type-object, #ac57ee);
	}

	.WirePath.WirePath-type-array {
		stroke: var(--proma-board--type-array, #bf7df2);
	}

	.WirePath.WirePath-type-tuple {
		stroke: var(--proma-board--type-tuple, #cd82a3);
	}

	.WirePath.WirePath-type-function {
		stroke: var(--proma-board--type-function, #d6557c);
	}

	.WirePath.WirePath-type-any-to-string,
	.WirePath.WirePath-type-string-to-any.WirePath-inverted {
		stroke: url(#any-to-string);
	}
	.WirePath.WirePath-type-any-to-number,
	.WirePath.WirePath-type-number-to-any.WirePath-inverted {
		stroke: url(#any-to-number);
	}
	.WirePath.WirePath-type-any-to-boolean,
	.WirePath.WirePath-type-boolean-to-any.WirePath-inverted {
		stroke: url(#any-to-boolean);
	}
	.WirePath.WirePath-type-any-to-object,
	.WirePath.WirePath-type-object-to-any.WirePath-inverted {
		stroke: url(#any-to-object);
	}
	.WirePath.WirePath-type-any-to-array,
	.WirePath.WirePath-type-array-to-any.WirePath-inverted {
		stroke: url(#any-to-array);
	}
	.WirePath.WirePath-type-any-to-tuple,
	.WirePath.WirePath-type-tuple-to-any.WirePath-inverted {
		stroke: url(#any-to-tuple);
	}
	.WirePath.WirePath-type-any-to-function,
	.WirePath.WirePath-type-function-to-any.WirePath-inverted {
		stroke: url(#any-to-function);
	}

	.WirePath.WirePath-type-string-to-any,
	.WirePath.WirePath-type-any-to-string.WirePath-inverted {
		stroke: url(#string-to-any);
	}
	.WirePath.WirePath-type-number-to-any,
	.WirePath.WirePath-type-any-to-number.WirePath-inverted {
		stroke: url(#number-to-any);
	}
	.WirePath.WirePath-type-boolean-to-any,
	.WirePath.WirePath-type-any-to-boolean.WirePath-inverted {
		stroke: url(#boolean-to-any);
	}
	.WirePath.WirePath-type-object-to-any,
	.WirePath.WirePath-type-any-to-object.WirePath-inverted {
		stroke: url(#object-to-any);
	}
	.WirePath.WirePath-type-array-to-any,
	.WirePath.WirePath-type-any-to-array.WirePath-inverted {
		stroke: url(#array-to-any);
	}
	.WirePath.WirePath-type-tuple-to-any,
	.WirePath.WirePath-type-any-to-tuple.WirePath-inverted {
		stroke: url(#tuple-to-any);
	}
	.WirePath.WirePath-type-function-to-any,
	.WirePath.WirePath-type-any-to-function.WirePath-inverted {
		stroke: url(#function-to-any);
	}
</style>
