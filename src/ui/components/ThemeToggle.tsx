import { Moon, Sun } from 'lucide-react';
import { useSettings } from '@/app/settings-store';
import { useResolvedTheme } from '../hooks';

/** One click flips between light and dark. "Match system" stays available in Settings. */
export function toggleTheme(current: 'light' | 'dark') {
  useSettings.getState().update({ theme: current === 'dark' ? 'light' : 'dark' });
}

export function ThemeToggle() {
  const theme = useResolvedTheme();
  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={label}
      title={label}
      onClick={() => toggleTheme(theme)}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
