import { openDB, IDBPDatabase, DBSchema } from "idb";
import { SavedSettings, WorkoutSession } from "./types.ts";
import { calculateStreak } from "./logic.ts";

const DEFAULT_DB_NAME = "emom-timer-db";
const DB_VERSION = 1;

interface TimerDB extends DBSchema {
  sessions: {
    key: number;
    value: WorkoutSession & { date: Date; id?: number };
    indexes: { date: Date };
  };
  settings: {
    key: string;
    value: SavedSettings;
  };
}

export class StorageService {
  private readonly dbName: string;
  private dbPromise!: Promise<IDBPDatabase<TimerDB>>;

  constructor(dbName?: string) {
    this.dbName = dbName || DEFAULT_DB_NAME;
  }

  public async init(): Promise<void> {
    this.dbPromise = openDB<TimerDB>(this.dbName, DB_VERSION, {
      upgrade(db) {
        // Store for workout sessions
        if (!db.objectStoreNames.contains("sessions")) {
          const store = db.createObjectStore("sessions", { keyPath: "id", autoIncrement: true });
          store.createIndex("date", "date");
        }
        // Store for user settings
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings");
        }
      },
    });
    await this.dbPromise;
  }

  async saveSession(session: WorkoutSession): Promise<WorkoutSession & { date: Date }> {
    const db = await this.dbPromise;
    const tx = db.transaction("sessions", "readwrite");
    const store = tx.objectStore("sessions");

    const record = {
      date: new Date(),
      ...session,
    };

    await store.add(record);
    await tx.done;
    return record;
  }

  async saveSettings(settings: SavedSettings): Promise<void> {
    const db = await this.dbPromise;
    await db.put("settings", settings, "config");
  }

  async loadSettings(): Promise<SavedSettings | undefined> {
    const db = await this.dbPromise;
    return db.get("settings", "config");
  }

  async getStreak(): Promise<number> {
    const db = await this.dbPromise;
    const sessions = (await db.getAllFromIndex("sessions", "date")) as (WorkoutSession & {
      date: Date;
    })[];

    if (!sessions || sessions.length === 0) return 0;

    const dates = sessions.map((s) => s.date);
    return calculateStreak(dates);
  }
}
