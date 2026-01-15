import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getAllCategories,
  addCustomCategory,
  updateCustomCategory,
  deleteCustomCategory,
  type CustomCategory,
} from "../db";
import { theme } from "../theme";
import { SafeAreaView } from "react-native-safe-area-context";

interface EditCategoryModalProps {
  visible: boolean;
  category: CustomCategory | null;
  onSave: (category: { name: string; icon: string }) => void;
  onCancel: () => void;
}

const AVAILABLE_ICONS = [
  "🍎",
  "🥕",
  "🍯",
  "🥒",
  "🍅",
  "🥩",
  "🧃",
  "🍲",
  "📦",
  "🍓",
  "🥬",
  "🌶️",
  "🧅",
  "🥔",
  "🍇",
  "🍊",
  "🍌",
  "🥝",
  "🥑",
  "🍑",
  "🍒",
  "🥥",
  "🍍",
  "🥭",
  "🍆",
  "🥦",
  "🌽",
  "🥖",
  "🧄",
  "🫐",
  "🍞",
  "🥨",
  "🥯",
  "🧀",
  "🥓",
  "🍖",
];

const EditCategoryModal: React.FC<EditCategoryModalProps> = ({
  visible,
  category,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("📦");
  const [error, setError] = useState("");

  useEffect(() => {
    if (category) {
      setName(category.name);
      setSelectedIcon(category.icon);
    } else {
      setName("");
      setSelectedIcon("📦");
    }
    setError(""); // Clear error when modal opens/closes
  }, [category, visible]);

  const handleSave = () => {
    if (name.trim()) {
      setError("");
      onSave({ name: name.trim(), icon: selectedIcon });
      // Field will be cleared when modal closes due to useEffect
    } else {
      setError("Category name is required");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>
            {category ? "Edit Category" : "Add Category"}
          </Text>

          <Text style={styles.label}>Name:</Text>
          <TextInput
            style={[styles.textInput, error ? styles.textInputError : null]}
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (error) setError(""); // Clear error when user types
            }}
            placeholder="Enter category name"
            autoFocus
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Text style={styles.label}>Icon:</Text>
          <View style={styles.iconGrid}>
            {AVAILABLE_ICONS.map((icon) => (
              <TouchableOpacity
                key={icon}
                style={[
                  styles.iconButton,
                  selectedIcon === icon && styles.selectedIconButton,
                ]}
                onPress={() => setSelectedIcon(icon)}
              >
                <Text style={styles.emojiIcon}>{icon}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default function CategoryManagementScreen() {
  const [categories, setCategories] = useState<CustomCategory[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CustomCategory | null>(
    null
  );

  const loadCategories = async () => {
    try {
      const allCategories = await getAllCategories();
      // Filter out any invalid categories and ensure proper data types
      const validCategories = allCategories.filter(
        (cat) =>
          cat && typeof cat.name === "string" && typeof cat.icon === "string"
      );
      setCategories(validCategories);
    } catch (error) {
      console.error("Error loading categories:", error);
      Alert.alert("Error", "Failed to load categories");
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleAddCategory = () => {
    setEditingCategory(null);
    setModalVisible(true);
  };

  const handleEditCategory = (category: CustomCategory) => {
    setEditingCategory(category);
    setModalVisible(true);
  };

  const handleSaveCategory = async (categoryData: {
    name: string;
    icon: string;
  }) => {
    try {
      // Check for duplicate names (case-insensitive)
      const isDuplicate = categories.some(
        (cat) =>
          cat.name.toLowerCase() === categoryData.name.toLowerCase() &&
          cat.id !== editingCategory?.id
      );

      if (isDuplicate) {
        Alert.alert(
          "Duplicate Category",
          `A category named "${categoryData.name}" already exists. Please choose a different name.`
        );
        return;
      }

      if (editingCategory) {
        await updateCustomCategory(
          editingCategory.id!,
          categoryData.name,
          categoryData.icon
        );
      } else {
        await addCustomCategory(categoryData.name, categoryData.icon);
      }
      setModalVisible(false);
      setEditingCategory(null);
      await loadCategories();
    } catch (error) {
      console.error("Error saving category:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save category";
      Alert.alert("Error", errorMessage);
    }
  };

  const handleDeleteCategory = (category: CustomCategory) => {
    if (category.isDefault === 1) {
      Alert.alert("Cannot Delete", "Default categories cannot be deleted.");
      return;
    }

    Alert.alert(
      "Delete Category",
      `Are you sure you want to delete "${category.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCustomCategory(category.id!);
              await loadCategories();
            } catch (error) {
              console.error("Error deleting category:", error);
              Alert.alert(
                "Error",
                `Failed to delete category. ${error.message}`
              );
            }
          },
        },
      ]
    );
  };

  const renderCategoryItem = ({ item }: { item: CustomCategory }) => (
    <View style={styles.categoryItem}>
      <View style={styles.categoryInfo}>
        <Text style={styles.categoryEmoji}>{item.icon || "📦"}</Text>
        <Text style={styles.categoryName}>{item.name || "Unknown"}</Text>
        {item.isDefault === 1 && (
          <Text style={styles.defaultLabel}>Default</Text>
        )}
      </View>
      <View style={styles.categoryActions}>
        {item.isDefault !== 1 && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditCategory(item)}
          >
            <Ionicons name="pencil" size={20} color="#666" />
          </TouchableOpacity>
        )}
        {item.isDefault !== 1 && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteCategory(item)}
          >
            <Ionicons name="trash" size={20} color="#ff4444" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <FlatList
        data={categories}
        keyExtractor={(item, index) =>
          item.id?.toString() || `category-${index}`
        }
        renderItem={renderCategoryItem}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={
          <View style={styles.headerButton}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddCategory}
            >
              <Text style={styles.buttonText}>Add Category</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <EditCategoryModal
        visible={modalVisible}
        category={editingCategory}
        onSave={handleSaveCategory}
        onCancel={() => {
          setModalVisible(false);
          setEditingCategory(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "500",
  },
  listContainer: {
    padding: 16,
  },
  categoryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  categoryInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 12,
    color: theme.colors.text,
  },
  defaultLabel: {
    fontSize: 12,
    color: "#666",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  categoryActions: {
    flexDirection: "row",
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    width: "90%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: theme.colors.text,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 8,
    color: theme.colors.text,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
  },
  iconButton: {
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    margin: 4,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  selectedIconButton: {
    borderColor: theme.colors.primary,
    backgroundColor: "#f0f8ff",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
  },
  saveButton: {
    flex: 1,
    padding: 12,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  emojiIcon: {
    fontSize: 24,
  },
  categoryEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  errorText: {
    color: "#ff4444",
    fontSize: 14,
    marginBottom: 16,
    marginTop: -16,
  },
  textInputError: {
    borderColor: "#ff4444",
  },
});
