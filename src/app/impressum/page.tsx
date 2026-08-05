import React from 'react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import { ArrowLeft } from 'lucide-react';

export default function ImpressumPage() {
  return (
    <main className="container flex-center" style={{ minHeight: '100vh', flexDirection: 'column', padding: '1rem', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', zIndex: 50 }}>
        <Link href="/" className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
          <ArrowLeft size={16} /> Zurück
        </Link>
      </div>
      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 50 }}>
        <ThemeToggle />
      </div>

      <div className="glass glass-card" style={{ width: '100%', maxWidth: '800px', padding: '3rem', zIndex: 10, margin: '4rem 0' }}>
        <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '2rem' }}>Impressum</h1>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
          <section>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Angaben gemäß § 5 TMG</h2>
            <p>
              Andre Reitz<br />
              Großaltenstädter Straße 59A<br />
              35586 Wetzlar
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Kontakt</h2>
            <p>
              Telefon: +49 (0) 151 6 52 63 42 1<br />
              E-Mail: support@va-tool.de
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
