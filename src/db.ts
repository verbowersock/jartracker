import * as SQLite from "expo-sqlite";

export type ItemType = {
  id?: number;
  name: string;
  category?: string;
  recipe?: string;
  notes?: string;
  recipe_image?: string;
};

export type Jar = {
  id?: number;
  itemTypeId: number;
  fillDateISO: string; // ISO string
  used: 0 | 1; // 0 false, 1 true
  jarSize?: string;
  location?: string;
  batchId?: string; // Unique identifier for the batch
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
  "Half-pint (8 oz)",
  "Pint (16 oz)",
  "1.5 pint (24 oz)",
  "Quart(32 oz)",
  "Half-gallon (64 oz)",
];

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  try {
    // Use the sync method which is more reliable
    db = SQLite.openDatabaseSync("jartracker.db");
    console.log("Database opened successfully");
  } catch (error) {
    console.error("Failed to open database:", error);
    // Try with a different database name as fallback
    console.log("Trying fallback database name...");
    try {
      db = SQLite.openDatabaseSync("jartracker_backup.db");
    } catch (fallbackError) {
      console.error("Fallback database also failed:", fallbackError);
      throw new Error("Cannot open any database");
    }
  }

  // Create tables with all columns
  await db.execAsync(
    `PRAGMA journal_mode = MEMORY;
     PRAGMA synchronous = NORMAL;
     CREATE TABLE IF NOT EXISTS item_types (
       id INTEGER PRIMARY KEY NOT NULL,
       name TEXT NOT NULL UNIQUE,
       category TEXT,
       recipe TEXT,
       notes TEXT,
       recipe_image TEXT
     );
     CREATE TABLE IF NOT EXISTS jars (
       id INTEGER PRIMARY KEY NOT NULL,
       itemTypeId INTEGER NOT NULL REFERENCES item_types(id) ON DELETE CASCADE,
       fillDateISO TEXT NOT NULL,
       used INTEGER NOT NULL DEFAULT 0,
       jarSize TEXT,
       location TEXT,
       batchId TEXT
     );
     CREATE INDEX IF NOT EXISTS idx_jars_itemTypeId ON jars(itemTypeId);`
  );

  // Add new columns safely if they don't exist (for existing databases)
  try {
    // Check if category and recipe_image columns exist in item_types
    const itemTypesInfo = await db.getAllAsync("PRAGMA table_info(item_types)");
    const hasCategoryColumn = itemTypesInfo.some(
      (col: any) => col.name === "category"
    );
    const hasRecipeImageColumn = itemTypesInfo.some(
      (col: any) => col.name === "recipe_image"
    );

    if (!hasCategoryColumn) {
      await db.execAsync("ALTER TABLE item_types ADD COLUMN category TEXT;");
    }
    if (!hasRecipeImageColumn) {
      await db.execAsync(
        "ALTER TABLE item_types ADD COLUMN recipe_image TEXT;"
      );
    }

    // Check if jarSize, location, and batchId columns exist in jars
    const jarsInfo = await db.getAllAsync("PRAGMA table_info(jars)");
    const hasJarSizeColumn = jarsInfo.some(
      (col: any) => col.name === "jarSize"
    );
    const hasLocationColumn = jarsInfo.some(
      (col: any) => col.name === "location"
    );
    const hasBatchIdColumn = jarsInfo.some(
      (col: any) => col.name === "batchId"
    );

    if (!hasJarSizeColumn) {
      await db.execAsync("ALTER TABLE jars ADD COLUMN jarSize TEXT;");
    }
    if (!hasLocationColumn) {
      await db.execAsync("ALTER TABLE jars ADD COLUMN location TEXT;");
    }
    if (!hasBatchIdColumn) {
      await db.execAsync("ALTER TABLE jars ADD COLUMN batchId TEXT;");
    }
  } catch (error) {
    // Columns might already exist, which is fine
    console.log("Database migration info:", error);
  }

  // Seed development data if in dev mode
  if (__DEV__) {
    try {
      await seedDevelopmentData();
    } catch (error) {
      console.error("Error seeding development data:", error);
    }
  }

  return db;
}

