# Capacitor 기본 규칙 — 플러그인 reflection 보호
-keep class com.getcapacitor.** { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * {
    @com.getcapacitor.annotation.CapacitorPlugin <methods>;
    @com.getcapacitor.PluginMethod <methods>;
}

# WebView JavaScript 인터페이스 보호
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# AdMob (Google Mobile Ads SDK)
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.android.gms.common.** { *; }
-dontwarn com.google.android.gms.**

# UMP (User Messaging Platform — GDPR consent SDK, AdMob 의존)
-keep class com.google.android.ump.** { *; }
-dontwarn com.google.android.ump.**

# Capacitor Community AdMob 플러그인 (R8 full mode 대응)
-keep class com.getcapacitor.community.admob.** { *; }

# 로컬 알림 플러그인
-keep class com.capacitorjs.plugins.localnotifications.** { *; }

# Splash Screen 플러그인
-keep class com.capacitorjs.plugins.splashscreen.** { *; }

# Cordova 호환성 (Capacitor 가 Cordova 플러그인 호환 레이어 포함)
-keep class org.apache.cordova.** { *; }
-keep class * extends org.apache.cordova.CordovaPlugin

# 라인 번호 유지 — Play Console 크래시 리포트 디버깅용
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# 출시 시 일반적 경고 무시
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
-dontwarn org.conscrypt.**
