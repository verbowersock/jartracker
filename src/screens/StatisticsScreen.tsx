import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { getDb, getAllCategories, type CustomCategory } from "../db";
import { theme } from "../theme";
import { SafeAreaView } from "react-native-safe-area-context";

type YearlyStats = {
  year: number;
  totalCanned: number;
  totalUsed: number;
};

type CategoryStats = {
  category: string;
  categoryName: string;
  totalCanned: number;
  totalUsed: number;
  sizeCounts?: { [jarSize: string]: number };
};

type ItemTypeStats = {
  id: number;
  name: string;
  category: string;
  totalCanned: number;
  totalUsed: number;
  sizeCounts?: { [jarSize: string]: number };
};

type MonthlyStats = {
  month: number;
  year: number;
  canned: number;
  used: number;
};

const getCategoryIcon = (categoryId: string, categories: CustomCategory[]) => {
  const category = categories.find((c) => c.name === categoryId);
  return category?.icon ?? "📦";
};

const getCategoryName = (categoryId: string, categories: CustomCategory[]) => {
  const category = categories.find((c) => c.name === categoryId);
  return category?.name ?? "Other";
};

const formatJarSizes = (
  sizeCounts?: { [jarSize: string]: number },
  detailed: boolean = false
) => {
  if (!sizeCounts || Object.keys(sizeCounts).length === 0) {
    return null;
  }

  const sortedSizes = Object.entries(sizeCounts).sort(([, a], [, b]) => b - a); // Sort by count, descending

  if (!detailed) {
    // Compact view - just show if there are sizes
    const totalJars = sortedSizes.reduce((sum, [, count]) => sum + count, 0);
    return `${totalJars} jars`;
  }

  // Detailed view when revealed
  return sortedSizes
    .map(([size, count]) => {
      const cleanSize = size === "Unknown" ? "Unknown size" : size;
      return `${cleanSize}: ${count}`;
    })
    .join("\n");
};

