plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {\n    compileOptions {\n        sourceCompatibility = JavaVersion.VERSION_17\n        targetCompatibility = JavaVersion.VERSION_17\n    }\n    kotlinOptions {\n        jvmTarget = "17"\n    }\n    namespace = "com.thesystem.workouttracker"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.thesystem.workouttracker"
        minSdk = 26
        targetSdk = 36
        versionCode = 37
        versionName = "0.37"
    }
}
dependencies {
    implementation("androidx.activity:activity-ktx:1.10.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.health.connect:connect-client:1.1.0")
}
