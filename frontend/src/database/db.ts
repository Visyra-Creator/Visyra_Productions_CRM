import { Platform } from 'react-native';

let SQLite: any = null;
let dbInstance: any = null;
let initPromise: Promise<any> | null = null;

// Only import SQLite on native platforms
if (Platform.OS !== 'web') {
  try {
    SQLite = require('expo-sqlite');
  } catch (error) {
    console.warn('SQLite not available:', error);
  }
}

export const initDatabase = async () => {
  if (Platform.OS === 'web' || !SQLite) return null;

  // If already initialized, return the instance
  if (dbInstance) return dbInstance;

  // If initialization is in progress, wait for it
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const db = await SQLite.openDatabaseAsync('visyra_crm_v2.db');
      
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS clients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id TEXT,
          name TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          event_type TEXT,
          event_date TEXT,
          event_location TEXT,
          package_name TEXT,
          total_price REAL DEFAULT 0,
          advance_paid REAL DEFAULT 0,
          balance_amount REAL DEFAULT 0,
          lead_source TEXT,
          notes TEXT,
          status TEXT DEFAULT 'active',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS shoots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id INTEGER,
          event_type TEXT,
          shoot_date TEXT,
          start_time TEXT,
          end_time TEXT,
          location TEXT,
          package_id INTEGER,
          status TEXT DEFAULT 'upcoming',
          notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (client_id) REFERENCES clients (id)
        );

        CREATE TABLE IF NOT EXISTS payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          payment_id TEXT,
          client_id INTEGER,
          shoot_id INTEGER,
          total_amount REAL DEFAULT 0,
          paid_amount REAL DEFAULT 0,
          balance REAL DEFAULT 0,
          payment_date TEXT,
          due_date TEXT,
          status TEXT DEFAULT 'pending',
          payment_method TEXT,
          receipt_path TEXT,
          is_cleared INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (client_id) REFERENCES clients (id),
          FOREIGN KEY (shoot_id) REFERENCES shoots (id)
        );

        CREATE TABLE IF NOT EXISTS packages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          event_type TEXT,
          price REAL,
          duration_hours INTEGER,
          deliverables TEXT,
          description TEXT,
          covers TEXT,
          team_type TEXT,
          team_size INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS leads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lead_id TEXT,
          name TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          company_name TEXT,
          event_type TEXT,
          event_date TEXT,
          source TEXT,
          budget REAL DEFAULT 0,
          stage TEXT DEFAULT 'new',
          last_contact TEXT,
          notes TEXT,
          next_follow_up TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          amount REAL,
          category TEXT,
          paid_to TEXT,
          payment_method TEXT,
          status TEXT DEFAULT 'paid',
          date TEXT,
          notes TEXT,
          receipt_path TEXT,
          shoot_id INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (shoot_id) REFERENCES shoots (id)
        );

        CREATE TABLE IF NOT EXISTS portfolio (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          media_type TEXT DEFAULT 'image',
          file_path TEXT,
          thumbnail_path TEXT,
          category TEXT,
          description TEXT,
          tags TEXT,
          featured INTEGER DEFAULT 0,
          client_id INTEGER,
          shoot_id INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (client_id) REFERENCES clients (id),
          FOREIGN KEY (shoot_id) REFERENCES shoots (id)
        );

        CREATE TABLE IF NOT EXISTS portfolio_images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          portfolio_id INTEGER,
          image_path TEXT,
          display_order INTEGER,
          FOREIGN KEY (portfolio_id) REFERENCES portfolio (id)
        );

        CREATE TABLE IF NOT EXISTS app_options (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          label TEXT NOT NULL,
          is_default INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS locations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT,
          city TEXT,
          is_paid INTEGER DEFAULT 0,
          price REAL DEFAULT 0,
          address TEXT,
          venue_name TEXT,
          landmark TEXT,
          google_maps_url TEXT,
          notes TEXT,
          usage_count INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS location_images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          location_id INTEGER,
          image_path TEXT,
          FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE
        );
      `);

      const ensureFormattedIdColumn = async (tableName: string, columnName: string, prefix: string) => {
        try {
          const tableInfo: any = await db.getAllAsync(`PRAGMA table_info(${tableName})`);
          const hasColumn = tableInfo.some((col: any) => col.name === columnName);
          if (!hasColumn) {
            console.log(`Migrating: Adding ${columnName} to ${tableName}`);
            await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} TEXT;`);

            // Backfill existing rows
            console.log(`Backfilling ${columnName} for existing records...`);
            await db.execAsync(
              `UPDATE ${tableName} SET ${columnName} = '${prefix}' || substr('0000' || id, -4) WHERE ${columnName} IS NULL;`
            );
          }
        } catch (e) {
          console.error(`Error ensuring column ${columnName} in ${tableName}:`, e);
        }
      };

      await ensureFormattedIdColumn('leads', 'lead_id', 'L');
      await ensureFormattedIdColumn('clients', 'client_id', 'C');
      await ensureFormattedIdColumn('payments', 'payment_id', 'P');

      // Triggers to auto-generate IDs on new inserts
      await db.execAsync(`
        CREATE TRIGGER IF NOT EXISTS set_lead_id AFTER INSERT ON leads
        BEGIN
          UPDATE leads SET lead_id = 'L' || substr('0000' || NEW.id, -4) WHERE id = NEW.id;
        END;
      `);

      await db.execAsync(`
        CREATE TRIGGER IF NOT EXISTS set_client_id AFTER INSERT ON clients
        BEGIN
          UPDATE clients SET client_id = 'C' || substr('0000' || NEW.id, -4) WHERE id = NEW.id;
        END;
      `);

      await db.execAsync(`
        CREATE TRIGGER IF NOT EXISTS set_payment_id AFTER INSERT ON payments
        BEGIN
          UPDATE payments SET payment_id = 'P' || substr('0000' || NEW.id, -4) WHERE id = NEW.id;
        END;
      `);

      const ensureColumn = async (tableName: string, columnName: string, columnType: string) => {
        try {
          const tableInfo: any = await db.getAllAsync(`PRAGMA table_info(${tableName})`);
          const hasColumn = tableInfo.some((col: any) => col.name === columnName);
          if (!hasColumn) {
            console.log(`Migrating: Adding ${columnName} to ${tableName}`);
            await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType};`);
          }
        } catch (e) {
          console.error(`Error ensuring column ${columnName} in ${tableName}:`, e);
        }
      };

      await ensureColumn('payments', 'payment_method', 'TEXT');
      await ensureColumn('payments', 'receipt_path', 'TEXT');
      await ensureColumn('payments', 'due_date', 'TEXT');
      await ensureColumn('payments', 'is_cleared', 'INTEGER DEFAULT 0');

      await ensureColumn('expenses', 'paid_to', 'TEXT');
      await ensureColumn('expenses', 'payment_method', 'TEXT');
      await ensureColumn('expenses', 'status', "TEXT DEFAULT 'paid'");

      // Portfolio migrations
      await ensureColumn('portfolio', 'media_type', "TEXT DEFAULT 'image'");
      await ensureColumn('portfolio', 'file_path', 'TEXT');
      await ensureColumn('portfolio', 'thumbnail_path', 'TEXT');
      await ensureColumn('portfolio', 'client_id', 'INTEGER');
      await ensureColumn('portfolio', 'shoot_id', 'INTEGER');
      await ensureColumn('portfolio', 'created_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');

      // Lead migrations
      await ensureColumn('leads', 'next_follow_up', 'TEXT');

      const seedOptions = async (type: string, labels: string[]) => {
        try {
          const result: any = await db.getAllAsync("SELECT COUNT(*) as count FROM app_options WHERE type = ?", [type]);
          if (result[0].count === 0) {
            console.log(`Seeding default options for: ${type}`);
            for (const label of labels) {
              await db.runAsync("INSERT INTO app_options (type, label) VALUES (?, ?)", [type, label]);
            }
          }
        } catch (e) {
          console.error(`Error seeding options for ${type}:`, e);
        }
      };

      await seedOptions('lead_source', ['Instagram', 'Facebook', 'Referral', 'Website', 'Walk-in']);
      await seedOptions('payment_method', ['Cash', 'UPI', 'Bank Transfer', 'Cheque']);
      await seedOptions('event_type', ['Wedding', 'Pre-Wedding', 'Engagement', 'Maternity', 'Baby Shoot', 'Corporate', 'Fashion']);
      await seedOptions('shoot_category', ['Cinematic Video', 'Traditional Video', 'Candid Photo', 'Traditional Photo', 'Drone', 'Outdoor']);

      console.log('Database initialized and migrated successfully');
      dbInstance = db;
      return db;
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
};

export const getDatabase = () => {
  if (Platform.OS === 'web') throw new Error('Database not supported on web');
  if (!dbInstance) throw new Error('Database not initialized. Call initDatabase first.');
  return dbInstance;
};

export default { initDatabase, getDatabase };
