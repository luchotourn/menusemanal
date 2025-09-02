import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";

const { Pool } = pg;

const PgSession = connectPgSimple(session);

// Parse DATABASE_URL to extract connection params
const getDatabaseConfig = () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  // Parse the connection string
  const url = new URL(databaseUrl);
  return {
    user: url.username,
    password: url.password,
    host: url.hostname,
    port: parseInt(url.port || "5432"),
    database: url.pathname.slice(1),
    ssl: url.searchParams.get("sslmode") !== "disable" ? { rejectUnauthorized: false } : false,
  };
};

// Create PostgreSQL pool for session store
const createSessionPool = () => {
  try {
    return new Pool(getDatabaseConfig());
  } catch (error) {
    console.error("Failed to create session pool:", error);
    throw error;
  }
};

export const configureSession = () => {
  const isProduction = process.env.NODE_ENV === "production";
  
  // Create session pool
  const pool = createSessionPool();

  return session({
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
      ttl: 7 * 24 * 60 * 60, // 7 days in seconds
      disableTouch: false, // Allow session refresh on activity
      pruneSessionInterval: 60 * 60, // Prune expired sessions every hour
    }),
    secret: process.env.SESSION_SECRET || "menu-familiar-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiry on activity
    cookie: {
      secure: isProduction, // HTTPS only in production
      httpOnly: true, // Prevent XSS attacks
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      sameSite: isProduction ? "strict" : "lax", // CSRF protection
    },
    name: "menu.sid", // Custom session ID name
  });
};

// Helper to ensure session secret is secure in production
export const validateSessionConfig = () => {
  if (process.env.NODE_ENV === "production") {
    if (!process.env.SESSION_SECRET) {
      console.error("❌ SESSION_SECRET is not set in production!");
      console.error("Please set a secure random string as SESSION_SECRET environment variable");
      process.exit(1);
    }
    
    if (process.env.SESSION_SECRET === "menu-familiar-secret-key-change-in-production") {
      console.error("❌ Using default SESSION_SECRET in production is insecure!");
      console.error("Please set a unique SESSION_SECRET environment variable");
      process.exit(1);
    }
    
    if (process.env.SESSION_SECRET.length < 32) {
      console.error("❌ SESSION_SECRET should be at least 32 characters long for security");
      process.exit(1);
    }
  }
};