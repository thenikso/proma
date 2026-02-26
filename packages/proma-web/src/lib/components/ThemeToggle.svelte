<script>
	import Moon from '@lucide/svelte/icons/moon';
	import Sun from '@lucide/svelte/icons/sun';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { getPreferredTheme, toggleTheme } from '$lib/theme';

	let theme = $state('light');

	onMount(() => {
		theme = getPreferredTheme();
	});

	function handleToggle() {
		theme = toggleTheme();
	}
</script>

<Button
	type="button"
	size="icon"
	variant="ghost"
	class=""
	disabled={false}
	title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
	onclick={handleToggle}
>
	{#if theme === 'dark'}
		<Sun class="h-4 w-4" />
	{:else}
		<Moon class="h-4 w-4" />
	{/if}
</Button>
