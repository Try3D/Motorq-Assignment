import pool from "../src/database/connection";

async function checkDatabase() {
  console.log("Checking database connection...");

  try {
    const client = await pool.connect();
    console.log("✅ Successfully connected to PostgreSQL");

    const result = await client.query("SELECT NOW()");
    console.log("✅ Database query successful:", result.rows[0]);

    client.release();
    console.log("✅ Database connection test completed");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkDatabase();
