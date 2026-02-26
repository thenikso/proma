import { afterEach, describe, expect, it } from 'vitest';
import { applyTheme, getPreferredTheme, initTheme, toggleTheme } from './theme';

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
const originalLocalStorage = globalThis.localStorage;

function mockEnv({ savedTheme = null, prefersDark = false } = {}) {
	const classes = new Set();
	const storage = new Map();
	if (savedTheme) storage.set('proma-theme', savedTheme);

	globalThis.localStorage = {
		getItem(key) {
			return storage.has(key) ? storage.get(key) : null;
		},
		setItem(key, value) {
			storage.set(key, String(value));
		},
	};

	globalThis.window = {
		matchMedia() {
			return { matches: prefersDark };
		},
	};

	globalThis.document = {
		documentElement: {
			dataset: {},
			classList: {
				contains(token) {
					return classes.has(token);
				},
				toggle(token, force) {
					if (typeof force === 'boolean') {
						if (force) classes.add(token);
						else classes.delete(token);
						return force;
					}
					if (classes.has(token)) {
						classes.delete(token);
						return false;
					}
					classes.add(token);
					return true;
				},
			},
		},
	};

	return { classes, storage };
}

afterEach(() => {
	globalThis.window = originalWindow;
	globalThis.document = originalDocument;
	globalThis.localStorage = originalLocalStorage;
});

describe('theme', () => {
	it('prefers saved theme over media query', () => {
		mockEnv({ savedTheme: 'dark', prefersDark: false });
		expect(getPreferredTheme()).toBe('dark');
	});

	it('initializes theme and persists it', () => {
		const { classes, storage } = mockEnv({ prefersDark: true });
		expect(initTheme()).toBe('dark');
		expect(classes.has('dark')).toBe(true);
		expect(storage.get('proma-theme')).toBe('dark');
	});

	it('toggles between dark and light', () => {
		const { classes } = mockEnv({ savedTheme: 'light' });
		applyTheme('light');
		expect(classes.has('dark')).toBe(false);
		expect(toggleTheme()).toBe('dark');
		expect(classes.has('dark')).toBe(true);
		expect(toggleTheme()).toBe('light');
		expect(classes.has('dark')).toBe(false);
	});
});
