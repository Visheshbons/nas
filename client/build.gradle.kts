buildscript {
    dependencies {
        classpath(libs.kotlin.gradle.plugin)
    }
}
plugins {
    alias(libs.plugins.android.application) apply false
}
// Ktor Client
implementation("io.ktor:ktor-client-core:2.3.6")
implementation("io.ktor:ktor-client-android:2.3.6") // Use 'android' engine for Android
implementation("io.ktor:ktor-client-content-negotiation:2.3.6")
implementation("io.ktor:ktor-serialization-kotlinx-json:2.3.6")

// Kotlinx Serialization
implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.0")