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
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { FontAwesome6 } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import {
  getDb,
  markJarUsed,
  getAllCategories,
  getAllJarSizes,
  deleteJarWithBatchCheck,
  addJarToBatch,
  getBatchRecipe,
  updateBatchRecipe,
  addMultipleJarsToBatch,
  getJarsForBatch,
  type CustomCategory,
  type CustomJarSize,
  formatDateWithUserPreference,
  formatDateStringWithUserPreference,
  getAllRecipes,
  getRecipeById,
  createRecipe,
  updateRecipe,
  setBatchRecipeById,
  Recipe,
} from "../db";
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

const getCategoryIcon = (categoryId: string, categories: CustomCategory[]) => {
  const category = categories.find((c) => c.name === categoryId);
  return category?.icon ?? "📦";
};

const getCategoryName = (categoryId: string, categories: CustomCategory[]) => {
  const category = categories.find((c) => c.name === categoryId);
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
  const [categories, setCategories] = React.useState<CustomCategory[]>([]);
  const [jarSizes, setJarSizes] = React.useState<CustomJarSize[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showIndividualJars, setShowIndividualJars] = React.useState(false);
  const [isEditingRecipe, setIsEditingRecipe] = React.useState(false);
  const [isEditingNotes, setIsEditingNotes] = React.useState(false);
  const [recipeText, setRecipeText] = React.useState("");
  const [notesText, setNotesText] = React.useState("");
  const [isRecipeExpanded, setIsRecipeExpanded] = React.useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = React.useState(false);
  const [recipeImage, setRecipeImage] = React.useState<string | null>(null);
  const [recipeName, setRecipeName] = React.useState("");
  const [selectedRecipe, setSelectedRecipe] = React.useState<Recipe | null>(
    null
  );
  const [showRecipeSelector, setShowRecipeSelector] = React.useState(false);
  const [showRecipeEditor, setShowRecipeEditor] = React.useState(false);
  const [availableRecipes, setAvailableRecipes] = React.useState<Recipe[]>([]);
  const [isImageModalVisible, setIsImageModalVisible] = React.useState(false);
  const [showAddJarModal, setShowAddJarModal] = React.useState(false);
  const [newJarQuantity, setNewJarQuantity] = React.useState("1");
  const [isEditingDetails, setIsEditingDetails] = React.useState(false);
  const [jarSizeText, setJarSizeText] = React.useState("");
  const [locationText, setLocationText] = React.useState("");
  const [dateCannedText, setDateCannedText] = React.useState("");
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [fillDateObject, setFillDateObject] = React.useState(new Date());
  const [formattedFillDate, setFormattedFillDate] = React.useState("");
  const [showJarSizeModal, setShowJarSizeModal] = React.useState(false);
  const [showCategoryModal, setShowCategoryModal] = React.useState(false);
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

      // Load categories
      const categoriesData = await getAllCategories();
      setCategories(categoriesData);

      // Load jar sizes
      const jarSizesData = await getAllJarSizes();
      setJarSizes(jarSizesData);

      // Load available recipes
      const recipesData = await getAllRecipes();
      setAvailableRecipes(recipesData);

      // Load batch-specific recipe (not from item type)
      const batchRecipeData = await getBatchRecipe(batchId);
      setRecipeText(batchRecipeData?.recipe || "");
      setRecipeImage(batchRecipeData?.recipe_image || null);

      // Check if batch has a linked recipe from recipes table
      const linkedRecipe = await db.getFirstAsync<{ recipeId: number | null }>(
        "SELECT recipeId FROM jars WHERE batchId = ? LIMIT 1",
        [batchId]
      );

      if (linkedRecipe?.recipeId) {
        try {
          const recipeData = await getRecipeById(linkedRecipe.recipeId);
          if (recipeData) {
            setSelectedRecipe(recipeData);
            setRecipeName(recipeData.name);
            // If we have a linked recipe and no custom recipe text, use the linked recipe's content
            if (!batchRecipeData?.recipe && recipeData.content) {
              setRecipeText(recipeData.content);
            }
            if (!batchRecipeData?.recipe_image && recipeData.image) {
              setRecipeImage(recipeData.image);
            }
          }
        } catch (error) {
          console.error("Error loading linked recipe:", error);
        }
      }

      // Initialize notes from item type
      setNotesText(itemTypeData?.notes || "");

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

      // Initialize date object for picker
      const dateObj = new Date(dateForEdit);
      if (!isNaN(dateObj.getTime())) {
        setFillDateObject(dateObj);
        // Format the date for display using user preference
        const formatted = await formatDateWithUserPreference(dateObj);
        setFormattedFillDate(formatted);
      }
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
      if (selectedRecipe) {
        // Update existing recipe if we're editing one
        await updateRecipe(selectedRecipe.id, {
          name: recipeName,
          content: recipeText,
          image: recipeImage || undefined,
        });
        // Update the selected recipe state
        setSelectedRecipe({
          ...selectedRecipe,
          name: recipeName,
          content: recipeText,
          image: recipeImage,
        });
      } else {
        // Create new recipe if we don't have one
        if (recipeName.trim()) {
          const newRecipeId = await createRecipe({
            name: recipeName,
            content: recipeText,
            image: recipeImage || undefined,
          });
          const newRecipe = await getRecipeById(newRecipeId);
          if (newRecipe) {
            setSelectedRecipe(newRecipe);
            await setBatchRecipeById(batchId, newRecipeId);
          }
        }
      }

      // Always save to batch as well
      await updateBatchRecipe(batchId, recipeText, recipeImage);

      setIsEditingRecipe(false);
      setShowRecipeEditor(false);
    } catch (error) {
      console.error("Error saving recipe:", error);
      Alert.alert("Error", "Failed to save recipe");
    }
  };

  const selectExistingRecipe = async (recipe: Recipe) => {
    try {
      setSelectedRecipe(recipe);
      setRecipeName(recipe.name);
      setRecipeText(recipe.content);
      setRecipeImage(recipe.image || null);
      setShowRecipeSelector(false);

      // Immediately save the selected recipe
      await setBatchRecipeById(batchId, recipe.id);
      await updateBatchRecipe(batchId, recipe.content, recipe.image || null);
    } catch (error) {
      console.error("Error selecting recipe:", error);
      Alert.alert("Error", "Failed to select recipe");
    }
  };

  const clearSelectedRecipe = async () => {
    try {
      setSelectedRecipe(null);
      setRecipeText("");
      setRecipeImage(null);
      setRecipeName("");

      // Clear recipe from batch in database
      await setBatchRecipeById(batchId); // Pass undefined to clear
      await updateBatchRecipe(batchId, "", null); // Clear custom recipe text and image
    } catch (error) {
      console.error("Error clearing recipe:", error);
      Alert.alert("Error", "Failed to clear recipe");
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

  const saveCategory = async (newCategory: string) => {
    try {
      const db = await getDb();

      // Update the item type's category
      await db.runAsync("UPDATE item_types SET category = ? WHERE id = ?", [
        newCategory,
        itemTypeId,
      ]);

      // Reload the data to reflect changes
      await loadData();
      setShowCategoryModal(false);
    } catch (error) {
      console.error("Error saving category:", error);
      Alert.alert("Error", "Failed to save category");
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

  const handleRemoveJar = async (jarId: number, jarIndex: number) => {
    Alert.alert(
      "Remove Jar",
      `Are you sure you want to remove Jar #${jarIndex + 1} from this batch?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const result = await deleteJarWithBatchCheck(jarId);
              if (result.success) {
                if (result.batchDeleted) {
                  Alert.alert(
                    "Batch Deleted",
                    "The batch is now empty and has been removed.",
                    [{ text: "OK", onPress: () => navigation.goBack() }]
                  );
                } else {
                  await loadData();
                  Alert.alert("Success", "Jar removed from batch.");
                }
              }
            } catch (error) {
              console.error("Error removing jar:", error);
              Alert.alert("Error", `Failed to remove jar: ${error.message}`);
            }
          },
        },
      ]
    );
  };

  const handleAddJars = async () => {
    try {
      const quantity = parseInt(newJarQuantity);
      if (isNaN(quantity) || quantity < 1 || quantity > 50) {
        Alert.alert(
          "Invalid Quantity",
          "Please enter a number between 1 and 50"
        );
        return;
      }

      // Get current jar size and location from existing jars if available
      const currentJar = jars.length > 0 ? jars[0] : null;

      await addMultipleJarsToBatch(
        batchId,
        itemTypeId,
        fillDate,
        quantity,
        currentJar?.jarSize,
        currentJar?.location
      );

      setShowAddJarModal(false);
      setNewJarQuantity("1");
      await loadData();
      Alert.alert(
        "Success",
        `Added ${quantity} jar${quantity > 1 ? "s" : ""} to the batch.`
      );
    } catch (error) {
      console.error("Error adding jars:", error);
      Alert.alert("Error", `Failed to add jars: ${error.message}`);
    }
  };

  const handleGenerateLabels = () => {
    const jarIds = jars.map((jar) => jar.id);
    navigation.navigate("QRLabel", {
      jarId: jarIds[0],
      batchIds: jarIds,
    });
  };

  const handleDeleteBatch = () => {
    Alert.alert(
      "Delete Batch",
      `Are you sure you want to delete this entire batch of "${batchName}"? This will permanently delete all ${
        jars.length
      } jar${jars.length !== 1 ? "s" : ""} in this batch and cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const db = await getDb();
              if (!db) {
                throw new Error("Database connection failed");
              }

              // Delete all jars in this batch
              await db.runAsync("DELETE FROM jars WHERE batchId = ?", [
                batchId,
              ]);

              Alert.alert(
                "Batch Deleted",
                `The batch "${batchName}" has been deleted successfully.`,
                [
                  {
                    text: "OK",
                    onPress: () => navigation.goBack(),
                  },
                ]
              );
            } catch (error) {
              console.error("Error deleting batch:", error);
              Alert.alert("Error", `Failed to delete batch: ${error.message}`);
            }
          },
        },
      ]
    );
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
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <ScrollView
        style={styles.modalContent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: theme.spacing.xl,
          flexGrow: 1,
        }}
        nestedScrollEnabled={true}
      >
        {/* Batch Name and Category */}
        <View style={[styles.modalSection, styles.firstModalSection]}>
          <Text style={styles.modalBatchName}>{batchName}</Text>
          {itemType?.category && (
            <TouchableOpacity
              style={[
                styles.modalCategoryChip,
                {
                  backgroundColor: getCategoryColor(itemType.category),
                },
              ]}
              onPress={() => setShowCategoryModal(true)}
            >
              <View style={styles.categoryChipContent}>
                <Text style={styles.modalCategoryText}>
                  {getCategoryIcon(itemType.category, categories)}{" "}
                  {getCategoryName(itemType.category, categories)}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color="white"
                  style={{ marginLeft: 4 }}
                />
              </View>
            </TouchableOpacity>
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
              <TouchableOpacity
                style={[styles.detailInput, styles.selectInput]}
                onPress={() => setShowJarSizeModal(true)}
              >
                <View style={styles.selectContent}>
                  <Text
                    style={[
                      styles.dateButtonText,
                      !jarSizeText && { color: theme.colors.textLight },
                    ]}
                  >
                    {jarSizeText || "Select jar size..."}
                  </Text>
                  <Ionicons
                    name="chevron-down-outline"
                    size={16}
                    color={theme.colors.textSecondary}
                  />
                </View>
              </TouchableOpacity>
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
              <>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.dateButtonText}>
                    {formattedFillDate || "Select Date"}
                  </Text>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={fillDateObject}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    accentColor={theme.colors.primary}
                    onChange={async (event, selectedDate) => {
                      setShowDatePicker(Platform.OS === "ios");
                      if (selectedDate) {
                        setFillDateObject(selectedDate);
                        const formattedDate = selectedDate
                          .toISOString()
                          .split("T")[0];
                        setDateCannedText(formattedDate);
                        // Update the formatted display date
                        const formatted = await formatDateWithUserPreference(
                          selectedDate
                        );
                        setFormattedFillDate(formatted);
                      }
                    }}
                  />
                )}
              </>
            ) : (
              <Text style={styles.modalDetailValue}>
                {formattedFillDate || "No date set"}
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
          <Text style={styles.modalSectionTitle}>Recipe</Text>

          {selectedRecipe || recipeText.trim() ? (
            // Show selected recipe with edit option
            <View style={styles.selectedRecipeContainer}>
              <View style={styles.selectedRecipeInfo}>
                <Text style={styles.selectedRecipeName}>
                  {selectedRecipe ? selectedRecipe.name : "Custom Recipe"}
                </Text>
                {selectedRecipe && selectedRecipe.content && (
                  <Text style={styles.selectedRecipePreview} numberOfLines={2}>
                    {selectedRecipe.content}
                  </Text>
                )}
              </View>
              <View style={styles.recipeActions}>
                <TouchableOpacity
                  style={styles.editRecipeButton}
                  onPress={() => setShowRecipeEditor(true)}
                >
                  <Text style={styles.editRecipeText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeRecipeButton}
                  onPress={clearSelectedRecipe}
                >
                  <Ionicons name="close" size={16} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // Show add recipe buttons
            <View style={styles.addRecipeButtons}>
              <TouchableOpacity
                style={styles.addExistingRecipeButton}
                onPress={() => setShowRecipeSelector(true)}
              >
                <Ionicons
                  name="library-outline"
                  size={20}
                  color={theme.colors.primary}
                />
                <Text style={styles.addRecipeButtonText}>
                  Add Existing Recipe
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.addNewRecipeButton}
                onPress={() => {
                  // Set up for creating new recipe
                  setSelectedRecipe(null);
                  setRecipeName(`${itemType?.name || "Custom"} Recipe`);
                  setRecipeText("");
                  setRecipeImage(null);
                  setShowRecipeEditor(true);
                }}
              >
                <Ionicons
                  name="add-outline"
                  size={20}
                  color={theme.colors.primary}
                />
                <Text style={styles.addRecipeButtonText}>
                  Create New Recipe
                </Text>
              </TouchableOpacity>
            </View>
          )}

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
              {/* Delete button only shows when editing and not using selected recipe */}
              {isEditingRecipe && !selectedRecipe && (
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setRecipeImage(null)}
                >
                  <Ionicons name="close-circle" size={24} color="#d32f2f" />
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

          <TouchableOpacity
            style={[styles.modalActionButton, styles.modalDeleteButton]}
            onPress={handleDeleteBatch}
          >
            <Ionicons name="trash-outline" size={20} color="white" />
            <Text style={styles.modalActionButtonText}>
              Delete Entire Batch
            </Text>
          </TouchableOpacity>
        </View>

        {/* Individual Jar Management */}
        {showIndividualJars && (
          <View style={styles.modalSection}>
            <View style={styles.sectionHeaderWithButton}>
              <Text style={styles.modalSectionTitle}>Individual Jars</Text>
              <TouchableOpacity
                style={styles.addJarButton}
                onPress={() => setShowAddJarModal(true)}
              >
                <Ionicons name="add" size={16} color="white" />
                <Text style={styles.addJarButtonText}>Add Jars</Text>
              </TouchableOpacity>
            </View>

            {jars.length > 0 ? (
              <FlatList
                data={jars}
                keyExtractor={(item) => item.id.toString()}
                scrollEnabled={false}
                nestedScrollEnabled={true}
                renderItem={({ item, index }) => (
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

                      <TouchableOpacity
                        style={[styles.actionBtn, styles.removeBtn]}
                        onPress={() => handleRemoveJar(item.id, index)}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color="white"
                        />
                        <Text style={styles.actionBtnText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
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

      {/* Jar Size Selection Modal */}
      <Modal
        visible={showJarSizeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowJarSizeModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowJarSizeModal(false)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cancel jar size selection"
            >
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Jar Size</Text>
            <View style={{ width: 60 }} />
          </View>

          <FlatList
            data={jarSizes}
            keyExtractor={(item) => item.id?.toString() || item.name}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.itemTypeRow}
                onPress={() => {
                  setJarSizeText(item.name);
                  setShowJarSizeModal(false);
                }}
              >
                <Text style={styles.itemTypeName}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Add Jar Modal */}
      <Modal
        visible={showAddJarModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddJarModal(false)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Add Jars to Batch</Text>

            <Text style={styles.modalLabel}>Number of Jars:</Text>
            <TextInput
              style={styles.modalTextInput}
              value={newJarQuantity}
              onChangeText={setNewJarQuantity}
              placeholder="1"
              keyboardType="numeric"
              autoFocus
            />

            <Text style={styles.modalNote}>
              New jars will inherit the same size and location as existing jars
              in this batch.
            </Text>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowAddJarModal(false);
                  setNewJarQuantity("1");
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalAddButton]}
                onPress={handleAddJars}
              >
                <Text style={styles.modalAddButtonText}>Add Jars</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Category Selection Modal */}
      <Modal
        visible={showCategoryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowCategoryModal(false)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cancel category selection"
            >
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Category</Text>
            <View style={{ width: 60 }} />
          </View>

          <FlatList
            data={categories}
            keyExtractor={(item) => item.id?.toString() || item.name}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.itemTypeRow}
                onPress={() => saveCategory(item.name)}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={styles.categoryIcon}>{item.icon}</Text>
                  <Text style={[styles.itemTypeName, { marginLeft: 12 }]}>
                    {item.name}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Recipe Selector Modal */}
      <Modal
        visible={showRecipeSelector}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowRecipeSelector(false)}
              hitSlop={8}
            >
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Recipe</Text>
            <View style={{ width: 60 }} />
          </View>

          {availableRecipes.length === 0 ? (
            <View style={styles.emptyRecipeContainer}>
              <Ionicons
                name="restaurant-outline"
                size={64}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.emptyRecipeText}>No recipes available</Text>
              <Text style={styles.emptyRecipeSubtext}>
                Create some recipes first or add recipes to your batches
              </Text>
            </View>
          ) : (
            <FlatList
              data={availableRecipes}
              keyExtractor={(item) => item.id!.toString()}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.recipeSelectionCard}
                  onPress={() => selectExistingRecipe(item)}
                >
                  <View style={styles.recipeSelectionContent}>
                    <Text style={styles.recipeSelectionName}>{item.name}</Text>
                    <Text
                      style={styles.recipeSelectionPreview}
                      numberOfLines={2}
                    >
                      {item.content}
                    </Text>
                    {item.last_used_date && (
                      <Text style={styles.recipeSelectionDate}>
                        Last used:{" "}
                        {new Date(item.last_used_date).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                  {item.image && (
                    <Image
                      source={{ uri: item.image }}
                      style={styles.recipeSelectionImage}
                    />
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* Recipe Editor Modal */}
      <Modal
        visible={showRecipeEditor}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowRecipeEditor(false)}
              hitSlop={8}
            >
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {selectedRecipe ? "Edit Recipe" : "New Recipe"}
            </Text>
            <TouchableOpacity onPress={saveRecipe} hitSlop={8}>
              <Text style={styles.modalCreate}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.recipeEditor}>
            {/* Recipe Name */}
            <Text style={styles.modalSectionTitle}>Recipe Name</Text>
            <TextInput
              style={styles.editableInput}
              value={recipeName || `${itemType?.name || "Custom"} Recipe`}
              onChangeText={setRecipeName}
              placeholder="Enter recipe name"
            />

            {/* Recipe Content */}
            <Text style={styles.modalSectionTitle}>Recipe Instructions</Text>
            <TextInput
              style={[styles.editableInput, { minHeight: 150 }]}
              value={recipeText}
              onChangeText={setRecipeText}
              placeholder="Enter recipe instructions, ingredients, notes..."
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />

            {/* Recipe Image */}
            {recipeImage ? (
              <View style={styles.recipeImageContainer}>
                <Image
                  source={{ uri: recipeImage }}
                  style={styles.recipeImage}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setRecipeImage(null)}
                >
                  <Ionicons name="close-circle" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addImageButton}
                onPress={showImagePicker}
              >
                <Ionicons
                  name="camera-outline"
                  size={20}
                  color={theme.colors.primary}
                />
                <Text style={styles.addImageText}>Add Photo</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  removeBtn: {
    backgroundColor: "#ff6b6b",
  },
  sectionHeaderWithButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  addJarButton: {
    backgroundColor: theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addJarButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginVertical: theme.spacing.lg,
    color: theme.colors.text,
  },
  modalTextInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: "white",
  },
  modalNote: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
    lineHeight: 18,
  },
  modalButtonRow: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalCancelButton: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  modalCancelButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  modalAddButton: {
    backgroundColor: theme.colors.primary,
  },
  modalAddButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
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
  categoryChipContent: {
    flexDirection: "row",
    alignItems: "center",
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
  modalDeleteButton: {
    backgroundColor: "#d32f2f",
    borderWidth: 1,
    borderColor: "#b71c1c",
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
  dateButton: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    height: 40,
    marginLeft: theme.spacing.xs,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateButtonText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
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
  selectInput: {
    justifyContent: "center",
  },
  selectContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  modalCancel: {
    fontSize: theme.fontSize.md,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.medium,
  },
  itemTypeRow: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  itemTypeName: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  categoryIcon: {
    fontSize: 20,
  },
  selectedRecipeIndicator: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  selectedRecipeText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.medium,
  },
  recipeSelectionCard: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  recipeSelectionContent: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  recipeSelectionName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  recipeSelectionPreview: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: theme.spacing.xs,
  },
  recipeSelectionDate: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    fontStyle: "italic",
  },
  recipeSelectionImage: {
    width: 60,
    height: 60,
    borderRadius: theme.borderRadius.sm,
  },
  emptyRecipeContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.xl,
  },
  emptyRecipeText: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  emptyRecipeSubtext: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  // Recipe section styles
  selectedRecipeContainer: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  selectedRecipeInfo: {
    flex: 1,
  },
  selectedRecipeName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  selectedRecipePreview: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  recipeActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  editRecipeButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
  },
  editRecipeText: {
    color: theme.colors.surface,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  removeRecipeButton: {
    padding: theme.spacing.sm,
  },
  addRecipeButtons: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  addExistingRecipeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  addNewRecipeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderStyle: "dashed",
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  addRecipeButtonText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.medium,
    flex: 1,
  },
  recipeEditor: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  addImageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderStyle: "dashed",
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  addImageText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.medium,
  },
  modalCreate: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
});
