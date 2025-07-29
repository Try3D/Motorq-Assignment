"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const connection_1 = __importDefault(require("../src/database/connection"));
async function checkDatabase() {
    console.log("Checking database connection...");
    try {
        const client = await connection_1.default.connect();
        console.log("✅ Successfully connected to PostgreSQL");
        const result = await client.query("SELECT NOW()");
        console.log("✅ Database query successful:", result.rows[0]);
        client.release();
        console.log("✅ Database connection test completed");
    }
    catch (error) {
        console.error("❌ Database connection failed:", error);
        process.exit(1);
    }
    finally {
        await connection_1.default.end();
    }
}
checkDatabase();
