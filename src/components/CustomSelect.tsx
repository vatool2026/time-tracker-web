import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  name?: string;
}

export default function CustomSelect({ value, onChange, options, className = '', style = {}, disabled = false, name }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }} className={className}>
      {name && <input type="hidden" name={name} value={value} disabled={disabled} />}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '0.75rem 1rem',
          background: disabled ? 'rgba(0,0,0,0.05)' : 'var(--bg-secondary)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--border-radius-sm)',
          color: disabled ? 'var(--text-secondary)' : 'var(--text-primary)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontWeight: 500,
          fontFamily: 'Inter, sans-serif',
          textAlign: 'left'
        }}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selectedOption?.label || ''}
        </span>
        <ChevronDown size={18} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0, opacity: disabled ? 0.5 : 1 }} />
      </button>

      {isOpen && (
        <div className="glass-dropdown" style={{
          position: 'absolute',
          top: 'calc(100% + 0.25rem)',
          left: 0,
          width: '100%',
          maxHeight: '250px',
          overflowY: 'auto',
          padding: '0.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.15rem',
          zIndex: 9999
        }}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                padding: '0.65rem 0.75rem',
                background: value === opt.value ? 'var(--accent-primary)' : 'transparent',
                color: value === opt.value ? '#fff' : 'var(--text-primary)',
                border: 'none',
                borderRadius: 'var(--border-radius-sm)',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: value === opt.value ? 600 : 400,
                transition: 'background 0.2s',
                fontFamily: 'Inter, sans-serif'
              }}
              onMouseEnter={(e) => {
                if (value !== opt.value) e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              }}
              onMouseLeave={(e) => {
                if (value !== opt.value) e.currentTarget.style.background = 'transparent';
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
