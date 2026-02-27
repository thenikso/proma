const THEME_STORAGE_KEY = 'proma-theme';

/**
 * @returns {'light' | 'dark'}
 */
export function getPreferredTheme() {
	if (typeof window === 'undefined') return 'light';
	const saved = localStorage.getItem(THEME_STORAGE_KEY);
	if (saved === 'light' || saved === 'dark') return saved;
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * @param {'light' | 'dark'} theme
 */
export function applyTheme(theme) {
	if (typeof document === 'undefined') return;
	document.documentElement.classList.toggle('dark', theme === 'dark');
	document.documentElement.dataset.theme = theme;
	localStorage.setItem(THEME_STORAGE_KEY, theme);
}

/**
 * @returns {'light' | 'dark'}
 */
export function initTheme() {
	const theme = getPreferredTheme();
	applyTheme(theme);
	return theme;
}

/**
 * @returns {'light' | 'dark'}
 */
export function toggleTheme() {
	const isDark =
		typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
	const next = isDark ? 'light' : 'dark';
	applyTheme(next);
	return next;
}
