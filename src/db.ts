import * as SQLite from "expo-sqlite";

export type ItemType = {
  id?: number;
  name: string;
  category?: string;
  recipe?: string;
  notes?: string;
  recipe_image?: string;
  lowStockThreshold?: number;
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

export type CustomCategory = {
  id?: number;
  name: string;
  icon: string;
  isDefault: 0 | 1; // 0 false, 1 true - for built-in categories
};

export type CustomJarSize = {
  id?: number;
  name: string;
  isDefault: 0 | 1; // 0 false, 1 true - for built-in jar sizes
  hidden: 0 | 1; // 0 visible, 1 hidden
};

export type Recipe = {
  id?: number;
  name: string;
  content: string;
  image?: string;
  created_date?: string;
  last_used_date?: string;
};

export type DateFormat = "MM/DD/YYYY" | "DD/MM/YYYY" | "MMM DD, YYYY";

export const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (US)" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (International)" },
  { value: "MMM DD, YYYY", label: "Jan 14, 2026 (Text Month)" },
];

export const CATEGORIES = [
  { id: "fruits", name: "Fruits", icon: "🍎" },
  { id: "vegetables", name: "Vegetables", icon: "🥕" },
  { id: "preserves", name: "Preserves", icon: "🍯" },
  { id: "pickles", name: "Pickles", icon: "🥒" },
  { id: "sauces", name: "Sauces", icon: "🍅" },
  { id: "meats", name: "Meats", icon: "🥩" },
  { id: "drinks", name: "Drinks", icon: "🧃" },
  { id: "meals", name: "Meals", icon: "🍲" },
  { id: "other", name: "Other", icon: "📦" },
];

export const JAR_SIZES = [
  "Quarter-pint (4 oz)",
  "Half-pint (8 oz)",
  "Pint (16 oz)",
  "1.5 pint (24 oz)",
  "Quart (32 oz)",
  "Half-gallon (64 oz)",
  "Gallon (128 oz)",
  "Quarter-liter (250 ml)",
  "Half-liter (500 ml)",
  "Liter (1000 ml)",
  "Three Liter (3000 ml)",
];

let db: SQLite.SQLiteDatabase | null = null;
let isInitializing = false;

// Function to reset database connection
export function resetDb(): void {
  db = null;
  isInitializing = false;
}

