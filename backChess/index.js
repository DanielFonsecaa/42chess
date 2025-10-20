import express from "express";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import dotenv from "dotenv";
import cors from "cors";
//import { prisma } from "./src/db.js";
//routes
import auth from "./src/routes/auth.js";
import users from "./src/routes/users.js";
import tornament from "./src/routes/tournment.js";

dotenv.config();
console.log("🟡 Iniciando backend");
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "42 Chess Club",
      version: "1.0.0",
      description: "API for our 42Chess club",
    },
    servers: [
      {
        url: process.env.SWAGGER_SERVER || "http://localhost:3000",
      },
      {
        url: "https://42chess.com",
        description: "Production site",
      },
      {
        url: "https://www.42chess.com",
        description: "Production (www)",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJSDoc(options);
const app = express();

// Lightweight health endpoint that doesn't touch the database.
// Useful for platform health checks to know the container process is running.
app.get("/health", (_req, res) => res.sendStatus(200));

// Global error handlers to surface unexpected startup/runtime errors in logs
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err && err.stack ? err.stack : err);
  // allow process to crash after logging so platform restarts the container
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

// Configure CORS: allow production domain and localhost during development
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN || "https://42chess.com",
  "https://www.42chess.com",
  "http://localhost:5173",
  "http://localhost:3000",
];
// If FRONTEND_ORIGIN is provided at runtime, ensure it's allowed
if (process.env.FRONTEND_ORIGIN) {
  // avoid duplicates
  if (!allowedOrigins.includes(process.env.FRONTEND_ORIGIN))
    allowedOrigins.push(process.env.FRONTEND_ORIGIN);
}
app.use(
  cors({
    origin: function (origin, cb) {
      // allow requests with no origin (curl, server-to-server)
      if (!origin) return cb(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) cb(null, true);
      else cb(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json());

const PORT = process.env.PORT ?? 3000;

// Helper to extract a DB host (masked) from DATABASE_URL for safe logging
function getDbHostMask() {
  const url = process.env.DATABASE_URL || "";
  const m = url.match(/@([^:/]+)(?::\d+)?\//);
  if (m && m[1]) return m[1];
  if (process.env.DB_HOST) return process.env.DB_HOST;
  return "(unknown)";
}

console.log("Starting application with:", {
  PORT: PORT,
  DB_HOST: getDbHostMask(),
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || null,
  allowedOrigins,
});

let server;
try {
  server = app.listen(PORT, "0.0.0.0", () =>
    console.log(`Server listening on ${PORT} (0.0.0.0)`)
  );
} catch (err) {
  console.error("Failed to bind server:", err && err.stack ? err.stack : err);
  // Crash so platform restarts and we get a fresh start with logs
  process.exit(1);
}

// Graceful shutdown handlers so platform logs show why we stopped
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing server...");
  try {
    if (server)
      server.close(() => {
        console.log("HTTP server closed");
     //   prisma.$disconnect().finally(() => process.exit(0));
      });
    else {
    //  await prisma.$disconnect();
      process.exit(0);
    }
  } catch (e) {
    console.error("Error during shutdown:", e);
    process.exit(1);
  }
});
console.log("✅ Express configurado");
console.log("✅ Prisma importado");

process.on("SIGINT", () => {
  console.log("SIGINT received, exiting");
  process.exit(0);
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/users", users);
app.use("/auth", auth);
app.use("/tornament", tornament);

app.get("/", async function (req, res) {
  res.json({ status: "Servidor rodando ✅" });
});
});
