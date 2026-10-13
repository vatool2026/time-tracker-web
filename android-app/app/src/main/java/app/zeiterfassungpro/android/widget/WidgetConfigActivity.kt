package app.zeiterfassungpro.android.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.state.updateAppWidgetState
import app.zeiterfassungpro.android.ui.AppTheme
import kotlinx.coroutines.launch

class WidgetConfigActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val appWidgetId = intent?.extras?.getInt(
            AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID
        setResult(Activity.RESULT_CANCELED, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId))
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) { finish(); return }

        setContent {
            AppTheme {
                val scope = rememberCoroutineScope()
                var layout by remember { mutableStateOf("STANDARD") }
                var theme by remember { mutableStateOf("SYSTEM") }
                var accent by remember { mutableStateOf("BLUE") }
                var showTimer by remember { mutableStateOf(true) }
                var showToday by remember { mutableStateOf(true) }
                var showWeek by remember { mutableStateOf(true) }
                var showBreak by remember { mutableStateOf(true) }

                Column(
                    Modifier.verticalScroll(rememberScrollState()).padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text("Widget einrichten", style = MaterialTheme.typography.headlineSmall)
                    Section("Layout") {
                        Choice("STANDARD", "Standard", layout) { layout = it }
                        Choice("COMPACT", "Kompakt", layout) { layout = it }
                    }
                    Section("Design") {
                        Choice("SYSTEM", "System", theme) { theme = it }
                        Choice("LIGHT", "Hell", theme) { theme = it }
                        Choice("DARK", "Dunkel", theme) { theme = it }
                    }
                    Section("Akzentfarbe") {
                        Choice("BLUE", "Blau", accent) { accent = it }
                        Choice("GREEN", "Grün", accent) { accent = it }
                        Choice("ORANGE", "Orange", accent) { accent = it }
                        Choice("PURPLE", "Lila", accent) { accent = it }
                    }
                    Toggle("Laufende Zeit anzeigen", showTimer) { showTimer = it }
                    Toggle("Heute-Stunden anzeigen", showToday) { showToday = it }
                    Toggle("Wochen-Stunden anzeigen", showWeek) { showWeek = it }
                    Toggle("Pause-Button anzeigen", showBreak) { showBreak = it }
                    Button(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = {
                            scope.launch {
                                val glanceId = GlanceAppWidgetManager(this@WidgetConfigActivity)
                                    .getGlanceIdBy(appWidgetId)
                                updateAppWidgetState(this@WidgetConfigActivity, glanceId) { p ->
                                    p[WidgetPrefs.LAYOUT] = layout
                                    p[WidgetPrefs.THEME] = theme
                                    p[WidgetPrefs.ACCENT] = accent
                                    p[WidgetPrefs.SHOW_TIMER] = showTimer
                                    p[WidgetPrefs.SHOW_TODAY] = showToday
                                    p[WidgetPrefs.SHOW_WEEK] = showWeek
                                    p[WidgetPrefs.SHOW_BREAK] = showBreak
                                }
                                ClockWidget().update(this@WidgetConfigActivity, glanceId)
                                setResult(
                                    Activity.RESULT_OK,
                                    Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                                )
                                finish()
                            }
                        }
                    ) { Text("Speichern") }
                }
            }
        }
    }
}

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, style = MaterialTheme.typography.titleSmall)
        androidx.compose.foundation.layout.FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) { content() }
    }
}

@Composable
private fun Choice(value: String, label: String, current: String, onSelect: (String) -> Unit) {
    FilterChip(selected = current == value, onClick = { onSelect(value) }, label = { Text(label) })
}

@Composable
private fun Toggle(label: String, value: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, Modifier.weight(1f))
        Switch(checked = value, onCheckedChange = onChange)
    }
}
