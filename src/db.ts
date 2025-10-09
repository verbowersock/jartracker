import * as SQLite from "expo-sqlite";

export type ItemType = {
  id?: number;
  name: string;
  category?: string;
  recipe?: string;
  notes?: string;
};

export type Jar = {
  id?: number;
  itemTypeId: number;
  fillDateISO: string; // ISO string
  used: 0 | 1; // 0 false, 1 true
  jarSize?: string;
  location?: string;
};

export const CATEGORIES = [
  { id: "fruits", name: "Fruits", icon: "🍎" },
  { id: "vegetables", name: "Vegetables", icon: "🥕" },
  { id: "preserves", name: "Preserves", icon: "🍯" },
  { id: "pickles", name: "Pickles", icon: "🥒" },
  { id: "sauces", name: "Sauces", icon: "🍅" },
  { id: "meats", name: "Meats", icon: "🥩" },
  { id: "other", name: "Other", icon: "📦" },
];

export const JAR_SIZES = [
  "4 oz",
  "8 oz",
  "12 oz",
  "16 oz",
  "24 oz",
  "32 oz",
  "Quart",
  "Half Gallon",
  "Gallon",
];

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("mypantry.db");

  // Create tables with all columns
  await db.execAsync(
    `PRAGMA journal_mode = WAL;
     CREATE TABLE IF NOT EXISTS item_types (
       id INTEGER PRIMARY KEY NOT NULL,
       name TEXT NOT NULL UNIQUE,
       category TEXT,
       recipe TEXT,
       notes TEXT
     );
     CREATE TABLE IF NOT EXISTS jars (
       id INTEGER PRIMARY KEY NOT NULL,
       itemTypeId INTEGER NOT NULL REFERENCES item_types(id) ON DELETE CASCADE,
       fillDateISO TEXT NOT NULL,
       used INTEGER NOT NULL DEFAULT 0,
       jarSize TEXT,
       location TEXT
     );
     CREATE INDEX IF NOT EXISTS idx_jars_itemTypeId ON jars(itemTypeId);`
  );

  // Add new columns safely if they don't exist (for existing databases)
  try {
    // Check if category column exists in item_types
    const itemTypesInfo = await db.getAllAsync("PRAGMA table_info(item_types)");
    const hasCategoryColumn = itemTypesInfo.some(
      (col: any) => col.name === "category"
    );

    if (!hasCategoryColumn) {
      await db.execAsync("ALTER TABLE item_types ADD COLUMN category TEXT;");
    }

    // Check if jarSize and location columns exist in jars
    const jarsInfo = await db.getAllAsync("PRAGMA table_info(jars)");
    const hasJarSizeColumn = jarsInfo.some(
      (col: any) => col.name === "jarSize"
    );
    const hasLocationColumn = jarsInfo.some(
      (col: any) => col.name === "location"
    );

    if (!hasJarSizeColumn) {
      await db.execAsync("ALTER TABLE jars ADD COLUMN jarSize TEXT;");
    }
    if (!hasLocationColumn) {
      await db.execAsync("ALTER TABLE jars ADD COLUMN location TEXT;");
    }
  } catch (error) {
    // Columns might already exist, which is fine
    console.log("Database migration info:", error);
  }

  return db;
}

export async function upsertItemType(itemType: ItemType): Promise<number> {
  const database = await getDb();
  if (itemType.id) {
    await database.runAsync(
      "UPDATE item_types SET name = ?, category = ?, recipe = ?, notes = ? WHERE id = ?",
      itemType.name,
      itemType.category ?? null,
      itemType.recipe ?? null,
      itemType.notes ?? null,
      itemType.id
    );
    return itemType.id;
  }
  const res = await database.runAsync(
    "INSERT INTO item_types (name, category, recipe, notes) VALUES (?, ?, ?, ?)",
    itemType.name,
    itemType.category ?? null,
    itemType.recipe ?? null,
    itemType.notes ?? null
  );
  return res.lastInsertRowId as number;
}

export async function deleteItemType(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM item_types WHERE id = ?", id);
}

export async function getItemTypesWithCounts(): Promise<
  Array<ItemType & { total: number; used: number }>
> {
  const database = await getDb();
  const rows = await database.getAllAsync<{
    id: number;
    name: string;
    category: string | null;
    recipe: string | null;
    notes: string | null;
    total: number;
    used: number;
  }>(
    `SELECT it.id, it.name, it.category, it.recipe, it.notes,
            COUNT(j.id) AS total,
            SUM(CASE WHEN j.used = 1 THEN 1 ELSE 0 END) AS used
       FROM item_types it
       LEFT JOIN jars j ON j.itemTypeId = it.id
      GROUP BY it.id
      ORDER BY it.name COLLATE NOCASE`
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category ?? undefined,
    recipe: r.recipe ?? undefined,
    notes: r.notes ?? undefined,
    total: r.total,
    used: r.used ?? 0,
  }));
}

export async function createJar(
  itemTypeId: number,
  fillDateISO: string,
  jarSize?: string,
  location?: string
): Promise<number> {
  const database = await getDb();
  const res = await database.runAsync(
    "INSERT INTO jars (itemTypeId, fillDateISO, used, jarSize, location) VALUES (?, ?, 0, ?, ?)",
    itemTypeId,
    fillDateISO,
    jarSize ?? null,
    location ?? null
  );
  return res.lastInsertRowId as number;
}

