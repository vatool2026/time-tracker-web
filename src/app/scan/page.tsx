import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { clockInAction, clockOutAction } from '@/app/actions';

export const dynamic = 'force-dynamic';

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams;
  const codeId = typeof params.code === 'string' ? params.code : null;

  if (!codeId) {
    redirect('/dashboard?error=Ungültiger QR-Code');
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/scan?code=${codeId}`);
  }

  // 1. Get QR Code details
  const { data: qrCode, error: qrError } = await supabase
    .from('qr_codes')
    .select('*')
    .eq('id', codeId)
    .single();

  if (qrError || !qrCode) {
    redirect('/dashboard?error=QR-Code nicht gefunden');
  }

  if (qrCode.is_active === false) {
    redirect('/dashboard?error=Dieser QR-Code wurde deaktiviert');
  }

  // 2. Check current time entry status
  const today = new Date().toISOString().split('T')[0];
  const { data: activeEntries } = await supabase
    .from('time_entries')
    .select('*')
    .eq('user_id', user.id)
    .eq('entry_date', today)
    .is('end_time', null);

  const activeEntry = activeEntries && activeEntries.length > 0 ? activeEntries[0] : null;

  if (!activeEntry) {
    // Start new entry
    const res = await clockInAction(qrCode.note_text, qrCode.id);
    if (res.success) {
      redirect(`/dashboard?success=Zeiterfassung für ${encodeURIComponent(qrCode.name)} gestartet`);
    } else {
      redirect(`/dashboard?error=${encodeURIComponent(res.message)}`);
    }
  } else {
    // There is an active entry
    if (activeEntry.qr_code_id === qrCode.id) {
      // Same code -> stop
      const res = await clockOutAction();
      if (res.success) {
        redirect(`/dashboard?success=Zeiterfassung für ${encodeURIComponent(qrCode.name)} gestoppt`);
      } else {
        redirect(`/dashboard?error=${encodeURIComponent(res.message)}`);
      }
    } else {
      // Different code -> stop current, start new
      await clockOutAction();
      const res = await clockInAction(qrCode.note_text, qrCode.id);
      if (res.success) {
        redirect(`/dashboard?success=Zeiterfassung für ${encodeURIComponent(qrCode.name)} gestartet`);
      } else {
        redirect(`/dashboard?error=${encodeURIComponent(res.message)}`);
      }
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
      <div className="glass" style={{ padding: '2rem', borderRadius: '16px' }}>
        <h2>Verarbeite QR-Code...</h2>
      </div>
    </div>
  );
}
