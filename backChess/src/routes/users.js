import express from "express";
import { verifyTokenAuthorization, verifyTokenAdmin } from "./verifyToken.js";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

/**
 * @openapi
 * /users:
 *   get:
 *     summary: Get list of users (admin only)
 *     tags:
 *       - Users
 *     parameters:
 *       - in: query
 *         name: new
 *         schema:
 *           type: boolean
 *         description: If true, return the 5 newest users
 *     responses:
 *       '200':
 *         description: OK - list of users
 *       '401':
 *         description: Unauthorized
 */
//Get All Users
router.get("/", verifyTokenAdmin, async (req, res) => {
  const isNew = req.query.new; // e.g. ?new=true or ?new=1
  try {
    const baseSelect = {
      id: true,
      name: true,
      email: true,
      img: true,
      intra: true,
      isAdmin: true,
    };

    const users = isNew
      ? await prisma.user.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          select: baseSelect,
        })
      : await prisma.user.findMany({ select: baseSelect });

    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Error fetching all the users" });
  }
});

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Get a user by id (admin only)
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: OK - user object
 *       '404':
 *         description: User not found
 */
//Get user
router.get("/:id", verifyTokenAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        name: true,
        email: true,
        img: true,
        intra: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json(error);
  }
});

/**
 * @openapi
 * /users/{id}:
 *   put:
 *     summary: Update a user (owner or admin)
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       '200':
 *         description: OK - updated user
 *       '401':
 *         description: Unauthorized or invalid current password
 */
//Update
router.put("/:id", verifyTokenAuthorization, async (req, res) => {
  try {
    const userId = req.params.id;
    // Find existing user
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: "User not found" });

    const updateData = {};

    // Allowed updatable fields
    const allowed = ["name", "email", "img"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }

    // Handle password change: require currentPassword and newPassword
    if (req.body.currentPassword || req.body.newPassword) {
      if (!req.body.currentPassword || !req.body.newPassword) {
        return res.status(400).json({
          message: "Provide currentPassword and newPassword to change password",
        });
      }

      if (!user.password) {
        // No local password set on account
        return res
          .status(400)
          .json({ message: "No local password set for this user" });
      }

      const valid = await bcrypt.compare(
        req.body.currentPassword,
        user.password
      );
      if (!valid)
        return res
          .status(401)
          .json({ message: "Current password is incorrect" });

      const envSalt = Number(process.env.SALT_ROUNDS);
      const saltRounds =
        Number.isInteger(envSalt) && envSalt > 0 ? envSalt : 10;
      const hashed = await bcrypt.hash(req.body.newPassword, saltRounds);
      updateData.password = hashed;
    }

    // Only allow isAdmin change if requester is admin
    if (req.body.isAdmin !== undefined) {
      const requesterIsAdmin = req.user && req.user.isAdmin;
      if (requesterIsAdmin) {
        updateData.isAdmin = Boolean(req.body.isAdmin);
      }
    }

    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          img: true,
          intra: true,
          isAdmin: true,
          createdAt: true,
        },
      });

      return res.status(200).json(updated);
    } catch (err) {
      if (err?.code === "P2002") {
        return res
          .status(409)
          .json({ message: "A record with that value already exists." });
      }
      throw err;
    }
  } catch (error) {
    console.error("Update error:", error);
    return res
      .status(500)
      .json({ message: "Server Error: cannot update user" });
  }
});

/**
 * @openapi
 * /users/del/{id}:
 *   delete:
 *     summary: Delete a user (admin only)
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: OK - deletion confirmation
 *       '404':
 *         description: User not found
 */
//Delete
router.delete("/del/:id", verifyTokenAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    await prisma.user.delete({ where: { id } });
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    // Prisma throws P2025 when record to delete does not exist
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "User not found" });
    }
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Error deleting user" });
  }
});

export default router;
