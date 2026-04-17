# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Add project specific ProGuard rules here.

# ─── BackgroundGeolocation ───
-keep class com.transistorsoft.** { *; }
-dontwarn com.transistorsoft.**

# ─── React Native ───
-keep class com.facebook.react.** { *; }
-dontwarn com.facebook.react.**

# ─── AsyncStorage ───
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# ─── OkHttp / Networking ───
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep class okio.** { *; }

# ─── Gson (if used) ───
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn sun.misc.**
-keep class com.google.gson.** { *; }

# ─── General ───
-keepattributes SourceFile,LineNumberTable
-keep public class * extends java.lang.Exception
