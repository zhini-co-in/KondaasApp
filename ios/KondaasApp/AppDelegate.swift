import UIKit
import FirebaseCore
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import Firebase
import CodePush // ✅ Correct

@main
class AppDelegate: RCTAppDelegate { // 1. Inherit from RCTAppDelegate for better RN integration

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    FirebaseApp.configure()
    
    self.moduleName = "KondaasApp"
    self.dependencyProvider = RCTAppDependencyProvider()

    // Add any custom initial props here
    self.initialProps = [:]

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // ✅ This is where Revopush links into the Swift lifecycle
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    return self.bundleURL()
  }

  override func bundleURL() -> URL? {
    #if DEBUG
      return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
    #else
      // ✅ Revopush (CodePush) handles the production bundle
      return CodePush.bundleURL() 
    #endif
  }
}