package app.zeiterfassungpro.android.data

import android.content.Context
import androidx.glance.appwidget.updateAll
import androidx.room.Room
import app.zeiterfassungpro.android.notify.ClockNotifications
import app.zeiterfassungpro.android.sync.SyncWorker
import app.zeiterfassungpro.android.widget.ClockWidget
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.IOException
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.util.UUID
import kotlin.math.max
import kotlin.math.roundToInt

enum class SyncResult { DONE, RETRY, LOGGED_OUT }

class ClockRepository private constructor(context: Context) {
    private val ctx = context.applicationContext
    val store = Store(ctx)
    private val auth = AuthClient(store)
    private val api = ApiClient()
    private val dao = Room.databaseBuilder(ctx, AppDatabase::class.java, "zep.db").build().dao()
    private val mutex = Mutex()

    private val _state = MutableStateFlow(store.readState())
    val state: StateFlow<ClockState> = _state
    private val _stats = MutableStateFlow(store.readStats())
    val stats: StateFlow<Stats> = _stats

    val pendingCount: Flow<Int> = dao.pendingCount()
    val failedEvents: Flow<List<PendingEvent>> = dao.failed()

    companion object {
        @Volatile private var inst: ClockRepository? = null
        fun get(context: Context): ClockRepository =
            inst ?: synchronized(this) { inst ?: ClockRepository(context).also { inst = it } }
    }

    private fun publishState(s: ClockState) {
        store.writeState(s.copy(loggedIn = store.refreshToken.isNotEmpty()))
        _state.value = store.readState()
    }

    private fun publishStats(s: Stats) { store.writeStats(s); _stats.value = s }

    private suspend fun afterChange() {
        SyncWorker.enqueue(ctx)
        refreshSurfaces()
    }

    /** Updates notification, break reminder and widgets from the local state. */
    suspend fun refreshSurfaces() {
        ClockNotifications.update(ctx)
        ClockNotifications.scheduleBreakReminder(ctx)
        try { ClockWidget().updateAll(ctx) } catch (_: Exception) { }
    }

    // ---------- auth ----------

    suspend fun login(email: String, password: String): LoginResult {
        val r = auth.login(email, password)
        if (r is LoginResult.Success) onLoggedIn()
        return r
    }

    suspend fun verifyMfa(factorId: String, aal1Token: String, code: String) {
        auth.verifyMfa(factorId, aal1Token, code)
        onLoggedIn()
    }

    private suspend fun onLoggedIn() {
        publishState(store.readState())
        refreshStatus()
        SyncWorker.schedulePeriodic(ctx)
        refreshSurfaces()
    }

    suspend fun logout() = mutex.withLock {
        dao.clearAll()
        store.clear()
        _state.value = store.readState()
        _stats.value = store.readStats()
        refreshSurfaces()
    }

    // ---------- clocking (local first) ----------

    private fun newId() = UUID.randomUUID().toString()

    /** @param customTime optional "HH:mm" for a retroactive start time (today). */
    suspend fun clockIn(customTime: String? = null) = mutex.withLock {
        val s = store.readState()
        if (!s.loggedIn || s.active) return@withLock
        val now = System.currentTimeMillis()
        val today = LocalDate.now(TimeUtil.zone)
        val startMs = if (customTime != null) TimeUtil.instantFor(today, LocalTime.parse(customTime))
        else TimeUtil.roundTo15(now)
        dao.insert(PendingEvent(id = newId(), type = "IN", atMs = now, time = customTime))
        publishState(
            s.copy(active = true, entryDate = today.toString(), startMs = startMs, breakMinutes = 0,
                breakStartMs = 0, note = "")
        )
        afterChange()
    }

    suspend fun clockOut(note: String? = null, customTime: String? = null) = mutex.withLock {
        var s = store.readState()
        if (!s.loggedIn || !s.active) return@withLock
        val now = System.currentTimeMillis()
        if (s.breakStartMs > 0) s = endBreakLocked(s, now)
        val endMs = if (customTime != null)
            TimeUtil.instantFor(LocalDate.now(TimeUtil.zone), LocalTime.parse(customTime))
        else TimeUtil.roundTo15(now)
        dao.insert(
            PendingEvent(
                id = newId(), type = "OUT", atMs = now + 1, time = customTime,
                note = note?.trim()?.ifEmpty { null }
            )
        )
        val worked = max(0L, (endMs - s.startMs) / 60_000 - s.breakMinutes)
        val st = _stats.value
        val keyToday = TimeUtil.today()
        publishStats(
            st.copy(
                todayMinutes = (if (st.dateKey == keyToday) st.todayMinutes else 0) + worked,
                weekMinutes = st.weekMinutes + worked, monthMinutes = st.monthMinutes + worked, dateKey = keyToday
            )
        )
        publishState(s.copy(active = false, startMs = 0, breakMinutes = 0, breakStartMs = 0, note = ""))
        afterChange()
    }

    suspend fun toggleClock() {
        if (store.readState().active) clockOut() else clockIn()
    }