// Wrapper function to handle database operations with automatic retry
async function withDb<T>(
  operation: (db: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  try {
    const database = await getDb();
    return await operation(database);
  } catch (error) {
    // Check if it's a database connection error
    if (
      error?.message?.includes("shared object that was already released") ||
      error?.message?.includes("database is closed")
    ) {
      // console.log("Database connection lost, resetting and retrying...");
      resetDb();
      const database = await getDb();
      return await operation(database);
    }
    throw error;
  }
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  // Prevent concurrent initialization
  if (isInitializing) {
    // Wait for the current initialization to complete
    while (isInitializing) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (db) return db;
  }

  isInitializing = true;

  try {
    // Use the sync method which is more reliable
    db = SQLite.openDatabaseSync("jartracker.db");
    // console.log("Database opened successfully");
  } catch (error) {
    console.error("Failed to open database:", error);
    // Try with a different database name as fallback
    // console.log("Trying fallback database name...");
    try {
      db = SQLite.openDatabaseSync("jartracker_backup.db");
    } catch (fallbackError) {
      console.error("Fallback database also failed:", fallbackError);
      isInitializing = false;
      throw new Error("Cannot open any database");
    }
  }

  try {
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
       recipe_image TEXT,
       lowStockThreshold INTEGER DEFAULT 0
     );
     CREATE TABLE IF NOT EXISTS recipes (
       id INTEGER PRIMARY KEY NOT NULL,
       name TEXT NOT NULL,
       content TEXT NOT NULL,
       image TEXT,
       created_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
       last_used_date TEXT
     );
     CREATE TABLE IF NOT EXISTS jars (
       id INTEGER PRIMARY KEY NOT NULL,
       itemTypeId INTEGER NOT NULL REFERENCES item_types(id) ON DELETE CASCADE,
       fillDateISO TEXT NOT NULL,
       used INTEGER NOT NULL DEFAULT 0,
       jarSize TEXT,
       location TEXT,
       batchId TEXT,
       recipe TEXT,
       recipe_image TEXT,
       recipeId INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
       usedDateISO TEXT
     );
     CREATE TABLE IF NOT EXISTS custom_categories (
       id INTEGER PRIMARY KEY NOT NULL,
       name TEXT NOT NULL UNIQUE,
       icon TEXT NOT NULL,
       isDefault INTEGER NOT NULL DEFAULT 0
     );
     CREATE TABLE IF NOT EXISTS custom_jar_sizes (
       id INTEGER PRIMARY KEY NOT NULL,
       name TEXT NOT NULL UNIQUE,
       isDefault INTEGER NOT NULL DEFAULT 0,
       hidden INTEGER NOT NULL DEFAULT 0
     );
     CREATE TABLE IF NOT EXISTS app_settings (
       id INTEGER PRIMARY KEY NOT NULL,
       key TEXT NOT NULL UNIQUE,
       value TEXT NOT NULL
     );
     CREATE INDEX IF NOT EXISTS idx_jars_itemTypeId ON jars(itemTypeId);`
    );

    // Add new columns safely if they don't exist (for existing databases)
    try {
      // Check if category and recipe_image columns exist in item_types
      const itemTypesInfo = await db.getAllAsync(
        "PRAGMA table_info(item_types)"
      );
      const hasCategoryColumn = itemTypesInfo.some(
        (col: any) => col.name === "category"
      );
      const hasItemTypeRecipeImageColumn = itemTypesInfo.some(
        (col: any) => col.name === "recipe_image"
      );
      const hasLowStockThresholdColumn = itemTypesInfo.some(
        (col: any) => col.name === "lowStockThreshold"
      );

      if (!hasCategoryColumn) {
        await db.execAsync("ALTER TABLE item_types ADD COLUMN category TEXT;");
      }
      if (!hasItemTypeRecipeImageColumn) {
        await db.execAsync(
          "ALTER TABLE item_types ADD COLUMN recipe_image TEXT;"
        );
      }
      if (!hasLowStockThresholdColumn) {
        await db.execAsync(
          "ALTER TABLE item_types ADD COLUMN lowStockThreshold INTEGER DEFAULT 0;"
        );
      }

      // Check if jarSize, location, batchId, recipe, and recipe_image columns exist in jars
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
      const hasJarRecipeColumn = jarsInfo.some(
        (col: any) => col.name === "recipe"
      );
      const hasJarRecipeImageColumn = jarsInfo.some(
        (col: any) => col.name === "recipe_image"
      );
      const hasRecipeIdColumn = jarsInfo.some(
        (col: any) => col.name === "recipeId"
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
      if (!hasJarRecipeColumn) {
        await db.execAsync("ALTER TABLE jars ADD COLUMN recipe TEXT;");
      }
      if (!hasJarRecipeImageColumn) {
        await db.execAsync("ALTER TABLE jars ADD COLUMN recipe_image TEXT;");
      }
      if (!hasRecipeIdColumn) {
        await db.execAsync(
          "ALTER TABLE jars ADD COLUMN recipeId INTEGER REFERENCES recipes(id) ON DELETE SET NULL;"
        );
      }

      // Add usedDateISO column for tracking when jars were used
      const usedDateColumns = await db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(jars);"
      );
      if (!usedDateColumns.some((col) => col.name === "usedDateISO")) {
        await db.execAsync("ALTER TABLE jars ADD COLUMN usedDateISO TEXT;");
      }

      // Create recipes table if it doesn't exist
      await db.execAsync(`
      CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        image TEXT,
        created_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_used_date TEXT
      );
    `);

      // Check if hidden column exists in custom_jar_sizes
      const jarSizesInfo = await db.getAllAsync(
        "PRAGMA table_info(custom_jar_sizes)"
      );
      const hasHiddenColumn = jarSizesInfo.some(
        (col: any) => col.name === "hidden"
      );

      if (!hasHiddenColumn) {
        await db.execAsync(
          "ALTER TABLE custom_jar_sizes ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;"
        );
      }
    } catch (error) {
      // Columns might already exist, which is fine
      // console.log("Database migration info:", error);
    }

    // Migrate recipes from item_types to jars for existing databases
    await migrateRecipesFromItemTypesToJars(db);

    // Automatically migrate unique recipes to recipe collection
    await autoMigrateRecipesToCollection();

    // Initialize custom categories with defaults if empty
    await initializeCustomCategories();

    // Initialize custom jar sizes with defaults if empty
    await initializeCustomJarSizes();

    // Seed development data if in dev mode
    if (__DEV__) {
      try {
        await seedDevelopmentData();
      } catch (error) {
        console.error("Error seeding development data:", error);
      }
    }

    isInitializing = false;
    return db;
  } catch (error) {
    isInitializing = false;
    console.error("Database initialization failed:", error);
    db = null; // Reset db to null so it can be retried
    throw error;
  }
}

// Initialize custom categories with defaults and migrate existing data
async function initializeCustomCategories(): Promise<void> {
  const database = await getDb();

  // Check if custom_categories table has any data
  const existingCount = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM custom_categories"
  );

  if (existingCount && existingCount.count === 0) {
    // Populate with default categories
    // console.log("Populating default categories...");
    for (const category of CATEGORIES) {
      await database.runAsync(
        "INSERT INTO custom_categories (name, icon, isDefault) VALUES (?, ?, 1)",
        [category.name, category.icon]
      );
    }

    // Now migrate any existing item categories that don't match defaults
    await migrateExistingCategories();
  }
}

// Migrate existing category data to ensure compatibility
async function migrateExistingCategories(): Promise<void> {
  const database = await getDb();

  // Get all unique categories currently used in item_types
  const existingCategories = await database.getAllAsync<{ category: string }>(
    "SELECT DISTINCT category FROM item_types WHERE category IS NOT NULL AND category != ''"
  );

  // Map old category IDs to proper names
  const categoryMapping: { [key: string]: string } = {
    fruits: "Fruits",
    vegetables: "Vegetables",
    preserves: "Preserves",
    pickles: "Pickles",
    sauces: "Sauces",
    meats: "Meats",
    drinks: "Drinks",
    meals: "Meals",
    other: "Other",
  };

  for (const { category } of existingCategories) {
    // Check if this is an old-style category ID
    if (categoryMapping[category]) {
      // Update items to use the new category name
      await database.runAsync(
        "UPDATE item_types SET category = ? WHERE category = ?",
        [categoryMapping[category], category]
      );
      // console.log(
      //   `Migrated category "${category}" to "${categoryMapping[category]}"`
      // );
    } else {
      // Check if this category exists in custom_categories
      const existsInCustom = await database.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM custom_categories WHERE name = ?",
        [category]
      );

      if (existsInCustom && existsInCustom.count === 0) {
        // This is a custom category that doesn't exist in our table, add it
        await database.runAsync(
          "INSERT INTO custom_categories (name, icon, isDefault) VALUES (?, ?, 0)",
          [category, "📦"] // Default icon for custom categories
        );
        console.log(`Added existing category "${category}" as custom category`);
      }
    }
  }
}

// Get all categories (defaults + custom)
export async function getAllCategories(): Promise<CustomCategory[]> {
  return withDb(async (database) => {
    return await database.getAllAsync<CustomCategory>(
      "SELECT * FROM custom_categories ORDER BY isDefault DESC, name COLLATE NOCASE"
    );
  });
}

// Add a new custom category
export async function addCustomCategory(
  name: string,
  icon: string
): Promise<number> {
  const database = await getDb();
  const result = await database.runAsync(
    "INSERT INTO custom_categories (name, icon, isDefault) VALUES (?, ?, 0)",
    [name, icon]
  );
  return result.lastInsertRowId as number;
}

// Update a custom category (only non-defaults)
export async function updateCustomCategory(
  id: number,
  name: string,
  icon: string
): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    "UPDATE custom_categories SET name = ?, icon = ? WHERE id = ? AND isDefault = 0",
    [name, icon, id]
  );
}

// Delete a custom category with safety checks
export async function deleteCustomCategory(id: number): Promise<void> {
  const database = await getDb();

  // Get the category name first
  const category = await database.getFirstAsync<{ name: string }>(
    "SELECT name FROM custom_categories WHERE id = ? AND isDefault = 0",
    [id]
  );

  if (!category) {
    throw new Error("Category not found or cannot be deleted");
  }

  // Check if any items are using this category
  const itemsCount = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM item_types WHERE category = ?",
    [category.name]
  );

  if (itemsCount && itemsCount.count > 0) {
    throw new Error(
      `Cannot delete category "${category.name}" because ${itemsCount.count} item(s) are still using it`
    );
  }

  // Safe to delete
  await database.runAsync(
    "DELETE FROM custom_categories WHERE id = ? AND isDefault = 0",
    [id]
  );
}

// === CUSTOM JAR SIZES FUNCTIONS ===

// Initialize custom jar sizes with defaults and migrate existing data
async function initializeCustomJarSizes(): Promise<void> {
  const database = await getDb();

  // Check if we have any custom jar sizes
  const existingCount = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM custom_jar_sizes"
  );

  if (existingCount && existingCount.count === 0) {
    // No jar sizes exist, insert defaults
    for (const jarSize of JAR_SIZES) {
      await database.runAsync(
        "INSERT INTO custom_jar_sizes (name, isDefault, hidden) VALUES (?, 1, 0)",
        [jarSize]
      );
      console.log(`Added default jar size: ${jarSize}`);
    }
  }

  // Migrate existing jar size data if needed
  await migrateExistingJarSizes();
}

// Migrate existing jar sizes that aren't in custom_jar_sizes
async function migrateExistingJarSizes(): Promise<void> {
  const database = await getDb();

  // Map old jar size names to proper names
  const jarSizeMapping: { [key: string]: string } = {
    "8 oz": "Half-pint (8 oz)",
    "16 oz": "Pint (16 oz)",
    Pint: "Pint (16 oz)",
    Quart: "Quart (32 oz)",
    "Half Pint": "Half-pint (8 oz)",
  };

  // Get all unique jar sizes currently in use
  const existingJarSizes = await database.getAllAsync<{ jarSize: string }>(
    "SELECT DISTINCT jarSize FROM jars WHERE jarSize IS NOT NULL AND jarSize != ''"
  );

  for (const { jarSize } of existingJarSizes) {
    // Check if this is an old-style jar size that needs mapping
    if (jarSizeMapping[jarSize]) {
      // Update jars to use the new jar size name
      await database.runAsync("UPDATE jars SET jarSize = ? WHERE jarSize = ?", [
        jarSizeMapping[jarSize],
        jarSize,
      ]);
      console.log(
        `Migrated jar size "${jarSize}" to "${jarSizeMapping[jarSize]}"`
      );
    } else {
      // Check if this jar size exists in custom_jar_sizes
      const existsInCustom = await database.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM custom_jar_sizes WHERE name = ?",
        [jarSize]
      );

      if (existsInCustom && existsInCustom.count === 0) {
        // This is a custom jar size that doesn't exist in our table, add it
        await database.runAsync(
          "INSERT INTO custom_jar_sizes (name, isDefault, hidden) VALUES (?, 0, 0)",
          [jarSize]
        );
        console.log(`Migrated existing jar size: ${jarSize}`);
      }
    }
  }
}

// Get all custom jar sizes (defaults and custom ones)
export async function getAllJarSizes(): Promise<CustomJarSize[]> {
  const database = await getDb();
  const jarSizes = await database.getAllAsync<CustomJarSize>(
    "SELECT id, name, isDefault, hidden FROM custom_jar_sizes WHERE hidden = 0 ORDER BY isDefault DESC, name ASC"
  );
  return jarSizes;
}

// Get all jar sizes including hidden ones (for management)
export async function getAllJarSizesIncludingHidden(): Promise<
  CustomJarSize[]
> {
  const database = await getDb();
  const jarSizes = await database.getAllAsync<CustomJarSize>(
    "SELECT id, name, isDefault, hidden FROM custom_jar_sizes ORDER BY hidden ASC, isDefault DESC, name ASC"
  );
  return jarSizes;
}

// Add a new custom jar size
export async function addCustomJarSize(name: string): Promise<number> {
  const database = await getDb();
  const result = await database.runAsync(
    "INSERT INTO custom_jar_sizes (name, isDefault, hidden) VALUES (?, 0, 0)",
    [name]
  );
  return result.lastInsertRowId as number;
}

// Update a custom jar size (only non-defaults)
export async function updateCustomJarSize(
  id: number,
  name: string
): Promise<void> {
  const database = await getDb();

  // First, get the current jar size name
  const currentJarSize = await database.getFirstAsync<{ name: string }>(
    "SELECT name FROM custom_jar_sizes WHERE id = ? AND isDefault = 0",
    [id]
  );

  if (!currentJarSize) {
    throw new Error("Jar size not found or cannot be updated");
  }

  // Update the jar size name in custom_jar_sizes
  await database.runAsync(
    "UPDATE custom_jar_sizes SET name = ? WHERE id = ? AND isDefault = 0",
    [name, id]
  );

  // Update all existing jars that use the old jar size name
  await database.runAsync("UPDATE jars SET jarSize = ? WHERE jarSize = ?", [
    name,
    currentJarSize.name,
  ]);
}

// Delete a custom jar size with safety checks
export async function deleteCustomJarSize(id: number): Promise<void> {
  const database = await getDb();

  // Get the jar size name first
  const jarSize = await database.getFirstAsync<{ name: string }>(
    "SELECT name FROM custom_jar_sizes WHERE id = ? AND isDefault = 0",
    [id]
  );

  if (!jarSize) {
    throw new Error("Jar size not found or cannot be deleted");
  }

  // Check if any jars are using this size
  const jarsCount = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM jars WHERE jarSize = ?",
    [jarSize.name]
  );

  if (jarsCount && jarsCount.count > 0) {
    throw new Error(
      `Cannot delete jar size "${jarSize.name}" because ${jarsCount.count} jar(s) are still using it`
    );
  }

  // Safe to delete
  await database.runAsync(
    "DELETE FROM custom_jar_sizes WHERE id = ? AND isDefault = 0",
    [id]
  );
}

// Toggle jar size visibility (hide/show)
export async function toggleJarSizeVisibility(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    "UPDATE custom_jar_sizes SET hidden = CASE WHEN hidden = 0 THEN 1 ELSE 0 END WHERE id = ?",
    [id]
  );
}

export async function upsertItemType(itemType: ItemType): Promise<number> {
  const database = await getDb();
  if (itemType.id) {
    await database.runAsync(
      "UPDATE item_types SET name = ?, category = ?, recipe = ?, notes = ?, recipe_image = ?, lowStockThreshold = ? WHERE id = ?",
      itemType.name,
      itemType.category ?? null,
      itemType.recipe ?? null,
      itemType.notes ?? null,
      itemType.recipe_image ?? null,
      itemType.lowStockThreshold ?? 0,
      itemType.id
    );
    return itemType.id;
  }
  const res = await database.runAsync(
    "INSERT INTO item_types (name, category, recipe, notes, recipe_image, lowStockThreshold) VALUES (?, ?, ?, ?, ?, ?)",
    itemType.name,
    itemType.category ?? null,
    itemType.recipe ?? null,
    itemType.notes ?? null,
    itemType.recipe_image ?? null,
    itemType.lowStockThreshold ?? 0
  );
  return res.lastInsertRowId as number;
}

export async function deleteItemType(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM item_types WHERE id = ?", id);
}

export async function getRunningLowItems(): Promise<
  Array<{
    id: number;
    name: string;
    category?: string;
    available: number;
    threshold: number;
    categoryIcon?: string;
  }>
> {
  return withDb(async (database) => {
    const customCategories = await getAllCategories();

    const runningLowItems = await database.getAllAsync(`
      SELECT 
        it.id,
        it.name,
        it.category,
        it.lowStockThreshold as threshold,
        COUNT(j.id) - SUM(j.used) as available
      FROM item_types it
      LEFT JOIN jars j ON j.itemTypeId = it.id
      WHERE it.lowStockThreshold > 0
      GROUP BY it.id, it.name, it.category, it.lowStockThreshold
      HAVING available < it.lowStockThreshold AND available >= 0
      ORDER BY (available * 1.0 / it.lowStockThreshold) ASC
    `);

    return runningLowItems.map((item: any) => {
      const category = customCategories.find((c) => c.name === item.category);
      return {
        ...item,
        categoryIcon: category?.icon ?? "📦",
      };
    });
  });
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
  location?: string,
  recipeId?: number
): Promise<{ jarIds: number[]; batchId: string }> {
  const database = await getDb();
  const jarIds: number[] = [];

  // Generate a unique batch ID using timestamp and random component
  const batchId = `batch_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  for (let i = 0; i < quantity; i++) {
    const res = await database.runAsync(
      "INSERT INTO jars (itemTypeId, fillDateISO, used, jarSize, location, batchId, recipeId) VALUES (?, ?, 0, ?, ?, ?, ?)",
      [
        itemTypeId,
        fillDateISO,
        jarSize ?? null,
        location ?? null,
        batchId,
        recipeId ?? null,
      ]
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
  const usedDate = new Date().toISOString();
  await database.runAsync(
    "UPDATE jars SET used = 1, usedDateISO = ? WHERE id = ?",
    [usedDate, jarId]
  );
  return { success: true, message: "Jar marked as used successfully", jar };
}

export async function deleteJar(jarId: number): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM jars WHERE id = ?", [jarId]);
}

export async function deleteJarWithBatchCheck(jarId: number): Promise<{
  success: boolean;
  batchDeleted: boolean;
  batchId?: string;
}> {
  const database = await getDb();

  // Get jar details before deletion
  const jar = await getJarById(jarId);
  if (!jar) {
    return { success: false, batchDeleted: false };
  }

  const batchId = jar.batchId;

  // Delete the jar
  await database.runAsync("DELETE FROM jars WHERE id = ?", [jarId]);

  // Check if this was the last jar in the batch
  if (batchId) {
    const remainingJars = await database.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM jars WHERE batchId = ?",
      [batchId]
    );

    if (remainingJars && remainingJars.count === 0) {
      // Batch is now empty
      return { success: true, batchDeleted: true, batchId };
    }
  }

  return { success: true, batchDeleted: false, batchId };
}

