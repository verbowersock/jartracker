import React, { createContext, useState, useEffect, ReactNode } from "react";
import { Alert, Platform } from "react-native";

// Conditionally import ExpoIAP only on native platforms
let ExpoIAP: any = null;
if (Platform.OS !== "web") {
  ExpoIAP = require("expo-iap");
}

interface SubscriptionContextType {
  isPremium: boolean;
  isLoading: boolean;
  productPrice: string | null;
  purchasePremium: () => Promise<boolean>;
  restorePurchases: () => Promise<void>;
  error: string | null;
}

export const SubscriptionContext = createContext<SubscriptionContextType>({
  isPremium: false,
  isLoading: true,
  productPrice: null,
  purchasePremium: async () => false,
  restorePurchases: async () => {},
  error: null,
});

// Your product SKU (must match Google Play)
const PREMIUM_PRODUCT_ID = "premium_unlock";

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  console.log("[Expo-IAP] *** Provider mounted ***");
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [productPrice, setProductPrice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<any>(null);

  useEffect(() => {
    if (Platform.OS === "web") {
      // On web, skip IAP and just set loading to false
      setIsLoading(false);
      return;
    }

    initializeIAP();

    // Listen for purchase updates (including refunds)
    if (ExpoIAP) {
      const subscription = ExpoIAP.purchaseUpdatedListener((purchase: any) => {
        console.log("[IAP-LISTENER] Purchase updated:", purchase);

        if (purchase.productId === PREMIUM_PRODUCT_ID) {
          // Check if purchase is still valid (not refunded)
          const isPurchased = purchase.purchaseState === "purchased";
          console.log("[IAP-LISTENER] Premium status changed to:", isPurchased);
          setIsPremium(isPurchased);
        }
      });

      return () => {
        // No disconnect in expo-iap
        subscription.remove();
      };
    }
  }, []);

  const initializeIAP = async () => {
    if (Platform.OS === "web") {
      console.log("[Expo-IAP] Skipping IAP initialization on web");
      setIsLoading(false);
      return;
    }

    if (!ExpoIAP) {
      console.error("[Expo-IAP] ExpoIAP module not available");
      setIsLoading(false);
      return;
    }

    try {
      console.log("[Expo-IAP] Starting initialization...");

      // Connect to billing
      console.log("[Expo-IAP] Connecting to billing...");
      await ExpoIAP.initConnection();
      console.log("[Expo-IAP] Connected");

      // Check existing purchases
      console.log("[Expo-IAP] Checking existing purchases...");
      const purchases = await ExpoIAP.getAvailablePurchases();
      console.log("[Expo-IAP] Purchase history retrieved:", purchases);

      const hasPremium = purchases.some(
        (purchase: any) => purchase.productId === PREMIUM_PRODUCT_ID,
      );
      setIsPremium(hasPremium);
      console.log("[Expo-IAP] Premium status:", hasPremium);

      // Get product info
      console.log("[Expo-IAP] Fetching product info...");
      const products = await ExpoIAP.fetchProducts({
        skus: [PREMIUM_PRODUCT_ID],
      });
      console.log("[Expo-IAP] Product info retrieved:", products);

      if (products && products.length > 0) {
        const price = products[0].price?.toString() || null;
        setProduct(products[0]);
        setProductPrice(price);
        console.log("[Expo-IAP] Product price:", price);
      }

      setError(null);
      console.log("[Expo-IAP] ✓ Initialization complete");
    } catch (err) {
      console.error("[Expo-IAP] ✗ Initialization error:", err);
      setError("Failed to initialize purchases");
    } finally {
      setIsLoading(false);
    }
  };

  const purchasePremium = async (): Promise<boolean> => {
    if (Platform.OS === "web") {
      Alert.alert("Info", "In-app purchases are not available on web");
      return false;
    }

    if (!ExpoIAP) {
      Alert.alert("Error", "Purchase module not available");
      return false;
    }

    console.log("[PURCHASE] 1. Purchase flow initiated");

    if (!product) {
      console.error("[PURCHASE] Product not loaded");
      Alert.alert("Error", "Product not loaded");
      return false;
    }

    try {
      console.log("[PURCHASE] 2. Starting purchase for:", PREMIUM_PRODUCT_ID);
      console.log("[PURCHASE] 2b. Product object:", product);

      // Get offerToken for one-time purchase on Android
      const offerToken =
        product?.oneTimePurchaseOfferDetailsAndroid?.offerToken;
      console.log("[PURCHASE] 2c. Using offerToken:", offerToken);

      // Use requestPurchase with proper platform-specific format
      const purchase = await ExpoIAP.requestPurchase({
        request: {
          apple: { sku: PREMIUM_PRODUCT_ID },
          google: {
            skus: [PREMIUM_PRODUCT_ID],
            ...(offerToken && { oneTimeOfferToken: offerToken }),
          },
        },
        type: "in-app",
      });

      console.log("[PURCHASE] 3. Purchase response:", purchase);

      if (purchase) {
        console.log("[PURCHASE] 4. Purchase successful");
        setIsPremium(true);
        setError(null);
        Alert.alert("Success", "Premium unlocked!");
        console.log("[PURCHASE] ✓ Purchase completed successfully");
        return true;
      }

      console.log("[PURCHASE] No purchase result");
      return false;
    } catch (err: any) {
      console.error("[PURCHASE] ✗ === Purchase Error ===");
      console.error("[PURCHASE] Error code:", err?.code);
      console.error("[PURCHASE] Error message:", err?.message);
      console.error("[PURCHASE] Full error:", JSON.stringify(err, null, 2));

      // Check if user cancelled
      if (err?.code === "E_USER_CANCELLED" || err?.userCancelled) {
        console.log("[PURCHASE] User cancelled purchase");
        return false;
      }

      const errorMsg = err?.message || "Purchase failed";
      setError(errorMsg);
      Alert.alert("Purchase Failed", errorMsg);
      return false;
    }
  };

  const restorePurchases = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Info", "In-app purchases are not available on web");
      return;
    }

    if (!ExpoIAP) {
      Alert.alert("Error", "Purchase module not available");
      return;
    }

    try {
      setIsLoading(true);
      console.log("[RESTORE] 1. Starting restore purchases...");

      const purchases = await ExpoIAP.getAvailablePurchases();
      console.log("[RESTORE] 2. Restore completed");

      const hasPremium = purchases.some(
        (purchase: any) => purchase.productId === PREMIUM_PRODUCT_ID,
      );
      setIsPremium(hasPremium);

      if (hasPremium) {
        console.log("[RESTORE] 3. Premium purchase restored");
        Alert.alert("Success", "Premium purchases restored!");
      } else {
        console.log("[RESTORE] 3. No premium purchase found");
        Alert.alert("Info", "No premium purchases to restore");
      }
    } catch (err) {
      console.error("[RESTORE] Error:", err);
      Alert.alert("Error", "Failed to restore purchases");
    } finally {
      setIsLoading(false);
    }
  };

  const value: SubscriptionContextType = {
    isPremium,
    isLoading,
    productPrice,
    purchasePremium,
    restorePurchases,
    error,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};
