import React from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { CameraView, Camera } from "expo-camera";
import { markJarUsed, parseJarQrData } from "../db";

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
    if (jarId) {
      await markJarUsed(jarId);
      Alert.alert("Marked used", `Jar ${jarId} marked as used.`);
    } else {
      Alert.alert("Invalid QR", "This QR code is not a pantry jar label.");
    }
    setTimeout(() => setScanned(false), 800);
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
