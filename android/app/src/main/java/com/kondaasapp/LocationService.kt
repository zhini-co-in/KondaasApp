package com.zhini.kondaas

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class LocationService : Service() {

    private val CHANNEL_ID = "kondaas_location"
    private val NOTIFICATION_ID = 1001
    private val INTERVAL = 120000L
    private var locationManager: LocationManager? = null
    private var locationListener: LocationListener? = null

    override fun onCreate() {
        super.onCreate()
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        createNotificationChannel()
        Log.d("LocationService", "✅ onCreate")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification())
        try {
            Log.d("LocationService", "✅ Started")
            startLocationUpdates()
        } catch (e: Exception) {
            Log.e("LocationService", "❌ Start error: ${e.message}")
        }
        return START_STICKY
    }

    private fun startLocationUpdates() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) {
            Log.e("LocationService", "❌ No permission — stopping")
            stopSelf()
            return
        }

        if (locationListener == null) {
            locationListener = object : LocationListener {
                override fun onLocationChanged(location: Location) {
                    Log.d("LocationService", "📍 ${location.latitude}, ${location.longitude}")
                    sendToReactNative(location)
                }
                override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
                override fun onProviderEnabled(provider: String) {
                    Log.d("LocationService", "✅ Provider enabled: $provider")
                    if (ContextCompat.checkSelfPermission(this@LocationService,
                            Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                        try {
                            locationManager?.requestLocationUpdates(provider, INTERVAL, 10f, locationListener!!)
                        } catch (e: Exception) {
                            Log.e("LocationService", "Re-register error: ${e.message}")
                        }
                    }
                }
                override fun onProviderDisabled(provider: String) {
                    Log.w("LocationService", "⚠️ Provider disabled: $provider")
                }
            }
        }

        val isGPSEnabled = locationManager?.isProviderEnabled(LocationManager.GPS_PROVIDER) ?: false
        val isNetworkEnabled = locationManager?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) ?: false
        Log.d("LocationService", "GPS: $isGPSEnabled, Network: $isNetworkEnabled")

        if (!isGPSEnabled && !isNetworkEnabled) {
            Log.e("LocationService", "❌ No provider available")
            return
        }

        try {
            if (isGPSEnabled) {
                locationManager?.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER, INTERVAL, 10f, locationListener!!
                )
                Log.d("LocationService", "✅ GPS updates registered")
            }
            if (isNetworkEnabled) {
                locationManager?.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER, INTERVAL, 10f, locationListener!!
                )
                Log.d("LocationService", "✅ Network updates registered")
            }
        } catch (e: SecurityException) {
            Log.e("LocationService", "❌ Permission error: ${e.message}")
        } catch (e: Exception) {
            Log.e("LocationService", "❌ Unknown error: ${e.message}")
        }
    }

    private fun sendToReactNative(location: Location) {
        try {
            val reactApp = application as? ReactApplication ?: return
            val reactContext = reactApp.reactHost?.currentReactContext ?: return

            val params = Arguments.createMap().apply {
                putDouble("latitude", location.latitude)
                putDouble("longitude", location.longitude)
                putDouble("timestamp", location.time.toDouble())
            }

            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("nativeLocationUpdate", params)

            Log.d("LocationService", "✅ SENDING → ${location.latitude}, ${location.longitude}")
        } catch (e: Exception) {
            Log.e("LocationService", "❌ Emit error: ${e.message}")
        }
    }

    private fun buildNotification(): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("KondaasApp")
            .setContentText("Location tracking is active")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setOngoing(true)
            .build()

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Location Tracking", NotificationManager.IMPORTANCE_HIGH
            )
            getSystemService(NotificationManager::class.java)
                ?.createNotificationChannel(channel)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        locationListener?.let { locationManager?.removeUpdates(it) }

        val prefs = getSharedPreferences("location_prefs", Context.MODE_PRIVATE)
        val shouldRestart = prefs.getBoolean("should_restart", true)
        Log.d("LocationService", "🔍 shouldRestart = $shouldRestart")

        if (shouldRestart && ContextCompat.checkSelfPermission(this,
                Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            Log.d("LocationService", "♻️ Restarting service")
            startService(Intent(applicationContext, LocationService::class.java))
        } else {
            Log.d("LocationService", "🛑 Not restarting — stopped intentionally")
        }
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        val prefs = getSharedPreferences("location_prefs", Context.MODE_PRIVATE)
        val shouldRestart = prefs.getBoolean("should_restart", true)
        if (shouldRestart && ContextCompat.checkSelfPermission(this,
                Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            startService(Intent(applicationContext, LocationService::class.java))
        }
        super.onTaskRemoved(rootIntent)
    }
}