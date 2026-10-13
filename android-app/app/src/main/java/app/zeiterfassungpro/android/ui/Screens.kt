package app.zeiterfassungpro.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.zeiterfassungpro.android.data.TimeUtil
import kotlinx.coroutines.delay

@Composable
fun LoginScreen(vm: MainViewModel) {
    val ui by vm.login.collectAsState()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }

    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Zeiterfassung Pro", fontSize = 28.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(24.dp))
        if (ui.mfa == null) {
            OutlinedTextField(
                email, { email = it }, label = { Text("E-Mail") }, singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                password, { password = it }, label = { Text("Passwort") }, singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier = Modifier.fillMaxWidth()
            )
        } else {
            Text("Bitte den 6-stelligen Code aus deiner Authenticator-App eingeben.")
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                code, { code = it.filter(Char::isDigit).take(6) }, label = { Text("Code") }, singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                modifier = Modifier.fillMaxWidth()
            )
        }
        ui.error?.let {
            Spacer(Modifier.height(8.dp))
            Text(it, color = MaterialTheme.colorScheme.error)
        }
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = { if (ui.mfa == null) vm.login(email, password) else vm.verifyMfa(code) },
            enabled = !ui.busy && if (ui.mfa == null) email.isNotBlank() && password.isNotEmpty() else code.length == 6,
            modifier = Modifier.fillMaxWidth()
        ) { Text(if (ui.busy) "Bitte warten …" else if (ui.mfa == null) "Anmelden" else "Bestätigen") }
        if (ui.mfa != null) TextButton(onClick = { vm.cancelMfa() }) { Text("Abbrechen") }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TimeDialog(title: String, onDismiss: () -> Unit, onPick: (String) -> Unit) {
    val picker = rememberTimePickerState(is24Hour = true)
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { TimePicker(state = picker) },
        confirmButton = {
            TextButton(onClick = { onPick("%02d:%02d".format(picker.hour, picker.minute)) }) { Text("OK") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Abbrechen") } },
    )
}

@Composable
fun HomeScreen(vm: MainViewModel) {
    val s by vm.repo.state.collectAsState()
    val stats by vm.repo.stats.collectAsState()
    val pending by vm.repo.pendingCount.collectAsState(initial = 0)
    val failed by vm.repo.failedEvents.collectAsState(initial = emptyList())
    val syncing by vm.syncing.collectAsState()

    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) { while (true) { delay(1000); now = System.currentTimeMillis() } }

    var note by remember { mutableStateOf("") }
    var useCustom by remember { mutableStateOf(false) }
    var customTime by remember { mutableStateOf<String?>(null) }
    var showPicker by remember { mutableStateOf(false) }

    if (showPicker) TimeDialog(
        title = if (s.active) "Endzeit" else "Startzeit",
        onDismiss = { showPicker = false },
        onPick = { customTime = it; showPicker = false }
    )

    val worked = s.workedMs(now) / 1000
    val timerText = "%02d:%02d:%02d".format(worked / 3600, (worked / 60) % 60, worked % 60)

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Zeiterfassung Pro", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                if (s.userName.isNotBlank()) Text(s.userName, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            TextButton(onClick = { vm.logout() }) { Text("Abmelden") }
        }

        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    if (s.onBreak) "In Pause" else if (s.active) "Eingestempelt seit ${TimeUtil.hhmm(s.startMs)}" else "Ausgestempelt",
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(timerText, fontSize = 48.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(6.dp))
                Text(
                    "Heute ${TimeUtil.formatMinutes(stats.todayTotal(s, now))}  ·  Woche ${TimeUtil.formatMinutes(stats.weekTotal(s, now))}",
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        if (s.active) OutlinedTextField(
            note, { note = it }, label = { Text("Notiz (optional)") }, modifier = Modifier.fillMaxWidth()
        )

        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Switch(useCustom, { useCustom = it; if (!it) customTime = null })
            Text(
                if (s.active) "  Endzeit nachtragen" else "  Startzeit nachtragen",
                Modifier.weight(1f)
            )
            if (useCustom) OutlinedButton(onClick = { showPicker = true }) { Text(customTime ?: "Zeit wählen") }
        }

        val needTime = useCustom && customTime == null
        Button(
            onClick = {
                val t = if (useCustom) customTime else null
                if (s.active) { vm.clockOut(note, t); note = "" } else vm.clockIn(t)
                useCustom = false; customTime = null
            },
            enabled = !needTime,
            modifier = Modifier.fillMaxWidth().height(64.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = if (s.active) Color(0xFFDC2626) else MaterialTheme.colorScheme.primary
            )
        ) { Text(if (s.active) "Ausstempeln" else "Einstempeln", fontSize = 20.sp) }

        if (s.active) {
            OutlinedButton(onClick = { vm.toggleBreak() }, modifier = Modifier.fillMaxWidth()) {
                Text(if (s.onBreak) "Pause beenden" else "Pause starten")
            }
            if (!s.onBreak) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(15, 30, 45).forEach { m ->
                    OutlinedButton(onClick = { vm.quickBreak(m) }, modifier = Modifier.weight(1f)) { Text("+$m min") }
                }
            }
            if (s.breakMinutes > 0) Text("Pausen bisher: ${s.breakMinutes} min", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        if (pending > 0) Card(Modifier.fillMaxWidth()) {
            Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("$pending Eintrag/Einträge noch nicht synchronisiert", Modifier.weight(1f))
                TextButton(onClick = { vm.syncNow() }, enabled = !syncing) { Text(if (syncing) "…" else "Jetzt senden") }
            }
        }

        failed.forEach { e ->
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    Text("Abgelehnt: ${e.type} um ${TimeUtil.hhmm(e.atMs)}", fontWeight = FontWeight.Bold)
                    Text(e.error ?: "Der Server hat den Eintrag abgelehnt.")
                    TextButton(onClick = { vm.dismissFailed(e.id) }) { Text("Verwerfen") }
                }
            }
        }
    }
}
