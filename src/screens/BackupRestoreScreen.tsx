import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { exportToJson, importFromJson } from '../db';

export default function BackupRestoreScreen() {
  const onBackup = async () => {
    const json = await exportToJson();
    const uri = FileSystem.cacheDirectory + `mypantry-backup-${Date.now()}.json`;
    await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/json' });
    } else {
      Alert.alert('Backup saved', `Saved to: ${uri}`);
    }
  };

  const onRestore = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', multiple: false, copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    const json = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
    await importFromJson(json);
    Alert.alert('Restore complete', 'Data has been restored.');
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.btn} onPress={onBackup}>
        <Text style={styles.btnText}>Backup to JSON</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btn} onPress={onRestore}>
        <Text style={styles.btnText}>Restore from JSON</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  btn: { padding: 14, backgroundColor: '#424242', borderRadius: 10 },
  btnText: { color: 'white', textAlign: 'center', fontWeight: '600' },
});


