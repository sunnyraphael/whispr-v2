// Simple global theme - toggled via localStorage
export const getTheme = () => localStorage.getItem("whispr_theme") || "dark";
export const setThemeStorage = (t) => localStorage.setItem("whispr_theme", t);
