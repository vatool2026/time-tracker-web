package app.zeiterfassungpro.android.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import kotlin.math.max

object TimeUtil {
    val zone: ZoneId = ZoneId.of("Europe/Berlin")
    private const val QUARTER = 15 * 60_000L
    private val hhmmFmt = DateTimeFormatter.ofPattern("HH:mm")

    /** Same rule as the server: round to the nearest 15 minutes (half up). */
    fun roundTo15(ms: Long): Long = Math.floorDiv(ms + QUARTER / 2, QUARTER) * QUARTER

    fun hhmm(ms: Long): String = ZonedDateTime.ofInstant(Instant.ofEpochMilli(ms), zone).format(hhmmFmt)

    fun today(): String = LocalDate.now(zone).toString()

    fun instantFor(date: LocalDate, time: LocalTime): Long =
        ZonedDateTime.of(date, time, zone).toInstant().toEpochMilli()

    fun instantFor(date: String, time: String): Long =
        instantFor(LocalDate.parse(date), LocalTime.parse(time))

    fun formatMinutes(minutes: Long): String {
        val m = max(0L, minutes)
        return "%d:%02d h".format(m / 60, m % 60)
    }
}

/** Locally cached clock state; the source of truth for UI, notification and widgets. */
data class ClockState(
    val loggedIn: Boolean = false,
    val userName: String = "",
    val active: Boolean = false,
    val entryDate: String = "",
    val startMs: Long = 0,
    val breakMinutes: Int = 0,
    val breakStartMs: Long = 0,
    val note: String = "",
) {
    val onBreak: Boolean get() = active && breakStartMs > 0

    fun workedMs(now: Long): Long {
        if (!active) return 0
        val live = if (breakStartMs > 0) now - breakStartMs else 0
        return max(0L, now - startMs - breakMinutes * 60_000L - live)
    }
}

data class Stats(
    val todayMinutes: Long = 0,
    val weekMinutes: Long = 0,
    val monthMinutes: Long = 0,
    val dateKey: String = "",
) {
    fun todayTotal(state: ClockState, now: Long): Long =
        (if (dateKey == TimeUtil.today()) todayMinutes else 0) + state.workedMs(now) / 60_000
    fun weekTotal(state: ClockState, now: Long): Long = weekMinutes + state.workedMs(now) / 60_000
}

class Store(context: Context) {
    private val p = context.applicationContext.getSharedPreferences("zep", Context.MODE_PRIVATE)

    var accessToken: String
        get() = p.getString("at", "") ?: ""
        set(v) { p.edit().putString("at", v).apply() }
    var refreshToken: String
        get() = p.getString("rt", "") ?: ""
        set(v) { p.edit().putString("rt", v).apply() }
    var expiresAtMs: Long
        get() = p.getLong("exp", 0)
        set(v) { p.edit().putLong("exp", v).apply() }

    fun readState(): ClockState = ClockState(
        loggedIn = refreshToken.isNotEmpty(),
        userName = p.getString("name", "") ?: "",
        active = p.getBoolean("active", false),
        entryDate = p.getString("date", "") ?: "",
        startMs = p.getLong("start", 0),
        breakMinutes = p.getInt("brk", 0),
        breakStartMs = p.getLong("brkStart", 0),
        note = p.getString("note", "") ?: "",
    )

    fun writeState(s: ClockState) {
        p.edit()
            .putString("name", s.userName)
            .putBoolean("active", s.active)
            .putString("date", s.entryDate)
            .putLong("start", s.startMs)
            .putInt("brk", s.breakMinutes)
            .putLong("brkStart", s.breakStartMs)
            .putString("note", s.note)
            .apply()
    }

    fun readStats(): Stats = Stats(
        p.getLong("sToday", 0), p.getLong("sWeek", 0), p.getLong("sMonth", 0), p.getString("sKey", "") ?: ""
    )

    fun writeStats(s: Stats) {
        p.edit().putLong("sToday", s.todayMinutes).putLong("sWeek", s.weekMinutes)
            .putLong("sMonth", s.monthMinutes).putString("sKey", s.dateKey).apply()
    }

    fun clear() { p.edit().clear().apply() }
}

@Entity(tableName = "pending_events")
data class PendingEvent(
    @PrimaryKey val id: String,
    val type: String,
    val atMs: Long,
    val time: String? = null,
    val note: String? = null,
    val minutes: Int? = null,
    val startMs: Long? = null,
    val endMs: Long? = null,
    val status: String = "PENDING",
    val error: String? = null,
    val createdAtMs: Long = System.currentTimeMillis(),
)

@Dao
interface PendingDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(e: PendingEvent)

    @Query("SELECT * FROM pending_events WHERE status = 'PENDING' ORDER BY atMs, createdAtMs LIMIT :n")
    suspend fun pending(n: Int): List<PendingEvent>

    @Query("SELECT COUNT(*) FROM pending_events WHERE status = 'PENDING'")
    suspend fun pendingCountNow(): Int

    @Query("SELECT COUNT(*) FROM pending_events WHERE status = 'PENDING'")
    fun pendingCount(): Flow<Int>

    @Query("SELECT * FROM pending_events WHERE status = 'FAILED' ORDER BY atMs")
    fun failed(): Flow<List<PendingEvent>>

    @Query("DELETE FROM pending_events WHERE id = :id")
    suspend fun delete(id: String)

    @Query("UPDATE pending_events SET status = 'FAILED', error = :error WHERE id = :id")
    suspend fun markFailed(id: String, error: String?)

    @Query("DELETE FROM pending_events")
    suspend fun clearAll()
}

@Database(entities = [PendingEvent::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun dao(): PendingDao
}
