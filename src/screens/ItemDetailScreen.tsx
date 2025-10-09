import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { createJar, getDb, getJarsForItemType, markJarUsed } from "../db";

type Route = RouteProp<RootStackParamList, "ItemDetail">;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ItemDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const itemTypeId = route.params.itemTypeId;
  const [name, setName] = React.useState("");
  const [jars, setJars] = React.useState<any[]>([]);

  const reload = React.useCallback(async () => {
    const db = await getDb();
    const row = await db.getFirstAsync<any>(
      "SELECT * FROM item_types WHERE id = ?",
      itemTypeId
    );
    setName(row?.name ?? "");
    const js = await getJarsForItemType(itemTypeId);
    setJars(js);
  }, [itemTypeId]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  const onAddJar = async () => {
    const id = await createJar(itemTypeId, new Date().toISOString());
    navigation.navigate("QRLabel", { jarId: id });
    await reload();
  };

  // Group jars by date to enable batch label generation
  const groupedJars = React.useMemo(() => {
    const groups: { [date: string]: any[] } = {};
    jars.forEach((jar) => {
      const date = new Date(jar.fillDateISO).toLocaleDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(jar);
    });
    return groups;
  }, [jars]);

  const onGenerateBatchLabels = (batchJars: any[]) => {
    const jarIds = batchJars.map((jar) => jar.id);
    navigation.navigate("QRLabel", {
      jarId: jarIds[0],
      batchIds: jarIds,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{name}</Text>
      <TouchableOpacity style={styles.add} onPress={onAddJar}>
        <Text style={styles.addText}>+ Add Jar</Text>
      </TouchableOpacity>

      {/* Show grouped jars by date */}
      {Object.keys(groupedJars).length > 0 ? (
        <FlatList
          data={Object.entries(groupedJars)}
          keyExtractor={([date]) => date}
          renderItem={({ item: [date, batchJars] }) => (
            <View style={styles.batchGroup}>
              <View style={styles.batchHeader}>
                <Text style={styles.batchDate}>
                  {date} ({batchJars.length} jar
                  {batchJars.length !== 1 ? "s" : ""})
                </Text>
                {batchJars.length > 1 && (
                  <TouchableOpacity
                    style={styles.batchLabelBtn}
                    onPress={() => onGenerateBatchLabels(batchJars)}
                  >
                    <Text style={styles.batchLabelText}>📄 Batch Labels</Text>
                  </TouchableOpacity>
                )}
              </View>

              {batchJars.map((item: any) => (
                <View key={item.id} style={styles.row}>
                  <Text style={styles.jarText}>
                    Jar #{item.id} {item.used ? "(used)" : ""}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      style={styles.btn}
                      onPress={() =>
                        navigation.navigate("QRLabel", { jarId: item.id })
                      }
                    >
                      <Text style={styles.btnText}>Label</Text>
                    </TouchableOpacity>
                    {!item.used && (
                      <TouchableOpacity
                        style={styles.btn}
                        onPress={async () => {
                          await markJarUsed(item.id);
                          await reload();
                        }}
                      >
                        <Text style={styles.btnText}>Mark Used</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No jars yet.</Text>}
        />
      ) : (
        <Text style={styles.empty}>No jars yet.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  add: {
    padding: 12,
    backgroundColor: "#2e7d32",
    borderRadius: 8,
    marginBottom: 12,
  },
  addText: { color: "white", textAlign: "center", fontWeight: "600" },
  batchGroup: {
    marginBottom: 16,
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  batchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
  },
  batchDate: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  batchLabelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#2e7d32",
    borderRadius: 6,
  },
  batchLabelText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  row: {
    padding: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  jarText: { fontSize: 14 },
  btn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#1565c0",
    borderRadius: 6,
  },
  btnText: { color: "white", fontSize: 12 },
  empty: { textAlign: "center", color: "#999", marginTop: 24 },
});
