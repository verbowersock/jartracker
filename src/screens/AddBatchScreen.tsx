import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  Modal,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import {
  getDb,
  upsertItemType,
  createMultipleJars,
  ItemType,
  CATEGORIES,
  JAR_SIZES,
} from "../db";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function AddBatchScreen() {
  const navigation = useNavigation<Nav>();
  const [selectedItemType, setSelectedItemType] =
    React.useState<ItemType | null>(null);
  const [newItemTypeName, setNewItemTypeName] = React.useState("");
  const [recipe, setRecipe] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");
  const [fillDate, setFillDate] = React.useState(
    new Date().toISOString().split("T")[0]
  );
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
  const [searchQuery, setSearchQuery] = React.useState("");

  // Load existing item types
  React.useEffect(() => {
    loadExistingItemTypes();
  }, []);

  const loadExistingItemTypes = async () => {
    const db = await getDb();
    const itemTypes = await db.getAllAsync<ItemType>(
      "SELECT * FROM item_types ORDER BY name COLLATE NOCASE"
    );
    setExistingItemTypes(itemTypes);
  };

  const filteredItemTypes = existingItemTypes.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onSelectExistingItemType = (itemType: ItemType) => {
    setSelectedItemType(itemType);
    setNewItemTypeName("");
    setRecipe(itemType.recipe || "");
    setNotes(itemType.notes || "");
    setCategory(itemType.category || "");
    setShowItemTypeModal(false);
    setSearchQuery("");
  };

  const onCreateNewItemType = () => {
    setSelectedItemType(null);
    setRecipe("");
    setNotes("");
    setCategory("");
    setShowItemTypeModal(false);
    setSearchQuery("");
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
    if (!fillDate) {
      Alert.alert("Date Required", "Please select a fill date");
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
      // Using existing item type, update it with new category if changed
      if (
        recipe !== (selectedItemType.recipe || "") ||
        notes !== (selectedItemType.notes || "") ||
        category !== (selectedItemType.category || "")
      ) {
        await upsertItemType({
          id: selectedItemType.id,
          name: selectedItemType.name,
          category: category,
          recipe: recipe.trim() || undefined,
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

      itemTypeId = await upsertItemType({
        name: newItemTypeName.trim(),
        category: category,
        recipe: recipe.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    }

    // Create multiple jars with jar size and location
    const jarIds = await createMultipleJars(
      itemTypeId,
      fillDate + "T12:00:00.000Z",
      qty,
      jarSize,
      location.trim() || undefined
    );

    // Show success message
    Alert.alert(
      "Batch Added Successfully",
      `Added ${qty} jar${qty > 1 ? "s" : ""} of ${
        selectedItemType?.name || newItemTypeName
      }`,
      [
        {
          text: "Generate Labels",
          onPress: () => {
            navigation.navigate("QRLabel", {
              jarId: jarIds[0],
              batchIds: jarIds,
            });
          },
        },
        {
          text: "Done",
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Add New Batch</Text>

      {/* Item Type Selection */}
      <Text style={styles.label}>Item Type</Text>
      <View style={styles.itemTypeSection}>
        {selectedItemType ? (
          <View style={styles.selectedItemType}>
            <Text style={styles.selectedItemTypeName}>
              {selectedItemType.name}
            </Text>
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
              <Text style={styles.selectButtonText}>
                Select Existing Item Type
              </Text>
            </TouchableOpacity>

            <Text style={styles.orText}>or</Text>

            <TextInput
              style={styles.input}
              value={newItemTypeName}
              onChangeText={setNewItemTypeName}
              placeholder="Enter new item type name (e.g., Strawberry Jam)"
            />
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
          {category ? (
            <>
              <Text style={styles.categoryIcon}>
                {CATEGORIES.find((c) => c.id === category)?.icon}
              </Text>
              <Text style={styles.selectText}>
                {CATEGORIES.find((c) => c.id === category)?.name}
              </Text>
            </>
          ) : (
            <Text style={styles.placeholderText}>Select category</Text>
          )}
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
      <TextInput
        style={styles.input}
        value={fillDate}
        onChangeText={setFillDate}
        placeholder="YYYY-MM-DD"
      />

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
      <TextInput
        style={[styles.input, styles.multiline]}
        value={recipe}
        onChangeText={setRecipe}
        placeholder="Recipe details"
        multiline
      />

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
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Category</Text>
            <View style={{ width: 60 }} />
          </View>

          <FlatList
            data={CATEGORIES}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.itemTypeRow}
                onPress={() => {
                  setCategory(item.id);
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
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowJarSizeModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Jar Size</Text>
            <View style={{ width: 60 }} />
          </View>

          <FlatList
            data={JAR_SIZES}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.itemTypeRow}
                onPress={() => {
                  setJarSize(item);
                  setShowJarSizeModal(false);
                }}
              >
                <Text style={styles.itemTypeName}>{item}</Text>
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
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowItemTypeModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Item Type</Text>
            <TouchableOpacity onPress={onCreateNewItemType}>
              <Text style={styles.modalCreate}>New</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search item types..."
          />

          <FlatList
            data={filteredItemTypes}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.itemTypeRow}
                onPress={() => onSelectExistingItemType(item)}
              >
                <Text style={styles.itemTypeName}>{item.name}</Text>
                {item.recipe && (
                  <Text style={styles.itemTypeRecipe} numberOfLines={1}>
                    {item.recipe}
                  </Text>
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {searchQuery
                  ? "No matching item types found"
                  : "No item types created yet"}
              </Text>
            }
          />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 24 },
  label: { marginTop: 16, marginBottom: 8, fontWeight: "600", fontSize: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  selectInput: {
    justifyContent: "center",
  },
  selectContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: {
    fontSize: 16,
    color: "#333",
  },
  placeholderText: {
    fontSize: 16,
    color: "#999",
  },
  categoryIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  itemTypeSection: {
    marginBottom: 8,
  },
  selectedItemType: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#e8f5e8",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4caf50",
  },
  selectedItemTypeName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2e7d32",
  },
  changeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#2e7d32",
    borderRadius: 6,
  },
  changeButtonText: {
    color: "white",
    fontWeight: "600",
  },
  selectButton: {
    padding: 12,
    backgroundColor: "#1565c0",
    borderRadius: 8,
    alignItems: "center",
  },
  selectButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  orText: {
    textAlign: "center",
    margin: 16,
    fontSize: 16,
    color: "#666",
  },
  saveButton: {
    marginTop: 24,
    marginBottom: 40,
    padding: 16,
    backgroundColor: "#2e7d32",
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 18,
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: "white",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  modalCancel: {
    color: "#666",
    fontSize: 16,
  },
  modalCreate: {
    color: "#2e7d32",
    fontSize: 16,
    fontWeight: "600",
  },
  searchInput: {
    margin: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    fontSize: 16,
  },
  itemTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
  },
  itemTypeName: {
    fontSize: 16,
    fontWeight: "600",
  },
  itemTypeRecipe: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    marginTop: 32,
    fontSize: 16,
  },
});
