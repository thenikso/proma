<script>
	export let text;
	export let matches = undefined;
	export let matchesKey = undefined;

	$: relevantMatches = matchesKey ? matches.filter(({ key }) => key === matchesKey) : matches;

	$: workingParts =
		!relevantMatches || relevantMatches.length === 0
			? [{ score: 0, text }]
			: relevantMatches[0].indices.reduce(
					(res, [s, e]) => {
						if (res.lastIndex < s) {
							res.array.push({ score: 0, text: text.substring(res.lastIndex, s) });
						}
						res.array.push({ score: 1, text: text.substring(s, e + 1) });
						res.lastIndex = e + 1;
						return res;
					},
					{ array: [], lastIndex: 0 },
				);

	$: textParts = [
		...workingParts.array,
		...(workingParts.lastIndex < text.length
			? [{ score: 0, text: text.substr(workingParts.lastIndex) }]
			: []),
	];
</script>

{#each textParts as { text, score }}
	{#if score > 0}<em>{text}</em>{:else}<span>{text}</span>{/if}
{/each}
