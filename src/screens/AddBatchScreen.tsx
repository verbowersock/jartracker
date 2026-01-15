import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  Platform,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import {
  getDb,
  upsertItemType,
  createMultipleJars,
  ItemType,
  getAllCategories,
  getAllJarSizes,
  type CustomCategory,
  type CustomJarSize,
  formatDateWithUserPreference,
  getAllRecipes,
  getRecipeById,
  Recipe,
  createRecipe,
  updateRecipe,
  setBatchRecipeById,
} from "../db";
import { theme } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function AddBatchScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [selectedItemType, setSelectedItemType] =
    React.useState<ItemType | null>(null);
  const [newItemTypeName, setNewItemTypeName] = React.useState("");
  const [recipe, setRecipe] = React.useState("");
  const [recipeName, setRecipeName] = React.useState("");
  const [recipeImage, setRecipeImage] = React.useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = React.useState<Recipe | null>(
    null
  );
  const [showRecipeSelector, setShowRecipeSelector] = React.useState(false);
  const [showRecipeEditor, setShowRecipeEditor] = React.useState(false);
  const [availableRecipes, setAvailableRecipes] = React.useState<Recipe[]>([]);
  const [notes, setNotes] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");
  const [fillDate, setFillDate] = React.useState(new Date());
  const [formattedFillDate, setFormattedFillDate] = React.useState("");
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [category, setCategory] = React.useState("");
  const [jarSize, setJarSize] = React.useState("");
  const [location, setLocation] = React.useState("");

  // Modal state for selecting existing item types
  const [showItemTypeModal, setShowItemTypeModal] = React.useState(false);
  const [showCategoryModal, setShowCategoryModal] = React.useState(false);
  const [showJarSizeModal, setShowJarSizeModal] = React.useState(false);
  const [existingItemTypes, setExistingItemTypes] = React.useState<ItemType[]>(
    []
  );
  const [categories, setCategories] = React.useState<CustomCategory[]>([]);
  const [jarSizes, setJarSizes] = React.useState<CustomJarSize[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Load existing item types
  React.useEffect(() => {
    loadExistingItemTypes();
  }, []);

  // Format the fill date when it changes
  React.useEffect(() => {
    const formatDate = async () => {
      const formatted = await formatDateWithUserPreference(fillDate);
      setFormattedFillDate(formatted);
    };
    formatDate();
  }, [fillDate]);

  const loadExistingItemTypes = async () => {
    const db = await getDb();
    const [itemTypes, categoriesData, jarSizesData, recipesData] =
      await Promise.all([
        db.getAllAsync<ItemType>(
          "SELECT * FROM item_types ORDER BY name COLLATE NOCASE"
        ),
        getAllCategories(),
        getAllJarSizes(),
        getAllRecipes(),
      ]);
    setExistingItemTypes(itemTypes);
    setCategories(categoriesData);
    setJarSizes(jarSizesData);
    setAvailableRecipes(recipesData);
  };

  const filteredItemTypes = existingItemTypes.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onSelectExistingItemType = (itemType: ItemType) => {
    setSelectedItemType(itemType);
    setNewItemTypeName("");
    // Keep recipe fields empty for new batch - recipes are now batch-specific
    setRecipe("");
    setRecipeImage(null);
    setNotes(itemType.notes || "");
    setCategory(itemType.category || "");
    setShowItemTypeModal(false);
    setSearchQuery("");
  };

  const onCreateNewItemType = () => {
    setSelectedItemType(null);
    setRecipe("");
    setRecipeImage(null);
    setNotes("");
    setCategory("");
    setShowItemTypeModal(false);
    setSearchQuery("");
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

  const selectExistingRecipe = async (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setRecipeName(recipe.name);
    setRecipe(recipe.content);
    setRecipeImage(recipe.image || null);
    setShowRecipeSelector(false);
  };

  const clearSelectedRecipe = () => {
    setSelectedRecipe(null);
    setRecipe("");
    setRecipeImage(null);
  };

  const saveRecipe = async () => {
    try {
      if (selectedRecipe) {
        // Update existing recipe if we're editing one
        await updateRecipe(selectedRecipe.id, {
          name: recipeName,
          content: recipe,
          image: recipeImage || undefined,
        });
        // Update the selected recipe state
        setSelectedRecipe({
          ...selectedRecipe,
          name: recipeName,
          content: recipe,
          image: recipeImage,
        });
      } else {
        // Create new recipe if we don't have one
        if (recipeName.trim()) {
          const newRecipeId = await createRecipe({
            name: recipeName,
            content: recipe,
            image: recipeImage || undefined,
          });
          const newRecipe = await getRecipeById(newRecipeId);
          if (newRecipe) {
            setSelectedRecipe(newRecipe);
          }
        }
      }

      setShowRecipeEditor(false);
    } catch (error) {
      console.error("Error saving recipe:", error);
      Alert.alert("Error", "Failed to save recipe");
    }
  };

  const validateAndSave = async () => {
    // Validate quantity
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1 || qty > 100) {
      Alert.alert(
        "Invalid Quantity",
        "Please enter a number between 1 and 100"
      );
      return;
    }

    // Validate date
    if (!fillDate || isNaN(fillDate.getTime())) {
      Alert.alert("Date Required", "Please select a valid fill date");
      return;
    }

    // Check if date is not in the future
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Set to end of today
    if (fillDate > today) {
      Alert.alert("Future Date", "Fill date cannot be in the future");
      return;
    }

    // Check if date is not too far in the past (optional - adjust as needed)
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
    if (fillDate < tenYearsAgo) {
      Alert.alert("Date Too Old", "Fill date cannot be more than 10 years ago");
      return;
    }

    // Validate required fields
    if (!category) {
      Alert.alert("Category Required", "Please select a category");
      return;
    }

    if (!jarSize) {
      Alert.alert("Jar Size Required", "Please select a jar size");
      return;
    }

    let itemTypeId: number;

    if (selectedItemType) {
      // Using existing item type, update it with new category/notes if changed
      // Note: recipes are now batch-specific, not item-type specific
      if (
        notes !== (selectedItemType.notes || "") ||
        category !== (selectedItemType.category || "")
      ) {
        await upsertItemType({
          id: selectedItemType.id,
          name: selectedItemType.name,
          category: category,
          notes: notes.trim() || undefined,
        });
      }
      itemTypeId = selectedItemType.id!;
    } else {
      // Creating new item type
      if (!newItemTypeName.trim()) {
        Alert.alert("Name Required", "Please enter a name for this item type");
        return;
      }

      // If creating new item type, don't include recipe in the item type
      // since recipes should be batch-specific
      itemTypeId = await upsertItemType({
        name: newItemTypeName.trim(),
        category: category,
        notes: notes.trim() || undefined,
      });
    }

    // Create multiple jars
    const isoDate = fillDate.toISOString();

    const { jarIds, batchId } = await createMultipleJars(
      itemTypeId,
      isoDate,
      qty,
      jarSize,
      location.trim() || undefined
    );

    // Handle recipe creation/linking if we have recipe content
    if (selectedRecipe) {
      // User selected an existing recipe from the library
      await setBatchRecipeById(batchId, selectedRecipe.id);
    } else if (recipe.trim()) {
      // User created new recipe content - create a new recipe and link it
      const recipeId = await createRecipe({
        name: `${selectedItemType?.name || newItemTypeName} Recipe`,
        content: recipe.trim(),
        image: recipeImage || undefined,
      });

      await setBatchRecipeById(batchId, recipeId);
    }

    // Show success message and offer label generation
    Alert.alert(
      "Batch Added Successfully",
      `Added ${qty} jar${qty > 1 ? "s" : ""} of ${
        selectedItemType?.name || newItemTypeName
      }\n\nWould you like to generate labels now?`,
      [
        {
          text: "Not Now",
          style: "cancel",
          onPress: () => navigation.goBack(),
        },
        {
          text: "Generate Labels",
          onPress: () => {
            navigation.replace("QRLabel", {
              jarId: jarIds[0],
              batchIds: jarIds,
            });
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        paddingBottom: insets.bottom + theme.spacing.xl,
      }}
    >
      {/* Item Type Selection */}
      <Text style={styles.label}>Item Type</Text>
      <View style={styles.itemTypeSection}>
        {selectedItemType || newItemTypeName ? (
          <View style={styles.selectedItemType}>
            <View style={styles.selectedItemTypeInfo}>
              <Text style={styles.selectedItemTypeName}>
                {selectedItemType?.name || newItemTypeName}
              </Text>
              {selectedItemType && selectedItemType.category && (
                <View style={styles.selectedItemTypeCategory}>
                  <Text style={styles.categoryIcon}>
                    {categories.find(
                      (c) => c.name === selectedItemType.category
                    )?.icon || "📦"}
                  </Text>
                  <Text style={styles.selectedItemTypeCategoryText}>
                    {categories.find(
                      (c) => c.name === selectedItemType.category
                    )?.name || selectedItemType.category}
                  </Text>
                </View>
              )}
              {!selectedItemType && newItemTypeName && (
                <Text style={styles.newItemTypeIndicator}>New item type</Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.changeButton}
              onPress={() => setShowItemTypeModal(true)}
            >
              <Text style={styles.changeButtonText}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowItemTypeModal(true)}
            >
              <Text style={styles.selectButtonText}>Select Item Type</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Category Selection */}
      <Text style={styles.label}>Category *</Text>
      <TouchableOpacity
        style={[styles.input, styles.selectInput]}
        onPress={() => setShowCategoryModal(true)}
      >
        <View style={styles.selectContent}>
          <View style={styles.selectTextContent}>
            {category ? (
              <>
                <Text style={styles.categoryIcon}>
                  {categories.find((c) => c.name === category)?.icon || "📦"}
                </Text>
                <Text style={styles.selectText}>
                  {categories.find((c) => c.name === category)?.name ||
                    category}
                </Text>
              </>
            ) : (
              <Text style={styles.placeholderText}>Select category</Text>
            )}
          </View>
          <Ionicons name="chevron-down" size={20} color="#666" />
        </View>
      </TouchableOpacity>

      {/* Jar Size Selection */}
      <Text style={styles.label}>Jar Size *</Text>
      <TouchableOpacity
        style={[styles.input, styles.selectInput]}
        onPress={() => setShowJarSizeModal(true)}
      >
        <View style={styles.selectContent}>
          <Text style={jarSize ? styles.selectText : styles.placeholderText}>
            {jarSize || "Select jar size"}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#666" />
        </View>
      </TouchableOpacity>

      {/* Quantity */}
      <Text style={styles.label}>Number of Jars</Text>
      <TextInput
        style={styles.input}
        value={quantity}
        onChangeText={setQuantity}
        placeholder="1"
        keyboardType="numeric"
      />

      {/* Fill Date */}
      <Text style={styles.label}>Fill Date</Text>
      <TouchableOpacity
        style={styles.dateButton}
        onPress={() => setShowDatePicker(true)}
      >
        <Text style={styles.dateButtonText}>
          {formattedFillDate || "Select Date"}
        </Text>
        <Ionicons
          name="calendar-outline"
          size={20}
          color={theme.colors.textSecondary}
        />
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={fillDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedDate) => {
            setShowDatePicker(Platform.OS === "ios");
            if (selectedDate) {
              setFillDate(selectedDate);
            }
          }}
        />
      )}

      {/* Location */}
      <Text style={styles.label}>Location (Optional)</Text>
      <TextInput
        style={styles.input}
        value={location}
        onChangeText={setLocation}
        placeholder="e.g., Pantry Shelf A, Basement Storage, etc."
      />

      {/* Recipe */}
      <Text style={styles.label}>Recipe (Optional)</Text>

      {selectedRecipe || recipe.trim() ? (
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
            <Text style={styles.addRecipeButtonText}>Add Existing Recipe</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addNewRecipeButton}
            onPress={() => {
              // Set up for creating new recipe
              setSelectedRecipe(null);
              setRecipeName(
                `${
                  selectedItemType?.name || newItemTypeName || "Custom"
                } Recipe`
              );
              setRecipe("");
              setRecipeImage(null);
              setShowRecipeEditor(true);
            }}
          >
            <Ionicons
              name="add-outline"
              size={20}
              color={theme.colors.primary}
            />
            <Text style={styles.addRecipeButtonText}>Create New Recipe</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Notes */}
      <Text style={styles.label}>Notes (Optional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Additional notes"
        multiline
      />

      <TouchableOpacity style={styles.saveButton} onPress={validateAndSave}>
        <Text style={styles.saveButtonText}>Add Batch</Text>
      </TouchableOpacity>

      {/* Category Selection Modal */}
      <Modal
        visible={showCategoryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderSide}>
              <Pressable
                onPress={() => setShowCategoryModal(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Cancel category selection"
              >
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
            </View>
            <Text style={styles.modalTitle}>Select Category</Text>
            <View style={styles.modalHeaderSide} />
          </View>

          <FlatList
            data={categories}
            keyExtractor={(item) => item.id?.toString() || item.name}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.itemTypeRow}
                onPress={() => {
                  setCategory(item.name);
                  setShowCategoryModal(false);
                }}
              >
                <Text style={styles.categoryIcon}>{item.icon}</Text>
                <Text style={styles.itemTypeName}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Jar Size Selection Modal */}
      <Modal
        visible={showJarSizeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowJarSizeModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable
              onPress={() => setShowJarSizeModal(false)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cancel jar size selection"
            >
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
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
                  setJarSize(item.name);
                  setShowJarSizeModal(false);
                }}
              >
                <Text style={styles.itemTypeName}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Item Type Selection Modal */}
      <Modal
        visible={showItemTypeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowItemTypeModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable
              onPress={() => setShowItemTypeModal(false)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cancel item type selection"
            >
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Select Item Type</Text>
            <View style={{ width: 60 }} />
          </View>

          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search item types or add new..."
          />

          {existingItemTypes.length === 0 ? (
            <View style={styles.listContainer}>
              {searchQuery.trim() ? (
                <TouchableOpacity
                  style={[styles.itemTypeRow, styles.createNewRow]}
                  onPress={() => {
                    setNewItemTypeName(searchQuery.trim());
                    onCreateNewItemType();
                  }}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={24}
                    color={theme.colors.primary}
                  />
                  <View style={styles.createNewContent}>
                    <Text style={styles.createNewText}>
                      Create new item type
                    </Text>
                    <Text style={styles.createNewName}>
                      "{searchQuery.trim()}"
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    No item types yet. Start typing to create your first one!
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.listContainer}>
              {searchQuery.trim() &&
                !existingItemTypes.some(
                  (item) =>
                    item.name.toLowerCase() === searchQuery.trim().toLowerCase()
                ) && (
                  <TouchableOpacity
                    style={[styles.itemTypeRow, styles.createNewRow]}
                    onPress={() => {
                      setNewItemTypeName(searchQuery.trim());
                      onCreateNewItemType();
                    }}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={24}
                      color={theme.colors.primary}
                    />
                    <View style={styles.createNewContent}>
                      <Text style={styles.createNewText}>
                        Create new item type
                      </Text>
                      <Text style={styles.createNewName}>
                        "{searchQuery.trim()}"
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              <FlatList
                data={
                  searchQuery.trim() ? filteredItemTypes : existingItemTypes
                }
                keyExtractor={(item) => String(item.id)}
                style={styles.flatListStyle}
                contentContainerStyle={styles.flatListContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.itemTypeRow}
                    onPress={() => onSelectExistingItemType(item)}
                  >
                    <Text style={styles.itemTypeName}>{item.name}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
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
            <Pressable
              style={styles.modalHeaderSide}
              onPress={() => setShowRecipeSelector(false)}
            >
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
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
              style={styles.recipeList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.recipeCard}
                  onPress={() => selectExistingRecipe(item)}
                >
                  <View style={styles.recipeCardContent}>
                    <Text style={styles.recipeCardName}>{item.name}</Text>
                    <Text style={styles.recipeCardPreview} numberOfLines={2}>
                      {item.content}
                    </Text>
                    {item.last_used_date && (
                      <Text style={styles.recipeCardDate}>
                        Last used:{" "}
                        {new Date(item.last_used_date).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                  {item.image && (
                    <Image
                      source={{ uri: item.image }}
                      style={styles.recipeCardImage}
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
            <Pressable
              style={styles.modalHeaderSide}
              onPress={() => setShowRecipeEditor(false)}
            >
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.modalTitle}>
              {selectedRecipe ? "Edit Recipe" : "New Recipe"}
            </Text>
            <Pressable style={styles.modalHeaderSide} onPress={saveRecipe}>
              <Text style={styles.modalCreate}>Save</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.recipeEditor}>
            {/* Recipe Name */}
            <Text style={styles.label}>Recipe Name</Text>
            <TextInput
              style={styles.input}
              value={
                recipeName ||
                `${
                  selectedItemType?.name || newItemTypeName || "Custom"
                } Recipe`
              }
              onChangeText={setRecipeName}
              placeholder="Enter recipe name"
            />

            {/* Recipe Content */}
            <Text style={styles.label}>Recipe Instructions</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={recipe}
              onChangeText={setRecipe}
              placeholder="Enter recipe instructions, ingredients, notes..."
              multiline
              numberOfLines={8}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.lg,
  },
  backButton: {
    marginRight: theme.spacing.md,
    padding: theme.spacing.sm,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    flex: 1,
  },
  label: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    backgroundColor: theme.colors.surface,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateButtonText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  selectInput: {
    justifyContent: "center",
  },
  selectContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectTextContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  selectText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  placeholderText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textLight,
  },
  categoryIcon: {
    fontSize: theme.fontSize.xl,
    marginRight: theme.spacing.md,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  itemTypeSection: {
    marginBottom: theme.spacing.sm,
  },
  selectedItemType: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primaryLight + "30",
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  selectedItemTypeInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  selectedItemTypeName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  selectedItemTypeCategory: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.xs,
  },
  selectedItemTypeCategoryText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium,
  },
  selectedItemTypeRecipe: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontStyle: "italic",
    lineHeight: 18,
  },
  newItemTypeIndicator: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.medium,
    fontStyle: "italic",
    marginBottom: theme.spacing.xs,
  },
  changeButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
    alignSelf: "flex-start",
  },
  changeButtonText: {
    color: theme.colors.surface,
    fontWeight: theme.fontWeight.semibold,
  },
  selectButton: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.primaryDark,
  },
  selectButtonText: {
    color: theme.colors.surface,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.md,
  },
  orText: {
    textAlign: "center",
    margin: theme.spacing.lg,
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
  },
  saveButton: {
    marginTop: theme.spacing.xxl,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.primaryDark,
  },
  saveButtonText: {
    color: theme.colors.surface,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.lg,
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing.xxl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginTop: theme.spacing.xxl,
  },
  modalHeaderSide: {
    width: 60,
    alignItems: "flex-start",
  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  modalCancel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
  },
  modalCreate: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  searchInput: {
    margin: theme.spacing.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.fontSize.md,
    backgroundColor: theme.colors.surface,
  },
  itemTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  itemTypeName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  itemTypeRecipe: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  emptyContainer: {
    padding: theme.spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 100,
    borderColor: theme.colors.error,
  },
  emptyText: {
    textAlign: "center",
    color: theme.colors.textLight,
    fontSize: theme.fontSize.md,
  },
  createNewRow: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderStyle: "dashed",
  },
  createNewContent: {
    marginLeft: theme.spacing.md,
    flex: 1,
  },
  createNewText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primary,
  },
  createNewName: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  listContainer: {
    flex: 1,
    minHeight: 200,
  },
  flatListStyle: {
    flex: 1,
  },
  flatListContent: {
    flexGrow: 1,
  },
  recipeImageContainer: {
    position: "relative",
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    overflow: "hidden",
  },
  recipeImage: {
    width: "100%",
    height: 200,
    backgroundColor: "#f5f5f5",
  },
  removeImageButton: {
    position: "absolute",
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 12,
    padding: 2,
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
  recipeSection: {
    marginBottom: theme.spacing.md,
  },
  recipeSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  recipeHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  recipeActionButton: {
    padding: theme.spacing.xs,
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
  recipeButtonContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  selectRecipeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  selectRecipeText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.medium,
    flex: 1,
  },
  clearRecipeButton: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.error,
    borderRadius: theme.borderRadius.md,
  },
  acceptRecipeButton: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.success,
    borderRadius: theme.borderRadius.md,
  },
  recipeList: {
    flex: 1,
    padding: theme.spacing.md,
  },
  recipeCard: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  recipeCardContent: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  recipeCardName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  recipeCardPreview: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: theme.spacing.xs,
  },
  recipeCardDate: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    fontStyle: "italic",
  },
  recipeCardImage: {
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
});