    suspend fun startBreak() = mutex.withLock {
        val s = store.readState()
        if (!s.active || s.breakStartMs > 0) return@withLock
        publishState(s.copy(breakStartMs = System.currentTimeMillis()))
        refreshSurfaces()
    }

    suspend fun endBreak() = mutex.withLock {
        val s = store.readState()
        if (!s.active || s.breakStartMs == 0L) return@withLock
        endBreakLocked(s, System.currentTimeMillis())
        afterChange()
    }

    suspend fun toggleBreak() {
        if (store.readState().breakStartMs > 0) endBreak() else startBreak()
    }

    suspend fun addQuickBreak(minutes: Int) = mutex.withLock {
        val s = store.readState()
        if (!s.active) return@withLock
        val now = System.currentTimeMillis()
        queueBreak(minutes, now - minutes * 60_000L, now)
        publishState(s.copy(breakMinutes = s.breakMinutes + minutes))
        afterChange()
    }

    private suspend fun queueBreak(minutes: Int, startMs: Long, endMs: Long) {
        dao.insert(
            PendingEvent(
                id = newId(), type = "BREAK", atMs = endMs, minutes = minutes, startMs = startMs, endMs = endMs
            )
        )
    }

    private suspend fun endBreakLocked(s: ClockState, now: Long): ClockState {
        val minutes = max(1, ((now - s.breakStartMs) / 60_000.0).roundToInt())
        queueBreak(minutes, s.breakStartMs, now)
        val updated = s.copy(breakMinutes = s.breakMinutes + minutes, breakStartMs = 0)
        publishState(updated)
        return updated
    }

    suspend fun dismissFailed(id: String) {
        dao.delete(id)
        refreshStatus()
    }

    // ---------- sync ----------

    private fun toDto(e: PendingEvent, recordedOffline: Boolean) = EventDto(
        id = e.id, type = e.type, at = Instant.ofEpochMilli(e.atMs).toString(),
        time = e.time, note = e.note, minutes = e.minutes,
        startIso = e.startMs?.let { Instant.ofEpochMilli(it).toString() },
        endIso = e.endMs?.let { Instant.ofEpochMilli(it).toString() },
        recordedOffline = if (recordedOffline) true else null,
    )

    suspend fun sync(): SyncResult = mutex.withLock {
        if (!store.readState().loggedIn) return@withLock SyncResult.LOGGED_OUT
        var forced = false
        var hadFailure = false
        while (true) {
            val batch = dao.pending(50)
            if (batch.isEmpty()) break
            val token = try {
                auth.validAccessToken(forced)
            } catch (e: IOException) {
                return@withLock SyncResult.RETRY
            } catch (e: AuthException) {
                _state.value = store.readState()
                refreshSurfaces()
                return@withLock SyncResult.LOGGED_OUT
            }
            val now = System.currentTimeMillis()
            val dtos = batch.map { toDto(it, now - it.atMs > 120_000) }
            when (val res = api.events(token, dtos)) {
                is ApiResult.Offline -> return@withLock SyncResult.RETRY
                is ApiResult.Unauthorized -> {
                    if (forced) return@withLock SyncResult.RETRY
                    forced = true
                    continue
                }
                is ApiResult.Http -> return@withLock SyncResult.RETRY
                is ApiResult.Ok -> {
                    var progressed = false
                    for (r in res.value.results) {
                        when (r.status) {
                            "applied", "duplicate" -> { dao.delete(r.id); progressed = true }
                            "rejected" -> { dao.markFailed(r.id, r.message); progressed = true; hadFailure = true }
                            else -> hadFailure = true // transient error: stay pending
                        }
                    }
                    if (!progressed) return@withLock SyncResult.RETRY
                }
            }
        }
        refreshStatusLocked()
        if (dao.pendingCountNow() > 0) SyncResult.RETRY else SyncResult.DONE
    }

    // ---------- status ----------

    suspend fun refreshStatus() = mutex.withLock { refreshStatusLocked() }

    private suspend fun refreshStatusLocked() {
        if (!store.readState().loggedIn) return
        if (dao.pendingCountNow() > 0) return // local state is ahead of the server
        val token = try { auth.validAccessToken() } catch (e: Exception) { return }
        var res = api.status(token)
        if (res is ApiResult.Unauthorized) {
            val t2 = try { auth.validAccessToken(true) } catch (e: Exception) { return }
            res = api.status(t2)
        }
        if (res !is ApiResult.Ok) return
        val st = res.value
        val local = store.readState()
        val a = st.active
        val next = if (a != null) {
            local.copy(
                active = true, entryDate = a.entryDate,
                startMs = TimeUtil.instantFor(a.entryDate, a.startTime),
                breakMinutes = a.breakMinutes,
                breakStartMs = if (local.active) local.breakStartMs else 0,
                note = a.note ?: "",
            )
        } else {
            local.copy(active = false, startMs = 0, breakMinutes = 0, breakStartMs = 0, note = "")
        }
        publishState(next.copy(userName = "${st.user.firstName} ${st.user.lastName}".trim()))
        publishStats(
            Stats(st.today.workedMinutes, st.week.workedMinutes, st.month.workedMinutes, TimeUtil.today())
        )
        refreshSurfaces()
    }
}
