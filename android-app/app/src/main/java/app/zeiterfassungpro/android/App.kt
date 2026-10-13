package app.zeiterfassungpro.android

import android.app.Application
import app.zeiterfassungpro.android.data.ClockRepository
import app.zeiterfassungpro.android.notify.ClockNotifications
import app.zeiterfassungpro.android.sync.SyncWorker

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        ClockNotifications.createChannels(this)
        val repo = ClockRepository.get(this)
        if (repo.store.readState().loggedIn) SyncWorker.schedulePeriodic(this)
    }
}
