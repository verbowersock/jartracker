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
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
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
import { theme } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function AddBatchScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [selectedItemType, setSelectedItemType] =
    React.useState<ItemType | null>(null);
  const [newItemTypeName, setNewItemTypeName] = React.useState("");
  const [recipe, setRecipe] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");
  const [fillDate, setFillDate] = React.useState(new Date());
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
    const isoDate = fillDate.toISOString();

    const { jarIds, batchId } = await createMultipleJars(
      itemTypeId,
      isoDate,
      qty,
      jarSize,
      location.trim() || undefined
    );

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
                    {
                      CATEGORIES.find((c) => c.id === selectedItemType.category)
                        ?.icon
                    }
                  </Text>
                  <Text style={styles.selectedItemTypeCategoryText}>
                    {
                      CATEGORIES.find((c) => c.id === selectedItemType.category)
                        ?.name
                    }
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
                  {CATEGORIES.find((c) => c.id === category)?.icon}
                </Text>
                <Text style={styles.selectText}>
                  {CATEGORIES.find((c) => c.id === category)?.name}
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
          {fillDate.toLocaleDateString("en-US", {
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
          })}
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
});
