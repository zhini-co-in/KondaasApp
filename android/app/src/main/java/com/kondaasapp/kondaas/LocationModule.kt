package com.trisentrix.kondaas

import android.content.Context
import android.content.Intent
import android.location.LocationManager
import com.facebook.react.bridge.*
import com.facebook.react.ReactPackage
import com.facebook.react.uimanager.ViewManager

class LocationModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "LocationManager"

    @ReactMethod
    fun isLocationEnabled(promise: Promise) {
        try {
            val lm = reactApplicationContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager
            val gps = lm.isProviderEnabled(LocationManager.GPS_PROVIDER)
            val network = lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
            promise.resolve(gps || network)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }
}

// 👇 புதுசா சேர்த்தது: JS-ல NativeModules.LocationService-ஐ Foreground
// LocationService (Service class)-ஓட start/stop பண்ண bridge module
class LocationServiceModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "LocationService"

    @ReactMethod
    fun startTracking() {
        val intent = Intent(reactContext, LocationService::class.java)
        reactContext.startForegroundService(intent)
    }

    @ReactMethod
    fun stopTracking() {
        val intent = Intent(reactContext, LocationService::class.java)
        reactContext.stopService(intent)
    }
}

class LocationPackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext) =
        listOf(LocationModule(ctx), LocationServiceModule(ctx))   // 👈 இரண்டையும் register பண்றோம்
    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}