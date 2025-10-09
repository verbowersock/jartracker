import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { getDb, markJarUsed, CATEGORIES } from "../db";

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

export default function BatchDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { batchName, itemTypeId, fillDate } = route.params;

  const [jars, setJars] = React.useState<JarWithDetails[]>([]);
  const [itemType, setItemType] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  const loadData = React.useCallback(async () => {
    try {
      const db = await getDb();

      // Get item type details
      const itemTypeData = await db.getFirstAsync<any>(
        "SELECT * FROM item_types WHERE id = ?",
        itemTypeId
      );
      setItemType(itemTypeData);

      // Get jars for this specific batch (same item type and fill date)
      const fillDateStart = fillDate + "T00:00:00.000Z";
      const fillDateEnd = fillDate + "T23:59:59.999Z";

      const batchJars = await db.getAllAsync<JarWithDetails>(
        `SELECT * FROM jars 
         WHERE itemTypeId = ? AND fillDateISO >= ? AND fillDateISO <= ?
         ORDER BY id ASC`,
        itemTypeId,
        fillDateStart,
        fillDateEnd
      );

      setJars(batchJars);
    } catch (error) {
      console.error("Error loading batch data:", error);
      Alert.alert("Error", "Failed to load batch data");
    } finally {
      setLoading(false);
    }
  }, [itemTypeId, fillDate]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

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
              await markJarUsed(jarId);
              await loadData();
            } catch (error) {
              Alert.alert("Error", "Failed to mark jar as used");
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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{batchName}</Text>
          {itemType?.category && (
            <View style={styles.categoryContainer}>
              <Text style={styles.categoryIcon}>
                {getCategoryIcon(itemType.category)}
              </Text>
              <Text style={styles.categoryText}>
                {getCategoryName(itemType.category)}
              </Text>
            </View>
          )}
          <Text style={styles.subtitle}>
            Filled: {new Date(fillDate).toLocaleDateString()}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{jars.length}</Text>
          <Text style={styles.statLabel}>Total Jars</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: "#2e7d32" }]}>
            {availableJars.length}
          </Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: "#d32f2f" }]}>
            {usedJars.length}
          </Text>
          <Text style={styles.statLabel}>Used</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleGenerateLabels}
        >
          <Ionicons name="qr-code-outline" size={20} color="white" />
          <Text style={styles.actionButtonText}>Generate All Labels</Text>
        </TouchableOpacity>
      </View>

      {/* Jar List */}
      <FlatList
        data={jars}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <View style={[styles.jarCard, item.used && styles.jarCardUsed]}>
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

            <View style={styles.jarDetails}>
              {item.jarSize && (
                <View style={styles.detailRow}>
                  <Ionicons name="resize-outline" size={16} color="#666" />
                  <Text style={styles.detailText}>Size: {item.jarSize}</Text>
                </View>
              )}

              {item.location && (
                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={16} color="#666" />
                  <Text style={styles.detailText}>
                    Location: {item.location}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.jarActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() =>
                  navigation.navigate("QRLabel", { jarId: item.id })
                }
              >
                <Ionicons name="qr-code-outline" size={16} color="white" />
                <Text style={styles.actionBtnText}>Label</Text>
              </TouchableOpacity>

              {!item.used && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.markUsedBtn]}
                  onPress={() => handleMarkUsed(item.id)}
                >
                  <Ionicons name="checkmark-outline" size={16} color="white" />
                  <Text style={styles.actionBtnText}>Mark Used</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No jars in this batch</Text>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  categoryContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
  },
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "white",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  actionsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  actionButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
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
});
