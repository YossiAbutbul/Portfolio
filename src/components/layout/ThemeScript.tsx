const SCRIPT = `(() => {
  try {
    const k = 'theme';
    const s = localStorage.getItem(k);
    const m = window.matchMedia('(prefers-color-scheme: light)').matches;
    const t = s || (m ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.style.colorScheme = t;
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();`;

export default function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