export async function createMultipleJars(
  itemTypeId: number,
  fillDateISO: string,
  quantity: number,
  jarSize?: string,
  location?: string
): Promise<number[]> {
  const database = await getDb();
  const jarIds: number[] = [];

  for (let i = 0; i < quantity; i++) {
    const res = await database.runAsync(
      "INSERT INTO jars (itemTypeId, fillDateISO, used, jarSize, location) VALUES (?, ?, 0, ?, ?)",
      itemTypeId,
      fillDateISO,
      jarSize ?? null,
      location ?? null
    );
    jarIds.push(res.lastInsertRowId as number);
  }

  return jarIds;
}

export async function markJarUsed(jarId: number): Promise<void> {
  const database = await getDb();
  await database.runAsync("UPDATE jars SET used = 1 WHERE id = ?", jarId);
}

export async function getJarsForItemType(itemTypeId: number): Promise<Jar[]> {
  const database = await getDb();
  return await database.getAllAsync<Jar>(
    "SELECT * FROM jars WHERE itemTypeId = ? ORDER BY datetime(fillDateISO) DESC",
    itemTypeId
  );
}

export async function getAllBatches(): Promise<
  Array<{
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
  }>
> {
  const database = await getDb();
  const rows = await database.getAllAsync<{
    itemTypeId: number;
    name: string;
    category: string | null;
    notes: string | null;
    fillDateISO: string;
    jarSize: string | null;
    location: string | null;
    totalJars: number;
    usedJars: number;
    jarIds: string;
  }>(
    `SELECT 
       it.id as itemTypeId,
       it.name,
       it.category,
       it.notes,
       j.fillDateISO,
       j.jarSize,
       j.location,
       COUNT(j.id) as totalJars,
       SUM(CASE WHEN j.used = 1 THEN 1 ELSE 0 END) as usedJars,
       GROUP_CONCAT(j.id) as jarIds
     FROM item_types it
     JOIN jars j ON j.itemTypeId = it.id
     GROUP BY it.id, j.fillDateISO, j.jarSize, j.location
     ORDER BY datetime(j.fillDateISO) DESC`
  );

  return rows.map((r) => ({
    id: r.itemTypeId,
    name: r.name,
    category: r.category ?? "other",
    fillDate: r.fillDateISO,
    jarSize: r.jarSize ?? "Unknown",
    location: r.location ?? "",
    notes: r.notes ?? "",
    totalJars: r.totalJars,
    usedJars: r.usedJars ?? 0,
    availableJars: r.totalJars - (r.usedJars ?? 0),
    jarIds: r.jarIds.split(",").map((id) => parseInt(id, 10)),
  }));
}

export async function getJarStats(): Promise<{
  total: number;
  available: number;
  used: number;
}> {
  const database = await getDb();
  const result = await database.getFirstAsync<{
    total: number;
    used: number;
  }>(
    `SELECT 
       COUNT(*) as total,
       SUM(CASE WHEN used = 1 THEN 1 ELSE 0 END) as used
     FROM jars`
  );

  const total = result?.total ?? 0;
  const used = result?.used ?? 0;
  const available = total - used;

  return { total, available, used };
}

export async function exportToJson(): Promise<string> {
  const database = await getDb();
  const itemTypes = await database.getAllAsync<ItemType>(
    "SELECT * FROM item_types"
  );
  const jars = await database.getAllAsync<Jar>("SELECT * FROM jars");
  return JSON.stringify({ itemTypes, jars }, null, 2);
}

export type ImportPayload = { itemTypes: ItemType[]; jars: Jar[] };

export async function importFromJson(json: string): Promise<void> {
  const database = await getDb();
  const payload = JSON.parse(json) as ImportPayload;
  await database.execAsync("BEGIN");
  try {
    await database.execAsync("DELETE FROM jars; DELETE FROM item_types;");
    for (const it of payload.itemTypes) {
      const res = await database.runAsync(
        "INSERT INTO item_types (id, name, recipe, notes) VALUES (?, ?, ?, ?)",
        it.id ?? null,
        it.name,
        it.recipe ?? null,
        it.notes ?? null
      );
      // preserve ids
      if (!it.id) {
        await database.runAsync(
          "UPDATE item_types SET id = ? WHERE rowid = ?",
          res.lastInsertRowId,
          res.lastInsertRowId
        );
      }
    }
    for (const j of payload.jars) {
      await database.runAsync(
        "INSERT INTO jars (id, itemTypeId, fillDateISO, used) VALUES (?, ?, ?, ?)",
        j.id ?? null,
        j.itemTypeId,
        j.fillDateISO,
        j.used ?? 0
      );
    }
    await database.execAsync("COMMIT");
  } catch (e) {
    await database.execAsync("ROLLBACK");
    throw e;
  }
}

export function buildJarQrData(jarId: number): string {
  return JSON.stringify({ type: "mypantry-jar", id: jarId });
}

export function parseJarQrData(data: string): number | null {
  try {
    const obj = JSON.parse(data);
    if (obj && obj.type === "mypantry-jar" && typeof obj.id === "number")
      return obj.id;
    return null;
  } catch {
    return null;
  }
}
