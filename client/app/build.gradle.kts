plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    // 1. Add the Serialization plugin
    kotlin("plugin.serialization") version "1.9.22"
}

android {
    namespace = "com.example.nas"

    // CORRECTION: Set compileSdk to an integer (34 is the current stable recommendation)
    compileSdk = 34

    defaultConfig {
        applicationId = "com.example.nas"
        minSdk = 31
        targetSdk = 34 // Must match compileSdk or be lower
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        // Keeping Java 11 is fine
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }
}

dependencies {
    // --- REMOVED: implementation(libs.core.ktx), etc. to avoid duplication ---

    // AndroidX & Compose (Using consistent, modern versions)
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1") // Equivalent to libs.appcompat
    implementation("com.google.android.material:material:1.10.0") // Equivalent to libs.material
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.6.2")
    implementation("androidx.activity:activity-compose:1.8.1")
    implementation(platform("androidx.compose:compose-bom:2023.10.00")) // Updated BOM version
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.6.2")

    // 2. Ktor Client and Kotlinx Serialization
    implementation("io.ktor:ktor-client-core:2.3.6")
    implementation("io.ktor:ktor-client-android:2.3.6") // Android engine
    implementation("io.ktor:ktor-client-content-negotiation:2.3.6")
    implementation("io.ktor:ktor-serialization-kotlinx-json:2.3.6")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.0")

    // Testing Dependencies
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
}