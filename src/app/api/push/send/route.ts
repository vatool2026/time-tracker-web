import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Initialize web-push
webpush.setVapidDetails(
  process.env.NEXT_PUBLIC_VAPID_SUBJECT || 'mailto:admin@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
  process.env.VAPID_PRIVATE_KEY as string
);

// We need an admin client to fetch all subscriptions
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function GET(request: Request) {
  try {
    // Optional: Add basic security header check here for cron jobs
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // In a real app, protect this endpoint!
      // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch active entries (end_time is null)
    // For simplicity, we just fetch all entries from today that don't have an end_time
    const today = new Date().toISOString().split('T')[0];
    
    const { data: activeEntries, error: entriesError } = await supabaseAdmin
      .from('time_entries')
      .select('*, user_id')
      .eq('entry_date', today)
      .is('end_time', null);

    if (entriesError || !activeEntries) {
      console.error('Error fetching active entries:', entriesError);
      return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
    }

    const now = new Date();
    const notificationsToSend: any[] = [];

    for (const entry of activeEntries) {
      const [sh, sm, ss] = entry.start_time.split(':').map(Number);
      const startDate = new Date(entry.entry_date);
      startDate.setHours(sh, sm, ss, 0);

      const diffMs = now.getTime() - startDate.getTime();
      const totalSeconds = Math.floor(diffMs / 1000);
      const totalBreakMinutes = entry.break_minutes || 0;

      let notificationMessage = null;

      // 6 Hours warning
      if (totalSeconds >= 6 * 3600 && totalBreakMinutes < 30) {
        notificationMessage = 'Achtung: Sie arbeiten bereits 6 Stunden. Eine Pause von 30 Min. ist gesetzlich vorgeschrieben!';
      } else if (totalSeconds >= 5.75 * 3600 && totalBreakMinutes < 30) {
        // Only send this once, to avoid spamming every minute. We could store "warning_sent" in db, but for now we just send it.
        notificationMessage = 'Hinweis: Sie arbeiten bald 6 Stunden. Bitte denken Sie an die gesetzliche Pause (30 Min).';
      }

      // 9 Hours warning
      if (totalSeconds >= 9 * 3600 && totalBreakMinutes < 45) {
        notificationMessage = 'Achtung: Sie arbeiten bereits 9 Stunden. Eine Pause von mind. 45 Min. ist vorgeschrieben!';
      } else if (totalSeconds >= 8.75 * 3600 && totalBreakMinutes < 45) {
        notificationMessage = 'Hinweis: Nach 9 Std. Arbeitszeit sind gesetzlich mind. 45 Min. Pause vorgeschrieben.';
      }

      if (notificationMessage) {
        // Fetch subscriptions for this user
        const { data: subs } = await supabaseAdmin
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', entry.user_id);

        if (subs && subs.length > 0) {
          for (const sub of subs) {
            notificationsToSend.push({
              subscription: {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh,
                  auth: sub.auth
                }
              },
              payload: JSON.stringify({
                title: 'Zeiterfassung',
                body: notificationMessage,
                icon: '/icons/icon-warning.svg',
                badge: '/icons/icon-warning.svg'
              })
            });
          }
        }
      }
    }

    // Send all notifications
    const results = await Promise.allSettled(
      notificationsToSend.map(n => webpush.sendNotification(n.subscription, n.payload))
    );

    // Optional: remove expired subscriptions if webpush throws 410 Gone

    return NextResponse.json({ success: true, sent: notificationsToSend.length, results });
  } catch (err) {
    console.error('Push cron error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
