// Applies the saved theme before first paint to avoid a flash of the wrong theme.
try {
  var s = JSON.parse(localStorage.getItem('mydoc:settings') || '{}');
  var t = s.theme || 'system';
  var dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  if (s.density) document.documentElement.dataset.density = s.density;
} catch (e) {}
