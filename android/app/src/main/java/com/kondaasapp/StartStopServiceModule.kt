package com.zhini.kondaas

import android.content.Intent
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class StartStopServiceModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "StartStopService"

    @ReactMethod
    fun startService() {
        Log.d("StartStopService", "Starting LocationService")
        reactContext.getSharedPreferences("location_prefs", android.content.Context.MODE_PRIVATE)
            .edit().putBoolean("should_restart", true).apply()
        val intent = Intent(reactContext, LocationService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }
    }

    @ReactMethod
    fun stopService() {
        Log.d("StartStopService", "Stopping LocationService")
        reactContext.getSharedPreferences("location_prefs", android.content.Context.MODE_PRIVATE)
            .edit().putBoolean("should_restart", false).apply()
        reactContext.stopService(Intent(reactContext, LocationService::class.java))
    }

    @ReactMethod
    fun requestBatteryOptimization() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val packageName = reactContext.packageName
                val pm = reactContext.getSystemService(android.content.Context.POWER_SERVICE)
                    as android.os.PowerManager
                if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                    val intent = Intent(
                        android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
                    ).apply {
                        data = android.net.Uri.parse("package:$packageName")
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    reactContext.startActivity(intent)
                    Log.d("StartStopService", "Battery optimization dialog shown")
                } else {
                    Log.d("StartStopService", "Already ignoring battery optimization")
                }
            }
        } catch (e: Exception) {
            Log.e("StartStopService", "Battery optimization error: ${e.message}")
        }
    }
}