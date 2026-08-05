import React from 'react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import { ArrowLeft } from 'lucide-react';

export default function DatenschutzPage() {
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
        <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '2rem' }}>Datenschutzerklärung</h1>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
          <section>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>1. Datenschutz auf einen Blick</h2>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginTop: '1rem', marginBottom: '0.5rem' }}>Allgemeine Hinweise</h3>
            <p>
              Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>2. Hosting</h2>
            <p>
              Wir hosten die Inhalte unserer Website bei folgendem Anbieter: [Name des Hosting-Anbieters].
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>3. Allgemeine Hinweise und Pflichtinformationen</h2>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginTop: '1rem', marginBottom: '0.5rem' }}>Datenschutz</h3>
            <p>
              Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend den gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.
            </p>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginTop: '1rem', marginBottom: '0.5rem' }}>Hinweis zur verantwortlichen Stelle</h3>
            <p>
              Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:<br /><br />
              Andre Reitz<br />
              Großaltenstädter Straße 59A<br />
              35586 Wetzlar<br /><br />
              Telefon: +49 (0) 151 6 52 63 42 1<br />
              E-Mail: support@va-tool.de
            </p>
          </section>
          
          <section>
            <p style={{ marginTop: '2rem', fontSize: '0.9rem', fontStyle: 'italic' }}>
              Hinweis: Dies ist eine Vorlage. Bitte passen Sie die Inhalte an Ihr Unternehmen und Ihre tatsächliche Datenverarbeitung an (z. B. durch Einsatz von Cookies, Analytics, etc.).
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
