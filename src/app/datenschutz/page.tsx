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

      <div className="glass glass-card" style={{ width: '100%', maxWidth: '900px', padding: '3rem', zIndex: 10, margin: '4rem 0' }}>
        <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '2rem' }}>Datenschutzerklärung</h1>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
          
          <section>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>1. Datenschutz auf einen Blick</h2>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Allgemeine Hinweise</h3>
            <p>
              Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website und unsere Anwendung besuchen bzw. nutzen. Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können. Ausführliche Informationen zum Thema Datenschutz entnehmen Sie unserer unter diesem Text aufgeführten Datenschutzerklärung.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>2. Verantwortliche Stelle</h2>
            <p>
              Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:<br /><br />
              Andre Reitz<br />
              Großaltenstädter Straße 59A<br />
              35586 Wetzlar<br /><br />
              Telefon: +49 (0) 151 6 52 63 42 1<br />
              E-Mail: support@va-tool.de
            </p>
            <p style={{ marginTop: '1rem' }}>
              Verantwortliche Stelle ist die natürliche oder juristische Person, die allein oder gemeinsam mit anderen über die Zwecke und Mittel der Verarbeitung von personenbezogenen Daten (z. B. Namen, E-Mail-Adressen o. Ä.) entscheidet.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>3. Hosting und Content Delivery Network (CDN)</h2>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Cloudflare</h3>
            <p>
              Wir hosten unsere Website und Anwendung bei Cloudflare. Anbieter ist die Cloudflare, Inc., 101 Townsend St., San Francisco, CA 94107, USA (nachfolgend Cloudflare).<br /><br />
              Die Nutzung von Cloudflare erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO. Wir haben ein berechtigtes Interesse an einer möglichst zuverlässigen Darstellung sowie Absicherung unserer Web-App. Wir haben einen Vertrag zur Auftragsverarbeitung (AVV) mit Cloudflare geschlossen.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>4. Datenbank, Login und Authentifizierung</h2>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Supabase</h3>
            <p>
              Für die Bereitstellung unserer Datenbank sowie die Nutzerauthentifizierung (Login-Verwaltung, Passkeys, 2-Faktor-Authentifizierung) nutzen wir den Dienst Supabase. Anbieter ist die Supabase Inc., 972 Mission St, San Francisco, CA 94103, USA.<br /><br />
              Wenn Sie sich bei unserer App registrieren oder anmelden, werden Ihre Anmeldedaten (z. B. E-Mail-Adresse, verschlüsselte Passwörter, WebAuthn-Credentials) und Ihre in der App eingegebenen Zeiterfassungsdaten auf den Servern von Supabase verarbeitet. Dies erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO zur Vertragserfüllung.<br /><br />
              Wir haben einen Vertrag zur Auftragsverarbeitung (AVV) mit Supabase geschlossen.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>5. Erfassung und Verarbeitung von Nutzerdaten in der App</h2>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Zeiterfassungsdaten</h3>
            <p>
              Zweck unserer Anwendung ist die Arbeitszeiterfassung für Unternehmen. Dabei verarbeiten wir zur Erfüllung des Vertrages (Art. 6 Abs. 1 lit. b DSGVO) folgende Daten:
            </p>
            <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
              <li>Stammdaten (Name, E-Mail-Adresse des Nutzers/Mitarbeiters)</li>
              <li>Erfasste Arbeitszeiten, Pausenzeiten und zugehörige Projekt-/Tätigkeitsbeschreibungen</li>
            </ul>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Standortdaten (Geofencing)</h3>
            <p>
              Sofern von Ihrem Arbeitgeber konfiguriert und von Ihnen auf dem Endgerät (Browser/Smartphone) ausdrücklich genehmigt, können bei der Erfassung von Arbeitszeiten Standortdaten (GPS-Koordinaten) verarbeitet werden, um sicherzustellen, dass Sie sich innerhalb eines definierten Arbeitsbereiches befinden (Geofencing). Diese Verarbeitung erfolgt aufgrund Ihrer ausdrücklichen Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Sie können diese Einwilligung jederzeit in Ihren Geräteeinstellungen widerrufen.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>6. Cookies und lokale Speicherung</h2>
            <p>
              Unsere Anwendung verwendet Local Storage und sogenannte technisch notwendige Cookies. Diese dienen dazu, den Anmeldestatus zu speichern (Session-Management) und die Sicherheit des Dienstes zu gewährleisten (z. B. 2-Faktor-Authentifizierung, Passkeys). 
              <br /><br />
              Das Setzen dieser technisch zwingend erforderlichen Cookies und Speicherungen erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO. Ein berechtigtes Interesse an der Bereitstellung der Kernfunktionalitäten der App liegt vor. Es findet hierbei kein Tracking zu Marketingzwecken statt.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>7. Rechte der Betroffenen</h2>
            <p>
              Sie haben jederzeit das Recht:
            </p>
            <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
              <li><strong>Auskunft</strong> über Ihre bei uns gespeicherten personenbezogenen Daten zu erhalten (Art. 15 DSGVO).</li>
              <li>Die <strong>Berichtigung</strong> unrichtiger oder unvollständiger Daten zu verlangen (Art. 16 DSGVO).</li>
              <li>Die <strong>Löschung</strong> Ihrer bei uns gespeicherten Daten zu verlangen, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen (Art. 17 DSGVO).</li>
              <li>Die <strong>Einschränkung der Verarbeitung</strong> zu verlangen (Art. 18 DSGVO).</li>
              <li>Auf <strong>Datenübertragbarkeit</strong> (Art. 20 DSGVO).</li>
              <li>Einer Verarbeitung, die auf unserem berechtigten Interesse basiert, zu <strong>widersprechen</strong> (Art. 21 DSGVO).</li>
            </ul>
            <p style={{ marginTop: '1rem' }}>
              Hierzu sowie zu weiteren Fragen zum Thema Datenschutz können Sie sich jederzeit an uns unter den oben angegebenen Kontaktdaten wenden. Des Weiteren steht Ihnen ein Beschwerderecht bei der zuständigen Aufsichtsbehörde zu.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
