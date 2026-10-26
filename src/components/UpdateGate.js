import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  AppState, Linking, Platform,
} from 'react-native';
import SpInAppUpdates, { IAUUpdateKind } from 'sp-react-native-in-app-updates';

const PLAY_STORE_PACKAGE = 'com.zhini.kondaas'; // 👈 un app package name podu

const inAppUpdates = new SpInAppUpdates(false);

const UpdateGate = ({ children }) => {
  const [updateRequired, setUpdateRequired] = useState(false);
  const checking = useRef(false);

  const checkUpdate = useCallback(async () => {
    if (Platform.OS !== 'android' || checking.current) return;
    checking.current = true;
    try {
      const result = await inAppUpdates.checkNeedsUpdate();
      if (result.shouldUpdate) {
        setUpdateRequired(true); // update mudiyara varaikum block
        await inAppUpdates.startUpdate({ updateType: IAUUpdateKind.IMMEDIATE });
      } else {
        setUpdateRequired(false);
      }
    } catch (e) {
      // net illa / Play Store check fail → app block pannala (offline-first app)
      console.log('[UpdateGate] check failed:', e?.message);
    } finally {
      checking.current = false;
    }
  }, []);

  // App open + background la irundhu thirumba vandha podhu check
  useEffect(() => {
    checkUpdate();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkUpdate();
    });
    return () => sub.remove();
  }, [checkUpdate]);

  const openPlayStore = () => {
    Linking.openURL(`market://details?id=${PLAY_STORE_PACKAGE}`).catch(() =>
      Linking.openURL(`https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE}`)
    );
  };

  return (
    <>
      {children}
      <Modal visible={updateRequired} animationType="fade" onRequestClose={() => {}}>
        <View style={styles.container}>
          <Text style={styles.title}>Update Required</Text>
          <Text style={styles.msg}>
            Puthu version available. App-a use panna update pannanum.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={checkUpdate}>
            <Text style={styles.btnText}>Update Now</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={openPlayStore}>
            <Text style={styles.link}>Open Play Store</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
};

export default UpdateGate;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', padding: 30 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#222', marginBottom: 10 },
  msg: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 28 },
  btn: { backgroundColor: '#ED1C25', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 10, marginBottom: 14 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link: { color: '#3b82f6', fontSize: 14, fontWeight: '600' },
});