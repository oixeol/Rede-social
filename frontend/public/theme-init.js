(function initializeTheme() {
  try {
    var saved = window.localStorage.getItem('vibra-theme');
    var theme = saved === 'dark' || saved === 'light' ? saved : 'dark';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (_error) {
    document.documentElement.dataset.theme = 'dark';
    document.documentElement.style.colorScheme = 'dark';
  }
})();
