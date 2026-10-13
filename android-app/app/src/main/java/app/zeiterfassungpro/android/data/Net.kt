package app.zeiterfassungpro.android.data

import app.zeiterfassungpro.android.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

object Net {
    val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()

    // explicitNulls = false is required: the server rejects `"time": null`.
    val json = Json { ignoreUnknownKeys = true; explicitNulls = false; encodeDefaults = false }
    val media = "application/json".toMediaType()
}

class AuthException(message: String) : Exception(message)

sealed class LoginResult {
    object Success : LoginResult()
    data class NeedsMfa(val factorId: String, val accessToken: String) : LoginResult()
}

class AuthClient(private val store: Store) {
    private val base get() = BuildConfig.SUPABASE_URL.trimEnd('/')

    private fun post(url: String, body: JsonObject, bearer: String?): Pair<Int, String> {
        val req = Request.Builder().url(url)
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .apply { if (bearer != null) header("Authorization", "Bearer $bearer") }
            .post(body.toString().toRequestBody(Net.media))
            .build()
        Net.http.newCall(req).execute().use { return it.code to (it.body?.string() ?: "") }
    }

    private fun parse(text: String): JsonObject =
        try { Net.json.parseToJsonElement(text).jsonObject } catch (e: Exception) { JsonObject(emptyMap()) }

    private fun errorMessage(o: JsonObject): String {
        val code = o["error_code"]?.jsonPrimitive?.contentOrNull
        if (code == "invalid_credentials") return "E-Mail oder Passwort ist falsch."
        return o["error_description"]?.jsonPrimitive?.contentOrNull
            ?: o["msg"]?.jsonPrimitive?.contentOrNull
            ?: o["message"]?.jsonPrimitive?.contentOrNull
            ?: "Anmeldung fehlgeschlagen."
    }

    private fun saveSession(o: JsonObject) {
        store.accessToken = o["access_token"]!!.jsonPrimitive.content
        store.refreshToken = o["refresh_token"]!!.jsonPrimitive.content
        val expiresIn = o["expires_in"]?.jsonPrimitive?.contentOrNull?.toLongOrNull() ?: 3600
        store.expiresAtMs = System.currentTimeMillis() + expiresIn * 1000
    }

    /** Throws IOException if offline, AuthException on rejected credentials. */
    suspend fun login(email: String, password: String): LoginResult = withContext(Dispatchers.IO) {
        val (code, text) = post(
            "$base/auth/v1/token?grant_type=password",
            buildJsonObject { put("email", email.trim()); put("password", password) }, null
        )
        val o = parse(text)
        if (code !in 200..299) throw AuthException(errorMessage(o))
        val factor = o["user"]?.jsonObject?.get("factors")?.jsonArray
            ?.map { it.jsonObject }
            ?.firstOrNull {
                it["factor_type"]?.jsonPrimitive?.contentOrNull == "totp" &&
                    it["status"]?.jsonPrimitive?.contentOrNull == "verified"
            }
        if (factor != null) {
            // MFA is enrolled: the aal1 session must not be stored until the code is verified.
            return@withContext LoginResult.NeedsMfa(
                factor["id"]!!.jsonPrimitive.content,
                o["access_token"]!!.jsonPrimitive.content
            )
        }
        saveSession(o)
        LoginResult.Success
    }

    suspend fun verifyMfa(factorId: String, aal1Token: String, codeInput: String) = withContext(Dispatchers.IO) {
        val (c1, t1) = post("$base/auth/v1/factors/$factorId/challenge", buildJsonObject { }, aal1Token)
        val challenge = parse(t1)
        if (c1 !in 200..299) throw AuthException(errorMessage(challenge))
        val (c2, t2) = post(
            "$base/auth/v1/factors/$factorId/verify",
            buildJsonObject {
                put("challenge_id", challenge["id"]!!.jsonPrimitive.content)
                put("code", codeInput.trim())
            }, aal1Token
        )
        val o = parse(t2)
        if (c2 !in 200..299) throw AuthException("Der Code ist ungültig.")
        saveSession(o)
    }