export async function upsertItemType(itemType: ItemType): Promise<number> {
  const database = await getDb();
  if (itemType.id) {
    await database.runAsync(
      "UPDATE item_types SET name = ?, category = ?, recipe = ?, notes = ?, recipe_image = ? WHERE id = ?",
      itemType.name,
      itemType.category ?? null,
      itemType.recipe ?? null,
      itemType.notes ?? null,
      itemType.recipe_image ?? null,
      itemType.id
    );
    return itemType.id;
  }
  const res = await database.runAsync(
    "INSERT INTO item_types (name, category, recipe, notes, recipe_image) VALUES (?, ?, ?, ?, ?)",
    itemType.name,
    itemType.category ?? null,
    itemType.recipe ?? null,
    itemType.notes ?? null,
    itemType.recipe_image ?? null
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
): Promise<{ jarIds: number[]; batchId: string }> {
  const database = await getDb();
  const jarIds: number[] = [];

  // Generate a unique batch ID using timestamp and random component
  const batchId = `batch_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  for (let i = 0; i < quantity; i++) {
    const res = await database.runAsync(
      "INSERT INTO jars (itemTypeId, fillDateISO, used, jarSize, location, batchId) VALUES (?, ?, 0, ?, ?, ?)",
      [itemTypeId, fillDateISO, jarSize ?? null, location ?? null, batchId]
    );
    jarIds.push(res.lastInsertRowId as number);
  }

  return { jarIds, batchId };
}

export async function getJarById(jarId: number): Promise<Jar | null> {
  const database = await getDb();
  return await database.getFirstAsync<Jar>("SELECT * FROM jars WHERE id = ?", [
    jarId,
  ]);
}

export async function markJarUsed(
  jarId: number
): Promise<{ success: boolean; message: string; jar?: Jar }> {
  const database = await getDb();

  // First check if jar exists and get its details
  const jar = await getJarById(jarId);
  if (!jar) {
    return { success: false, message: "Jar not found" };
  }

  // Check if already used
  if (jar.used) {
    return {
      success: false,
      message: "This jar has already been marked as used",
      jar,
    };
  }

  // Mark as used
  await database.runAsync("UPDATE jars SET used = 1 WHERE id = ?", [jarId]);
  return { success: true, message: "Jar marked as used successfully", jar };
}

export async function getJarsForItemType(itemTypeId: number): Promise<Jar[]> {
  const database = await getDb();
  return await database.getAllAsync<Jar>(
    "SELECT * FROM jars WHERE itemTypeId = ? ORDER BY datetime(fillDateISO) DESC",
    [itemTypeId]
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
    batchId: string;
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
    batchId: string | null;
  }>(
    `SELECT 
       it.id as itemTypeId,
       it.name,
       it.category,
       it.notes,
       j.fillDateISO,
       j.jarSize,
       j.location,
       j.batchId,
       COUNT(j.id) as totalJars,
       SUM(CASE WHEN j.used = 1 THEN 1 ELSE 0 END) as usedJars,
       GROUP_CONCAT(j.id) as jarIds
     FROM item_types it
     JOIN jars j ON j.itemTypeId = it.id
     WHERE j.batchId IS NOT NULL
     GROUP BY j.batchId
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
    batchId: r.batchId ?? "",
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
    "SELECT id, name, category, recipe, notes, recipe_image FROM item_types"
  );
  const jars = await database.getAllAsync<Jar>(
    "SELECT id, itemTypeId, fillDateISO, used, jarSize, location, batchId FROM jars"
  );
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
        "INSERT INTO item_types (id, name, category, recipe, notes, recipe_image) VALUES (?, ?, ?, ?, ?, ?)",
        it.id ?? null,
        it.name,
        it.category ?? null,
        it.recipe ?? null,
        it.notes ?? null,
        it.recipe_image ?? null
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
        "INSERT INTO jars (id, itemTypeId, fillDateISO, used, jarSize, location, batchId) VALUES (?, ?, ?, ?, ?, ?, ?)",
        j.id ?? null,
        j.itemTypeId,
        j.fillDateISO,
        j.used ?? 0,
        j.jarSize ?? null,
        j.location ?? null,
        j.batchId ?? null
      );
    }
    await database.execAsync("COMMIT");
  } catch (e) {
    await database.execAsync("ROLLBACK");
    throw e;
  }
}

