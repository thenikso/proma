import { describe, expect, it } from 'vitest';
import {
	buildProjectsOptions,
	projectSelectCreateItem,
	projectSelectOptionLabel,
} from './project-options';

describe('project-options', () => {
	it('builds selectable project options from storage keys', () => {
		const options = buildProjectsOptions(['foo', 'project-zeta', 'project-alpha']);

		expect(options).toEqual([
			{ label: '➕ New Project', value: 'new' },
			{ label: 'alpha', value: 'project-alpha' },
			{ label: 'zeta', value: 'project-zeta' },
		]);
	});

	it('formats creator option labels', () => {
		expect(projectSelectOptionLabel({ label: 'demo', isCreator: true })).toBe('Save as "demo"');
		expect(projectSelectOptionLabel({ label: 'demo', isCreator: false })).toBe('demo');
	});

	it('creates save-as option payloads', () => {
		expect(projectSelectCreateItem('my-project')).toEqual({
			value: 'saveas-my-project',
			label: 'my-project',
		});
	});
});
