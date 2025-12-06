import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
  Image,
  Modal,
  Dimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { FontAwesome6 } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { getDb, markJarUsed, CATEGORIES } from "../db";
import { theme } from "../theme";
import { SafeAreaView } from "react-native-safe-area-context";

type Route = RouteProp<RootStackParamList, "BatchDetail">;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type JarWithDetails = {
  id: number;
  used: number;
  jarSize?: string;
  location?: string;
  fillDateISO: string;
};

const getCategoryIcon = (categoryId: string) => {
  const category = CATEGORIES.find((c) => c.id === categoryId);
  return category?.icon ?? "📦";
};

const getCategoryName = (categoryId: string) => {
  const category = CATEGORIES.find((c) => c.id === categoryId);
  return category?.name ?? "Other";
};

const getCategoryColor = (categoryId: string) => {
  return (
    theme.categoryColors[categoryId as keyof typeof theme.categoryColors] ??
    theme.categoryColors.other
  );
};

export default function BatchDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { batchName, itemTypeId, fillDate, batchId } = route.params;

  // Validate required parameters
  if (!batchName || !itemTypeId || !fillDate || !batchId) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyText}>Invalid batch parameters</Text>
        <TouchableOpacity
          style={{
            marginTop: 16,
            padding: 12,
            backgroundColor: theme.colors.primary,
            borderRadius: 8,
          }}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: "white", textAlign: "center" }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const [jars, setJars] = React.useState<JarWithDetails[]>([]);
  const [itemType, setItemType] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [showIndividualJars, setShowIndividualJars] = React.useState(false);
  const [isEditingRecipe, setIsEditingRecipe] = React.useState(false);
  const [isEditingNotes, setIsEditingNotes] = React.useState(false);
  const [recipeText, setRecipeText] = React.useState("");
  const [notesText, setNotesText] = React.useState("");
  const [isRecipeExpanded, setIsRecipeExpanded] = React.useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = React.useState(false);
  const [recipeImage, setRecipeImage] = React.useState<string | null>(null);
  const [isImageModalVisible, setIsImageModalVisible] = React.useState(false);
  const [isEditingDetails, setIsEditingDetails] = React.useState(false);
  const [jarSizeText, setJarSizeText] = React.useState("");
  const [locationText, setLocationText] = React.useState("");
  const [dateCannedText, setDateCannedText] = React.useState("");
  const [shouldThrowError, setShouldThrowError] = React.useState(false);

  // Simulate error for testing ErrorBoundary (dev only)
  if (__DEV__ && shouldThrowError) {
    throw new Error(
      "Test error for ErrorBoundary simulation - this should be caught!"
    );
  }

  const loadData = React.useCallback(async () => {
    try {
      console.log("Loading batch data with params:", {
        itemTypeId,
        fillDate,
        batchId,
      });
      const db = await getDb();

      if (!db) {
        throw new Error("Database connection failed");
      }

      // Get item type details
      console.log("Fetching item type for ID:", itemTypeId);
      const itemTypeData = await db.getFirstAsync<any>(
        "SELECT * FROM item_types WHERE id = ?",
        [itemTypeId]
      );
      // Log item type data without the large base64 image
      const { recipe_image, ...itemTypeDataForLog } = itemTypeData || {};
      console.log("Item type data:", {
        ...itemTypeDataForLog,
        recipe_image: recipe_image ? "base64 image data present" : null,
      });
      setItemType(itemTypeData);

      // Initialize editable text fields
      setRecipeText(itemTypeData?.recipe || "");
      setNotesText(itemTypeData?.notes || "");
      setRecipeImage(itemTypeData?.recipe_image || null);

      // Get jars for this specific batch using batchId
      console.log("Fetching jars for batch ID:", batchId);
      const batchJars = await db.getAllAsync<JarWithDetails>(
        `SELECT * FROM jars 
         WHERE batchId = ?
         ORDER BY id ASC`,
        [batchId]
      );
      console.log("Found jars:", batchJars.length);

      setJars(batchJars);

      // Initialize editable detail fields
      setJarSizeText(batchJars[0]?.jarSize || "");
      setLocationText(batchJars[0]?.location || "");
      // Format date for editing (YYYY-MM-DD format)
      const dateForEdit = batchJars[0]?.fillDateISO
        ? batchJars[0].fillDateISO.split("T")[0]
        : fillDate.split("T")[0];
      setDateCannedText(dateForEdit);
    } catch (error) {
      console.error("Error loading batch data:", error);
      Alert.alert("Error", `Failed to load batch data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [itemTypeId, fillDate, batchId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const saveRecipe = async () => {
    try {
      const db = await getDb();
      await db.runAsync(
        "UPDATE item_types SET recipe = ?, recipe_image = ? WHERE id = ?",
        [recipeText, recipeImage, itemTypeId]
      );
      setItemType((prev) => ({
        ...prev,
        recipe: recipeText,
        recipe_image: recipeImage,
      }));
      setIsEditingRecipe(false);
    } catch (error) {
      console.error("Error saving recipe:", error);
      Alert.alert("Error", "Failed to save recipe");
    }
  };

  const pickImage = async () => {
    try {
      // Request permission
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert(
          "Permission Required",
          "Please allow access to your photo library to add recipe images."
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        // Convert to base64 for cross-device compatibility
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: "base64",
        });
        const base64Image = `data:image/jpeg;base64,${base64}`;
        setRecipeImage(base64Image);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const takePhoto = async () => {
    try {
      // Request permission
      const permissionResult =
        await ImagePicker.requestCameraPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert(
          "Permission Required",
          "Please allow access to your camera to take recipe photos."
        );
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        // Convert to base64 for cross-device compatibility
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: "base64",
        });
        const base64Image = `data:image/jpeg;base64,${base64}`;
        setRecipeImage(base64Image);
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo");
    }
  };

  const showImagePicker = () => {
    Alert.alert("Add Recipe Image", "Choose how you'd like to add an image", [
      { text: "Cancel", style: "cancel" },
      { text: "Camera", onPress: takePhoto },
      { text: "Photo Library", onPress: pickImage },
    ]);
  };

  const saveNotes = async () => {
    try {
      const db = await getDb();
      await db.runAsync("UPDATE item_types SET notes = ? WHERE id = ?", [
        notesText,
        itemTypeId,
      ]);
      setItemType((prev) => ({ ...prev, notes: notesText }));
      setIsEditingNotes(false);
    } catch (error) {
      console.error("Error saving notes:", error);
      Alert.alert("Error", "Failed to save notes");
    }
  };

  const saveDetails = async () => {
    try {
      const db = await getDb();

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateCannedText && !dateRegex.test(dateCannedText)) {
        Alert.alert("Invalid Date", "Please enter date in YYYY-MM-DD format");
        return;
      }

      // Update all jars in this batch with new details
      await db.runAsync(
        "UPDATE jars SET jarSize = ?, location = ?, fillDateISO = ? WHERE batchId = ?",
        [jarSizeText, locationText, dateCannedText, batchId]
      );

      // Reload the data to reflect changes
      await loadData();
      setIsEditingDetails(false);
    } catch (error) {
      console.error("Error saving details:", error);
      Alert.alert("Error", "Failed to save details");
    }
  };

  const isTextLong = (text: string) => {
    return text.length > 200 || text.split("\n").length > 4;
  };

  const getTruncatedText = (text: string) => {
    const lines = text.split("\n");
    if (lines.length > 4) {
      return lines.slice(0, 4).join("\n") + "...";
    }
    if (text.length > 200) {
      return text.substring(0, 200) + "...";
    }
    return text;
  };

  const handleMarkUsed = async (jarId: number) => {
    Alert.alert(
      "Mark Jar as Used",
      "Are you sure you want to mark this jar as used?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Used",
          style: "destructive",
          onPress: async () => {
            try {
              const result = await markJarUsed(jarId);
              if (result.success) {
                await loadData();
                Alert.alert("Success", result.message);
              } else {
                Alert.alert("Error", result.message);
              }
            } catch (error) {
              console.error("Error marking jar as used:", error);
              Alert.alert(
                "Error",
                `Failed to mark jar as used: ${error.message}`
              );
            }
          },
        },
      ]
    );
  };

  const handleGenerateLabels = () => {
    const jarIds = jars.map((jar) => jar.id);
    navigation.navigate("QRLabel", {
      jarId: jarIds[0],
      batchIds: jarIds,
    });
  };

  const availableJars = jars.filter((jar) => !jar.used);
  const usedJars = jars.filter((jar) => jar.used);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView
        style={styles.modalContent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
      >
        {/* Batch Name and Category */}
        <View style={[styles.modalSection, styles.firstModalSection]}>
          <Text style={styles.modalBatchName}>{batchName}</Text>
          {itemType?.category && (
            <View
              style={[
                styles.modalCategoryChip,
                {
                  backgroundColor: getCategoryColor(itemType.category),
                },
              ]}
            >
              <Text style={styles.modalCategoryText}>
                {getCategoryIcon(itemType.category)}{" "}
                {getCategoryName(itemType.category)}
              </Text>
            </View>
          )}
        </View>

        {/* Key Details */}
        <View style={styles.modalSection}>
          <View style={styles.editableHeader}>
            <Text style={styles.modalSectionTitle}>Details</Text>
            <TouchableOpacity
              onPress={() => {
                if (isEditingDetails) {
                  saveDetails();
                } else {
                  setIsEditingDetails(true);
                }
              }}
            >
              <Ionicons
                name={isEditingDetails ? "checkmark-outline" : "create-outline"}
                size={20}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
          </View>

          {/* Jar Size */}
          <View style={styles.modalDetailRow}>
            <View style={styles.detailIconContainer}>
              <FontAwesome6 name="jar" size={20} color="#666" />
            </View>
            <Text style={styles.modalDetailLabel}>Jar Size:</Text>
            {isEditingDetails ? (
              <TextInput
                style={styles.detailInput}
                value={jarSizeText}
                onChangeText={setJarSizeText}
                placeholder="e.g., 16 oz, Quart"
              />
            ) : (
              <Text style={styles.modalDetailValue}>
                {jarSizeText || "Not specified"}
              </Text>
            )}
          </View>

          {/* Date Canned */}
          <View style={styles.modalDetailRow}>
            <View style={styles.detailIconContainer}>
              <Ionicons name="calendar-outline" size={20} color="#666" />
            </View>
            <Text style={styles.modalDetailLabel}>Date Canned:</Text>
            {isEditingDetails ? (
              <TextInput
                style={styles.detailInput}
                value={dateCannedText}
                onChangeText={setDateCannedText}
                placeholder="YYYY-MM-DD"
              />
            ) : (
              <Text style={styles.modalDetailValue}>
                {new Date(
                  jars[0]?.fillDateISO || fillDate
                ).toLocaleDateString()}
              </Text>
            )}
          </View>

          {/* Location */}
          <View style={styles.modalDetailRow}>
            <View style={styles.detailIconContainer}>
              <Ionicons name="location-outline" size={20} color="#666" />
            </View>
            <Text style={styles.modalDetailLabel}>Location:</Text>
            {isEditingDetails ? (
              <TextInput
                style={styles.detailInput}
                value={locationText}
                onChangeText={setLocationText}
                placeholder="e.g., Pantry, Basement"
              />
            ) : (
              <Text style={styles.modalDetailValue}>
                {locationText || "Not specified"}
              </Text>
            )}
          </View>
        </View>

        {/* Jar Statistics */}
        <View style={styles.modalSection}>
          <Text style={styles.modalSectionTitle}>Jar Inventory</Text>

          <View style={styles.modalStatsGrid}>
            <View style={styles.modalStatCard}>
              <Text style={styles.modalStatNumber}>{jars.length}</Text>
              <Text style={styles.modalStatLabel}>Total</Text>
            </View>
            <View style={styles.modalStatCard}>
              <Text style={[styles.modalStatNumber, { color: "#2e7d32" }]}>
                {availableJars.length}
              </Text>
              <Text style={styles.modalStatLabel}>Available</Text>
            </View>
            <View style={styles.modalStatCard}>
              <Text style={[styles.modalStatNumber, { color: "#d32f2f" }]}>
                {usedJars.length}
              </Text>
              <Text style={styles.modalStatLabel}>Used</Text>
            </View>
          </View>
        </View>

        {/* Recipe */}
        <View style={styles.modalSection}>
          <View style={styles.editableHeader}>
            <Text style={styles.modalSectionTitle}>Recipe</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={showImagePicker}
                style={styles.imageButton}
              >
                <Ionicons
                  name="camera-outline"
                  size={20}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (isEditingRecipe) {
                    saveRecipe();
                  } else {
                    setIsEditingRecipe(true);
                  }
                }}
              >
                <Ionicons
                  name={
                    isEditingRecipe ? "checkmark-outline" : "create-outline"
                  }
                  size={20}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Recipe Image */}
          {recipeImage && (
            <View style={styles.recipeImageContainer}>
              <TouchableOpacity
                onPress={() => setIsImageModalVisible(true)}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: recipeImage }}
                  style={styles.recipeImage}
                />
                {/* Zoom indicator */}
                <View style={styles.zoomIndicator}>
                  <Ionicons name="expand-outline" size={20} color="white" />
                </View>
              </TouchableOpacity>
              {/* Delete button only shows when editing */}
              {isEditingRecipe && (
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setRecipeImage(null)}
                >
                  <Ionicons name="close-circle" size={24} color="#d32f2f" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {isEditingRecipe ? (
            <TextInput
              style={styles.editableInput}
              value={recipeText}
              onChangeText={setRecipeText}
              placeholder="Add recipe instructions..."
              multiline
              textAlignVertical="top"
            />
          ) : (
            <View>
              <TouchableOpacity
                style={styles.modalNotesBox}
                onPress={() => setIsEditingRecipe(true)}
              >
                <Text style={styles.modalNotesText}>
                  {recipeText
                    ? isRecipeExpanded || !isTextLong(recipeText)
                      ? recipeText
                      : getTruncatedText(recipeText)
                    : "Tap to add recipe instructions..."}
                </Text>
              </TouchableOpacity>
              {recipeText && isTextLong(recipeText) && (
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() => setIsRecipeExpanded(!isRecipeExpanded)}
                >
                  <Text style={styles.expandButtonText}>
                    {isRecipeExpanded ? "Show Less" : "Show More"}
                  </Text>
                  <Ionicons
                    name={
                      isRecipeExpanded
                        ? "chevron-up-outline"
                        : "chevron-down-outline"
                    }
                    size={16}
                    color={theme.colors.primary}
                  />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Notes */}
        <View style={styles.modalSection}>
          <View style={styles.editableHeader}>
            <Text style={styles.modalSectionTitle}>Notes</Text>
            <TouchableOpacity
              onPress={() => {
                if (isEditingNotes) {
                  saveNotes();
                } else {
                  setIsEditingNotes(true);
                }
              }}
            >
              <Ionicons
                name={isEditingNotes ? "checkmark-outline" : "create-outline"}
                size={20}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
          </View>
          {isEditingNotes ? (
            <TextInput
              style={styles.editableInput}
              value={notesText}
              onChangeText={setNotesText}
              placeholder="Add notes..."
              multiline
              textAlignVertical="top"
            />
          ) : (
            <View>
              <TouchableOpacity
                style={styles.modalNotesBox}
                onPress={() => setIsEditingNotes(true)}
              >
                <Text style={styles.modalNotesText}>
                  {notesText
                    ? isNotesExpanded || !isTextLong(notesText)
                      ? notesText
                      : getTruncatedText(notesText)
                    : "Tap to add notes..."}
                </Text>
              </TouchableOpacity>
              {notesText && isTextLong(notesText) && (
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() => setIsNotesExpanded(!isNotesExpanded)}
                >
                  <Text style={styles.expandButtonText}>
                    {isNotesExpanded ? "Show Less" : "Show More"}
                  </Text>
                  <Ionicons
                    name={
                      isNotesExpanded
                        ? "chevron-up-outline"
                        : "chevron-down-outline"
                    }
                    size={16}
                    color={theme.colors.primary}
                  />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.modalSection}>
          <Text style={styles.modalSectionTitle}>Actions</Text>

          <TouchableOpacity
            style={styles.modalActionButton}
            onPress={handleGenerateLabels}
          >
            <Ionicons name="qr-code-outline" size={20} color="white" />
            <Text style={styles.modalActionButtonText}>Generate QR Labels</Text>
          </TouchableOpacity>
          {/* 
          {__DEV__ && (
            <TouchableOpacity
              style={[styles.modalActionButton, { backgroundColor: "#d32f2f" }]}
              onPress={() => {
                setShouldThrowError(true);
              }}
            >
              <Ionicons name="bug-outline" size={20} color="white" />
              <Text style={styles.modalActionButtonText}>
                Simulate Error (Dev Only)
              </Text>
            </TouchableOpacity>
          )} */}

          <TouchableOpacity
            style={[styles.modalActionButton, styles.modalSecondaryButton]}
            onPress={() => setShowIndividualJars(!showIndividualJars)}
          >
            <Ionicons
              name={showIndividualJars ? "chevron-up-outline" : "list-outline"}
              size={20}
              color={theme.colors.primary}
            />
            <Text
              style={[
                styles.modalActionButtonText,
                { color: theme.colors.primary },
              ]}
            >
              {showIndividualJars
                ? "Hide Individual Jars"
                : "Manage Individual Jars"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Individual Jar Management */}
        {showIndividualJars && (
          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>Individual Jars</Text>

            {jars.length > 0 ? (
              jars.map((item, index) => (
                <View key={item.id} style={styles.jarCard}>
                  <View style={styles.jarHeader}>
                    <Text style={styles.jarNumber}>Jar #{index + 1}</Text>
                    <View style={styles.jarStatus}>
                      <Text
                        style={[
                          styles.statusText,
                          { color: item.used ? "#d32f2f" : "#2e7d32" },
                        ]}
                      >
                        {item.used ? "USED" : "AVAILABLE"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.jarActions}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() =>
                        navigation.navigate("QRLabel", { jarId: item.id })
                      }
                    >
                      <Ionicons
                        name="qr-code-outline"
                        size={16}
                        color="white"
                      />
                      <Text style={styles.actionBtnText}>Label</Text>
                    </TouchableOpacity>

                    {!item.used && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.markUsedBtn]}
                        onPress={() => handleMarkUsed(item.id)}
                      >
                        <Ionicons
                          name="checkmark-outline"
                          size={16}
                          color="white"
                        />
                        <Text style={styles.actionBtnText}>Mark Used</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No jars in this batch</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Fullscreen Image Modal */}
      {recipeImage && (
        <Modal
          visible={isImageModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsImageModalVisible(false)}
        >
          <View style={styles.fullscreenModalContainer}>
            <TouchableOpacity
              style={styles.fullscreenModalBackground}
              activeOpacity={1}
              onPress={() => setIsImageModalVisible(false)}
            >
              <Image
                source={{ uri: recipeImage }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.fullscreenCloseButton}
              onPress={() => setIsImageModalVisible(false)}
            >
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },

  actionButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.primaryDark,
  },
  actionButtonText: {
    color: theme.colors.surface,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.md,
  },
  jarCard: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 8,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  jarCardUsed: {
    opacity: 0.7,
    backgroundColor: "#f9f9f9",
  },
  jarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  jarNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  jarStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  jarDetails: {
    marginBottom: 12,
    gap: 6,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: "#666",
  },
  jarActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    backgroundColor: "#007AFF",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    justifyContent: "center",
  },
  markUsedBtn: {
    backgroundColor: "#d32f2f",
  },
  actionBtnText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    marginTop: 32,
    fontSize: 16,
  },

  notesText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  // Modal-style layout
  modalContent: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
  },
  modalSection: {
    marginVertical: theme.spacing.lg,
  },
  firstModalSection: {
    marginTop: theme.spacing.md,
  },
  modalBatchName: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  modalCategoryChip: {
    alignSelf: "flex-start",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.xl,
  },
  modalCategoryText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  modalSectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  modalDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
    minHeight: 44, // Consistent height for both text and input rows
  },
  detailIconContainer: {
    width: 32, // Fixed width for consistent alignment
    alignItems: "center",
    justifyContent: "center",
  },
  modalDetailLabel: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    width: 130, // Reduced width to bring data closer
    marginLeft: theme.spacing.sm, // Space after icon
  },
  modalDetailValue: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
    flex: 1,
    marginLeft: theme.spacing.xs, // Small gap between label and value
  },
  modalStatsGrid: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  modalStatCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalStatNumber: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  modalStatLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  modalNotesBox: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalNotesText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    lineHeight: 22,
  },
  modalActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  modalSecondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  modalActionButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.surface,
  },
  editableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  imageButton: {
    padding: theme.spacing.xs,
  },
  editableInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    minHeight: 100,
    textAlignVertical: "top",
  },
  detailInput: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    height: 40, // Fixed height to match the text values
    marginLeft: theme.spacing.xs, // Match the value margin for alignment
  },
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  expandButtonText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.medium,
  },
  recipeImageContainer: {
    position: "relative",
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden",
  },
  recipeImage: {
    width: "100%",
    height: 200,
    backgroundColor: theme.colors.surface,
  },
  removeImageButton: {
    position: "absolute",
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 12,
  },
  zoomIndicator: {
    position: "absolute",
    bottom: theme.spacing.sm,
    left: theme.spacing.sm,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 16,
    padding: 6,
  },
  fullscreenModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenModalBackground: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenImage: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  },
  fullscreenCloseButton: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
    padding: 10,
    zIndex: 1,
  },
});
