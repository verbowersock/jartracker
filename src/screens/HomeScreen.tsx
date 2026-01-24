import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { FontAwesome6, Ionicons } from "@expo/vector-icons";
import {
  getAllBatches,
  getJarStats,
  getAllCategories,
  type CustomCategory,
  getDb,
  formatDateStringWithUserPreference,
  CATEGORIES,
  getRunningLowItems,
  resetDb,
} from "../db";
import { theme } from "../theme";
import type { RootStackParamList } from "../App";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

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
  batchId: string;
  formattedFillDate?: string;
};

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [batches, setBatches] = React.useState<Batch[]>([]);
  const [stats, setStats] = React.useState({ total: 0, available: 0, used: 0 });
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] =
    React.useState<CategoryFilter>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortByDate, setSortByDate] = React.useState<"asc" | "desc">("desc");
  const [categories, setCategories] = React.useState<CustomCategory[]>([]);
  const [isInitializing, setIsInitializing] = React.useState(true);
  const [runningLowItems, setRunningLowItems] = React.useState<
    Array<{
      id: number;
      name: string;
      category?: string;
      available: number;
      threshold: number;
      categoryIcon?: string;
    }>
  >([]);

  const loadData = async () => {
    try {
      // Ensure DB is initialized first (this includes seeding)
      await getDb();

      const [batchData, statsData, categoriesData, lowStockData] =
        await Promise.all([
          getAllBatches(),
          getJarStats(),
          getAllCategories(),
          getRunningLowItems(),
        ]);

      // Format dates for each batch
      const batchesWithFormattedDates = await Promise.all(
        batchData.map(async (batch) => ({
          ...batch,
          formattedFillDate: await formatDateStringWithUserPreference(
            batch.fillDate,
          ),
        })),
      );

      setBatches(batchesWithFormattedDates);
      setStats(statsData);
      setCategories(categoriesData);
      setRunningLowItems(lowStockData);
    } catch (error) {
      console.error("Error loading data:", error);

      // If it's a database connection error, reset and try once more
      if (
        error?.message?.includes("shared object that was already released") ||
        error?.message?.includes("database is closed")
      ) {
        // console.log("Resetting database connection and retrying...");
        resetDb();
        try {
          // Try one more time with fresh connection
          const [batchData, statsData, categoriesData, lowStockData] =
            await Promise.all([
              getAllBatches(),
              getJarStats(),
              getAllCategories(),
              getRunningLowItems(),
            ]);

          // Format dates for each batch
          const batchesWithFormattedDates = await Promise.all(
            batchData.map(async (batch) => ({
              ...batch,
              formattedFillDate: await formatDateStringWithUserPreference(
                batch.fillDate,
              ),
            })),
          );

          setBatches(batchesWithFormattedDates);
          setStats(statsData);
          setCategories(categoriesData);
          setRunningLowItems(lowStockData);
        } catch (retryError) {
          console.error("Error loading data on retry:", retryError);
        }
      }
    } finally {
      setIsInitializing(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, []),
  );

  const filteredBatches = batches
    .filter((batch) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = batch.name.toLowerCase().includes(query);
        const matchesNotes =
          batch.notes?.toLowerCase().includes(query) || false;
        const matchesLocation =
          batch.location?.toLowerCase().includes(query) || false;

        if (!matchesName && !matchesNotes && !matchesLocation) {
          return false;
        }
      }

      // Status filter
      if (statusFilter === "available" && batch.availableJars === 0)
        return false;
      if (statusFilter === "used" && batch.usedJars === 0) return false;

      // Category filter
      if (categoryFilter !== "all" && batch.category !== categoryFilter)
        return false;

      return true;
    })
    .sort((a, b) => {
      // Sort by date
      const dateA = new Date(a.fillDate).getTime();
      const dateB = new Date(b.fillDate).getTime();

      if (sortByDate === "asc") {
        return dateA - dateB;
      } else {
        return dateB - dateA;
      }
    });

  const getCategoryIcon = (categoryId: string) => {
    const category = categories.find((c) => c.name === categoryId);
    return category?.icon ?? "📦";
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c) => c.name === categoryId);
    return category?.name ?? "Other";
  };

  const getCategoryColor = (categoryName: string): string => {
    // Find the category ID from the name
    const category = CATEGORIES.find((c) => c.name === categoryName);
    const categoryId = category?.id || "other";

    return (
      theme.categoryColors[categoryId as keyof typeof theme.categoryColors] ??
      theme.categoryColors.other
    );
  };

  // Check if an item type is running low
  const isItemRunningLow = (itemTypeId: number): boolean => {
    return runningLowItems.some((item) => item.id === itemTypeId);
  };

  const renderBatchCard = ({ item }: { item: Batch }) => {
    const isRunningLow = isItemRunningLow(item.id);

    return (
      <TouchableOpacity
        style={[styles.batchCard, isRunningLow && styles.batchCardLowStock]}
        onPress={() => {
          // Navigate to the dedicated BatchDetailScreen
          navigation.navigate("BatchDetail", {
            batchName: item.name,
            itemTypeId: item.id,
            fillDate: item.fillDate,
            batchId: item.batchId,
          });
        }}
      >
        {isRunningLow && (
          <View style={styles.lowStockBadge}>
            <Ionicons name="warning" size={14} color="#fff" />
            <Text style={styles.lowStockBadgeText}>Running Low</Text>
          </View>
        )}

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
            <FontAwesome6 name="jar" size={16} color="#666" />
            <Text style={styles.detailText}>Size: {item.jarSize}</Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={16} color="#666" />
            <Text style={styles.detailText}>
              Canned: {item.formattedFillDate || item.fillDate}
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
  };

  // Show loading spinner while initializing database
  if (isInitializing) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading pantry...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.colors.background}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Pantry Dashboard</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate("AddBatch")}
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Stats Cards (now clickable filters) */}
        <View style={styles.statsContainer}>
          <TouchableOpacity
            style={[
              styles.statCard,
              statusFilter === "all" && styles.statCardActive,
            ]}
            onPress={() => setStatusFilter("all")}
          >
            <Text
              style={[
                styles.statNumber,
                statusFilter === "all" && styles.statNumberActive,
              ]}
            >
              {stats.total}
            </Text>
            <Text
              style={[
                styles.statLabel,
                statusFilter === "all" && styles.statLabelActive,
              ]}
            >
              Total Jars
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statCard,
              statusFilter === "available" && styles.statCardActive,
            ]}
            onPress={() => setStatusFilter("available")}
          >
            <Text
              style={[
                styles.statNumber,
                { color: "#2e7d32" },
                statusFilter === "available" && styles.statNumberActive,
              ]}
            >
              {stats.available}
            </Text>
            <Text
              style={[
                styles.statLabel,
                statusFilter === "available" && styles.statLabelActive,
              ]}
            >
              Available
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statCard,
              statusFilter === "used" && styles.statCardActive,
            ]}
            onPress={() => setStatusFilter("used")}
          >
            <Text
              style={[
                styles.statNumber,
                { color: "#d32f2f" },
                statusFilter === "used" && styles.statNumberActive,
              ]}
            >
              {stats.used}
            </Text>
            <Text
              style={[
                styles.statLabel,
                statusFilter === "used" && styles.statLabelActive,
              ]}
            >
              Used
            </Text>
          </TouchableOpacity>
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

            {categories.map((category) => (
              <TouchableOpacity
                key={category.id || category.name}
                style={[
                  styles.categoryButton,
                  categoryFilter === category.name &&
                    styles.categoryButtonActive,
                ]}
                onPress={() => setCategoryFilter(category.name)}
              >
                <Text style={styles.categoryIcon}>{category.icon}</Text>
                <Text
                  style={[
                    styles.categoryButtonText,
                    categoryFilter === category.name &&
                      styles.categoryButtonTextActive,
                  ]}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Ionicons
              name="search"
              size={20}
              color={theme.colors.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search batch names, notes, or loca..."
              placeholderTextColor={theme.colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setSearchQuery("")}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => setSortByDate(sortByDate === "asc" ? "desc" : "asc")}
          >
            <Ionicons
              name={sortByDate === "asc" ? "calendar-outline" : "calendar"}
              size={28}
              color={theme.colors.primary}
            />
            <Ionicons
              name={sortByDate === "asc" ? "arrow-up" : "arrow-down"}
              size={22}
              color={theme.colors.primary}
              style={styles.sortArrow}
            />
          </TouchableOpacity>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  loadingText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  header: {
    ...theme.typography.headerContainer,
  },
  headerTitle: {
    ...theme.typography.headingTitle,
    paddingVertical: theme.spacing.xl,
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.round,
    justifyContent: "center",
    alignItems: "center",
  },
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statCardActive: {
    backgroundColor: theme.colors.primary,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    borderColor: theme.colors.primaryDark,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  statNumber: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  statNumberActive: {
    color: theme.colors.surface,
  },
  statLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  statLabelActive: {
    color: theme.colors.surface,
  },
  filterSection: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
  },
  filterTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  categoryButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  categoryButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceSecondary,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    borderWidth: 0.5,
    borderColor: theme.colors.primary,
  },
  categoryButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primaryDark,
  },
  categoryIcon: {
    fontSize: theme.fontSize.md,
  },
  categoryButtonText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium,
  },
  categoryButtonTextActive: {
    color: theme.colors.surface,
  },
  batchesSection: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
  },
  batchesTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.xs,
  },
  sortArrow: {
    marginLeft: 2,
    marginTop: -1,
  },
  batchCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadow.small,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    position: "relative",
  },
  batchCardLowStock: {
    borderColor: theme.colors.accent,
    borderWidth: 2,
    backgroundColor: "#fcf4f2",
  },
  lowStockBadge: {
    position: "absolute",
    bottom: theme.spacing.xs,
    right: theme.spacing.xs,
    backgroundColor: theme.colors.accent,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    zIndex: 1,
    gap: theme.spacing.xs,
  },
  lowStockBadgeText: {
    color: "#fff",
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: theme.spacing.md,
  },
  batchName: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    flex: 1,
    marginRight: theme.spacing.md,
  },
  categoryChip: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.lg,
  },
  categoryChipText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },
  cardDetails: {
    gap: theme.spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  detailText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  jarStats: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  jarStatsText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: theme.spacing.xxxl + theme.spacing.sm,
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textLight,
    marginTop: theme.spacing.md,
    fontWeight: theme.fontWeight.medium,
  },
  emptySubtext: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
    marginTop: theme.spacing.xs,
    textAlign: "center",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: theme.spacing.xl,
    marginVertical: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    paddingVertical: theme.spacing.xs,
  },
  clearButton: {
    marginLeft: theme.spacing.sm,
    padding: theme.spacing.xs,
  },
});
