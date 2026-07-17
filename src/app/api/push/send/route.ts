import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export async function GET(request: Request) {
  try {
    // Optional: Add basic security header check here for cron jobs
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // In a real app, protect this endpoint!
      // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize web-push and supabase admin lazily at runtime
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      console.error('VAPID keys are missing');
      return NextResponse.json({ error: 'Push service not configured' }, { status: 500 });
    }
    
    webpush.setVapidDetails(
      process.env.NEXT_PUBLIC_VAPID_SUBJECT || 'mailto:admin@example.com',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    );

    // 1. Fetch active entries (end_time is null) and their company_id
    const today = new Date().toISOString().split('T')[0];
    
    const { data: activeEntries, error: entriesError } = await supabaseAdmin
      .from('time_entries')
      .select(`
        *,
        profiles!inner(company_id)
      `)
      .eq('entry_date', today)
      .is('end_time', null);

    if (entriesError || !activeEntries) {
      console.error('Error fetching active entries:', entriesError);
      return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
    }

    // 2. Fetch custom push rules for all relevant companies
    const companyIds = Array.from(new Set(activeEntries.map(e => e.profiles?.company_id).filter(Boolean)));
    const { data: customRules } = await supabaseAdmin
      .from('push_notification_rules')
      .select('*')
      .in('company_id', companyIds)
      .eq('is_active', true);

    const now = new Date();
    const notificationsToSend: any[] = [];

    for (const entry of activeEntries) {
      if (!entry.profiles?.company_id) continue;
      
      const [sh, sm, ss] = entry.start_time.split(':').map(Number);
      const startDate = new Date(entry.entry_date);
      startDate.setHours(sh, sm, ss, 0);

      const diffMs = now.getTime() - startDate.getTime();
      const totalSeconds = Math.floor(diffMs / 1000);
      const totalBreakMinutes = entry.break_minutes || 0;

      let notificationMessage = null;
      
      const companyRules = customRules?.filter(r => r.company_id === entry.profiles.company_id) || [];
      
      if (companyRules.length > 0) {
        // Sort descending by trigger time to check highest thresholds first
        companyRules.sort((a, b) => b.trigger_minutes - a.trigger_minutes);
        
        for (const rule of companyRules) {
          const triggerSeconds = rule.trigger_minutes * 60;
          // Check if we reached the trigger, and are within a 5-minute window to avoid spamming
          if (totalSeconds >= triggerSeconds && totalSeconds < triggerSeconds + 300 && totalBreakMinutes < rule.condition_break_minutes) {
            notificationMessage = rule.message;
            break;
          }
        }
      } else {
        // Fallback to default rules if no custom rules exist
        // 12 Hours warning
        if (totalSeconds >= 12 * 3600 && totalSeconds < 12 * 3600 + 300) {
          notificationMessage = 'Achtung: Du bist seit 12 Stunden eingeloggt. Hast du vergessen dich auszustempeln?';
        }
        // 9 Hours warning
        else if (totalSeconds >= 9 * 3600 && totalSeconds < 9 * 3600 + 300 && totalBreakMinutes < 45) {
          notificationMessage = 'Achtung: Sie arbeiten bereits 9 Stunden. Eine Pause von mind. 45 Min. ist vorgeschrieben!';
        } else if (totalSeconds >= 8.75 * 3600 && totalSeconds < 8.75 * 3600 + 300 && totalBreakMinutes < 45) {
          notificationMessage = 'Hinweis: Nach 9 Std. Arbeitszeit sind gesetzlich mind. 45 Min. Pause vorgeschrieben.';
        }
        // 8 Hours warning
        else if (totalSeconds >= 8 * 3600 && totalSeconds < 8 * 3600 + 300) {
          notificationMessage = 'Hinweis: Du arbeitest bereits 8 Stunden. Vergiss nicht, dich auszustempeln!';
        }
        // 6 Hours warning
        else if (totalSeconds >= 6 * 3600 && totalSeconds < 6 * 3600 + 300 && totalBreakMinutes < 30) {
          notificationMessage = 'Achtung: Sie arbeiten bereits 6 Stunden. Eine Pause von 30 Min. ist gesetzlich vorgeschrieben!';
        } else if (totalSeconds >= 5.75 * 3600 && totalSeconds < 5.75 * 3600 + 300 && totalBreakMinutes < 30) {
          notificationMessage = 'Hinweis: Sie arbeiten bald 6 Stunden. Bitte denken Sie an die gesetzliche Pause (30 Min).';
        }
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
