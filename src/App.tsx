import React from "react";
import {
  NavigationContainer,
  DefaultTheme,
  Theme,
  getFocusedRouteNameFromRoute,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import HomeScreen from "./screens/HomeScreen";
import ItemTypeFormScreen from "./screens/ItemTypeFormScreen";
import ItemDetailScreen from "./screens/ItemDetailScreen";
import BatchDetailScreen from "./screens/BatchDetailScreen";
import AddBatchScreen from "./screens/AddBatchScreen";
import QRLabelScreen from "./screens/QRLabelScreen";
import QRScannerScreen from "./screens/QRScannerScreen";
import BackupRestoreScreen from "./screens/BackupRestoreScreen";
import StatisticsScreen from "./screens/StatisticsScreen";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { theme } from "./theme";

export type RootStackParamList = {
  Tabs: undefined;
  ItemTypeForm: { itemTypeId?: number } | undefined;
  ItemDetail: { itemTypeId: number };
  BatchDetail: {
    batchName: string;
    itemTypeId: number;
    fillDate: string;
    batchId: string;
  };
  AddBatch: undefined;
  QRLabel: { jarId: number; batchIds?: number[] };
  QRScanner: undefined;
  BackupRestore: undefined;
};

export type TabParamList = {
  Home: undefined;
  Statistics: undefined;
  Backup: undefined;
  Scan: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function Tabs() {
  return (
    <Tab.Navigator
      id={undefined}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === "Home") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "Statistics") {
            iconName = focused ? "bar-chart" : "bar-chart-outline";
          } else if (route.name === "Backup") {
            iconName = focused ? "cloud-download" : "cloud-download-outline";
          } else if (route.name === "Scan") {
            iconName = focused ? "qr-code" : "qr-code-outline";
          } else {
            iconName = "ellipse";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: "gray",
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Statistics" component={StatisticsScreen} />
      <Tab.Screen name="Backup" component={BackupRestoreScreen} />
      <Tab.Screen name="Scan" component={QRScannerScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const theme: Theme = {
    ...DefaultTheme,
  };
  return (
    <ErrorBoundary>
      <NavigationContainer theme={theme}>
        <Stack.Navigator id={undefined}>
          <Stack.Screen
            name="Tabs"
            component={Tabs}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="ItemTypeForm"
            component={ItemTypeFormScreen}
            options={{ title: "Item Type" }}
          />
          <Stack.Screen
            name="ItemDetail"
            component={ItemDetailScreen}
            options={{ title: "Item Detail" }}
          />
          <Stack.Screen
            name="BatchDetail"
            component={BatchDetailScreen}
            options={{ title: "Batch Details" }}
          />
          <Stack.Screen
            name="AddBatch"
            component={AddBatchScreen}
            options={{ title: "Add Batch" }}
          />
          <Stack.Screen
            name="QRLabel"
            component={QRLabelScreen}
            options={{ title: "QR Code Label" }}
          />
          <Stack.Screen
            name="QRScanner"
            component={QRScannerScreen}
            options={{ title: "QR Scanner" }}
          />
          <Stack.Screen
            name="BackupRestore"
            component={BackupRestoreScreen}
            options={{ title: "Backup & Restore" }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
}
