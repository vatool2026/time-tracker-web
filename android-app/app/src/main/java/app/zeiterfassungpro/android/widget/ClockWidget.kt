package app.zeiterfassungpro.android.widget

import android.content.Context
import android.content.res.Configuration
import android.os.SystemClock
import android.widget.RemoteViews
import android.widget.Toast
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.glance.ButtonDefaults
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalSize
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.AndroidRemoteViews
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import app.zeiterfassungpro.android.R
import app.zeiterfassungpro.android.data.ClockRepository
import app.zeiterfassungpro.android.data.TimeUtil
import app.zeiterfassungpro.android.ui.MainActivity

object WidgetPrefs {
    val LAYOUT = stringPreferencesKey("layout")     // STANDARD | COMPACT
    val THEME = stringPreferencesKey("theme")       // SYSTEM | LIGHT | DARK
    val ACCENT = stringPreferencesKey("accent")     // BLUE | GREEN | ORANGE | PURPLE
    val SHOW_TIMER = booleanPreferencesKey("showTimer")
    val SHOW_TODAY = booleanPreferencesKey("showToday")
    val SHOW_WEEK = booleanPreferencesKey("showWeek")
    val SHOW_BREAK = booleanPreferencesKey("showBreak")

    val accents = mapOf(
        "BLUE" to Color(0xFF2563EB), "GREEN" to Color(0xFF16A34A),
        "ORANGE" to Color(0xFFEA580C), "PURPLE" to Color(0xFF7C3AED),
    )
}

class ClockWidget : GlanceAppWidget() {
    override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition
    override val sizeMode = SizeMode.Responsive(
        setOf(DpSize(110.dp, 40.dp), DpSize(110.dp, 110.dp), DpSize(220.dp, 110.dp))
    )

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent { Content(context) }
    }

    @Composable
    private fun Content(context: Context) {
        val prefs = currentState<Preferences>()
        val layout = prefs[WidgetPrefs.LAYOUT] ?: "STANDARD"
        val theme = prefs[WidgetPrefs.THEME] ?: "SYSTEM"
        val accentName = prefs[WidgetPrefs.ACCENT] ?: "BLUE"
        val showTimer = prefs[WidgetPrefs.SHOW_TIMER] ?: true
        val showToday = prefs[WidgetPrefs.SHOW_TODAY] ?: true
        val showWeek = prefs[WidgetPrefs.SHOW_WEEK] ?: true
        val showBreak = prefs[WidgetPrefs.SHOW_BREAK] ?: true

        val repo = ClockRepository.get(context)
        val s = repo.store.readState()
        val stats = repo.store.readStats()
        val now = System.currentTimeMillis()

        val night = (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES
        val dark = theme == "DARK" || (theme == "SYSTEM" && night)
        val bg = if (dark) Color(0xFF1F2937) else Color.White
        val fg = if (dark) Color.White else Color(0xFF111827)
        val sub = if (dark) Color(0xFF9CA3AF) else Color(0xFF6B7280)
        val accent = WidgetPrefs.accents[accentName] ?: Color(0xFF2563EB)
        val size = LocalSize.current
        val compact = layout == "COMPACT" || size.height < 90.dp

        val mainLabel = if (s.active) "Ausstempeln" else "Einstempeln"
        val mainColor = if (s.active) Color(0xFFDC2626) else accent

        @Composable
        fun mainButton(modifier: GlanceModifier) {
            androidx.glance.Button(
                text = mainLabel,
                onClick = if (s.loggedIn) actionRunCallback<ToggleClockAction>() else actionStartActivity<MainActivity>(),
                modifier = modifier,
                colors = ButtonDefaults.buttonColors(
                    backgroundColor = ColorProvider(mainColor), contentColor = ColorProvider(Color.White)
                ),
            )
        }

        @Composable
        fun timer() {
            if (s.onBreak) {
                Text("Pause", style = TextStyle(color = ColorProvider(accent), fontWeight = FontWeight.Bold, fontSize = 22.sp))
            } else if (s.active && showTimer) {
                val rv = RemoteViews(context.packageName, R.layout.widget_chrono).apply {
                    setChronometer(R.id.widget_chrono, SystemClock.elapsedRealtime() - s.workedMs(now), null, true)
                    setTextColor(R.id.widget_chrono, fg.toArgbInt())
                }
                AndroidRemoteViews(rv)
            } else {
                Text(
                    if (s.active) "seit ${TimeUtil.hhmm(s.startMs)}" else "Ausgestempelt",
                    style = TextStyle(color = ColorProvider(fg), fontWeight = FontWeight.Bold, fontSize = 18.sp)
                )
            }
        }

        val root = GlanceModifier.fillMaxSize().background(ColorProvider(bg)).cornerRadius(20.dp).padding(12.dp)
        if (compact) {
            Row(root, verticalAlignment = Alignment.CenterVertically) {
                Column(GlanceModifier.defaultWeight()) { timer() }
                Spacer(GlanceModifier.width(8.dp))
                mainButton(GlanceModifier)
            }
        } else {
            Column(root) {
                Text(
                    if (s.onBreak) "In Pause" else if (s.active) "Eingestempelt" else "Zeiterfassung",
                    style = TextStyle(color = ColorProvider(sub), fontSize = 12.sp)
                )
                timer()
                if (showToday || showWeek) {
                    val parts = buildList {
                        if (showToday) add("Heute ${TimeUtil.formatMinutes(stats.todayTotal(s, now))}")
                        if (showWeek) add("Woche ${TimeUtil.formatMinutes(stats.weekTotal(s, now))}")
                    }
                    Text(parts.joinToString(" · "), style = TextStyle(color = ColorProvider(sub), fontSize = 12.sp))
                }
                Spacer(GlanceModifier.defaultWeight())
                Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    mainButton(GlanceModifier.defaultWeight())
                    if (s.active && showBreak) {
                        Spacer(GlanceModifier.width(8.dp))
                        androidx.glance.Button(
                            text = if (s.onBreak) "Weiter" else "Pause",
                            onClick = actionRunCallback<ToggleBreakAction>(),
                            modifier = GlanceModifier.defaultWeight(),
                            colors = ButtonDefaults.buttonColors(
                                backgroundColor = ColorProvider(if (dark) Color(0xFF374151) else Color(0xFFE5E7EB)),
                                contentColor = ColorProvider(fg)
                            ),
                        )
                    }
                }
            }
        }
    }
}

private fun Color.toArgbInt(): Int = this.toArgb()

class ToggleClockAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        ClockRepository.get(context).toggleClock()
    }
}

class ToggleBreakAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        ClockRepository.get(context).toggleBreak()
    }
}

class ClockWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = ClockWidget()
}