export async function addJarToBatch(
  batchId: string,
  itemTypeId: number,
  fillDateISO: string,
  jarSize?: string,
  location?: string
): Promise<number> {
  const database = await getDb();
  const res = await database.runAsync(
    "INSERT INTO jars (itemTypeId, fillDateISO, used, jarSize, location, batchId) VALUES (?, ?, 0, ?, ?, ?)",
    [itemTypeId, fillDateISO, jarSize ?? null, location ?? null, batchId]
  );
  return res.lastInsertRowId as number;
}

export async function addMultipleJarsToBatch(
  batchId: string,
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
      "INSERT INTO jars (itemTypeId, fillDateISO, used, jarSize, location, batchId) VALUES (?, ?, 0, ?, ?, ?)",
      [itemTypeId, fillDateISO, jarSize ?? null, location ?? null, batchId]
    );
    jarIds.push(res.lastInsertRowId as number);
  }

  return jarIds;
}

export async function getJarsForItemType(itemTypeId: number): Promise<Jar[]> {
  const database = await getDb();
  return await database.getAllAsync<Jar>(
    "SELECT * FROM jars WHERE itemTypeId = ? ORDER BY datetime(fillDateISO) DESC",
    [itemTypeId]
  );
}

export async function getJarsForBatch(batchId: string): Promise<Jar[]> {
  const database = await getDb();
  return await database.getAllAsync<Jar>(
    "SELECT * FROM jars WHERE batchId = ? ORDER BY id ASC",
    [batchId]
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
  return withDb(async (database) => {
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
  });
}

export async function getJarStats(): Promise<{
  total: number;
  available: number;
  used: number;
}> {
  return withDb(async (database) => {
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
  });
}

export async function exportToJson(): Promise<string> {
  const database = await getDb();
  const itemTypes = await database.getAllAsync<ItemType>(
    "SELECT id, name, category, recipe, notes, recipe_image, lowStockThreshold FROM item_types"
  );
  const jars = await database.getAllAsync<Jar>(
    "SELECT id, itemTypeId, fillDateISO, used, jarSize, location, batchId, recipeId FROM jars"
  );
  const customCategories = await database.getAllAsync<CustomCategory>(
    "SELECT id, name, icon, isDefault FROM custom_categories"
  );
  const customJarSizes = await database.getAllAsync<CustomJarSize>(
    "SELECT id, name, isDefault, hidden FROM custom_jar_sizes"
  );
  const recipes = await database.getAllAsync<Recipe>(
    "SELECT id, name, content, image, created_date, last_used_date FROM recipes"
  );
  return JSON.stringify(
    { itemTypes, jars, customCategories, customJarSizes, recipes },
    null,
    2
  );
}

export type ImportPayload = {
  itemTypes: ItemType[];
  jars: Jar[];
  customCategories?: CustomCategory[];
  customJarSizes?: CustomJarSize[];
  recipes?: Recipe[];
};

export async function importFromJson(json: string): Promise<void> {
  const database = await getDb();
  const payload = JSON.parse(json) as ImportPayload;
  await database.execAsync("BEGIN");
  try {
    await database.execAsync(
      "DELETE FROM jars; DELETE FROM item_types; DELETE FROM custom_categories; DELETE FROM custom_jar_sizes; DELETE FROM recipes;"
    );

    // Import custom categories first
    if (payload.customCategories) {
      for (const category of payload.customCategories) {
        await database.runAsync(
          "INSERT INTO custom_categories (id, name, icon, isDefault) VALUES (?, ?, ?, ?)",
          category.id ?? null,
          category.name,
          category.icon,
          category.isDefault ? 1 : 0
        );
      }
    } else {
      // No custom categories in backup, initialize with defaults
      console.log("No categories in backup, initializing with defaults...");
      for (const category of CATEGORIES) {
        await database.runAsync(
          "INSERT INTO custom_categories (name, icon, isDefault) VALUES (?, ?, 1)",
          [category.name, category.icon]
        );
      }
    }

    // Import custom jar sizes
    if (payload.customJarSizes) {
      for (const jarSize of payload.customJarSizes) {
        await database.runAsync(
          "INSERT INTO custom_jar_sizes (id, name, isDefault, hidden) VALUES (?, ?, ?, ?)",
          jarSize.id ?? null,
          jarSize.name,
          jarSize.isDefault ? 1 : 0,
          jarSize.hidden ? 1 : 0
        );
      }
    } else {
      // No jar sizes in backup, initialize with defaults
      console.log("No jar sizes in backup, initializing with defaults...");
      for (const jarSize of JAR_SIZES) {
        await database.runAsync(
          "INSERT INTO custom_jar_sizes (name, isDefault, hidden) VALUES (?, 1, 0)",
          [jarSize]
        );
      }
    }

    // Import recipes
    if (payload.recipes) {
      for (const recipe of payload.recipes) {
        await database.runAsync(
          "INSERT INTO recipes (id, name, content, image, created_date, last_used_date) VALUES (?, ?, ?, ?, ?, ?)",
          recipe.id ?? null,
          recipe.name,
          recipe.content,
          recipe.image ?? null,
          recipe.created_date ?? null,
          recipe.last_used_date ?? null
        );
      }
    }

    // Map old category IDs to proper names during import
    const categoryMapping: { [key: string]: string } = {
      fruits: "Fruits",
      vegetables: "Vegetables",
      preserves: "Preserves",
      pickles: "Pickles",
      sauces: "Sauces",
      meats: "Meats",
      drinks: "Drinks",
      meals: "Meals",
      other: "Other",
    };

    for (const it of payload.itemTypes) {
      // Migrate old category ID to new category name if needed
      let category = it.category;
      if (category && categoryMapping[category]) {
        category = categoryMapping[category];
      }

      const res = await database.runAsync(
        "INSERT INTO item_types (id, name, category, recipe, notes, recipe_image) VALUES (?, ?, ?, ?, ?, ?)",
        it.id ?? null,
        it.name,
        category ?? null,
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
        "INSERT INTO jars (id, itemTypeId, fillDateISO, used, jarSize, location, batchId, recipe, recipe_image, recipeId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        j.id ?? null,
        j.itemTypeId,
        j.fillDateISO,
        j.used ?? 0,
        j.jarSize ?? null,
        j.location ?? null,
        j.batchId ?? null,
        null, // recipe (legacy field)
        null, // recipe_image (legacy field)
        (j as any).recipeId ?? null // Include recipeId from backup
      );
    }

    // Migrate recipes from item_types to jars for old backups
    await migrateRecipesFromItemTypesToJars(database);

    await database.execAsync("COMMIT");
  } catch (e) {
    await database.execAsync("ROLLBACK");
    throw e;
  }
}

// Migration function to copy recipes from item_types to jars
async function migrateRecipesFromItemTypesToJars(
  database: SQLite.SQLiteDatabase
): Promise<void> {
  try {
    // Find all jars that don't have recipes but their item_types do
    const jarsNeedingRecipes = await database.getAllAsync<{
      jarId: number;
      itemTypeId: number;
      batchId: string;
      recipe: string;
      recipe_image: string;
    }>(
      `SELECT j.id as jarId, j.itemTypeId, j.batchId, it.recipe, it.recipe_image 
       FROM jars j 
       JOIN item_types it ON j.itemTypeId = it.id 
       WHERE (j.recipe IS NULL OR j.recipe = '') 
       AND (it.recipe IS NOT NULL AND it.recipe != '')`
    );

    if (jarsNeedingRecipes.length > 0) {
      console.log(
        `Migrating recipes for ${jarsNeedingRecipes.length} jars from item_types to batch-specific storage`
      );

      // Group by batchId to ensure all jars in a batch get the same recipe
      const batchGroups = new Map<string, (typeof jarsNeedingRecipes)[0]>();

      for (const jar of jarsNeedingRecipes) {
        if (jar.batchId && !batchGroups.has(jar.batchId)) {
          batchGroups.set(jar.batchId, jar);
        }
      }

      // Update all jars in each batch with the recipe
      for (const [batchId, jarData] of batchGroups) {
        await database.runAsync(
          "UPDATE jars SET recipe = ?, recipe_image = ? WHERE batchId = ?",
          [jarData.recipe, jarData.recipe_image, batchId]
        );
      }

      // For jars without batchId, update individually
      for (const jar of jarsNeedingRecipes) {
        if (!jar.batchId) {
          await database.runAsync(
            "UPDATE jars SET recipe = ?, recipe_image = ? WHERE id = ?",
            [jar.recipe, jar.recipe_image, jar.jarId]
          );
        }
      }

      console.log("Recipe migration completed");
    }
  } catch (error) {
    console.error("Error during recipe migration:", error);
    // Don't throw - migration is best effort
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
      category: "Preserves",
      recipe: "Fresh strawberries with sugar and lemon",
    },
    {
      name: "Tomato Sauce",
      category: "Sauces",
      recipe: "San Marzano tomatoes, basil, garlic",
    },
    {
      name: "Dill Pickles",
      category: "Pickles",
      recipe: "Cucumbers in vinegar brine with dill",
    },
    {
      name: "Apple Butter",
      category: "Preserves",
      recipe: "Slow-cooked apples with cinnamon",
    },
    {
      name: "Green Beans",
      category: "Vegetables",
      recipe: "Fresh green beans pressure canned",
    },
    {
      name: "Peach Preserves",
      category: "Fruits",
      recipe: "Ripe peaches with sugar",
    },
    {
      name: "Marinara Sauce",
      category: "Sauces",
      recipe: "Roma tomatoes, herbs, onions",
    },
    {
      name: "Corn Relish",
      category: "Vegetables",
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
        const jarSize = JAR_SIZES[Math.floor(Math.random() * JAR_SIZES.length)];

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

// === DATE FORMAT SETTINGS ===

export async function getDateFormat(): Promise<DateFormat> {
  const database = await getDb();
  const result = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = ?",
    ["dateFormat"]
  );

  if (result?.value && DATE_FORMATS.some((df) => df.value === result.value)) {
    return result.value as DateFormat;
  }

  // Default to US format
  return "MM/DD/YYYY";
}

export async function setDateFormat(format: DateFormat): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
    ["dateFormat", format]
  );
}

