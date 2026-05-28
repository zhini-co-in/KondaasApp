import Foundation
import CoreLocation
import React

@objc(LocationService)
class LocationService: RCTEventEmitter, CLLocationManagerDelegate {

  @objc static var shared: LocationService?
  private var locationManager: CLLocationManager?
  private var hasListeners = false
  private var pendingEvents: [[String: Any]] = []

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  override init() {
    super.init()
    LocationService.shared = self
    print("✅ LocationService init — shared set")
  }

  override func supportedEvents() -> [String]! {
    return ["nativeLocationUpdate"]
  }

  override func startObserving() {
    hasListeners = true
    // JS listener ready ஆனதும் pending events flush பண்ணு
    for event in pendingEvents {
      sendEvent(withName: "nativeLocationUpdate", body: event)
    }
    pendingEvents.removeAll()
  }

  override func stopObserving() {
    hasListeners = false
  }

  @objc func startTracking() {
    // ✅ MUST run on main thread
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }

      if self.locationManager != nil {
        print("⚠️ Already tracking")
        return
      }

      let manager = CLLocationManager()
      manager.delegate = self
      manager.desiredAccuracy = kCLLocationAccuracyBest
      manager.allowsBackgroundLocationUpdates = true
      manager.pausesLocationUpdatesAutomatically = false
      manager.distanceFilter = kCLDistanceFilterNone
      manager.startUpdatingLocation()  // ✅ இது மட்டும் போதும், Timer வேண்டாம்

      self.locationManager = manager
      print("✅ iOS LocationService startTracking called")
    }
  }

  @objc func stopTracking() {
    DispatchQueue.main.async { [weak self] in
      self?.locationManager?.stopUpdatingLocation()
      self?.locationManager = nil
      print("🛑 iOS LocationService stopTracking called")
    }
  }

  func locationManager(_ manager: CLLocationManager,
                       didUpdateLocations locations: [CLLocation]) {
    guard let loc = locations.last else { return }

    let body: [String: Any] = [
      "latitude": loc.coordinate.latitude,
      "longitude": loc.coordinate.longitude,
      "timestamp": loc.timestamp.timeIntervalSince1970 * 1000
    ]

    print("📍 Location update: \(loc.coordinate.latitude), \(loc.coordinate.longitude)")

    if hasListeners {
      sendEvent(withName: "nativeLocationUpdate", body: body)
      print("✅ Event sent to JS")
    } else {
      // JS listener இல்லாட்டாலும் queue பண்ணு
      pendingEvents.append(body)
      print("⏳ Queued — listener not ready yet")
    }
  }

  func locationManager(_ manager: CLLocationManager,
                       didFailWithError error: Error) {
    print("❌ Location error: \(error.localizedDescription)")
  }
}