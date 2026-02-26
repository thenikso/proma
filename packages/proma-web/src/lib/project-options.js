export function buildProjectsOptions(storageKeys = []) {
	const options = storageKeys
		.filter((k) => k.startsWith('project-'))
		.map((k) => k.slice(8))
		.sort((a, b) => a.localeCompare(b))
		.map((label) => ({
			label,
			value: 'project-' + label,
		}));

	return [
		{
			label: '➕ New Project',
			value: 'new',
		},
		...options,
	];
}

export function projectSelectOptionLabel(option) {
	return option.isCreator ? `Save as "${option.label}"` : option.label;
}

export function projectSelectCreateItem(text) {
	return {
		value: 'saveas-' + text,
		label: text,
	};
}
