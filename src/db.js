import "dotenv/config";
import pg from "pg";

export const db = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000
});

db.on("error", (err) => {
    console.log("unexpected error", err.msg);
});