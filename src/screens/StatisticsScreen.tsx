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
import { getDb, CATEGORIES } from "../db";
import { theme } from "../theme";

type YearlyStats = {
  year: number;
  totalCanned: number;
  totalUsed: number;
  available: number;
};

type CategoryStats = {
  category: string;
  categoryName: string;
  totalCanned: number;
  totalUsed: number;
  available: number;
};

type ItemTypeStats = {
  id: number;
  name: string;
  category: string;
  totalCanned: number;
  totalUsed: number;
  available: number;
};

type MonthlyStats = {
  month: number;
  year: number;
  canned: number;
  used: number;
};

const getCategoryIcon = (categoryId: string) => {
  const category = CATEGORIES.find((c) => c.id === categoryId);
  return category?.icon ?? "📦";
};

const getCategoryName = (categoryId: string) => {
  const category = CATEGORIES.find((c) => c.id === categoryId);
  return category?.name ?? "Other";
};

const getCategoryColor = (categoryId: string) => {
  return (
    theme.categoryColors[categoryId as keyof typeof theme.categoryColors] ??
    theme.categoryColors.other
  );
};

export default function StatisticsScreen() {
  const [yearlyStats, setYearlyStats] = React.useState<YearlyStats[]>([]);
  const [categoryStats, setCategoryStats] = React.useState<CategoryStats[]>([]);
  const [itemTypeStats, setItemTypeStats] = React.useState<ItemTypeStats[]>([]);
  const [expandedCategories, setExpandedCategories] = React.useState<
    Set<string>
  >(new Set());
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

      // Load yearly statistics
      const yearlyData = await db.getAllAsync<YearlyStats>(`
        SELECT 
          strftime('%Y', j.fillDateISO) as year,
          COUNT(*) as totalCanned,
          SUM(j.used) as totalUsed,
          COUNT(*) - SUM(j.used) as available
        FROM jars j
        GROUP BY strftime('%Y', j.fillDateISO)
        ORDER BY year DESC
      `);

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
          available: 0,
        });
      }

      setYearlyStats(yearlyData);

      // Load category statistics
      const categoryData = await db.getAllAsync<CategoryStats>(
        `
        SELECT 
          COALESCE(it.category, 'other') as category,
          COUNT(j.id) as totalCanned,
          SUM(j.used) as totalUsed,
          COUNT(j.id) - SUM(j.used) as available
        FROM jars j
        LEFT JOIN item_types it ON j.itemTypeId = it.id
        WHERE strftime('%Y', j.fillDateISO) = ?
        GROUP BY it.category
        ORDER BY totalCanned DESC
      `,
        [selectedYear.toString()]
      );

      const categoryStatsWithNames = categoryData.map((stat) => ({
        ...stat,
        categoryName: getCategoryName(stat.category),
      }));
      setCategoryStats(categoryStatsWithNames);

      // Load item type statistics for selected year
      const itemTypeData = await db.getAllAsync<ItemTypeStats>(
        `
        SELECT 
          it.id,
          it.name,
          COALESCE(it.category, 'other') as category,
          COUNT(j.id) as totalCanned,
          SUM(j.used) as totalUsed,
          COUNT(j.id) - SUM(j.used) as available
        FROM item_types it
        LEFT JOIN jars j ON j.itemTypeId = it.id AND strftime('%Y', j.fillDateISO) = ?
        WHERE j.id IS NOT NULL
        GROUP BY it.id, it.name, it.category
        ORDER BY totalCanned DESC
      `,
        [selectedYear.toString()]
      );
      setItemTypeStats(itemTypeData);

      // Load monthly statistics for selected year
      const monthlyData = await db.getAllAsync<MonthlyStats>(
        `
        SELECT 
          CAST(strftime('%m', j.fillDateISO) as INTEGER) as month,
          CAST(strftime('%Y', j.fillDateISO) as INTEGER) as year,
          COUNT(*) as canned,
          SUM(j.used) as used
        FROM jars j
        WHERE strftime('%Y', j.fillDateISO) = ?
        GROUP BY strftime('%Y-%m', j.fillDateISO)
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
  const usageRate = currentYearStats
    ? Math.round(
        (currentYearStats.totalUsed / currentYearStats.totalCanned) * 100
      )
    : 0;

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
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
    <View style={styles.container}>
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
                .map((yearStat) => (
                  <TouchableOpacity
                    key={yearStat.year}
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
              <View style={styles.metricCard}>
                <Ionicons name="archive" size={24} color="#1976d2" />
                <Text style={styles.metricNumber}>
                  {currentYearStats.available}
                </Text>
                <Text style={styles.metricLabel}>Available</Text>
              </View>
              <View style={styles.metricCard}>
                <Ionicons name="trending-up" size={24} color="#7b1fa2" />
                <Text style={styles.metricNumber}>
                  {usageRate ? `${usageRate}%` : `Unavailable`}
                </Text>
                <Text style={styles.metricLabel}>Usage Rate</Text>
              </View>
            </View>
          </View>
        )}

        {/* Category Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Category Breakdown ({selectedYear})
          </Text>
          {categoryStats.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No categories to show</Text>
            </View>
          ) : (
            categoryStats.map((category) => {
              const isExpanded = expandedCategories.has(category.category);
              const itemTypes = getItemTypesForCategory(category.category);

              return (
                <View key={category.category}>
                  <TouchableOpacity
                    style={styles.categoryRow}
                    onPress={() => toggleCategory(category.category)}
                  >
                    <View style={styles.categoryInfo}>
                      <Text style={styles.categoryIcon}>
                        {getCategoryIcon(category.category)}
                      </Text>
                      <Text style={styles.categoryName}>
                        {category.categoryName}
                      </Text>
                    </View>
                    <View style={styles.categoryStats}>
                      <View style={styles.categoryStat}>
                        <Text style={styles.categoryStatNumber}>
                          {category.totalCanned}
                        </Text>
                        <Text style={styles.categoryStatLabel}>Canned</Text>
                      </View>
                      <View style={styles.categoryStat}>
                        <Text
                          style={[
                            styles.categoryStatNumber,
                            { color: "#d32f2f" },
                          ]}
                        >
                          {category.totalUsed}
                        </Text>
                        <Text style={styles.categoryStatLabel}>Used</Text>
                      </View>
                      <View style={styles.categoryStat}>
                        <Text
                          style={[
                            styles.categoryStatNumber,
                            { color: "#2e7d32" },
                          ]}
                        >
                          {category.available}
                        </Text>

                        <Text style={styles.categoryStatLabel}>Available</Text>
                      </View>
                      <Ionicons
                        name={
                          isExpanded
                            ? "chevron-up-outline"
                            : "chevron-down-outline"
                        }
                        size={20}
                        color={theme.colors.textSecondary}
                        style={styles.expandIcon}
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Item Types */}
                  {isExpanded && itemTypes.length > 0 && (
                    <View style={styles.itemTypesContainer}>
                      {itemTypes.map((itemType, index) => (
                        <View
                          key={itemType.id}
                          style={[
                            styles.itemTypeRow,
                            index === itemTypes.length - 1 && {
                              borderBottomWidth: 0,
                            },
                          ]}
                        >
                          <Text style={styles.itemTypeName}>
                            {itemType.name}
                          </Text>
                          <View style={styles.itemTypeStats}>
                            <View style={styles.itemTypeStat}>
                              <Text style={styles.itemTypeStatNumber}>
                                {itemType.totalCanned}
                              </Text>
                              <Text style={styles.itemTypeStatLabel}>
                                Canned
                              </Text>
                            </View>
                            <View style={styles.itemTypeStat}>
                              <Text
                                style={[
                                  styles.itemTypeStatNumber,
                                  { color: "#d32f2f" },
                                ]}
                              >
                                {itemType.totalUsed}
                              </Text>
                              <Text style={styles.itemTypeStatLabel}>Used</Text>
                            </View>
                            <View style={styles.itemTypeStat}>
                              <Text
                                style={[
                                  styles.itemTypeStatNumber,
                                  { color: "#2e7d32" },
                                ]}
                              >
                                {itemType.available}
                              </Text>
                              <Text style={styles.itemTypeStatLabel}>
                                Available
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Monthly Trends */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Monthly Activity ({selectedYear})
          </Text>
          <View style={styles.monthlyChart}>
            {Array.from({ length: 12 }, (_, i) => {
              const monthNum = i + 1;
              const monthData = monthlyStats.find((m) => m.month === monthNum);
              const canned = monthData?.canned || 0;
              const used = monthData?.used || 0;
              const maxValue = Math.max(
                ...monthlyStats.map((m) => m.canned),
                50
              );

              return (
                <View key={monthNum} style={styles.monthColumn}>
                  <View style={styles.monthBars}>
                    <View
                      style={[
                        styles.monthBar,
                        styles.cannedBar,
                        { height: Math.max((canned / maxValue) * 80, 2) },
                      ]}
                    />
                    <View
                      style={[
                        styles.monthBar,
                        styles.usedBar,
                        { height: Math.max((used / maxValue) * 80, 2) },
                      ]}
                    />
                  </View>
                  <Text style={styles.monthLabel}>
                    {getMonthName(monthNum)}
                  </Text>
                  <Text style={styles.monthValue}>{canned}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendColor, { backgroundColor: "#2e7d32" }]}
              />
              <Text style={styles.legendLabel}>Canned</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendColor, { backgroundColor: "#d32f2f" }]}
              />
              <Text style={styles.legendLabel}>Used</Text>
            </View>
          </View>
        </View>

        {/* Yearly Comparison */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yearly Comparison</Text>
          {yearlyStats.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No stats to show</Text>
            </View>
          ) : (
            yearlyStats.map((year) => {
              const yearUsageRate = Math.round(
                (year.totalUsed / year.totalCanned) * 100
              );
              return (
                <View key={year.year} style={styles.yearComparisonRow}>
                  <Text style={styles.yearComparisonYear}>{year.year}</Text>
                  <View style={styles.yearComparisonStats}>
                    <Text style={styles.yearComparisonStat}>
                      {year.totalCanned} canned
                    </Text>
                    <Text style={styles.yearComparisonStat}>
                      {year.totalUsed} used
                    </Text>
                    <Text style={styles.yearComparisonStat}>
                      {yearUsageRate ? `${yearUsageRate}% rate` : ``}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
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
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  categoryInfo: {
    flexDirection: "row",
    alignItems: "center",
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
  expandIcon: {
    marginLeft: theme.spacing.sm,
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
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  itemTypeName: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    flex: 1,
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
});
