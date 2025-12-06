import React from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { CameraView, Camera } from "expo-camera";
import { markJarUsed, parseJarQrData, getJarById } from "../db";

export default function QRScannerScreen() {
  const [hasPermission, setHasPermission] = React.useState<boolean | null>(
    null
  );
  const [scanned, setScanned] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    const jarId = parseJarQrData(data);
    if (!jarId) {
      Alert.alert("Invalid QR Code", "This QR code is not a pantry jar label.");
      setTimeout(() => setScanned(false), 2000);
      return;
    }

    try {
      // Get jar details first
      const jar = await getJarById(jarId);
      if (!jar) {
        Alert.alert(
          "Jar Not Found",
          `Jar with ID ${jarId} was not found in your pantry.`
        );
        setTimeout(() => setScanned(false), 2000);
        return;
      }

      // Check if already used
      if (jar.used) {
        Alert.alert(
          "Already Used",
          `This jar (ID: ${jarId}) has already been marked as used.`,
          [
            {
              text: "OK",
              onPress: () => setTimeout(() => setScanned(false), 500),
            },
          ]
        );
        return;
      }

      // Show confirmation dialog with delay
      setTimeout(() => {
        Alert.alert(
          "Mark Jar as Used",
          `Are you sure you want to mark jar ${jarId} as used?\n\nThis action cannot be undone.`,
          [
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => setTimeout(() => setScanned(false), 500),
            },
            {
              text: "Mark Used",
              style: "destructive",
              onPress: async () => {
                const result = await markJarUsed(jarId);
                if (result.success) {
                  Alert.alert(
                    "Success",
                    `Jar ${jarId} has been marked as used.`,
                    [
                      {
                        text: "OK",
                        onPress: () => setTimeout(() => setScanned(false), 500),
                      },
                    ]
                  );
                } else {
                  Alert.alert("Error", result.message, [
                    {
                      text: "OK",
                      onPress: () => setTimeout(() => setScanned(false), 500),
                    },
                  ]);
                }
              },
            },
          ]
        );
      }, 1000); // 1 second delay before showing confirmation
    } catch (error) {
      console.error("Error processing scanned jar:", error);
      Alert.alert(
        "Error",
        "An error occurred while processing the jar. Please try again.",
        [
          {
            text: "OK",
            onPress: () => setTimeout(() => setScanned(false), 500),
          },
        ]
      );
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <Text>Requesting camera permission…</Text>
      </View>
    );
  }
  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Text>No access to camera.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={handleBarCodeScanned}
      />
      <View style={styles.overlay}>
        <Text style={styles.overlayText}>Scan a jar label</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  overlay: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  overlayText: {
    backgroundColor: "rgba(0,0,0,0.6)",
    color: "white",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
});
