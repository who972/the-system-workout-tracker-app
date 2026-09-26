plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.thesystem.workouttracker"
    compileSdk = 36

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    signingConfigs {
        create("systemDebug") {
            storeFile = rootProject.file("system-debug.keystore")
            storePassword = System.getenv("SYSTEM_KEYSTORE_PASSWORD")
            keyAlias = System.getenv("SYSTEM_KEY_ALIAS")
            keyPassword = System.getenv("SYSTEM_KEY_PASSWORD")
        }
    }

    defaultConfig {
        applicationId = "com.thesystem.workouttracker"
        minSdk = 26
        targetSdk = 36
        versionCode = 40
        versionName = "0.40"
    }

    buildTypes {
        getByName("debug") {
            signingConfig = signingConfigs.getByName("systemDebug")
        }
    }
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.10.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.health.connect:connect-client:1.1.0")
}
