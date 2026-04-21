package com.trisentrix.kondaas

import android.location.LocationManager
import android.content.Context
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

class LocationPackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext) = listOf(LocationModule(ctx))
    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}