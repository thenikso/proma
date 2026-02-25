<script>
	/**
	 * @typedef {Object} Props
	 * @property {import('svelte').Snippet} [children]
	 */

	/** @type {Props} */
	let { children } = $props();
</script>

<main>
	<nav>
		<img src="/images/logo.webp" alt="Proma" style="width: 60px" />
	</nav>
	<section class="content">
		{@render children?.()}
	</section>
</main>

<style>
	main {
		position: absolute;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;

		display: flex;
		flex-direction: row;
	}

	nav {
		flex: 0 0 96px;

		box-sizing: border-box;
		width: 96px;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 20px;

		background-color: var(--proma-panel--background-color, #fbfdfe);
		box-shadow: 1px 0 3px var(--proma-panel--shadow-color, #eaedf0);
		z-index: 1;
	}

	section {
		flex-grow: 1;
		position: relative;
	}
</style>