export function buildJarQrData(jarId: number): string {
  return JSON.stringify({ type: "jartracker-jar", id: jarId });
}

export function parseJarQrData(data: string): number | null {
  try {
    const obj = JSON.parse(data);
    if (obj && obj.type === "jartracker-jar" && typeof obj.id === "number")
      return obj.id;
    return null;
  } catch {
    return null;
  }
}

export async function seedDevelopmentData(): Promise<void> {
  if (!__DEV__) return;

  const db = await getDb();

  // Check if data already exists
  const existingData = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM item_types"
  );

  if (existingData && existingData.count > 0) {
    console.log("Development data already exists, skipping seed");
    return;
  }

  console.log("Seeding development data...");

  const testItemTypes = [
    {
      name: "Strawberry Jam",
      category: "preserves",
      recipe: "Fresh strawberries with sugar and lemon",
    },
    {
      name: "Tomato Sauce",
      category: "sauces",
      recipe: "San Marzano tomatoes, basil, garlic",
    },
    {
      name: "Dill Pickles",
      category: "pickles",
      recipe: "Cucumbers in vinegar brine with dill",
    },
    {
      name: "Apple Butter",
      category: "preserves",
      recipe: "Slow-cooked apples with cinnamon",
    },
    {
      name: "Green Beans",
      category: "vegetables",
      recipe: "Fresh green beans pressure canned",
    },
    {
      name: "Peach Preserves",
      category: "fruits",
      recipe: "Ripe peaches with sugar",
    },
    {
      name: "Marinara Sauce",
      category: "sauces",
      recipe: "Roma tomatoes, herbs, onions",
    },
    {
      name: "Corn Relish",
      category: "vegetables",
      recipe: "Sweet corn with peppers and onions",
    },
  ];

  const generateRandomDate = (year: number, month: number) => {
    const day = Math.floor(Math.random() * 28) + 1;
    return new Date(year, month - 1, day).toISOString();
  };

  try {
    for (const itemType of testItemTypes) {
      const result = await db.runAsync(
        "INSERT INTO item_types (name, category, recipe) VALUES (?, ?, ?)",
        [itemType.name, itemType.category, itemType.recipe]
      );

      const itemTypeId = result.lastInsertRowId;

      // Generate 2-4 batches per item type
      const batchCount = Math.floor(Math.random() * 3) + 2;

      for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
        // Spread across 2023, 2024, and 2025
        const year = 2023 + Math.floor(Math.random() * 3);
        const month = Math.floor(Math.random() * 12) + 1;
        const fillDate = generateRandomDate(year, month);

        // Generate unique batch ID
        const batchId = `batch-${itemTypeId}-${batchIndex}-${year}${month
          .toString()
          .padStart(2, "0")}`;

        // Random jar sizes (consistent within batch)
        const jarSizes = ["8 oz", "16 oz", "Pint", "Quart", "Half Pint"];
        const jarSize = jarSizes[Math.floor(Math.random() * jarSizes.length)];

        // Random locations (consistent within batch)
        const locations = [
          "Pantry Shelf A",
          "Basement Storage",
          "Kitchen Cabinet",
          "Garage Shelf",
          "Cold Room",
        ];
        const location =
          locations[Math.floor(Math.random() * locations.length)];

        // Generate 2-6 jars per batch
        const jarsPerBatch = Math.floor(Math.random() * 5) + 2;

        for (let jarIndex = 0; jarIndex < jarsPerBatch; jarIndex++) {
          // 30% chance of being used
          const used = Math.random() < 0.3 ? 1 : 0;

          await db.runAsync(
            "INSERT INTO jars (itemTypeId, fillDateISO, jarSize, location, used, batchId) VALUES (?, ?, ?, ?, ?, ?)",
            [itemTypeId, fillDate, jarSize, location, used, batchId]
          );
        }
      }
    }

    console.log("Development data seeded successfully");
  } catch (error) {
    console.error("Error seeding development data:", error);
  }
}
