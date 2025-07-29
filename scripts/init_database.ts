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
        FOREIGN KEY (vehicle_vin) REFERENCES vehicles(vin),
        UNIQUE(vehicle_vin, timestamp)
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

    // Add vehicle authentication table
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicle_auth (
        id SERIAL PRIMARY KEY,
        vehicle_vin INTEGER NOT NULL,
        api_key_hash VARCHAR(64) NOT NULL,
        api_key_prefix VARCHAR(16) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'revoked')),
        provisioned_by VARCHAR(100),
        provisioned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP,
        rate_limit_per_hour INTEGER DEFAULT 3600,
        FOREIGN KEY (vehicle_vin) REFERENCES vehicles(vin),
        UNIQUE(vehicle_vin),
        UNIQUE(api_key_hash)
      )
    `);

    // Add admin users table for fleet operators
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(64) NOT NULL,
        role VARCHAR(20) DEFAULT 'fleet_manager' CHECK (role IN ('super_admin', 'fleet_manager', 'technician')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);

    // Add vehicle request logs table for rate limiting
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicle_request_logs (
        id SERIAL PRIMARY KEY,
        vehicle_vin INTEGER NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        endpoint VARCHAR(255) NOT NULL,
        ip_address INET,
        FOREIGN KEY (vehicle_vin) REFERENCES vehicles(vin)
      )
    `);

    // Add index for efficient rate limiting queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_vehicle_request_logs_vin_timestamp 
      ON vehicle_request_logs(vehicle_vin, timestamp DESC)
    `);

    // Add index for cleanup queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_vehicle_request_logs_timestamp 
      ON vehicle_request_logs(timestamp)
    `);

    console.log("✅ Database tables created successfully!");
    
    // Verify the vehicle_request_logs table was created
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'vehicle_request_logs'
      )
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log("✅ vehicle_request_logs table verified");
    } else {
      console.log("❌ vehicle_request_logs table NOT found");
    }

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
