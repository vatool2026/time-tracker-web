import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.devtools.ksp")
}

// --- Build-time configuration -------------------------------------------------------------
// Supabase URL + anon key are read from the web project's .env.local (public values, same as the
// web app uses). The API base URL (deployed Next.js site) comes from app.local.properties.
fun loadEnv(file: File): Map<String, String> =
    if (!file.exists()) emptyMap()
    else file.readLines()
        .map { it.trim() }
        .filter { it.isNotEmpty() && !it.startsWith("#") && it.contains("=") }
        .associate { it.substringBefore("=").trim() to it.substringAfter("=").trim().trim('"', '\'') }

fun loadProps(file: File): Properties =
    Properties().apply { if (file.exists()) file.inputStream().use { load(it) } }

val webEnv = loadEnv(rootProject.file("../.env.local"))
val localProps = loadProps(rootProject.file("app.local.properties"))

val supabaseUrl = webEnv["NEXT_PUBLIC_SUPABASE_URL"] ?: localProps.getProperty("SUPABASE_URL", "")
val supabaseAnonKey = webEnv["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ?: localProps.getProperty("SUPABASE_ANON_KEY", "")
val apiBaseUrl = localProps.getProperty("API_BASE_URL", "https://CHANGE-ME.example.com").trimEnd('/')

android {
    namespace = "app.zeiterfassungpro.android"
    compileSdk = 36

    defaultConfig {
        applicationId = "app.zeiterfassungpro.android"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"

        buildConfigField("String", "SUPABASE_URL", "\"$supabaseUrl\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"$supabaseAnonKey\"")
        buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
    }

    signingConfigs {
        val storeFile = localProps.getProperty("KEYSTORE_FILE")
        if (storeFile != null) {
            create("release") {
                this.storeFile = rootProject.file(storeFile)
                storePassword = localProps.getProperty("KEYSTORE_PASSWORD")
                keyAlias = localProps.getProperty("KEY_ALIAS")
                keyPassword = localProps.getProperty("KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfigs.findByName("release")?.let { signingConfig = it }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.2")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.2")

    val composeBom = platform("androidx.compose:compose-bom:2025.07.00")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    debugImplementation("androidx.compose.ui:ui-tooling")

    implementation("androidx.datastore:datastore-preferences:1.1.7")

    implementation("androidx.room:room-runtime:2.7.2")
    implementation("androidx.room:room-ktx:2.7.2")
    ksp("androidx.room:room-compiler:2.7.2")

    implementation("androidx.work:work-runtime-ktx:2.10.3")

    implementation("androidx.glance:glance-appwidget:1.1.1")

    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}
