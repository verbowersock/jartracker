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
  getAllJarSizesIncludingHidden,
  addCustomJarSize,
  updateCustomJarSize,
  deleteCustomJarSize,
  toggleJarSizeVisibility,
  type CustomJarSize,
} from "../db";
import { theme } from "../theme";
import { SafeAreaView } from "react-native-safe-area-context";

interface EditJarSizeModalProps {
  visible: boolean;
  jarSize: CustomJarSize | null;
  onSave: (jarSize: { name: string }) => void;
  onCancel: () => void;
}

const EditJarSizeModal: React.FC<EditJarSizeModalProps> = ({
  visible,
  jarSize,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState("");

  useEffect(() => {
    if (jarSize) {
      setName(jarSize.name);
    } else {
      setName("");
    }
  }, [jarSize]);

  const handleSave = () => {
    if (name.trim()) {
      onSave({ name: name.trim() });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>
            {jarSize ? "Edit Jar Size" : "Add Jar Size"}
          </Text>

          <Text style={styles.label}>Size Name:</Text>
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            placeholder="Enter jar size (e.g., 16 oz, 1 pint)"
            autoFocus
          />

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

export default function JarSizeManagementScreen() {
  const [jarSizes, setJarSizes] = useState<CustomJarSize[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingJarSize, setEditingJarSize] = useState<CustomJarSize | null>(
    null
  );

  const loadJarSizes = async () => {
    try {
      const allJarSizes = await getAllJarSizesIncludingHidden();
      setJarSizes(allJarSizes);
    } catch (error) {
      console.error("Error loading jar sizes:", error);
      Alert.alert("Error", "Failed to load jar sizes");
    }
  };

  useEffect(() => {
    loadJarSizes();
  }, []);

  const handleAddJarSize = () => {
    setEditingJarSize(null);
    setModalVisible(true);
  };

  const handleEditJarSize = (jarSize: CustomJarSize) => {
    setEditingJarSize(jarSize);
    setModalVisible(true);
  };

  const handleSaveJarSize = async (jarSizeData: { name: string }) => {
    try {
      if (editingJarSize) {
        await updateCustomJarSize(editingJarSize.id!, jarSizeData.name);
      } else {
        await addCustomJarSize(jarSizeData.name);
      }
      setModalVisible(false);
      setEditingJarSize(null);
      await loadJarSizes();
    } catch (error) {
      console.error("Error saving jar size:", error);
      Alert.alert("Error", "Failed to save jar size");
    }
  };

  const handleDeleteJarSize = (jarSize: CustomJarSize) => {
    if (jarSize.isDefault) {
      Alert.alert("Cannot Delete", "Default jar sizes cannot be deleted.");
      return;
    }

    Alert.alert(
      "Delete Jar Size",
      `Are you sure you want to delete "${jarSize.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCustomJarSize(jarSize.id!);
              await loadJarSizes();
            } catch (error) {
              console.error("Error deleting jar size:", error);
              Alert.alert(
                "Error",
                `Failed to delete jar size. ${error.message}`
              );
            }
          },
        },
      ]
    );
  };

  const handleToggleVisibility = async (jarSize: CustomJarSize) => {
    try {
      await toggleJarSizeVisibility(jarSize.id!);
      await loadJarSizes();
    } catch (error) {
      console.error("Error toggling jar size visibility:", error);
      Alert.alert("Error", "Failed to toggle jar size visibility");
    }
  };

  const renderJarSizeItem = ({ item }: { item: CustomJarSize }) => (
    <View
      style={[
        styles.jarSizeItem,
        item.hidden ? styles.hiddenJarSizeItem : null,
      ]}
    >
      <View style={styles.jarSizeInfo}>
        <Text
          style={[styles.jarSizeName, item.hidden ? styles.hiddenText : null]}
        >
          {item.name}
        </Text>
        {!!item.isDefault && <Text style={styles.defaultLabel}>Default</Text>}
        {!!item.hidden && <Text style={styles.hiddenLabel}>Hidden</Text>}
      </View>
      <View style={styles.jarSizeActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleToggleVisibility(item)}
        >
          <Ionicons
            name={item.hidden ? "eye" : "eye-off"}
            size={20}
            color="#666"
          />
        </TouchableOpacity>
        {!item.isDefault && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditJarSize(item)}
          >
            <Ionicons name="pencil" size={20} color="#666" />
          </TouchableOpacity>
        )}
        {!item.isDefault && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteJarSize(item)}
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
        data={jarSizes}
        keyExtractor={(item) => item.id?.toString() || item.name}
        renderItem={renderJarSizeItem}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={
          <View style={styles.headerButton}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddJarSize}
            >
              <Text style={styles.buttonText}>Add Custom Jar Size</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <EditJarSizeModal
        visible={modalVisible}
        jarSize={editingJarSize}
        onSave={handleSaveJarSize}
        onCancel={() => {
          setModalVisible(false);
          setEditingJarSize(null);
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
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
  jarSizeItem: {
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
  jarSizeInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  jarSizeName: {
    fontSize: 16,
    fontWeight: "500",
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
  jarSizeActions: {
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
  hiddenJarSizeItem: {
    opacity: 0.6,
    backgroundColor: "#f5f5f5",
  },
  hiddenText: {
    color: "#999",
    fontStyle: "italic",
  },
  hiddenLabel: {
    fontSize: 12,
    color: "#999",
    backgroundColor: "#e0e0e0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
});