    /** Returns a valid access token. IOException = offline, AuthException = session is gone. */
    suspend fun validAccessToken(force: Boolean = false): String = withContext(Dispatchers.IO) {
        if (store.refreshToken.isEmpty()) throw AuthException("Nicht angemeldet.")
        if (!force && store.accessToken.isNotEmpty() && store.expiresAtMs - System.currentTimeMillis() > 60_000) {
            return@withContext store.accessToken
        }
        val (code, text) = post(
            "$base/auth/v1/token?grant_type=refresh_token",
            buildJsonObject { put("refresh_token", store.refreshToken) }, null
        )
        if (code in 200..299) {
            saveSession(parse(text))
            return@withContext store.accessToken
        }
        if (code in 400..401 || code == 403) {
            store.accessToken = ""; store.refreshToken = ""
            throw AuthException("Sitzung abgelaufen. Bitte neu anmelden.")
        }
        throw IOException("Token-Refresh fehlgeschlagen ($code)")
    }
}

@Serializable data class MinutesDto(val workedMinutes: Long = 0)
@Serializable data class UserDto(val firstName: String = "", val lastName: String = "")
@Serializable data class ActiveDto(
    val id: String = "",
    val entryDate: String,
    val startTime: String,
    val breakMinutes: Int = 0,
    val note: String? = null,
)
@Serializable data class StatusDto(
    val user: UserDto = UserDto(),
    val active: ActiveDto? = null,
    val today: MinutesDto = MinutesDto(),
    val week: MinutesDto = MinutesDto(),
    val month: MinutesDto = MinutesDto(),
)
@Serializable data class EventDto(
    val id: String,
    val type: String,
    val at: String,
    val time: String? = null,
    val note: String? = null,
    val minutes: Int? = null,
    val startIso: String? = null,
    val endIso: String? = null,
    val recordedOffline: Boolean? = null,
)
@Serializable data class EventsRequest(val events: List<EventDto>)
@Serializable data class ResultDto(val id: String, val status: String, val message: String? = null)
@Serializable data class EventsResponse(val results: List<ResultDto> = emptyList())

sealed class ApiResult<out T> {
    data class Ok<T>(val value: T) : ApiResult<T>()
    object Unauthorized : ApiResult<Nothing>()
    data class Http(val code: Int, val message: String) : ApiResult<Nothing>()
    object Offline : ApiResult<Nothing>()
}

class ApiClient {
    private val base get() = BuildConfig.API_BASE_URL.trimEnd('/')

    private suspend inline fun <reified T> call(req: Request): ApiResult<T> = withContext(Dispatchers.IO) {
        try {
            Net.http.newCall(req).execute().use { resp ->
                val text = resp.body?.string() ?: ""
                when {
                    resp.code == 401 -> ApiResult.Unauthorized
                    resp.isSuccessful -> ApiResult.Ok(Net.json.decodeFromString<T>(text))
                    else -> ApiResult.Http(resp.code, text.take(200))
                }
            }
        } catch (e: IOException) {
            ApiResult.Offline
        } catch (e: kotlinx.serialization.SerializationException) {
            ApiResult.Http(0, "Ungültige Serverantwort")
        }
    }

    suspend fun status(token: String): ApiResult<StatusDto> = call(
        Request.Builder().url("$base/api/mobile/status").header("Authorization", "Bearer $token").get().build()
    )

    suspend fun events(token: String, events: List<EventDto>): ApiResult<EventsResponse> = call(
        Request.Builder().url("$base/api/mobile/events").header("Authorization", "Bearer $token")
            .post(Net.json.encodeToString(EventsRequest.serializer(), EventsRequest(events)).toRequestBody(Net.media))
            .build()
    )
}
