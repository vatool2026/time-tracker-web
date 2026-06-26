"use client";

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    // Check local storage or system preference
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && systemPrefersDark);
    
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    setTimeout(() => {
      setIsDark(shouldBeDark);
    }, 0);
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="btn btn-secondary glass"
      style={{
        padding: '0.5rem',
        borderRadius: '50%',
        width: '40px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid var(--glass-border)',
        cursor: 'pointer',
      }}
      title={isDark ? 'Helles Design' : 'Dunkles Design'}
      aria-label="Farbschema wechseln"
    >
      {isDark ? (
        <Sun size={20} className="text-gradient" style={{ transition: 'transform 0.5s ease' }} />
      ) : (
        <Moon size={20} style={{ color: 'var(--accent-secondary)', transition: 'transform 0.5s ease' }} />
      )}
    </button>
  );
}
