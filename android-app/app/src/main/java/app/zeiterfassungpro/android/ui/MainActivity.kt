package app.zeiterfassungpro.android.ui

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import app.zeiterfassungpro.android.data.ClockRepository
import kotlinx.coroutines.launch

@Composable
fun AppTheme(content: @Composable () -> Unit) {
    val scheme = if (isSystemInDarkTheme()) darkColorScheme(primary = Color(0xFF60A5FA))
    else lightColorScheme(primary = Color(0xFF2563EB))
    MaterialTheme(colorScheme = scheme, content = content)
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val repo = ClockRepository.get(this)
        // Refresh from the server whenever the app comes to the foreground.
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                repo.sync()
                repo.refreshStatus()
                repo.refreshSurfaces()
            }
        }
        setContent {
            AppTheme {
                val vm: MainViewModel = viewModel()
                val state by vm.repo.state.collectAsState()
                if (Build.VERSION.SDK_INT >= 33) {
                    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
                        lifecycleScope.launch { repo.refreshSurfaces() }
                    }
                    LaunchedEffect(state.loggedIn) {
                        if (state.loggedIn) launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    }
                }
                if (state.loggedIn) HomeScreen(vm) else LoginScreen(vm)
            }
        }
    }
}