export default function StatisticsScreen() {
  const [yearlyStats, setYearlyStats] = React.useState<YearlyStats[]>([]);
  const [categoryStats, setCategoryStats] = React.useState<CategoryStats[]>([]);
  const [cannedCategoryStats, setCannedCategoryStats] = React.useState<
    CategoryStats[]
  >([]);
  const [usedCategoryStats, setUsedCategoryStats] = React.useState<
    CategoryStats[]
  >([]);
  const [itemTypeStats, setItemTypeStats] = React.useState<ItemTypeStats[]>([]);
  const [categories, setCategories] = React.useState<CustomCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = React.useState<
    Set<string>
  >(new Set());
  const [expandedItemTypes, setExpandedItemTypes] = React.useState<Set<number>>(
    new Set()
  );
  const [monthlyStats, setMonthlyStats] = React.useState<MonthlyStats[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [selectedYear, setSelectedYear] = React.useState(
    new Date().getFullYear()
  );

  const loadStatistics = React.useCallback(async () => {
    try {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // Load yearly statistics - get all years from both canning and usage
      const yearlyData = await db.getAllAsync<YearlyStats>(`
        SELECT 
          year,
          SUM(totalCanned) as totalCanned,
          SUM(totalUsed) as totalUsed
        FROM (
          SELECT 
            CAST(strftime('%Y', j.fillDateISO) as INTEGER) as year,
            COUNT(*) as totalCanned,
            0 as totalUsed
          FROM jars j
          GROUP BY strftime('%Y', j.fillDateISO)
          
          UNION ALL
          
          SELECT 
            CAST(strftime('%Y', j.usedDateISO) as INTEGER) as year,
            0 as totalCanned,
            COUNT(*) as totalUsed
          FROM jars j
          WHERE j.used = 1 AND j.usedDateISO IS NOT NULL
          GROUP BY strftime('%Y', j.usedDateISO)
        ) combined
        GROUP BY year
        ORDER BY year DESC
      `);

      console.log("Raw yearly data from DB:", yearlyData);

      // Ensure current year is always available for selection even with no data
      const currentYear = new Date().getFullYear();
      const hasCurrentYear = yearlyData.some(
        (stat) => stat.year === currentYear
      );

      if (!hasCurrentYear) {
        yearlyData.unshift({
          year: currentYear,
          totalCanned: 0,
          totalUsed: 0,
        });
      }

      console.log("Final yearly data:", yearlyData);
      setYearlyStats(yearlyData);

      // Load categories
      const categoriesData = await getAllCategories();
      setCategories(categoriesData);

      // Load category statistics - separate for canned and used
      const cannedCategoryData = await db.getAllAsync<CategoryStats>(
        `
        SELECT 
          COALESCE(it.category, 'other') as category,
          COUNT(j.id) as totalCanned,
          0 as totalUsed
        FROM jars j
        LEFT JOIN item_types it ON j.itemTypeId = it.id
        WHERE strftime('%Y', j.fillDateISO) = ?
        GROUP BY it.category
        ORDER BY totalCanned DESC
      `,
        [selectedYear.toString()]
      );

      const usedCategoryData = await db.getAllAsync<CategoryStats>(
        `
        SELECT 
          COALESCE(it.category, 'other') as category,
          0 as totalCanned,
          COUNT(j.id) as totalUsed
        FROM jars j
        LEFT JOIN item_types it ON j.itemTypeId = it.id
        WHERE j.used = 1 AND strftime('%Y', j.usedDateISO) = ?
        GROUP BY it.category
        ORDER BY totalUsed DESC
      `,
        [selectedYear.toString()]
      );

      const cannedStatsWithNames = cannedCategoryData.map((stat) => ({
        ...stat,
        categoryName: getCategoryName(stat.category, categoriesData),
      }));

      const usedStatsWithNames = usedCategoryData.map((stat) => ({
        ...stat,
        categoryName: getCategoryName(stat.category, categoriesData),
      }));

      // Load jar size breakdown for canned categories
      for (const category of cannedStatsWithNames) {
        const sizeData = await db.getAllAsync<{
          jarSize: string;
          count: number;
        }>(
          `
          SELECT 
            COALESCE(j.jarSize, 'Unknown') as jarSize,
            COUNT(*) as count
          FROM jars j
          LEFT JOIN item_types it ON j.itemTypeId = it.id
          WHERE COALESCE(it.category, 'other') = ? AND strftime('%Y', j.fillDateISO) = ?
          GROUP BY j.jarSize
          ORDER BY count DESC
        `,
          [category.category, selectedYear.toString()]
        );

        category.sizeCounts = {};
        sizeData.forEach((row) => {
          category.sizeCounts![row.jarSize] = row.count;
        });
      }

      // Load jar size breakdown for used categories
      for (const category of usedStatsWithNames) {
        const sizeData = await db.getAllAsync<{
          jarSize: string;
          count: number;
        }>(
          `
          SELECT 
            COALESCE(j.jarSize, 'Unknown') as jarSize,
            COUNT(*) as count
          FROM jars j
          LEFT JOIN item_types it ON j.itemTypeId = it.id
          WHERE COALESCE(it.category, 'other') = ? 
            AND j.used = 1 
            AND strftime('%Y', j.usedDateISO) = ?
          GROUP BY j.jarSize
          ORDER BY count DESC
        `,
          [category.category, selectedYear.toString()]
        );

        category.sizeCounts = {};
        sizeData.forEach((row) => {
          category.sizeCounts![row.jarSize] = row.count;
        });
      }

      // Store both canned and used category stats separately
      setCannedCategoryStats(cannedStatsWithNames);
      setUsedCategoryStats(usedStatsWithNames);
      setCategoryStats([...cannedStatsWithNames, ...usedStatsWithNames]);

      // Load item type statistics for selected year
      const itemTypeData = await db.getAllAsync<ItemTypeStats>(
        `
        SELECT 
          it.id,
          it.name,
          COALESCE(it.category, 'other') as category,
          COALESCE(canned.totalCanned, 0) as totalCanned,
          COALESCE(used.totalUsed, 0) as totalUsed
        FROM item_types it
        LEFT JOIN (
          SELECT 
            j.itemTypeId,
            COUNT(*) as totalCanned
          FROM jars j
          WHERE strftime('%Y', j.fillDateISO) = ?
          GROUP BY j.itemTypeId
        ) canned ON canned.itemTypeId = it.id
        LEFT JOIN (
          SELECT 
            j.itemTypeId,
            COUNT(*) as totalUsed
          FROM jars j
          WHERE j.used = 1 AND strftime('%Y', j.usedDateISO) = ?
          GROUP BY j.itemTypeId
        ) used ON used.itemTypeId = it.id
        WHERE COALESCE(canned.totalCanned, 0) > 0 OR COALESCE(used.totalUsed, 0) > 0
        ORDER BY COALESCE(canned.totalCanned, 0) + COALESCE(used.totalUsed, 0) DESC
      `,
        [selectedYear.toString(), selectedYear.toString()]
      );

      // Load jar size breakdown for each item type - both canned and used
      for (const itemType of itemTypeData) {
        // Get sizes for items canned in this year
        const cannedSizeData = await db.getAllAsync<{
          jarSize: string;
          count: number;
        }>(
          `
          SELECT 
            COALESCE(j.jarSize, 'Unknown') as jarSize,
            COUNT(*) as count
          FROM jars j
          WHERE j.itemTypeId = ? AND strftime('%Y', j.fillDateISO) = ?
          GROUP BY j.jarSize
          ORDER BY count DESC
        `,
          [itemType.id, selectedYear.toString()]
        );

        // Get sizes for items used in this year
        const usedSizeData = await db.getAllAsync<{
          jarSize: string;
          count: number;
        }>(
          `
          SELECT 
            COALESCE(j.jarSize, 'Unknown') as jarSize,
            COUNT(*) as count
          FROM jars j
          WHERE j.itemTypeId = ? AND j.used = 1 AND strftime('%Y', j.usedDateISO) = ?
          GROUP BY j.jarSize
          ORDER BY count DESC
        `,
          [itemType.id, selectedYear.toString()]
        );

        // Combine size data from both canned and used
        itemType.sizeCounts = {};
        cannedSizeData.forEach((row) => {
          itemType.sizeCounts![row.jarSize] =
            (itemType.sizeCounts![row.jarSize] || 0) + row.count;
        });
        usedSizeData.forEach((row) => {
          itemType.sizeCounts![row.jarSize] =
            (itemType.sizeCounts![row.jarSize] || 0) + row.count;
        });
      }

      setItemTypeStats(itemTypeData);

      // Load monthly statistics for selected year - track usage by month
      const monthlyData = await db.getAllAsync<MonthlyStats>(
        `
        SELECT 
          CAST(strftime('%m', j.usedDateISO) as INTEGER) as month,
          CAST(strftime('%Y', j.usedDateISO) as INTEGER) as year,
          0 as canned,
          COUNT(*) as used
        FROM jars j
        WHERE j.used = 1 
          AND j.usedDateISO IS NOT NULL 
          AND strftime('%Y', j.usedDateISO) = ?
        GROUP BY strftime('%Y-%m', j.usedDateISO)
        ORDER BY month
      `,
        [selectedYear.toString()]
      );
      setMonthlyStats(monthlyData);
    } catch (error) {
      console.error("Error loading statistics:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  React.useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  // Refresh statistics when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadStatistics();
    }, [loadStatistics])
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadStatistics();
    setRefreshing(false);
  }, [loadStatistics]);

  const currentYearStats = yearlyStats.find(
    (stat) => stat.year === selectedYear
  );

  const toggleCategory = async (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleItemType = async (itemTypeId: number) => {
    setExpandedItemTypes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemTypeId)) {
        newSet.delete(itemTypeId);
      } else {
        newSet.add(itemTypeId);
      }
      return newSet;
    });
  };

  const getItemTypesForCategory = (category: string) => {
    return itemTypeStats.filter((item) => item.category === category);
  };

  const getMonthName = (month: number) => {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return months[month - 1];
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text>Loading statistics...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Year Selector */}
        <View style={styles.section}>
          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>Year Overview</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.yearSelector}>
              {yearlyStats
                .sort((a, b) => b.year - a.year) // Ensure proper sorting with current year first
                .map((yearStat, index) => (
                  <TouchableOpacity
                    key={`selector-${yearStat.year}-${index}`}
                    style={[
                      styles.yearButton,
                      selectedYear === yearStat.year && styles.yearButtonActive,
                    ]}
                    onPress={() => setSelectedYear(yearStat.year)}
                  >
                    <Text
                      style={[
                        styles.yearButtonText,
                        selectedYear === yearStat.year &&
                          styles.yearButtonTextActive,
                      ]}
                    >
                      {yearStat.year}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>
          </ScrollView>
        </View>

        {/* Key Metrics */}
        {currentYearStats && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{selectedYear} Summary</Text>
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Ionicons name="add-circle" size={24} color="#2e7d32" />
                <Text style={styles.metricNumber}>
                  {currentYearStats.totalCanned}
                </Text>
                <Text style={styles.metricLabel}>Jars Canned</Text>
              </View>
              <View style={styles.metricCard}>
                <Ionicons name="checkmark-circle" size={24} color="#d32f2f" />
                <Text style={styles.metricNumber}>
                  {currentYearStats.totalUsed}
                </Text>
                <Text style={styles.metricLabel}>Jars Used</Text>
              </View>
            </View>
          </View>
        )}

        {/* Canned in Year */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Canned in {selectedYear}</Text>
          {cannedCategoryStats.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No records of jars canned this year
              </Text>
            </View>
          ) : (
            cannedCategoryStats.map((category) => {
              const isExpanded = expandedCategories.has(
                `canned-${category.category}`
              );
              const itemTypes = getItemTypesForCategory(category.category);

              return (
                <View key={`canned-${category.category}`}>
                  <TouchableOpacity
                    style={styles.categoryRow}
                    onPress={() =>
                      toggleCategory(`canned-${category.category}`)
                    }
                  >
                    <Ionicons
                      name={
                        isExpanded
                          ? "chevron-up-outline"
                          : "chevron-down-outline"
                      }
                      size={16}
                      color={theme.colors.textSecondary}
                      style={styles.expandIcon}
                    />
                    <View style={styles.categoryInfo}>
                      <Text style={styles.categoryIcon}>
                        {getCategoryIcon(category.category, categories)}
                      </Text>
                      <Text style={styles.categoryName}>
                        {category.categoryName || category.category}
                      </Text>
                    </View>
                    <View style={styles.categoryStats}>
                      <View style={styles.categoryStat}>
                        <Text style={styles.categoryStatNumber}>
                          {category.totalCanned}
                        </Text>
                        <Text style={styles.categoryStatLabel}>canned</Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.expandedContent}>
                      {itemTypes.map((itemType) => (
                        <React.Fragment key={itemType.id}>
                          <View
                            style={styles.itemTypeRow}
                            // onPress={() => toggleItemType(itemType.id)}
                          >
                            {/* <Ionicons
                              name={
                                expandedItemTypes.has(itemType.id)
                                  ? "chevron-up-outline"
                                  : "chevron-down-outline"
                              }
                              size={14}
                              color={theme.colors.textSecondary}
                              style={styles.expandIcon}
                            /> */}
                            <View style={styles.itemTypeInfo}>
                              <Text style={styles.itemTypeName}>
                                {itemType.name}
                              </Text>
                            </View>
                            {/* <View style={styles.itemTypeStats}>
                              <View style={styles.itemTypeStat}>
                                <Text style={styles.itemTypeStatNumber}>
                                  {itemType.totalCanned}
                                </Text>
                                <Text style={styles.itemTypeStatLabel}>
                                  canned
                                </Text>
                              </View>
                              <View style={styles.itemTypeStat}>
                                <Text style={styles.itemTypeStatNumber}>
                                  {itemType.totalUsed}
                                </Text>
                                <Text style={styles.itemTypeStatLabel}>
                                  used
                                </Text>
                              </View>
                            </View> */}
                            {itemType.sizeCounts && (
                              <View style={styles.itemSizeContainer}>
                                <Text style={styles.itemSizeText}>
                                  {formatJarSizes(itemType.sizeCounts, true) ||
                                    "No size data"}
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* Item Type Jar Size Totals
                          {expandedItemTypes.has(itemType.id) &&
                            itemType.sizeCounts && (
                              <View style={styles.itemSizeContainer}>
                                <Text style={styles.itemSizeText}>
                                  {formatJarSizes(itemType.sizeCounts, true) ||
                                    "No size data"}
                                </Text>
                              </View>
                            )} */}
                        </React.Fragment>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Used in Year */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Used in {selectedYear}</Text>
          {usedCategoryStats.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No records of jars used this year
              </Text>
            </View>
          ) : (
            usedCategoryStats.map((category) => {
              const isExpanded = expandedCategories.has(
                `used-${category.category}`
              );
              const itemTypes = getItemTypesForCategory(category.category);

              return (
                <View key={`used-${category.category}`}>
                  <TouchableOpacity
                    style={styles.categoryRow}
                    onPress={() => toggleCategory(`used-${category.category}`)}
                  >
                    <Ionicons
                      name={
                        isExpanded
                          ? "chevron-up-outline"
                          : "chevron-down-outline"
                      }
                      size={16}
                      color={theme.colors.textSecondary}
                      style={styles.expandIcon}
                    />
                    <View style={styles.categoryInfo}>
                      <Text style={styles.categoryIcon}>
                        {getCategoryIcon(category.category, categories)}
                      </Text>
                      <Text style={styles.categoryName}>
                        {category.categoryName || category.category}
                      </Text>
                    </View>
                    <View style={styles.categoryStats}>
                      <View style={styles.categoryStat}>
                        <Text style={styles.categoryStatNumber}>
                          {category.totalUsed}
                        </Text>
                        <Text style={styles.categoryStatLabel}>used</Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.expandedContent}>
                      {itemTypes.map((itemType) => (
                        <React.Fragment key={itemType.id}>
                          <View
                            style={styles.itemTypeRow}
                            // onPress={() => toggleItemType(itemType.id)}
                          >
                            {/* <Ionicons
                              name={
                                expandedItemTypes.has(itemType.id)
                                  ? "chevron-up-outline"
                                  : "chevron-down-outline"
                              }
                              size={14}
                              color={theme.colors.textSecondary}
                              style={styles.expandIcon}
                            /> */}
                            <View style={styles.itemTypeInfo}>
                              <Text style={styles.itemTypeName}>
                                {itemType.name}
                              </Text>
                            </View>
                            {/* <View style={styles.itemTypeStats}>
                              <View style={styles.itemTypeStat}>
                                <Text style={styles.itemTypeStatNumber}>
                                  {itemType.totalCanned}
                                </Text>
                                <Text style={styles.itemTypeStatLabel}>
                                  canned
                                </Text>
                              </View>
                              <View style={styles.itemTypeStat}>
                                <Text style={styles.itemTypeStatNumber}>
                                  {itemType.totalUsed}
                                </Text>
                                <Text style={styles.itemTypeStatLabel}>
                                  used
                                </Text>
                              </View>
                            </View> */}
                            {itemType.sizeCounts && (
                              <View style={styles.itemSizeContainer}>
                                <Text style={styles.itemSizeText}>
                                  {formatJarSizes(itemType.sizeCounts, true) ||
                                    "No size data"}
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* Item Type Jar Size Totals */}
                          {/* {expandedItemTypes.has(itemType.id) &&
                            itemType.sizeCounts && (
                              <View style={styles.itemSizeContainer}>
                                <Text style={styles.itemSizeText}>
                                  {formatJarSizes(itemType.sizeCounts, true) ||
                                    "No size data"}
                                </Text>
                              </View>
                            )} */}
                        </React.Fragment>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Yearly Comparison */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yearly Comparison</Text>
          {yearlyStats.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No stats to show</Text>
            </View>
          ) : (
            yearlyStats.map((year, index) => {
              return (
                <View
                  key={`comparison-${year.year}-${index}`}
                  style={styles.yearComparisonRow}
                >
                  <Text style={styles.yearComparisonYear}>{year.year}</Text>
                  <View style={styles.yearComparisonStats}>
                    <Text style={styles.yearComparisonStat}>
                      {year.totalCanned} canned
                    </Text>
                    <Text style={styles.yearComparisonStat}>
                      {year.totalUsed} used
                    </Text>
                  </View>
                </View>
              );
            })
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
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  headerContainer: {
    ...theme.typography.headerContainer,
    paddingHorizontal: 0,
  },
  headerTitle: {
    ...theme.typography.headingTitle,
    paddingVertical: theme.spacing.xl,
  },
  section: {
    marginVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  yearSelector: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  yearButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  yearButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  yearButtonText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium,
  },
  yearButtonTextActive: {
    color: theme.colors.surface,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  metricCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  metricNumber: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
  },
  metricLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,

    borderWidth: 1,
    borderColor: theme.colors.border,
    // backgroundColor: theme.colors.primary,
  },
  categoryInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  categoryTextContainer: {
    flex: 1,
  },
  categoryIcon: {
    fontSize: theme.fontSize.lg,
    marginRight: theme.spacing.md,
  },
  categoryName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    flex: 1,
  },
  categorySizes: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
    fontWeight: theme.fontWeight.normal,
  },
  expandIcon: {
    marginLeft: theme.spacing.sm,
    marginRight: theme.spacing.md,
    alignSelf: "center",
  },
  categoryStats: {
    flexDirection: "row",
    gap: theme.spacing.lg,
  },
  categoryStat: {
    alignItems: "center",
  },
  categoryStatNumber: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  categoryStatLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  monthlyChart: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 120,
    paddingHorizontal: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  monthColumn: {
    alignItems: "center",
    flex: 1,
  },
  monthBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 80,
    gap: 2,
  },
  monthBar: {
    width: 8,
    borderRadius: 4,
    minHeight: 2,
  },
  cannedBar: {
    backgroundColor: "#2e7d32",
  },
  usedBar: {
    backgroundColor: "#d32f2f",
  },
  monthLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  monthValue: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
  },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: theme.spacing.lg,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  yearComparisonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  yearComparisonYear: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  yearComparisonStats: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  yearComparisonStat: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  itemTypesContainer: {
    backgroundColor: theme.colors.surface,
    marginLeft: theme.spacing.lg,
    marginRight: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.sm,
  },
  itemTypeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    // backgroundColor: theme.colors.accent,
    // borderBottomWidth: 1,
    // borderBottomColor: theme.colors.border,
  },
  itemTypeNameContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  itemTypeName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    flex: 1,
  },
  itemTypeSizes: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
    fontWeight: theme.fontWeight.normal,
  },
  itemTypeStats: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  itemTypeStat: {
    alignItems: "center",
  },
  itemTypeStatNumber: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  itemTypeStatLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    paddingVertical: theme.spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  sizeIcon: {
    marginLeft: theme.spacing.sm,
  },
  jarListContainer: {
    backgroundColor: "#f8f9fa",
    marginLeft: theme.spacing.lg,
    marginRight: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  jarListTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  jarRow: {
    backgroundColor: "white",
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.xs,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  jarMainInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.xs,
  },
  jarItemName: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    flex: 1,
  },
  jarSize: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium,
  },
  jarDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  jarDate: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  jarStatus: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  jarUsed: {
    backgroundColor: "#fee",
  },
  jarAvailable: {
    backgroundColor: "#efe",
  },
  jarStatusText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
  },
  jarUsedText: {
    color: "#d32f2f",
  },
  jarAvailableText: {
    color: "#2e7d32",
  },
  jarLocation: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  emptyJarList: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontStyle: "italic",
    textAlign: "center",
    padding: theme.spacing.md,
  },
  itemJarListContainer: {
    backgroundColor: "#f8f9fa",
    marginLeft: theme.spacing.lg,
    marginRight: theme.spacing.lg,
    marginBottom: theme.spacing.xs,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  itemJarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  itemJarInfo: {
    flex: 1,
  },
  itemJarSize: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
  },
  itemJarDate: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  emptyItemJarList: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    fontStyle: "italic",
  },
  sizeBreakdownContainer: {
    backgroundColor: "#f5f5f5",
    marginLeft: theme.spacing.lg,
    marginRight: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  sizeBreakdownTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  sizeBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  sizeBreakdownSize: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    flex: 1,
  },
  sizeBreakdownCount: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium,
  },
  sizeBreakdownEmpty: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontStyle: "italic",
  },
  itemTypeSizeDetails: {
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  itemSizeContainer: {
    //backgroundColor: "#e2562bff",
    // marginLeft: theme.spacing.lg,
    // marginRight: theme.spacing.lg,
    // marginVertical: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    // padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  itemSizeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  itemSizeText: {
    fontSize: theme.fontSize.sm,
    lineHeight: 30,
    color: theme.colors.text,
    marginVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
  },
  emptyItemSizeList: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontStyle: "italic",
  },
  expandedContent: {
    backgroundColor: "white",
  },
  itemTypeInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
});
