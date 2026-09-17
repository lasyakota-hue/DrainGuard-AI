import sqlite3 from "sqlite3";
import fs from "fs";
import path from "path";

const directory = path.join(process.cwd(), "data");

if (!fs.existsSync(directory)) {
  fs.mkdirSync(directory, { recursive: true });
}

const db = new sqlite3.Database(path.join(directory, "drain_guard.db"));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS drains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      capacity INTEGER DEFAULT 100,
      water_level REAL DEFAULT 0,
      temperature REAL DEFAULT 0,
      status TEXT DEFAULT 'NORMAL',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drain_id INTEGER,
      severity TEXT,
      title TEXT,
      description TEXT,
      status TEXT DEFAULT 'OPEN',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      acknowledged_at TEXT,
      cleaned_at TEXT,
      FOREIGN KEY(drain_id) REFERENCES drains(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sensor_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drain_id INTEGER,
      water_level REAL,
      temperature REAL,
      status TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id INTEGER,
      message TEXT,
      type TEXT,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cleanups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id INTEGER,
      drain_id INTEGER,
      before_level REAL,
      after_level REAL,
      verified INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.get("SELECT COUNT(*) AS count FROM drains", (error, row) => {
    if (!error && row.count === 0) {
      const statement = db.prepare(`
        INSERT INTO drains
        (name, location, latitude, longitude, water_level, temperature, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      statement.run("Drain Node A1", "Hyderabad Central Zone", 17.3850, 78.4867, 32, 28, "NORMAL");
      statement.run("Drain Node A2", "Hitech City", 17.4483, 78.3915, 46, 29, "NORMAL");
      statement.run("Drain Node B1", "Kukatpally", 17.4849, 78.4138, 68, 30, "WARNING");
      statement.run("Drain Node B2", "Madhapur", 17.4486, 78.3908, 91, 31, "CRITICAL");

      statement.finalize();
    }
  });
});

export default db;