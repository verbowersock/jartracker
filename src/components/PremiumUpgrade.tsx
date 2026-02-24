import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { usePremium } from "../hooks/usePremium";
import { SafeAreaView } from "react-native-safe-area-context";

interface PremiumUpgradeProps {
  visible: boolean;
  onClose: () => void;
}

export default function PremiumUpgrade({
  visible,
  onClose,
}: PremiumUpgradeProps) {
  const { productPrice, purchasePremium, isLoading, restorePurchases } =
    usePremium();
  const [purchasing, setPurchasing] = useState(false);

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      const success = await purchasePremium();
      if (success) {
        onClose();
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    try {
      await restorePurchases();
      onClose();
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={28} color={theme.colors.primary} />
          </TouchableOpacity>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            bounces={true}
          >
            {/* Header */}
            <View style={styles.headerContainer}>
              <Ionicons
                name="star"
                size={40}
                color={theme.colors.primary}
                style={styles.icon}
              />
              <Text style={styles.title}>Upgrade to Premium</Text>
              <Text style={styles.subtitle}>
                Unlock advanced features and get the most out of Jar Tracker
              </Text>
            </View>

            {/* Features List */}
            <View style={styles.featuresContainer}>
              <Feature
                icon="analytics"
                title="Advanced Analytics"
                description="View detailed statistics and trends"
              />
              <Feature
                icon="notifications-outline"
                title="Low Stock Notifications"
                description="Enable Low Stock alerts for your items"
              />
              <Feature
                icon="options"
                title="Custom Categories"
                description="Create as many custom categories as you need"
              />
              <Feature
                icon="cloud-upload"
                title="Automatic Cloud Backup (in development)"
                description="Scheduled cloud backups (coming soon!)"
              />
            </View>

            {/* Price and Button */}
            <View style={styles.priceContainer}>
              {isLoading ? (
                <ActivityIndicator size="large" color={theme.colors.primary} />
              ) : (
                <>
                  <Text style={styles.priceText}>
                    {productPrice || "$5.99"}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.purchaseButton,
                      purchasing && styles.purchaseButtonDisabled,
                    ]}
                    onPress={handlePurchase}
                    disabled={purchasing}
                  >
                    {purchasing ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={styles.purchaseButtonText}>
                        Unlock Premium
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Restore Button */}
            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleRestore}
              disabled={purchasing}
            >
              <Text style={styles.restoreButtonText}>Restore Purchase</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

interface FeatureProps {
  icon: string;
  title: string;
  description: string;
}

function Feature({ icon, title, description }: FeatureProps) {
  return (
    <View style={styles.feature}>
      <Ionicons name={icon as any} size={24} color={theme.colors.primary} />
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 30,
    paddingVertical: 30,
    maxHeight: "95%",
  },
  scrollContent: {
    paddingBottom: 10,
  },
  closeButton: {
    alignSelf: "flex-end",
    marginBottom: 10,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  icon: {
    marginBottom: 15,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: "bold",
    color: theme.colors.primary,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  featuresContainer: {
    marginBottom: 30,
  },
  feature: {
    flexDirection: "row",
    marginBottom: 16,
    alignItems: "flex-start",
  },
  featureText: {
    marginLeft: 20,
    flex: 1,
  },
  featureTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: theme.fontSize.sm,
    color: "#666",
  },
  priceContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  priceText: {
    fontSize: theme.fontSize.xxxl,
    fontWeight: "bold",
    color: theme.colors.primary,
    marginBottom: 15,
  },
  purchaseButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
  },
  purchaseButtonDisabled: {
    opacity: 0.6,
  },
  purchaseButtonText: {
    color: "white",
    fontSize: theme.fontSize.lg,
    fontWeight: "bold",
  },
  errorText: {
    color: "#d32f2f",
    fontSize: theme.fontSize.sm,
    textAlign: "center",
  },
  devNote: {
    color: "#ff9800",
    fontSize: theme.fontSize.md,
    textAlign: "center",
    marginBottom: 15,
    fontStyle: "italic",
  },
  restoreButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  restoreButtonText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.lg,
    fontWeight: "600",
  },
});
