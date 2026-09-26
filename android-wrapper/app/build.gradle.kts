plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.thesystem.workouttracker"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.thesystem.workouttracker"
        minSdk = 26
        targetSdk = 35
        versionCode = 37
        versionName = "0.37"
    }
}
dependencies {
    implementation("androidx.activity:activity-ktx:1.10.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.health.connect:connect-client:1.1.0")
}
