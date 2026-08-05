import Link from 'next/link';

export default function Home() {
  return (
    <main className="container flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: '2rem', position: 'relative' }}>
      <div className="glass glass-card" style={{ maxWidth: '600px', textAlign: 'center', position: 'relative', zIndex: 10 }}>
        <h1 className="text-gradient" style={{ fontSize: '3rem', marginBottom: '1rem' }}>Zeiterfassung Pro</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1.1rem', lineHeight: 1.6 }}>
          Die moderne Lösung für Ihre Unternehmens-Zeiterfassung. 
          Einfach, sicher und übersichtlich – für Mitarbeiter und Administratoren.
        </p>
        
        <div className="flex-center" style={{ gap: '1rem' }}>
          <Link href="/login" className="btn btn-primary">
            Anmelden
          </Link>
          <Link href="/register" className="btn btn-secondary">
            Unternehmen registrieren
          </Link>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: '2rem', display: 'flex', gap: '1.5rem', zIndex: 10 }}>
        <Link href="/impressum" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Impressum
        </Link>
        <Link href="/datenschutz" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Datenschutz
        </Link>
      </div>
    </main>
  );
}
