import pool from "../src/database/connection";

async function initDatabase() {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS owners (
        owner_id INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS fleets (
        fleet_id INTEGER PRIMARY KEY,
        fleet_type VARCHAR(50) NOT NULL CHECK (fleet_type IN ('Corporate', 'Rental', 'Personal')),
        owner_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES owners(owner_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        vin INTEGER PRIMARY KEY,
        manufacturer VARCHAR(50) NOT NULL CHECK (manufacturer IN ('Tesla', 'BMW', 'Ford', 'Toyota')),
        fleet_id INTEGER NOT NULL,
        registration_status VARCHAR(50) NOT NULL CHECK (registration_status IN ('Active', 'Maintanance', 'Decommissioned')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (fleet_id) REFERENCES fleets(fleet_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS telemetry (
        id SERIAL PRIMARY KEY,
        vehicle_vin INTEGER NOT NULL,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        speed DECIMAL(5, 2) NOT NULL,
        engine_status VARCHAR(10) NOT NULL CHECK (engine_status IN ('On', 'Off', 'Idle')),
        fuel DECIMAL(5, 2) NOT NULL,
        total_km DECIMAL(10, 2) NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicle_vin) REFERENCES vehicles(vin)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        vehicle_vin INTEGER NOT NULL,
        alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('Speed Violation', 'Low Fuel', 'Engine Status', 'Maintenance')),
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('Critical', 'Warning', 'Info')),
        message TEXT NOT NULL,
        threshold_value DECIMAL(10, 2),
        actual_value DECIMAL(10, 2),
        is_resolved BOOLEAN DEFAULT FALSE,
        triggered_at TIMESTAMP NOT NULL,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicle_vin) REFERENCES vehicles(vin)
      )
    `);

    console.log("✅ Database tables created successfully!");
  } catch (error) {
    console.error("❌ Error creating tables:", error);
  } finally {
    client.release();
  }
}

initDatabase()
  .then(() => {
    console.log("✅ Database initialization complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Database initialization failed:", error);
    process.exit(1);
  });
