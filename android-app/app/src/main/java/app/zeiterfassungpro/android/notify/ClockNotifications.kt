package app.zeiterfassungpro.android.notify

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import app.zeiterfassungpro.android.R
import app.zeiterfassungpro.android.data.ClockRepository
import app.zeiterfassungpro.android.data.TimeUtil
import app.zeiterfassungpro.android.sync.BreakReminderWorker
import app.zeiterfassungpro.android.ui.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

object ClockNotifications {
    private const val CHANNEL = "clock"
    private const val CHANNEL_REMINDER = "reminder"
    private const val ID = 1
    private const val ID_REMINDER = 2
    const val ACTION_TOGGLE_BREAK = "app.zeiterfassungpro.android.TOGGLE_BREAK"
    const val ACTION_CLOCK_OUT = "app.zeiterfassungpro.android.CLOCK_OUT"

    fun createChannels(ctx: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val nm = ctx.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL, "Laufende Zeiterfassung", NotificationManager.IMPORTANCE_LOW)
        )
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_REMINDER, "Pausen-Erinnerung", NotificationManager.IMPORTANCE_DEFAULT)
        )
    }

    private fun canNotify(ctx: Context) =
        Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED

    private fun action(ctx: Context, action: String, code: Int): PendingIntent =
        PendingIntent.getBroadcast(
            ctx, code,
            Intent(ctx, NotificationActionReceiver::class.java).setAction(action),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

    private fun openApp(ctx: Context): PendingIntent =
        PendingIntent.getActivity(
            ctx, 0, Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

    fun update(ctx: Context) {
        val nm = NotificationManagerCompat.from(ctx)
        val s = ClockRepository.get(ctx).store.readState()
        if (!s.loggedIn || !s.active) {
            nm.cancel(ID)
            return
        }
        if (!canNotify(ctx)) return
        val now = System.currentTimeMillis()
        val b = NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_clock)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(openApp(ctx))
            .setCategory(NotificationCompat.CATEGORY_STATUS)
        if (s.onBreak) {
            b.setContentTitle("In Pause")
                .setContentText("Eingestempelt seit ${TimeUtil.hhmm(s.startMs)} · Pause seit ${TimeUtil.hhmm(s.breakStartMs)}")
                .setUsesChronometer(false)
                .addAction(0, "Pause beenden", action(ctx, ACTION_TOGGLE_BREAK, 1))
        } else {
            b.setContentTitle("Eingestempelt seit ${TimeUtil.hhmm(s.startMs)}")
                .setContentText("Arbeitszeit läuft")
                .setShowWhen(true)
                .setUsesChronometer(true)
                .setWhen(now - s.workedMs(now))
                .addAction(0, "Pause", action(ctx, ACTION_TOGGLE_BREAK, 1))
        }
        b.addAction(0, "Ausstempeln", action(ctx, ACTION_CLOCK_OUT, 2))
        try { nm.notify(ID, b.build()) } catch (_: SecurityException) { }
    }

    fun showBreakReminder(ctx: Context) {
        val s = ClockRepository.get(ctx).store.readState()
        if (!s.active || s.breakMinutes >= 30 || s.onBreak || !canNotify(ctx)) return
        val n = NotificationCompat.Builder(ctx, CHANNEL_REMINDER)
            .setSmallIcon(R.drawable.ic_stat_clock)
            .setContentTitle("Zeit für eine Pause?")
            .setContentText("Du arbeitest seit fast 6 Stunden.")
            .setAutoCancel(true)
            .setContentIntent(openApp(ctx))
            .addAction(0, "Pause starten", action(ctx, ACTION_TOGGLE_BREAK, 1))
            .build()
        try { NotificationManagerCompat.from(ctx).notify(ID_REMINDER, n) } catch (_: SecurityException) { }
    }

    fun scheduleBreakReminder(ctx: Context) {
        val wm = WorkManager.getInstance(ctx)
        val s = ClockRepository.get(ctx).store.readState()
        if (!s.active) {
            wm.cancelUniqueWork("break-reminder")
            NotificationManagerCompat.from(ctx).cancel(ID_REMINDER)
            return
        }
        val delay = s.startMs + (5 * 60 + 45) * 60_000L - System.currentTimeMillis()
        if (delay <= 0) return
        wm.enqueueUniqueWork(
            "break-reminder",
            androidx.work.ExistingWorkPolicy.REPLACE,
            OneTimeWorkRequestBuilder<BreakReminderWorker>().setInitialDelay(delay, TimeUnit.MILLISECONDS).build()
        )
    }
}

class NotificationActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val pending = goAsync()
        val repo = ClockRepository.get(context)
        CoroutineScope(Dispatchers.Default).launch {
            try {
                when (intent.action) {
                    ClockNotifications.ACTION_TOGGLE_BREAK -> repo.toggleBreak()
                    ClockNotifications.ACTION_CLOCK_OUT -> repo.clockOut()
                }
            } finally {
                pending.finish()
            }
        }
    }
}
