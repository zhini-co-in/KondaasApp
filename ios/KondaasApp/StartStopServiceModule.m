#import <React/RCTBridgeModule.h>
#import "KondaasApp-Swift.h"

@interface StartStopServiceModule : NSObject <RCTBridgeModule>
@end

@implementation StartStopServiceModule

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(startService:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    LocationService *service = LocationService.shared;
    if (service) {
      [service startTracking];
      NSLog(@"✅ iOS startService called");
      resolve(@"started");
    } else {
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)),
                     dispatch_get_main_queue(), ^{
        LocationService *retryService = LocationService.shared;
        if (retryService) {
          [retryService startTracking];
          NSLog(@"✅ iOS startService called (retry)");
          resolve(@"started");
        } else {
          NSLog(@"❌ LocationService not initialized");
          reject(@"ERROR", @"LocationService not initialized", nil);
        }
      });
    }
  });
}

RCT_EXPORT_METHOD(stopService:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    LocationService *service = LocationService.shared;
    if (service) {
      [service stopTracking];
      NSLog(@"🛑 iOS stopService called");
    }
    resolve(@"stopped");
  });
}

RCT_EXPORT_METHOD(requestBatteryOptimization:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  resolve(nil);
}

@end