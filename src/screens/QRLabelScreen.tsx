import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../App";
import { buildJarQrData, getDb, formatDateWithUserPreference } from "../db";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import QRCodeGenerator from "qrcode-generator";

type Route = RouteProp<RootStackParamList, "QRLabel">;

const { width: screenWidth } = Dimensions.get("window");

export default function QRLabelScreen({
  route,
}: {
  route: Route["params"] & any;
}) {
  const jarId = (route as any).params.jarId as number;
  const batchIds = (route as any).params.batchIds as number[] | undefined;
  const [name, setName] = React.useState("");
  const [isGeneratingPDF, setIsGeneratingPDF] = React.useState(false);

  const allJarIds = batchIds || [jarId];

  React.useEffect(() => {
    (async () => {
      const db = await getDb();
      const row = await db.getFirstAsync<any>(
        "SELECT it.name FROM jars j JOIN item_types it ON it.id = j.itemTypeId WHERE j.id = ?",
        jarId
      );
      setName(row?.name ?? "Jar");
    })();
  }, [jarId]);

  // Generate QR code as SVG data URL
  const generateQRCodeDataURL = (data: string): string => {
    try {
      // Create QR code using qrcode-generator
      const qr = QRCodeGenerator(0, "M"); // Type 0 (auto), Error correction level M
      qr.addData(data);
      qr.make();

      // Get the module count
      const moduleCount = qr.getModuleCount();
      const size = 110; // Smaller size for 2" labels
      const moduleSize = size / moduleCount;

      // Generate SVG
      let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">`;
      svg += `<rect width="${size}" height="${size}" fill="white"/>`;

      // Draw QR code modules
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          if (qr.isDark(row, col)) {
            const x = col * moduleSize;
            const y = row * moduleSize;
            svg += `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`;
          }
        }
      }

      svg += "</svg>";

      // Convert SVG to data URL
      const base64 = btoa(svg);
      return `data:image/svg+xml;base64,${base64}`;
    } catch (error) {
      console.error("Error generating QR code:", error);
      // Fallback to a simple pattern
      return generateFallbackQR(data);
    }
  };

  // Fallback QR generation
  const generateFallbackQR = (data: string): string => {
    const size = 110; // Smaller size for 2" labels
    const modules = 25;
    const moduleSize = size / modules;

    // Simple hash function to create a deterministic pattern
    const hashCode = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      return Math.abs(hash);
    };

    const hash = hashCode(data);
    let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect width="${size}" height="${size}" fill="white"/>`;

    // Create a pattern based on the data
    for (let row = 0; row < modules; row++) {
      for (let col = 0; col < modules; col++) {
        const cellHash = hash + (row * modules + col);
        if (cellHash % 3 === 0) {
          const x = col * moduleSize;
          const y = row * moduleSize;
          svg += `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`;
        }
      }
    }

    svg += "</svg>";
    const base64 = btoa(svg);
    return `data:image/svg+xml;base64,${base64}`;
  };

  // Generate HTML for PDF with proper label dimensions
  const generateHTMLForPDF = async (jarIds: number[]): Promise<string> => {
    const sheets: string[] = [];

    // Get formatted current date once for all labels
    const formattedDate = await formatDateWithUserPreference(new Date());

    // Process jars in groups of 24 (4x6 grid)
    for (let i = 0; i < jarIds.length; i += 24) {
      const sheetJars = jarIds.slice(i, i + 24);

      let labelsHTML = "";

      // Generate 24 labels per sheet
      for (let j = 0; j < 24; j++) {
        const currentJarId = sheetJars[j];
        if (currentJarId) {
          // Generate QR code data
          const qrData = buildJarQrData(currentJarId);

          try {
            // Generate QR code as data URL
            const qrCodeDataURL = generateQRCodeDataURL(qrData);

            labelsHTML += `
              <div class="label">
                <div class="label-title">${name}</div>
                <div class="qr-container">
                  <img src="${qrCodeDataURL}" alt="QR Code ${currentJarId}" class="qr-image" />
                </div>
                <div class="label-id">ID: ${currentJarId}</div>
                <div class="label-date">${formattedDate}</div>
              </div>
            `;
          } catch (error) {
            console.error(
              "Error generating QR code for jar",
              currentJarId,
              error
            );
            // Fallback to placeholder if QR generation fails
            labelsHTML += `
              <div class="label">
                <div class="label-title">${name}</div>
                <div class="qr-placeholder">
                  <div class="qr-pattern"></div>
                  <div class="qr-text">QR ${currentJarId}</div>
                </div>
                <div class="label-id">ID: ${currentJarId}</div>
                <div class="label-date">${formattedDate}</div>
              </div>
            `;
          }
        }
      }

      sheets.push(`
        <div class="sheet">
          <div class="label-grid">
            ${labelsHTML}
          </div>
        </div>
      `);
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Jar Labels - ${name}</title>
        <style>
          @page {
            size: 8.5in 11in;
            margin: 0.5in 0.75in;
          }
          
          body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
          }
          
          .sheet {
            width: 7in;
            height: 10in;
            page-break-after: always;
            padding: 0;
            box-sizing: border-box;
          }
          
          .sheet:last-child {
            page-break-after: avoid;
          }
          
          .label-grid {
            display: grid;
            grid-template-columns: repeat(4, 1.5in);
            grid-template-rows: repeat(6, 1.5in);
            column-gap: 0.3125in;
            row-gap: 0.1875in;
            width: 100%;
            height: 100%;
            justify-content: center;
            align-content: center;
          }
          
          .label {
            width: 1.5in;
            height: 1.5in;
            border: 2px solid #000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            padding: 6px;
            box-sizing: border-box;
            background: white;
          }
          

          
          .label-title {
            font-size: 12px;
            font-weight: bold;
            text-align: center;
            line-height: 1.1;
            margin-bottom: 3px;
          }
          
          .qr-container {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 2px 0;
          }
          
          .qr-image {
            width: 80px;
            height: 80px;
            display: block;
          }
          
          .qr-placeholder {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 80px;
            height: 80px;
            border: 2px solid #333;
            position: relative;
          }
          
          .qr-pattern {
            width: 100%;
            height: 60%;
            background: repeating-linear-gradient(
              90deg,
              #000 0px,
              #000 4px,
              #fff 4px,
              #fff 8px
            );
          }
          
          .qr-text {
            font-size: 10px;
            font-weight: bold;
            margin-top: 3px;
          }
          
          .label-id {
            font-size: 10px;
            font-weight: bold;
            color: #333;
            text-align: center;
            margin-top: 3px;
          }
          
          .label-date {
            font-size: 8px;
            color: #666;
            text-align: center;
          }
        </style>
      </head>
      <body>
        ${sheets.join("")}
      </body>
      </html>
    `;
  };

  // Generate and share PDF
  const generatePDF = async () => {
    try {
      setIsGeneratingPDF(true);

      const html = await generateHTMLForPDF(allJarIds);

      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `${name} Labels`,
        UTI: "com.adobe.pdf",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      Alert.alert("Error", "Failed to generate PDF. Please try again.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.batchCount}>
          {allJarIds.length} Jar{allJarIds.length !== 1 ? "s" : ""}
        </Text>

        <Text style={styles.description}>
          Generate printable labels (1.5" × 1.5") - 24 per sheet
        </Text>

        <TouchableOpacity
          style={[
            styles.generateButton,
            isGeneratingPDF && styles.generateButtonDisabled,
          ]}
          onPress={generatePDF}
          disabled={isGeneratingPDF}
        >
          <Text style={styles.generateButtonText}>
            {isGeneratingPDF ? "Generating PDF..." : "📄 Generate Label Sheet"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.info}>
          {Math.ceil(allJarIds.length / 24)} sheet
          {Math.ceil(allJarIds.length / 24) !== 1 ? "s" : ""} will be generated
        </Text>
      </View>

      <View style={styles.previewContainer}>
        <Text style={styles.previewTitle}>Preview (4×6 grid per sheet):</Text>
        <View style={styles.gridPreview}>
          {allJarIds.slice(0, 24).map((jarId, index) => (
            <View key={jarId} style={styles.miniLabel}>
              <Text style={styles.miniLabelText}>{name}</Text>
              <View style={styles.miniQRPlaceholder}>
                <Text style={styles.miniQRText}>QR</Text>
              </View>
              <Text style={styles.miniLabelId}>ID: {jarId}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
    color: "#333",
  },
  batchCount: {
    fontSize: 16,
    color: "#666",
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  generateButton: {
    backgroundColor: "#2e7d32",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  generateButtonDisabled: {
    backgroundColor: "#ccc",
  },
  generateButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  info: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    fontStyle: "italic",
  },
  previewContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  gridPreview: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  miniLabel: {
    width: "31%", // 3 columns with gaps
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    padding: 4,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
  },

  miniLabelText: {
    fontSize: 8,
    fontWeight: "600",
    textAlign: "center",
    color: "#333",
  },
  miniQRPlaceholder: {
    flex: 1,
    width: "80%",
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 2,
  },
  miniQRText: {
    fontSize: 6,
    color: "#666",
    fontWeight: "600",
  },
  miniLabelId: {
    fontSize: 6,
    color: "#333",
    fontWeight: "600",
  },
  // Keep old styles for compatibility
  batchInfo: {
    fontSize: 16,
    color: "#666",
    marginBottom: 16,
    textAlign: "center",
  },
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    padding: 4,
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: "center",
  },
  toggleButtonActive: {
    backgroundColor: "#2e7d32",
  },
  toggleText: {
    color: "#666",
    fontWeight: "600",
  },
  toggleTextActive: {
    color: "white",
  },
  gridContainer: {
    flex: 1,
    paddingVertical: 8,
  },
  gridRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
    alignItems: "flex-start",
  },
  qrLabel: {
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  qrContainer: {
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  qrTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  qrSub: {
    marginTop: 4,
    color: "#666",
    fontSize: 12,
    textAlign: "center",
  },
  qrDate: {
    marginTop: 2,
    color: "#999",
    fontSize: 10,
    textAlign: "center",
  },
  singleViewContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  navigation: {
    flexDirection: "row",
    marginTop: 24,
    gap: 16,
  },
  navButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#1565c0",
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
  },
  navButtonDisabled: {
    backgroundColor: "#ccc",
  },
  navButtonText: {
    color: "white",
    fontWeight: "600",
  },
  navButtonTextDisabled: {
    color: "#999",
  },
});
