import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../theme";
import packageJson from "../../package.json";

export default function AboutScreen() {
  const handleEmailPress = () => {
    Linking.openURL("mailto:vbdesignapps@gmail.com");
  };

  const handleWebsitePress = () => {
    console.log("Website link pressed");
  };

  const handlePrivacyPolicyPress = () => {
    Linking.openURL(
      "https://verbowersock.github.io/JarTrackerPrivacy/privacy.html"
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* App Info Section */}
          <View style={styles.section}>
            <View style={styles.headerSection}>
              <Image
                source={require("../../assets/icon.png")}
                style={styles.appIcon}
                resizeMode="cover"
              />
              <Text style={styles.appName}>Jar Tracker</Text>
              <Text style={styles.version}>Version {packageJson.version}</Text>
            </View>
            <Text style={styles.description}>
              Keep track of your home-canned goods, preserves, and jarred items.
            </Text>
            <Text style={styles.description}>
              Made by a home canner for other home canners!
            </Text>
          </View>

          {/* Features Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Features</Text>
            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={theme.colors.primary}
                />
                <Text style={styles.featureText}>
                  Track jar inventory and usage
                </Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={theme.colors.primary}
                />
                <Text style={styles.featureText}>
                  Organize by categories and batches
                </Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={theme.colors.primary}
                />
                <Text style={styles.featureText}>
                  QR code scanning and labeling
                </Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={theme.colors.primary}
                />
                <Text style={styles.featureText}>Recipe and notes storage</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={theme.colors.primary}
                />
                <Text style={styles.featureText}>Backup and restore data</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={theme.colors.primary}
                />
                <Text style={styles.featureText}>Statistics and insights</Text>
              </View>
            </View>
          </View>

          {/* Notes Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>
              The QR code stickers are formatted to work best with Premium Label
              Supply 1.5" x 1.5" square labels. These can be purchased from
              various online retailers such as Amazon.
            </Text>
            <Text style={styles.notesText}>
              Please note that different printing services can change the scale
              and margins of the labels, so it's recommended to print a test
              sheet first to ensure proper sizing.
            </Text>
            <Text style={styles.notesText}>
              Alternatively, you can print the labels at home using sticker
              paper compatible with your printer or just use regular paper and
              tape them onto your jars or lids.
            </Text>
          </View>

          {/* Contact Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact & Support</Text>

            <TouchableOpacity
              style={styles.contactItem}
              onPress={handleEmailPress}
            >
              <Ionicons name="mail" size={24} color={theme.colors.primary} />
              <View style={styles.contactText}>
                <Text style={styles.contactLabel}>Email Support</Text>
                <Text style={styles.contactValue}>vbdesignapps@gmail.com</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contactItem}
              onPress={handleWebsitePress}
            >
              <Ionicons name="globe" size={24} color={theme.colors.primary} />
              <View style={styles.contactText}>
                <Text style={styles.contactLabel}>Website</Text>
                <Text style={styles.contactValue}>coming soon</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Developer Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Developer</Text>
            <View style={styles.developerInfo}>
              <Text style={styles.developerName}>Veronika Bowersock</Text>
              <Text style={styles.developerDescription}>
                Passionate about making apps that solve real problems for real
                people.
              </Text>
            </View>
          </View>

          {/* Legal Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Legal</Text>

            <TouchableOpacity
              style={styles.contactItem}
              onPress={handlePrivacyPolicyPress}
            >
              <Ionicons
                name="document-text"
                size={24}
                color={theme.colors.primary}
              />
              <View style={styles.contactText}>
                <Text style={styles.contactLabel}>Terms & Privacy Policy</Text>
                <Text style={styles.contactValue}>View our privacy policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <View style={styles.legalInfo}>
              <Text style={styles.legalText}>
                © 2025 Jar Tracker by Veronika Bowersock. All rights reserved.
              </Text>
              <Text style={styles.legalText}>
                This app is designed to help track your preserved foods. Always
                follow safe canning practices and food safety guidelines.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 0,
    marginBottom: 0,
  },
  section: {
    marginBottom: 32,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 16,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 8,
  },
  appName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  version: {
    fontSize: 16,
    color: "#666",
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: "#555",
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureText: {
    fontSize: 16,
    color: "#555",
    flex: 1,
  },

  notesText: {
    fontSize: 16,
    color: "#666",
    lineHeight: 20,
    marginBottom: 12,
  },

  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  contactText: {
    flex: 1,
    marginLeft: 16,
  },
  contactLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 14,
    color: "#666",
  },
  developerInfo: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  developerName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  developerDescription: {
    fontSize: 16,
    color: "#555",
    lineHeight: 22,
  },
  legalInfo: {
    padding: 20,
  },
  legalText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 8,
  },
  attribution: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 40,
  },
  attributionText: {
    fontSize: 14,
    color: "#888",
    fontStyle: "italic",
  },
});
