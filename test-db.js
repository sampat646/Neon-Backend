// Get neon db URL from environment variable
import "dotenv/config";
import pg from "pg";

const db = new pg.Pool({connectionString: process.env.DATABASE_URL});

try {
    const {rows} = await db.query("SELECT current_database(), current_user");
    console.log("Connected to database:", rows[0].current_database, "as user:", rows[0].current_user);
} catch (error) {
    console.error("Error connecting to the database:", error);
}finally {
    await db.end();
}