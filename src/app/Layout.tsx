import { Moon, ShieldCheck, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Layout({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('safe-scan-theme') === 'dark';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light';
      document.documentElement.dataset.atlaixTheme = darkMode ? 'dark' : 'light';
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('safe-scan-theme', darkMode ? 'dark' : 'light');
    }
  }, [darkMode]);

  return (
    <div className={`app-shell safe-scan-shell ${darkMode ? 'dark-preview' : ''}`}>
      <header className="topbar">
        <div className="brand-mark safe-scan-brand" aria-label="Safe Scan">
          <span><ShieldCheck size={22} /></span>
          <strong>Safe Scan</strong>
        </div>
        <h1>Safe Scan</h1>
        <div className="topbar-actions">
          <div className="theme-segment" role="group" aria-label="Choose appearance">
            <button className={!darkMode ? 'active' : ''} type="button" onClick={() => setDarkMode(false)} aria-label="Switch to light mode" aria-pressed={!darkMode} title="Light mode">
              <Sun size={17} />
            </button>
            <button className={darkMode ? 'active' : ''} type="button" onClick={() => setDarkMode(true)} aria-label="Switch to dark mode" aria-pressed={darkMode} title="Dark mode">
              <Moon size={17} />
            </button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
