import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               img:
 *                 type: string
 *                 format: uri
 *     responses:
 *       '201':
 *         description: Created - returns created user and token
 *       '400':
 *         description: Missing required fields
 *       '409':
 *         description: Email already in use
 */
//REGISTER
router.post("/register", async (req, res) => {
  try {
    // Debug log to verify handler is executed
    console.debug("[AUTH] register called", { email: req.body?.email });
    const { name, email, password, img } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // Check if user already exists
    const existing = await prisma.user.findFirst({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: "Email already in use" });
    }

    // Hash password
    const envSalt = Number(process.env.SALT_ROUNDS);
    const saltRounds = Number.isInteger(envSalt) && envSalt > 0 ? envSalt : 10;
    const hashed = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        img: img ?? null,
      },
      // Don't return password in the response
      select: { id: true, name: true, email: true, img: true, isAdmin: true },
    });

    // Optionally issue a token
    const token = jwt.sign(
      { id: user.id, isAdmin: user.isAdmin, email: user.email },
      process.env.JWT_TOKEN,
      { expiresIn: "1d" }
    );

    return res.status(201).json({ user, token });
  } catch (err) {
    // Prisma unique constraint code is P2002
    if (err?.code === "P2002") {
      return res
        .status(409)
        .json({ message: "A record with that value already exists." });
    }
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Log in a user
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       '200':
 *         description: OK - returns user public data and token
 *       '400':
 *         description: Missing credentials
 *       '401':
 *         description: Wrong credentials
 */
//LOGIN
router.post("/login", async (req, res) => {
  try {
    // Debug log to verify handler is executed
    console.debug("[AUTH] login called", { email: req.body?.email });
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Missing credentials" });

    const user = await prisma.user.findFirst({ where: { email } });
    if (!user) return res.status(401).json({ message: "Wrong credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Wrong credentials" });

    const token = jwt.sign(
      { id: user.id, isAdmin: user.isAdmin, email: user.email },
      process.env.JWT_TOKEN,
      { expiresIn: "1d" }
    );

    // exclude password from response
    const { password: _pw, ...publicData } = user;
    res.status(200).json({ ...publicData, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
