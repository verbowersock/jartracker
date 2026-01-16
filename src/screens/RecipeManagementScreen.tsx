import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Image,
  Modal,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { theme } from "../theme";
import {
  Recipe,
  getAllRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe,
} from "../db";

export default function RecipeManagementScreen() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [recipeName, setRecipeName] = useState("");
  const [recipeContent, setRecipeContent] = useState("");
  const [recipeImage, setRecipeImage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      // console.log("Loading recipes from database...");
      const allRecipes = await getAllRecipes();
      // console.log(
      //   "Found recipes:",
      //   allRecipes.length,
      //   allRecipes.map((r) => ({
      //     id: r.id,
      //     name: r.name,
      //     hasImage: !!r.image,
      //     created_date: r.created_date,
      //     last_used_date: r.last_used_date,
      //   }))
      // );
      setRecipes(allRecipes);
    } catch (error) {
      console.error("Error loading recipes:", error);
      Alert.alert("Error", "Failed to load recipes");
    }
  };

  const filteredRecipes = recipes.filter(
    (recipe) =>
      recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openModal = (recipe?: Recipe) => {
    setEditingRecipe(recipe || null);
    setRecipeName(recipe?.name || "");
    setRecipeContent(recipe?.content || "");
    setRecipeImage(recipe?.image || null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRecipe(null);
    setRecipeName("");
    setRecipeContent("");
    setRecipeImage(null);
  };

  const openDetailModal = (recipe: Recipe) => {
    setDetailRecipe(recipe);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setDetailRecipe(null);
  };

  const saveRecipe = async () => {
    if (!recipeName.trim()) {
      Alert.alert("Error", "Please enter a recipe name");
      return;
    }
    if (!recipeContent.trim()) {
      Alert.alert("Error", "Please enter recipe content");
      return;
    }

    try {
      if (editingRecipe) {
        await updateRecipe(editingRecipe.id!, {
          name: recipeName.trim(),
          content: recipeContent.trim(),
          image: recipeImage,
        });
      } else {
        await createRecipe({
          name: recipeName.trim(),
          content: recipeContent.trim(),
          image: recipeImage,
        });
      }
      closeModal();
      await loadRecipes();
    } catch (error) {
      console.error("Error saving recipe:", error);
      Alert.alert("Error", "Failed to save recipe");
    }
  };

  const deleteRecipeHandler = async (recipe: Recipe) => {
    Alert.alert(
      "Delete Recipe",
      `Are you sure you want to delete "${recipe.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRecipe(recipe.id!);
              await loadRecipes();
            } catch (error) {
              console.error("Error deleting recipe:", error);
              Alert.alert("Error", "Failed to delete recipe");
            }
          },
        },
      ]
    );
  };

  const pickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to add recipe images."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const imageUri = result.assets[0].uri;
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: "base64",
      });
      const base64Image = `data:image/jpeg;base64,${base64}`;
      setRecipeImage(base64Image);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert(
        "Permission Required",
        "Please allow access to your camera to take recipe photos."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const imageUri = result.assets[0].uri;
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: "base64",
      });
      const base64Image = `data:image/jpeg;base64,${base64}`;
      setRecipeImage(base64Image);
    }
  };

  const addImageOptions = () => {
    Alert.alert("Add Recipe Image", "Choose how you'd like to add an image", [
      {
        text: "Camera",
        onPress: takePhoto,
      },
      {
        text: "Photo Library",
        onPress: pickImage,
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  };

  const renderRecipe = ({ item }: { item: Recipe }) => (
    <TouchableOpacity
      style={styles.recipeCard}
      onPress={() => openDetailModal(item)}
      activeOpacity={0.7}
    >
      <View style={styles.recipeHeader}>
        <Text style={styles.recipeName}>{item.name}</Text>
        <View style={styles.recipeActions}>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              openModal(item);
            }}
            style={styles.actionButton}
          >
            <Ionicons
              name="create-outline"
              size={20}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              deleteRecipeHandler(item);
            }}
            style={styles.actionButton}
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color={theme.colors.error}
            />
          </TouchableOpacity>
        </View>
      </View>
      {item.image && (
        <Image source={{ uri: item.image }} style={styles.recipeImage} />
      )}
      <Text style={styles.recipeContent} numberOfLines={3}>
        {item.content}
      </Text>
      {item.last_used_date && (
        <Text style={styles.lastUsed}>
          Last used: {new Date(item.last_used_date).toLocaleDateString()}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Recipe Collection</Text>
        <TouchableOpacity onPress={() => openModal()} style={styles.addButton}>
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search recipes..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredRecipes}
        renderItem={renderRecipe}
        keyExtractor={(item) => item.id!.toString()}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Ionicons
              name="restaurant-outline"
              size={64}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.emptyText}>Loading recipes...</Text>
            <Text style={styles.emptySubtext}>
              If you have recipes in existing batches, those are being
              automatically imported. You may need to restart the app to see
              them all.
            </Text>
          </View>
        )}
      />

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeModal}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingRecipe ? "Edit Recipe" : "New Recipe"}
            </Text>
            <TouchableOpacity onPress={saveRecipe}>
              <Text style={styles.saveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Recipe Name</Text>
              <TextInput
                style={styles.input}
                value={recipeName}
                onChangeText={setRecipeName}
                placeholder="Enter recipe name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Recipe Image</Text>
              <TouchableOpacity
                style={styles.imageButton}
                onPress={addImageOptions}
              >
                {recipeImage ? (
                  <Image
                    source={{ uri: recipeImage }}
                    style={styles.imagePreview}
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons
                      name="image-outline"
                      size={32}
                      color={theme.colors.textSecondary}
                    />
                    <Text style={styles.imageText}>Add Image</Text>
                  </View>
                )}
              </TouchableOpacity>
              {recipeImage && (
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setRecipeImage(null)}
                >
                  <Text style={styles.removeImageText}>Remove Image</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Recipe Instructions</Text>
              <TextInput
                style={styles.textArea}
                value={recipeContent}
                onChangeText={setRecipeContent}
                placeholder="Enter recipe instructions, ingredients, and notes"
                multiline
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Recipe Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeDetailModal}>
              <Text style={styles.cancelButton}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {detailRecipe?.name || "Recipe"}
            </Text>
            <TouchableOpacity
              onPress={() => {
                closeDetailModal();
                if (detailRecipe) {
                  openModal(detailRecipe);
                }
              }}
            >
              <Text style={styles.saveButton}>Edit</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {detailRecipe?.image && (
              <View style={styles.detailImageContainer}>
                <Image
                  source={{ uri: detailRecipe.image }}
                  style={styles.detailImage}
                  resizeMode="contain"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Instructions</Text>
              <ScrollView style={styles.detailContentContainer}>
                <Text style={styles.detailContent}>
                  {detailRecipe?.content || "No instructions provided"}
                </Text>
              </ScrollView>
            </View>

            {detailRecipe?.last_used_date && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Last Used</Text>
                <Text style={styles.detailLastUsed}>
                  {new Date(detailRecipe.last_used_date).toLocaleDateString()}
                </Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Created</Text>
              <Text style={styles.detailCreated}>
                {detailRecipe?.created_date
                  ? new Date(detailRecipe.created_date).toLocaleDateString()
                  : "Unknown"}
              </Text>
            </View>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    height: 50,
    marginLeft: 10,
    color: theme.colors.text,
    fontSize: 16,
  },
  list: {
    padding: 20,
    paddingTop: 0,
  },
  recipeCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  recipeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  recipeName: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.text,
    flex: 1,
  },
  recipeActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  recipeImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  recipeContent: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  lastUsed: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: "italic",
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  cancelButton: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.text,
  },
  saveButton: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.primary,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text,
  },
  textArea: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text,
    minHeight: 120,
  },
  imageButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
    borderRadius: 8,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  imagePlaceholder: {
    alignItems: "center",
  },
  imageText: {
    marginTop: 8,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  removeImageButton: {
    marginTop: 8,
    padding: 8,
  },
  removeImageText: {
    color: theme.colors.error,
    fontSize: 14,
    textAlign: "center",
  },
  // Detail modal styles
  detailImageContainer: {
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    overflow: "hidden",
  },
  detailImage: {
    width: "100%",
    height: 300,
    backgroundColor: theme.colors.surfaceSecondary,
  },
  detailContentContainer: {
    maxHeight: 400,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  detailContent: {
    fontSize: theme.fontSize.md,
    lineHeight: 22,
    color: theme.colors.text,
  },
  detailLastUsed: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    paddingVertical: theme.spacing.sm,
  },
  detailCreated: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    paddingVertical: theme.spacing.sm,
  },
});
