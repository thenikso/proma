<svelte:options runes={true} />

<script>
	let { type = 'exec', connected = false } = $props(); // NOTE this is more like "kind" than "type"
</script>

{#if type === 'exec'}
	<svg
		class="Outlet OutletType-exec"
		class:OutletConnected={connected}
		width="14px"
		height="14px"
		viewBox="0 0 14 14"
		version="1.1"
		xmlns="http://www.w3.org/2000/svg"
		xmlns:xlink="http://www.w3.org/1999/xlink"
	>
		<path
			class="OutletSocket"
			d="M7.51858978,13 C9.17524069,11.3077914 9.62157492,10.8471271 10.2125708,10.2177479 C10.2565449,10.1708903 10.2565449,10.1708903 10.3004686,10.1239759 C10.8730068,9.51209497 11.2886114,9.05400143 12.8688865,7.2985412 C13.0406255,7.10776364 13.0394148,6.84912109 12.8914308,6.69528838 C11.0883032,4.8208974 10.6383651,4.35154225 10.0157286,3.69283325 C9.9967594,3.67276293 9.9967594,3.67276293 9.97779417,3.65268844 C9.40248877,3.04366974 8.98159809,2.59242046 7.50290681,1 C4.96161701,1 4.81652504,1 2,1 C1.44771525,1 1,1.44771525 1,2 L1,12 C1,12.5522847 1.44771525,13 2,13 C4.82230767,13 4.96220153,13 7.51858978,13 Z"
			stroke="currentColor"
			stroke-width="2"
			fill="transparent"
		/>
	</svg>
{:else}
	<svg
		class="Outlet OutletType-{type}"
		class:OutletConnected={connected}
		width="14px"
		height="14px"
		viewBox="0 0 14 14"
		version="1.1"
		xmlns="http://www.w3.org/2000/svg"
		xmlns:xlink="http://www.w3.org/1999/xlink"
	>
		<rect
			stroke="currentColor"
			stroke-width="2"
			fill="transparent"
			x="1"
			y="1"
			width="12"
			height="12"
			rx="3"
		/>
		<rect class="OutletSocket" x="3" y="3" width="8" height="8" rx="1" />
	</svg>
{/if}

<style>
	.Outlet .OutletSocket {
		fill: transparent;
	}

	.Outlet.OutletConnected .OutletSocket {
		fill: currentColor;
	}

	.Outlet {
		color: var(--proma-board--type-any, #00a7ef);
	}

	.Outlet.OutletType-exec {
		color: var(--proma-board--type-exec, #e7e7e7);
	}

	.Outlet.OutletType-string {
		color: var(--proma-board--type-string, #55d67c);
	}

	.Outlet.OutletType-number {
		color: var(--proma-board--type-number, #57acee);
	}

	.Outlet.OutletType-boolean {
		color: var(--proma-board--type-boolean, #eeac57);
	}

	.Outlet.OutletType-object {
		color: var(--proma-board--type-object, #ac57ee);
	}

	.Outlet.OutletType-array {
		color: var(--proma-board--type-array, #bf7df2);
	}

	.Outlet.OutletType-tuple {
		color: var(--proma-board--type-tuple, #cd82a3);
	}

	.Outlet.OutletType-function {
		color: var(--proma-board--type-function, #d6557c);
	}
</style>
