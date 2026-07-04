import { WifiOff } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Offline - Zeiterfassung Pro',
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="glass-card max-w-md w-full p-8 text-center flex flex-col items-center gap-6">
        <div className="h-24 w-24 rounded-full bg-yellow-500/20 flex items-center justify-center">
          <WifiOff className="h-12 w-12 text-yellow-500" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Keine Internetverbindung</h1>
          <p className="text-muted-foreground">
            Sie sind aktuell offline. Einige Funktionen stehen erst wieder zur Verfügung, 
            wenn Sie mit dem Internet verbunden sind.
          </p>
        </div>

        <p className="text-sm text-muted-foreground/80">
          Tipp: Zeiterfassungen (Kommen/Gehen/Pause) können Sie auf dem Dashboard auch offline durchführen. 
          Diese werden automatisch synchronisiert, sobald Sie wieder online sind.
        </p>

        <Link 
          href="/"
          className="w-full mt-4 bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-4 rounded-md inline-flex justify-center items-center transition-colors"
        >
          Zum Dashboard
        </Link>
      </div>
    </div>
  );
}
