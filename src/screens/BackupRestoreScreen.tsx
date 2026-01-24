import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { exportToJson, importFromJson } from "../db";
import { theme } from "../theme";
import { SafeAreaView } from "react-native-safe-area-context";

export default function BackupRestoreScreen() {
  const onBackup = async () => {
    try {
      const json = await exportToJson();
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, -5);
      const fileName = `jartracker-backup-${timestamp}.json`;

      // Try to use Storage Access Framework for proper saving
      if (FileSystem.StorageAccessFramework) {
        try {
          const permissions =
            await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            const fileUri =
              await FileSystem.StorageAccessFramework.createFileAsync(
                permissions.directoryUri,
                fileName,
                "application/json",
              );
            await FileSystem.writeAsStringAsync(fileUri, json);
            Alert.alert(
              "Backup Saved",
              `Backup saved successfully as ${fileName}`,
            );
            return;
          }
        } catch (safError) {
          // console.log("SAF not available, falling back to sharing:", safError);
        }
      }

      // Fallback to sharing if SAF doesn't work
      const tempUri = FileSystem.cacheDirectory + fileName;
      await FileSystem.writeAsStringAsync(tempUri, json);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(tempUri, {
          mimeType: "application/json",
          dialogTitle: "Save JarTracker Backup",
        });
      } else {
        Alert.alert(
          "Backup Created",
          `Backup created in app cache. Use the share button to save it permanently.`,
        );
      }
    } catch (error) {
      console.error("Backup failed:", error);
      Alert.alert(
        "Backup Failed",
        "An error occurred while creating the backup.",
      );
    }
  };
  const onRestore = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: "application/json",
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    const json = await FileSystem.readAsStringAsync(asset.uri);
    await importFromJson(json);
    Alert.alert("Restore complete", "Data has been restored.");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.section}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Backup and restore</Text>
        </View>
        <Text style={styles.sectionTitle}>Backup Data</Text>

        <TouchableOpacity style={styles.btn} onPress={onBackup}>
          <Text style={styles.btnText}>Create Backup</Text>
        </TouchableOpacity>
        <Text style={styles.helpText}>
          Creates a backup file and lets you choose where to save it
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Restore Data</Text>
        <TouchableOpacity
          style={[styles.btn, styles.dangerBtn]}
          onPress={onRestore}
        >
          <Text style={styles.btnText}>Restore from Backup</Text>
        </TouchableOpacity>
        <Text style={styles.helpText}>
          Choose a backup file to restore your data
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fefcf8",
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#5d7a5d",
    marginBottom: 8,
  },

  headerContainer: {
    ...theme.typography.headerContainer,
    paddingHorizontal: 0,
  },
  headerTitle: {
    ...theme.typography.headingTitle,
    paddingVertical: theme.spacing.xl,
  },
  btn: {
    padding: 16,
    backgroundColor: "#5d7a5d",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#5d7a5d",
    marginBottom: 8,
  },
  dangerBtn: {
    backgroundColor: "#d32f2f",
    borderColor: "#d32f2f",
  },
  btnText: {
    color: "white",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 16,
  },
  helpText: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
  },
});
