export type ThemeMode = 'light' | 'dark';

export const THEME_CHANGE_EVENT = 'ecolora-theme-change';

export const getStoredTheme = (): ThemeMode => {
  const savedTheme = localStorage.getItem('theme');
  return savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark';
};

export const applyTheme = (mode: ThemeMode): void => {
  document.documentElement.setAttribute('data-theme', mode);
  document.documentElement.style.colorScheme = mode;
  localStorage.setItem('theme', mode);
  window.dispatchEvent(new CustomEvent<ThemeMode>(THEME_CHANGE_EVENT, { detail: mode }));
};
