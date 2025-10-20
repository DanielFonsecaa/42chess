import express from "express";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import dotenv from "dotenv";
import cors from "cors";
import { prisma } from "./src/db.js";
//routes
import auth from "./src/routes/auth.js";
import users from "./src/routes/users.js";
import tornament from "./src/routes/tournment.js";

dotenv.config();

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
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/users", users);
app.use("/auth", auth);
app.use("/tornament", tornament);

app.get("/", async function (req, res) {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    res.json(error);
  }
});
