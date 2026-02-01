import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Image,
  Modal,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../theme";
import Constants from "expo-constants";
import * as Application from "expo-application";
import {
  getDateFormat,
  setDateFormat,
  DATE_FORMATS,
  formatDateWithUserPreference,
  DateFormat,
} from "../db";

export default function SettingsScreen({ navigation }: any) {
  const [activeSection, setActiveSection] = useState<"settings" | "about">(
    "settings"
  );
  const [currentDateFormat, setCurrentDateFormat] =
    useState<DateFormat>("MM/DD/YYYY");
  const [showDateFormatModal, setShowDateFormatModal] = useState(false);

  // Load current date format when component mounts
  useEffect(() => {
    loadDateFormat();
  }, []);

  const loadDateFormat = async () => {
    try {
      const format = await getDateFormat();
      setCurrentDateFormat(format);
    } catch (error) {
      console.error("Error loading date format:", error);
    }
  };

  const handleDateFormatChange = async (format: DateFormat) => {
    try {
      await setDateFormat(format);
      setCurrentDateFormat(format);
      setShowDateFormatModal(false);
    } catch (error) {
      console.error("Error saving date format:", error);
      Alert.alert("Error", "Failed to save date format setting");
    }
  };

  const handleEmailPress = () => {
    Linking.openURL("mailto:vbdesignapps@gmail.com");
  };

  const handleWebsitePress = () => {
    Linking.openURL("https://jartracker.vbdesigns.dev");
  };

  const handlePrivacyPolicyPress = () => {
    Linking.openURL("https://jartracker.vbdesigns.dev/privacy");
  };

  const renderSettingsContent = () => (
    <View>
      {/* Customization Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Customization</Text>

        <TouchableOpacity
          style={styles.settingsItem}
          onPress={() => setShowDateFormatModal(true)}
        >
          <Ionicons name="calendar" size={24} color={theme.colors.primary} />
          <View style={styles.settingsText}>
            <Text style={styles.settingsLabel}>Date Format</Text>
            <Text style={styles.settingsValue}>
              {currentDateFormat === "MM/DD/YYYY"
                ? "03/15/2024 (US)"
                : currentDateFormat === "DD/MM/YYYY"
                ? "15/03/2024 (International)"
                : "Mar 15, 2024 (Text)"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingsItem}
          onPress={() => navigation.navigate("CategoryManagement")}
        >
          <Ionicons name="folder" size={24} color={theme.colors.primary} />
          <View style={styles.settingsText}>
            <Text style={styles.settingsLabel}>Manage Categories</Text>
            <Text style={styles.settingsValue}>
              Add, edit, or remove custom categories
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingsItem}
          onPress={() => navigation.navigate("JarSizeManagement")}
        >
          <Ionicons name="resize" size={24} color={theme.colors.primary} />
          <View style={styles.settingsText}>
            <Text style={styles.settingsLabel}>Manage Jar Sizes</Text>
            <Text style={styles.settingsValue}>
              Add, edit, or remove custom jar sizes
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      </View>

      {/* Data Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data</Text>

        <TouchableOpacity
          style={styles.settingsItem}
          onPress={() => navigation.navigate("RecipeManagement")}
        >
          <Ionicons name="restaurant" size={24} color={theme.colors.primary} />
          <View style={styles.settingsText}>
            <Text style={styles.settingsLabel}>Recipe Collection</Text>
            <Text style={styles.settingsValue}>Manage your saved recipes</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingsItem}
          onPress={() => navigation.navigate("BackupRestore")}
        >
          <Ionicons
            name="cloud-download"
            size={24}
            color={theme.colors.primary}
          />
          <View style={styles.settingsText}>
            <Text style={styles.settingsLabel}>Backup & Restore</Text>
            <Text style={styles.settingsValue}>Export or import your data</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Get version reliably across all platforms
  const getAppVersion = () => {
    // expo-application is most reliable in production
    if (Application.nativeApplicationVersion) {
      return Application.nativeApplicationVersion;
    }
    // fallback for dev/Expo Go
    return (
      Constants.expoConfig?.version ||
      Constants.manifest?.version ||
      "1.1.3"
    );
  };

  const renderAboutContent = () => (
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
          <Text style={styles.version}>Version {getAppVersion()}</Text>
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
          Supply 1.5" x 1.5" square labels. These can be purchased from various
          online retailers such as Amazon.
        </Text>
        <Text style={styles.notesText}>
          Please note that different printing services can change the scale and
          margins of the labels, so it's recommended to print a test sheet first
          to ensure proper sizing.
        </Text>
        <Text style={styles.notesText}>
          Alternatively, you can print the labels at home using sticker paper
          compatible with your printer or just use regular paper and tape them
          onto your jars or lids.
        </Text>
      </View>

      {/* Contact Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact & Support</Text>

        <TouchableOpacity style={styles.contactItem} onPress={handleEmailPress}>
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
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeSection === "settings" && styles.activeTab]}
          onPress={() => setActiveSection("settings")}
        >
          <Ionicons
            name="settings"
            size={20}
            color={
              activeSection === "settings"
                ? theme.colors.primary
                : theme.colors.textSecondary
            }
          />
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeSection === "settings"
                    ? theme.colors.primary
                    : theme.colors.textSecondary,
              },
            ]}
          >
            Settings
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeSection === "about" && styles.activeTab]}
          onPress={() => setActiveSection("about")}
        >
          <Ionicons
            name="information-circle"
            size={20}
            color={
              activeSection === "about"
                ? theme.colors.primary
                : theme.colors.textSecondary
            }
          />
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeSection === "about"
                    ? theme.colors.primary
                    : theme.colors.textSecondary,
              },
            ]}
          >
            About
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {activeSection === "settings"
            ? renderSettingsContent()
            : renderAboutContent()}
        </View>
      </ScrollView>

      {/* Date Format Selection Modal */}
      <Modal
        visible={showDateFormatModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDateFormatModal(false)}
      >
        <View style={styles.modalContainer}>
          <SafeAreaView style={styles.modalContent} edges={["top", "bottom"]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setShowDateFormatModal(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Date Format</Text>
              <View style={styles.spacer} />
            </View>

            <ScrollView style={styles.optionsList}>
              {DATE_FORMATS.map((formatOption) => {
                const isSelected = currentDateFormat === formatOption.value;
                const exampleDate = new Date();
                exampleDate.setFullYear(2024, 2, 15); // March 15, 2024 for consistent example

                let formattedExample = "";
                try {
                  // Use the specific format instead of user preference for examples
                  if (formatOption.value === "MM/DD/YYYY") {
                    formattedExample = "03/15/2024";
                  } else if (formatOption.value === "DD/MM/YYYY") {
                    formattedExample = "15/03/2024";
                  } else if (formatOption.value === "MMM DD, YYYY") {
                    formattedExample = "Mar 15, 2024";
                  }
                } catch (error) {
                  formattedExample = formatOption.label;
                }

                return (
                  <TouchableOpacity
                    key={formatOption.value}
                    style={[
                      styles.optionItem,
                      isSelected && styles.selectedOption,
                    ]}
                    onPress={() => handleDateFormatChange(formatOption.value)}
                  >
                    <View style={styles.optionContent}>
                      <Text
                        style={[
                          styles.optionTitle,
                          isSelected && styles.selectedOptionText,
                        ]}
                      >
                        {formatOption.label}
                      </Text>
                      <Text
                        style={[
                          styles.optionExample,
                          isSelected && styles.selectedOptionExample,
                        ]}
                      >
                        Example: {formattedExample}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={24}
                        color={theme.colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  tabContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: "500",
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  settingsItem: {
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
  settingsText: {
    flex: 1,
    marginLeft: 16,
  },
  settingsLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  settingsValue: {
    fontSize: 14,
    color: "#666",
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
    marginBottom: 12,
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
    textAlign: "center",
  },
  notesText: {
    fontSize: 16,
    color: "#666",
    lineHeight: 20,
    marginBottom: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  cancelButton: {
    padding: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    color: theme.colors.primary,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  spacer: {
    width: 40, // Balance the cancel button width
  },
  optionsList: {
    flex: 1,
    padding: 16,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedOption: {
    backgroundColor: theme.colors.primary || "#e3f2fd",
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 4,
  },
  selectedOptionText: {
    color: theme.colors.background,
  },
  optionExample: {
    fontSize: 14,
    color: theme.colors.text,
  },
  selectedOptionExample: {
    color: theme.colors.background,
  },
});
