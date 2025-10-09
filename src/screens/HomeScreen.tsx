import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Modal,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getAllBatches, getJarStats, CATEGORIES } from "../db";
import type { RootStackParamList } from "../App";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type StatusFilter = "all" | "available" | "used";
type CategoryFilter = "all" | string;

type Batch = {
  id: number;
  name: string;
  category: string;
  fillDate: string;
  jarSize: string;
  location: string;
  notes: string;
  totalJars: number;
  usedJars: number;
  availableJars: number;
  jarIds: number[];
};

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const [batches, setBatches] = React.useState<Batch[]>([]);
  const [stats, setStats] = React.useState({ total: 0, available: 0, used: 0 });
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] =
    React.useState<CategoryFilter>("all");
  const [selectedBatch, setSelectedBatch] = React.useState<Batch | null>(null);
  const [showBatchModal, setShowBatchModal] = React.useState(false);

  const loadData = async () => {
    try {
      const [batchData, statsData] = await Promise.all([
        getAllBatches(),
        getJarStats(),
      ]);
      setBatches(batchData);
      setStats(statsData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const filteredBatches = batches.filter((batch) => {
    // Status filter
    if (statusFilter === "available" && batch.availableJars === 0) return false;
    if (statusFilter === "used" && batch.usedJars === 0) return false;

    // Category filter
    if (categoryFilter !== "all" && batch.category !== categoryFilter)
      return false;

    return true;
  });

  const getCategoryIcon = (categoryId: string) => {
    const category = CATEGORIES.find((c) => c.id === categoryId);
    return category?.icon ?? "📦";
  };

  const getCategoryName = (categoryId: string) => {
    const category = CATEGORIES.find((c) => c.id === categoryId);
    return category?.name ?? "Other";
  };

  const renderBatchCard = ({ item }: { item: Batch }) => (
    <TouchableOpacity
      style={styles.batchCard}
      onPress={() => {
        setSelectedBatch(item);
        setShowBatchModal(true);
      }}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.batchName}>{item.name}</Text>
        <View
          style={[
            styles.categoryChip,
            { backgroundColor: getCategoryColor(item.category) },
          ]}
        >
          <Text style={styles.categoryChipText}>
            {getCategoryIcon(item.category)} {getCategoryName(item.category)}
          </Text>
        </View>
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="resize-outline" size={16} color="#666" />
          <Text style={styles.detailText}>Size: {item.jarSize}</Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color="#666" />
          <Text style={styles.detailText}>
            Canned: {new Date(item.fillDate).toLocaleDateString()}
          </Text>
        </View>

        {item.location && (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.detailText}>Location: {item.location}</Text>
          </View>
        )}

        {item.notes && (
          <View style={styles.detailRow}>
            <Ionicons name="document-text-outline" size={16} color="#666" />
            <Text style={styles.detailText}>Note: {item.notes}</Text>
          </View>
        )}

        <View style={styles.jarStats}>
          <Text style={styles.jarStatsText}>
            {item.availableJars} available • {item.usedJars} used •{" "}
            {item.totalJars} total
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const getCategoryColor = (categoryId: string): string => {
    const colors: { [key: string]: string } = {
      fruits: "#FFE0B2",
      vegetables: "#C8E6C9",
      preserves: "#FFF3E0",
      pickles: "#E8F5E8",
      sauces: "#FFCDD2",
      meats: "#F3E5F5",
      other: "#E0E0E0",
    };
    return colors[categoryId] ?? colors.other;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Pantry Dashboard</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate("AddBatch")}
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Jars</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: "#2e7d32" }]}>
              {stats.available}
            </Text>
            <Text style={styles.statLabel}>Available</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: "#d32f2f" }]}>
              {stats.used}
            </Text>
            <Text style={styles.statLabel}>Used</Text>
          </View>
        </View>

        {/* Status Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>Filter by Status</Text>
          <View style={styles.filterButtons}>
            {["all", "available", "used"].map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterButton,
                  statusFilter === status && styles.filterButtonActive,
                ]}
                onPress={() => setStatusFilter(status as StatusFilter)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    statusFilter === status && styles.filterButtonTextActive,
                  ]}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Category Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>Filter by Category</Text>
          <View style={styles.categoryButtons}>
            <TouchableOpacity
              style={[
                styles.categoryButton,
                categoryFilter === "all" && styles.categoryButtonActive,
              ]}
              onPress={() => setCategoryFilter("all")}
            >
              <Text style={styles.categoryIcon}>📋</Text>
              <Text
                style={[
                  styles.categoryButtonText,
                  categoryFilter === "all" && styles.categoryButtonTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>

            {CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryButton,
                  categoryFilter === category.id && styles.categoryButtonActive,
                ]}
                onPress={() => setCategoryFilter(category.id)}
              >
                <Text style={styles.categoryIcon}>{category.icon}</Text>
                <Text
                  style={[
                    styles.categoryButtonText,
                    categoryFilter === category.id &&
                      styles.categoryButtonTextActive,
                  ]}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Batch Cards */}
        <View style={styles.batchesSection}>
          <Text style={styles.batchesTitle}>
            Batches ({filteredBatches.length})
          </Text>
          {filteredBatches.length > 0 ? (
            <FlatList
              data={filteredBatches}
              renderItem={renderBatchCard}
              keyExtractor={(item, index) =>
                `${item.id}-${item.fillDate}-${index}`
              }
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No batches found</Text>
              <Text style={styles.emptySubtext}>
                Try adjusting your filters or add a new batch
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Batch Detail Modal */}
      <Modal
        visible={showBatchModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowBatchModal(false)}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Batch Details</Text>
            <TouchableOpacity
              onPress={() => {
                if (selectedBatch) {
                  setShowBatchModal(false);
                  navigation.navigate("QRLabel", {
                    jarId: selectedBatch.jarIds[0],
                    batchIds: selectedBatch.jarIds,
                  });
                }
              }}
            >
              <Text style={styles.modalAction}>Labels</Text>
            </TouchableOpacity>
          </View>

          {selectedBatch && (
            <ScrollView style={styles.modalContent}>
              {/* Batch Name and Category */}
              <View style={styles.modalSection}>
                <Text style={styles.modalBatchName}>{selectedBatch.name}</Text>
                <View
                  style={[
                    styles.modalCategoryChip,
                    {
                      backgroundColor: getCategoryColor(selectedBatch.category),
                    },
                  ]}
                >
                  <Text style={styles.modalCategoryText}>
                    {getCategoryIcon(selectedBatch.category)}{" "}
                    {getCategoryName(selectedBatch.category)}
                  </Text>
                </View>
              </View>

              {/* Key Details */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Details</Text>

                <View style={styles.modalDetailRow}>
                  <Ionicons name="resize-outline" size={20} color="#666" />
                  <Text style={styles.modalDetailLabel}>Jar Size:</Text>
                  <Text style={styles.modalDetailValue}>
                    {selectedBatch.jarSize || "Not specified"}
                  </Text>
                </View>

                <View style={styles.modalDetailRow}>
                  <Ionicons name="calendar-outline" size={20} color="#666" />
                  <Text style={styles.modalDetailLabel}>Date Canned:</Text>
                  <Text style={styles.modalDetailValue}>
                    {new Date(selectedBatch.fillDate).toLocaleDateString()}
                  </Text>
                </View>

                {selectedBatch.location && (
                  <View style={styles.modalDetailRow}>
                    <Ionicons name="location-outline" size={20} color="#666" />
                    <Text style={styles.modalDetailLabel}>Location:</Text>
                    <Text style={styles.modalDetailValue}>
                      {selectedBatch.location}
                    </Text>
                  </View>
                )}
              </View>

              {/* Jar Statistics */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Jar Inventory</Text>

                <View style={styles.modalStatsGrid}>
                  <View style={styles.modalStatCard}>
                    <Text style={styles.modalStatNumber}>
                      {selectedBatch.totalJars}
                    </Text>
                    <Text style={styles.modalStatLabel}>Total</Text>
                  </View>
                  <View style={styles.modalStatCard}>
                    <Text
                      style={[styles.modalStatNumber, { color: "#2e7d32" }]}
                    >
                      {selectedBatch.availableJars}
                    </Text>
                    <Text style={styles.modalStatLabel}>Available</Text>
                  </View>
                  <View style={styles.modalStatCard}>
                    <Text
                      style={[styles.modalStatNumber, { color: "#d32f2f" }]}
                    >
                      {selectedBatch.usedJars}
                    </Text>
                    <Text style={styles.modalStatLabel}>Used</Text>
                  </View>
                </View>
              </View>

              {/* Notes */}
              {selectedBatch.notes && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Notes</Text>
                  <View style={styles.modalNotesBox}>
                    <Text style={styles.modalNotesText}>
                      {selectedBatch.notes}
                    </Text>
                  </View>
                </View>
              )}

              {/* Actions */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Actions</Text>

                <TouchableOpacity
                  style={styles.modalActionButton}
                  onPress={() => {
                    setShowBatchModal(false);
                    navigation.navigate("QRLabel", {
                      jarId: selectedBatch.jarIds[0],
                      batchIds: selectedBatch.jarIds,
                    });
                  }}
                >
                  <Ionicons name="qr-code-outline" size={20} color="white" />
                  <Text style={styles.modalActionButtonText}>
                    Generate QR Labels
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalActionButton,
                    styles.modalSecondaryButton,
                  ]}
                  onPress={() => {
                    // Navigate to batch detail screen to manage individual jars
                    setShowBatchModal(false);
                    navigation.navigate("BatchDetail", {
                      batchName: selectedBatch.name,
                      itemTypeId: selectedBatch.id,
                      fillDate: selectedBatch.fillDate.split("T")[0], // Extract just the date part
                    });
                  }}
                >
                  <Ionicons name="list-outline" size={20} color="#007AFF" />
                  <Text
                    style={[styles.modalActionButtonText, { color: "#007AFF" }]}
                  >
                    Manage Individual Jars
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  addButton: {
    backgroundColor: "#007AFF",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  filterSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  filterButtons: {
    flexDirection: "row",
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#e0e0e0",
  },
  filterButtonActive: {
    backgroundColor: "#007AFF",
  },
  filterButtonText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  filterButtonTextActive: {
    color: "white",
  },
  categoryButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#e0e0e0",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryButtonActive: {
    backgroundColor: "#007AFF",
  },
  categoryIcon: {
    fontSize: 16,
  },
  categoryButtonText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  categoryButtonTextActive: {
    color: "white",
  },
  batchesSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  batchesTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  batchCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  batchName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    flex: 1,
    marginRight: 12,
  },
  categoryChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#333",
  },
  cardDetails: {
    gap: 8,
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
  jarStats: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  jarStatsText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    marginTop: 12,
    fontWeight: "500",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#ccc",
    marginTop: 4,
    textAlign: "center",
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalClose: {
    fontSize: 16,
    color: "#666",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  modalAction: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalSection: {
    marginVertical: 16,
  },
  modalBatchName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  modalCategoryChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modalCategoryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  modalDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 12,
  },
  modalDetailLabel: {
    fontSize: 16,
    color: "#666",
    minWidth: 100,
  },
  modalDetailValue: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
    flex: 1,
  },
  modalStatsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  modalStatCard: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  modalStatNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  modalStatLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  modalNotesBox: {
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  modalNotesText: {
    fontSize: 16,
    color: "#333",
    lineHeight: 22,
  },
  modalActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  modalSecondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  modalActionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
});
