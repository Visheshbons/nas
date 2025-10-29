// Theme handling
const STORAGE_KEY = 'vnas-theme';
const LIGHT_THEME = 'light';
const DARK_THEME = 'dark';

// Get saved theme or system preference
function getPreferredTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEY);
    if (savedTheme) {
        return savedTheme;
    }

    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return LIGHT_THEME;
    }

    return DARK_THEME;
}

// Apply theme to document
function applyTheme(theme) {
    document.body.classList.remove(LIGHT_THEME, DARK_THEME);
    document.body.classList.add(theme);
    localStorage.setItem(STORAGE_KEY, theme);
}

// Toggle between light and dark themes
function toggleTheme() {
    const currentTheme = document.body.classList.contains(LIGHT_THEME) ? LIGHT_THEME : DARK_THEME;
    const newTheme = currentTheme === LIGHT_THEME ? DARK_THEME : LIGHT_THEME;
    applyTheme(newTheme);
}

// Initialize theme
document.addEventListener('DOMContentLoaded', () => {
    // Apply initial theme
    applyTheme(getPreferredTheme());

    // Add click handler to theme toggle button
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Listen for system theme changes
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
            applyTheme(e.matches ? LIGHT_THEME : DARK_THEME);
        });
    }
});