export function formatDate(date: Date, format?: DateFormat): string {
  if (!format) {
    format = "MM/DD/YYYY"; // Default fallback
  }

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();

  const monthNames = [
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

  switch (format) {
    case "MM/DD/YYYY":
      return `${month.toString().padStart(2, "0")}/${day
        .toString()
        .padStart(2, "0")}/${year}`;
    case "DD/MM/YYYY":
      return `${day.toString().padStart(2, "0")}/${month
        .toString()
        .padStart(2, "0")}/${year}`;
    case "MMM DD, YYYY":
      return `${monthNames[month - 1]} ${day}, ${year}`;
    default:
      return date.toLocaleDateString();
  }
}

export async function formatDateWithUserPreference(
  date: Date
): Promise<string> {
  const userFormat = await getDateFormat();
  return formatDate(date, userFormat);
}

export function formatDateString(
  dateString: string,
  format?: DateFormat
): string {
  const date = new Date(dateString);
  return formatDate(date, format);
}

export async function formatDateStringWithUserPreference(
  dateString: string
): Promise<string> {
  const userFormat = await getDateFormat();
  return formatDateString(dateString, userFormat);
}

// Functions for batch-specific recipes
export async function getBatchRecipe(batchId: string): Promise<{
  recipe: string | null;
  recipe_image: string | null;
} | null> {
  const database = await getDb();
  const result = await database.getFirstAsync<{
    recipe: string | null;
    recipe_image: string | null;
  }>("SELECT recipe, recipe_image FROM jars WHERE batchId = ? LIMIT 1", [
    batchId,
  ]);
  return result || null;
}

export async function updateBatchRecipe(
  batchId: string,
  recipe?: string,
  recipeImage?: string
): Promise<void> {
  const database = await getDb();

  // First, check if this batch has a linked recipe in the recipes table
  const batchInfo = await database.getFirstAsync<{
    recipeId: number | null;
  }>("SELECT recipeId FROM jars WHERE batchId = ? LIMIT 1", [batchId]);

  if (batchInfo?.recipeId) {
    // Update the recipe in the recipes table
    console.log(
      `updateBatchRecipe: Updating recipe ${batchInfo.recipeId} in recipes table`
    );
    await updateRecipe(batchInfo.recipeId, {
      content: recipe || "",
      image: recipeImage || null,
    });

    // Also update the legacy fields for backward compatibility
    await database.runAsync(
      "UPDATE jars SET recipe = ?, recipe_image = ? WHERE batchId = ?",
      [recipe ?? null, recipeImage ?? null, batchId]
    );
  } else {
    // No linked recipe, just update the legacy fields
    console.log(
      `updateBatchRecipe: Updating legacy recipe fields for batch ${batchId}`
    );
    await database.runAsync(
      "UPDATE jars SET recipe = ?, recipe_image = ? WHERE batchId = ?",
      [recipe ?? null, recipeImage ?? null, batchId]
    );
  }
}

// Recipe Management Functions
export async function createRecipe(
  recipe: Omit<Recipe, "id" | "created_date">
): Promise<number> {
  const database = await getDb();
  console.log("createRecipe: Creating recipe with data:", {
    name: recipe.name,
    hasContent: !!recipe.content,
    hasImage: !!recipe.image,
  });

  const result = await database.runAsync(
    "INSERT INTO recipes (name, content, image, created_date) VALUES (?, ?, ?, datetime('now'))",
    [recipe.name, recipe.content, recipe.image ?? null]
  );

  console.log("createRecipe: Created recipe with ID:", result.lastInsertRowId);
  return result.lastInsertRowId;
}

export async function getAllRecipes(): Promise<Recipe[]> {
  const database = await getDb();
  console.log("getAllRecipes: Querying recipes table...");

  // Check if table exists
  try {
    const tableCheck = await database.getFirstAsync(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='recipes'"
    );
    console.log("Recipes table exists:", !!tableCheck);

    if (!tableCheck) {
      console.log("Creating recipes table...");
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS recipes (
          id INTEGER PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          content TEXT NOT NULL,
          image TEXT,
          created_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          last_used_date TEXT
        );
      `);
    }
  } catch (error) {
    console.error("Error checking/creating recipes table:", error);
  }

  const result = await database.getAllAsync<Recipe>(
    "SELECT * FROM recipes ORDER BY last_used_date DESC, created_date DESC"
  );
  console.log(
    "getAllRecipes: Found",
    result.length,
    "recipes",
    result.map((r) => ({
      id: r.id,
      name: r.name,
      hasImage: !!r.image,
    }))
  );
  return result;
}

export async function getRecipeById(id: number): Promise<Recipe | null> {
  const database = await getDb();
  return await database.getFirstAsync<Recipe>(
    "SELECT * FROM recipes WHERE id = ?",
    [id]
  );
}

export async function updateRecipe(
  id: number,
  recipe: Partial<Omit<Recipe, "id" | "created_date">>
): Promise<void> {
  const database = await getDb();
  const fields = [];
  const values = [];

  if (recipe.name !== undefined) {
    fields.push("name = ?");
    values.push(recipe.name);
  }
  if (recipe.content !== undefined) {
    fields.push("content = ?");
    values.push(recipe.content);
  }
  if (recipe.image !== undefined) {
    fields.push("image = ?");
    values.push(recipe.image);
  }

  if (fields.length > 0) {
    values.push(id);
    await database.runAsync(
      `UPDATE recipes SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    // Also sync changes to legacy fields in all batches that reference this recipe
    console.log(
      `updateRecipe: Syncing changes to recipe ${id} back to linked batches`
    );

    // Get the updated recipe data
    const updatedRecipe = await database.getFirstAsync<Recipe>(
      "SELECT content, image FROM recipes WHERE id = ?",
      [id]
    );

    if (updatedRecipe) {
      // Update legacy fields in all jars that reference this recipe
      const updateResult = await database.runAsync(
        "UPDATE jars SET recipe = ?, recipe_image = ? WHERE recipeId = ?",
        [updatedRecipe.content, updatedRecipe.image, id]
      );

      console.log(
        `updateRecipe: Updated legacy fields in ${updateResult.changes} batch records`
      );
    }
  }
}

export async function deleteRecipe(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM recipes WHERE id = ?", [id]);
}

export async function updateRecipeLastUsed(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    "UPDATE recipes SET last_used_date = datetime('now') WHERE id = ?",
    [id]
  );
}

// Functions to use recipes with batches
export async function setBatchRecipeById(
  batchId: string,
  recipeId?: number
): Promise<void> {
  const database = await getDb();
  if (recipeId) {
    await updateRecipeLastUsed(recipeId);
  }
  await database.runAsync("UPDATE jars SET recipeId = ? WHERE batchId = ?", [
    recipeId ?? null,
    batchId,
  ]);
}

// Functions to import existing batch recipes
export async function getUniqueBatchRecipes(): Promise<
  {
    recipe: string;
    recipe_image: string | null;
    batchCount: number;
    sampleBatchId: string;
    itemTypeName: string;
    source: "jar" | "item_type";
  }[]
> {
  const database = await getDb();

  // Get recipes from jars table (new system)
  const jarRecipes = await database.getAllAsync<{
    recipe: string;
    recipe_image: string | null;
    batchCount: number;
    sampleBatchId: string;
    itemTypeName: string;
  }>(
    `SELECT 
       j.recipe, 
       j.recipe_image, 
       COUNT(DISTINCT j.batchId) as batchCount,
       MIN(j.batchId) as sampleBatchId,
       it.name as itemTypeName
     FROM jars j
     JOIN item_types it ON j.itemTypeId = it.id
     WHERE j.recipe IS NOT NULL 
       AND j.recipe != ''
       AND j.recipeId IS NULL
     GROUP BY j.recipe, j.recipe_image
     ORDER BY batchCount DESC, j.recipe`
  );

  // Get recipes from item_types table (old system) that haven't been used in jars yet
  const itemTypeRecipes = await database.getAllAsync<{
    recipe: string;
    recipe_image: string | null;
    itemTypeName: string;
  }>(
    `SELECT DISTINCT 
       it.recipe, 
       it.recipe_image,
       it.name as itemTypeName
     FROM item_types it
     WHERE it.recipe IS NOT NULL 
       AND it.recipe != ''
       AND NOT EXISTS (
         SELECT 1 FROM recipes r 
         WHERE r.content = it.recipe 
           AND (r.image = it.recipe_image OR (r.image IS NULL AND it.recipe_image IS NULL))
       )
     ORDER BY it.name`
  );

  // Combine and format results
  const results = [
    ...jarRecipes.map((r) => ({ ...r, source: "jar" as const })),
    ...itemTypeRecipes.map((r) => ({
      ...r,
      batchCount: 0,
      sampleBatchId: "",
      source: "item_type" as const,
    })),
  ];

  return results;
}

export async function importBatchRecipeToCollection(
  recipe: string,
  recipeImage: string | null,
  recipeName: string,
  source: "jar" | "item_type" = "jar"
): Promise<number> {
  const database = await getDb();
  console.log("importBatchRecipeToCollection: Starting import with:", {
    name: recipeName,
    hasContent: !!recipe,
    hasImage: !!recipeImage,
    source,
  });

  // Create the recipe in the collection
  const result = await database.runAsync(
    "INSERT INTO recipes (name, content, image, created_date) VALUES (?, ?, ?, datetime('now'))",
    [recipeName, recipe, recipeImage]
  );

  const recipeId = result.lastInsertRowId;
  console.log(
    "importBatchRecipeToCollection: Created recipe with ID:",
    recipeId
  );

  if (source === "jar") {
    // Update all jars that have this recipe to reference the new recipe ID
    const updateResult = await database.runAsync(
      "UPDATE jars SET recipeId = ? WHERE recipe = ? AND (recipe_image = ? OR (recipe_image IS NULL AND ? IS NULL)) AND recipeId IS NULL",
      [recipeId, recipe, recipeImage, recipeImage]
    );
    console.log(
      "importBatchRecipeToCollection: Updated",
      updateResult.changes,
      "jars to reference this recipe"
    );
  }

  return recipeId;
}

export async function getBatchRecipeInfo(batchId: string): Promise<{
  recipe: string | null;
  recipe_image: string | null;
  recipeId: number | null;
  savedRecipe?: Recipe;
} | null> {
  const database = await getDb();
  const result = await database.getFirstAsync<{
    recipe: string | null;
    recipe_image: string | null;
    recipeId: number | null;
  }>(
    "SELECT recipe, recipe_image, recipeId FROM jars WHERE batchId = ? LIMIT 1",
    [batchId]
  );

  if (!result) return null;

  let savedRecipe: Recipe | undefined;
  if (result.recipeId) {
    savedRecipe = (await getRecipeById(result.recipeId)) ?? undefined;
  }

  return {
    ...result,
    savedRecipe,
  };
}

// Automatically migrate unique recipes from batches to the recipe collection
async function autoMigrateRecipesToCollection(): Promise<void> {
  console.log(
    "autoMigrateRecipesToCollection: Starting automatic recipe migration..."
  );

  try {
    // Get all unique batch recipes that haven't been migrated yet
    const uniqueRecipes = await getUniqueBatchRecipes();
    console.log(
      `autoMigrateRecipesToCollection: Found ${uniqueRecipes.length} unique recipes to migrate`
    );

    for (const recipeData of uniqueRecipes) {
      const { recipe, recipe_image, itemTypeName, source } = recipeData;

      // Generate a recipe name from the item type name and content preview
      const contentPreview = recipe.split("\n")[0].substring(0, 50);
      const recipeName = `${itemTypeName} Recipe`;

      console.log(
        `autoMigrateRecipesToCollection: Migrating recipe for "${itemTypeName}"`
      );

      try {
        await importBatchRecipeToCollection(
          recipe,
          recipe_image,
          recipeName,
          source
        );
        console.log(
          `autoMigrateRecipesToCollection: Successfully migrated "${recipeName}"`
        );
      } catch (error) {
        console.error(
          `autoMigrateRecipesToCollection: Error migrating "${recipeName}":`,
          error
        );
        // Continue with other recipes even if one fails
      }
    }

    console.log("autoMigrateRecipesToCollection: Recipe migration completed");
  } catch (error) {
    console.error(
      "autoMigrateRecipesToCollection: Error during automatic migration:",
      error
    );
    // Don't throw - migration is best effort
  }
}
