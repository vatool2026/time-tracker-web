"use client";

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  if (!mounted) {
    return (
      <button
        className="btn btn-secondary glass"
        style={{
          padding: '0.5rem',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-primary)',
          opacity: 0.5
        }}
        aria-label="Theme umschalten (Laden)"
      >
        <Moon size={20} />
      </button>
    );
  }

  const isDark = theme === 'dark';

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
        <Sun size={20} style={{ color: 'var(--warning)', transition: 'transform 0.5s ease' }} />
      ) : (
        <Moon size={20} style={{ color: 'var(--accent-secondary)', transition: 'transform 0.5s ease' }} />
      )}
    </button>
  );
}
