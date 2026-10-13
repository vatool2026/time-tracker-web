package app.zeiterfassungpro.android.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.zeiterfassungpro.android.data.AuthException
import app.zeiterfassungpro.android.data.ClockRepository
import app.zeiterfassungpro.android.data.LoginResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.io.IOException

data class LoginUi(
    val busy: Boolean = false,
    val error: String? = null,
    val mfa: LoginResult.NeedsMfa? = null,
)

class MainViewModel(app: Application) : AndroidViewModel(app) {
    val repo = ClockRepository.get(app)

    private val _login = MutableStateFlow(LoginUi())
    val login: StateFlow<LoginUi> = _login

    private val _syncing = MutableStateFlow(false)
    val syncing: StateFlow<Boolean> = _syncing

    fun login(email: String, password: String) = viewModelScope.launch {
        _login.value = LoginUi(busy = true)
        _login.value = try {
            when (val r = repo.login(email, password)) {
                is LoginResult.NeedsMfa -> LoginUi(mfa = r)
                else -> LoginUi()
            }
        } catch (e: AuthException) {
            LoginUi(error = e.message)
        } catch (e: IOException) {
            LoginUi(error = "Keine Verbindung. Zum Anmelden wird Internet benötigt.")
        } catch (e: Exception) {
            LoginUi(error = e.message ?: "Anmeldung fehlgeschlagen.")
        }
    }

    fun verifyMfa(code: String) = viewModelScope.launch {
        val mfa = _login.value.mfa ?: return@launch
        _login.value = LoginUi(busy = true, mfa = mfa)
        _login.value = try {
            repo.verifyMfa(mfa.factorId, mfa.accessToken, code)
            LoginUi()
        } catch (e: AuthException) {
            LoginUi(error = e.message, mfa = mfa)
        } catch (e: IOException) {
            LoginUi(error = "Keine Verbindung.", mfa = mfa)
        }
    }

    fun cancelMfa() { _login.value = LoginUi() }

    fun clockIn(customTime: String?) = viewModelScope.launch { repo.clockIn(customTime) }
    fun clockOut(note: String, customTime: String?) = viewModelScope.launch { repo.clockOut(note, customTime) }
    fun toggleBreak() = viewModelScope.launch { repo.toggleBreak() }
    fun quickBreak(minutes: Int) = viewModelScope.launch { repo.addQuickBreak(minutes) }
    fun dismissFailed(id: String) = viewModelScope.launch { repo.dismissFailed(id) }
    fun logout() = viewModelScope.launch { repo.logout() }

    fun syncNow() = viewModelScope.launch {
        _syncing.value = true
        try { repo.sync(); repo.refreshStatus() } finally { _syncing.value = false }
    }
}
