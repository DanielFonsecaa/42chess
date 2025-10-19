import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import {
  verifyToken,
  verifyTokenAuthorization,
  verifyTokenAdmin,
} from "./verifyToken.js";

const prisma = new PrismaClient();
const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: Tournament
 *     description: Tournament management endpoints
 */

/**
 * @openapi
 * /tornament:
 *   post:
 *     summary: Create a tournament (admin only)
 *     tags: [Tournament]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               startedAt:
 *                 type: string
 *                 format: date-time
 *               endedAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       '201':
 *         description: Tournament created
 *       '400':
 *         description: Missing or invalid fields
 */
//CREATE TORNAMENT
router.post("/", verifyTokenAdmin, async (req, res) => {
  try {
    const { name, startedAt, endedAt } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ message: "Missing or invalid name" });
    }

    // Prisma schema currently requires startedAt to be non-null.
    // If the client didn't provide one, use the current time so creation succeeds.
    const createData = {
      name,
      startedAt: startedAt ? new Date(startedAt) : new Date(),
    };
    if (endedAt !== undefined)
      createData.endedAt = endedAt ? new Date(endedAt) : null;

    const tournament = await prisma.tournament.create({
      data: createData,
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true, img: true } },
          },
        },
        matches: true,
      }, // optional
    });

    return res.status(201).json(tournament);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * @openapi
 * /tornament/{tournamentId}/join:
 *   post:
 *     summary: Join a tournament (authenticated users)
 *     tags: [Tournament]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '201':
 *         description: Participant created
 *       '404':
 *         description: Tournament not found
 */
//CREATE PARTICIPANT TORNAMENT
router.post("/:tournamentId/join", verifyToken, async (req, res) => {
  const tournamentId = req.params.tournamentId;
  const userId = req.user.id;

  try {
    // Ensure tournament exists
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament)
      return res.status(404).json({ message: "Tournament not found" });

    // Prevent duplicate joins: check if the user is already a participant
    const existingParticipant = await prisma.tournamentParticipant.findFirst({
      where: { tournamentId, userId },
    });
    if (existingParticipant) {
      return res.status(409).json({ message: "Already joined" });
    }

    // create participant and include the related user so the response contains user info
    const participant = await prisma.tournamentParticipant.create({
      data: { tournamentId, userId },
      include: { user: true },
    });

    return res.status(201).json(participant);
  } catch (err) {
    // Handle duplicate (unique constraint) — Prisma error code is P2002
    if (err?.code === "P2002") {
      return res.status(409).json({ message: "Already joined" });
    }
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * @openapi
 * /tornament:
 *   get:
 *     summary: List tournaments
 *     tags: [Tournament]
 *     responses:
 *       '200':
 *         description: Array of tournaments
 */
// LIST TOURNAMENTS
router.get("/", async (req, res) => {
  try {
    const tournaments = await prisma.tournament.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true, img: true } },
          },
        },
      },
    });
    res.json(tournaments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @openapi
 * /tornament/{tournamentId}/start:
 *   post:
 *     summary: Start or create next round of a tournament (admin only)
 *     tags: [Tournament]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Round created
 *       '400':
 *         description: Not enough participants or previous round incomplete
 */
// START TOURNAMENT: generate round-robin matches (admin only)
router.post("/:tournamentId/start", verifyTokenAdmin, async (req, res) => {
  const tournamentId = req.params.tournamentId;
  try {
    const participants = await prisma.tournamentParticipant.findMany({
      where: { tournamentId },
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true, byeCount: true },
    });

    if (participants.length < 2) {
      return res.status(400).json({ message: "Not enough participants" });
    }

    // if tournament has < 10 participants -> full round-robin (all rounds)
    if (participants.length <= 10) {
      // round-robin: create only the next round each time start is called
      // compute pairings
      const ids = participants.map((p) => p.id);

      const generateRoundRobinPairings = (players) => {
        const p = players.slice();
        const isOdd = p.length % 2 === 1;
        if (isOdd) p.push(null); // null == bye
        const n = p.length;
        const rounds = [];
        for (let r = 0; r < n - 1; r++) {
          const pairs = [];
          for (let i = 0; i < n / 2; i++) {
            const a = p[i];
            const b = p[n - 1 - i];
            pairs.push([a, b]);
          }
          // rotate keeping first element in place
          p.splice(1, 0, p.pop());
          rounds.push(pairs);
        }
        return rounds;
      };

      const rounds = generateRoundRobinPairings(ids);

      // Determine current max round and create only the next one
      const maxRoundRes = await prisma.match.aggregate({
        where: { tournamentId },
        _max: { round: true },
      });
      const nextRound = (maxRoundRes._max.round || 0) + 1;

      // Ensure previous round (nextRound - 1) results are complete before creating the next
      if (nextRound > 1) {
        const prevMatches = await prisma.match.findMany({
          where: { tournamentId, round: nextRound - 1 },
          select: { id: true, scoreA: true, scoreB: true },
        });
        const incomplete = prevMatches.some(
          (m) => typeof m.scoreA !== "number" || typeof m.scoreB !== "number"
        );
        if (incomplete) {
          return res
            .status(400)
            .json({ message: "Previous round not complete" });
        }
      }

      if (nextRound > rounds.length) {
        return res.status(400).json({ message: "All rounds already created" });
      }

      // create matches only for rounds[nextRound - 1]
      const pairs = rounds[nextRound - 1];
      const ops = [];
      pairs.forEach(([a, b]) => {
        if (a === null && b === null) return;
        // determine initial assignment; if one is null, that's the bye
        let playerAId = a ?? b;
        let playerBId = a ? b : null;
        // if both players exist, randomize which one becomes A or B
        if (playerBId != null && Math.random() < 0.5) {
          const tmp = playerAId;
          playerAId = playerBId;
          playerBId = tmp;
        }
        const isBye = playerBId == null;
        ops.push(
          prisma.match.create({
            data: {
              tournamentId,
              round: nextRound,
              playerAId,
              playerBId,
              scoreA: isBye ? 0.5 : 0,
              scoreB: isBye ? 0 : 0,
            },
          })
        );
        if (isBye) {
          ops.push(
            prisma.tournamentParticipant.update({
              where: { id: playerAId },
              data: { byeCount: { increment: 1 } },
            })
          );
        }
      });

      await prisma.$transaction(ops);

      // mark tournament as started if not already
      await prisma.tournament.update({
        where: { id: tournamentId },
        data: { startedAt: new Date() },
      });

      return res.json({
        message: "Round created (round-robin)",
        round: nextRound,
      });
    }

    // >= 10 participants -> Swiss pairing for next round
    // Determine current max round
    const maxRoundRes = await prisma.match.aggregate({
      where: { tournamentId },
      _max: { round: true },
    });
    const nextRound = (maxRoundRes._max.round || 0) + 1;

    // Ensure previous round (nextRound - 1) results are complete before creating the next (if exists)
    if (nextRound > 1) {
      const prevMatches = await prisma.match.findMany({
        where: { tournamentId, round: nextRound - 1 },
        select: { id: true, scoreA: true, scoreB: true },
      });
      const incomplete = prevMatches.some(
        (m) => typeof m.scoreA !== "number" || typeof m.scoreB !== "number"
      );
      if (incomplete) {
        return res.status(400).json({ message: "Previous round not complete" });
      }
    }

    // load all matches to compute points and previous opponents
    const allMatches = await prisma.match.findMany({
      where: { tournamentId },
      select: { playerAId: true, playerBId: true, scoreA: true, scoreB: true },
    });

    // compute points per participant
    const pointsMap = {};
    const playedMap = {}; // 'a-b' -> true
    participants.forEach((p) => {
      pointsMap[p.id] = 0;
    });
    allMatches.forEach((m) => {
      if (m.playerAId) {
        pointsMap[m.playerAId] =
          (pointsMap[m.playerAId] || 0) + (m.scoreA || 0);
      }
      if (m.playerBId) {
        pointsMap[m.playerBId] =
          (pointsMap[m.playerBId] || 0) + (m.scoreB || 0);
      }
      if (m.playerAId && m.playerBId) {
        playedMap[`${m.playerAId}-${m.playerBId}`] = true;
        playedMap[`${m.playerBId}-${m.playerAId}`] = true;
      }
    });

    // build pool with sorting: points desc, byeCount asc, createdAt asc
    const pool = participants
      .map((p) => ({
        id: p.id,
        points: pointsMap[p.id] || 0,
        byeCount: p.byeCount || 0,
        createdAt: p.createdAt,
      }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (a.byeCount !== b.byeCount) return a.byeCount - b.byeCount;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });

    const pairs = [];
    const remaining = pool.slice();

    // greedy pairing: for each top player, find first opponent not played yet
    while (remaining.length > 1) {
      const p = remaining.shift();
      let idx = remaining.findIndex((op) => !playedMap[`${p.id}-${op.id}`]);
      if (idx === -1) {
        // no opponent not played before, just pick the first
        idx = 0;
      }
      const opponent = remaining.splice(idx, 1)[0];
      pairs.push([p.id, opponent.id]);
    }

    // if odd one remains -> assign bye to the remaining or choose lowest who hasn't had bye
    let byeAssigned = null;
    if (remaining.length === 1) {
      const single = remaining[0];
      // prefer someone with byeCount == 0 and lowest points
      const noByeCandidates = pool.slice().filter((pp) => pp.byeCount === 0);
      if (noByeCandidates.length > 0) {
        // pick the lowest by points among no-bye candidates
        noByeCandidates.sort(
          (a, b) => a.points - b.points || a.byeCount - b.byeCount
        );
        byeAssigned = noByeCandidates[0].id;
        // remove from pairs if it was already included (unlikely)
        // ensure we don't duplicate
        pairs.push([byeAssigned, null]);
      } else {
        // everyone had bye, fallback to the remaining single
        pairs.push([single.id, null]);
        byeAssigned = single.id;
      }
    }

    // create match records in a transaction; also update byeCount if needed
    const ops = [];
    pairs.forEach(([aId, bId]) => {
      const isBye = bId == null;
      ops.push(
        prisma.match.create({
          data: {
            tournamentId,
            round: nextRound,
            playerAId: aId,
            playerBId: bId,
            scoreA: isBye ? 0.5 : 0,
            scoreB: isBye ? 0 : 0,
          },
        })
      );
      if (isBye) {
        ops.push(
          prisma.tournamentParticipant.update({
            where: { id: aId },
            data: { byeCount: { increment: 1 } },
          })
        );
      }
    });

    await prisma.$transaction(ops);

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { startedAt: new Date() },
    });

    return res.json({
      message: "Swiss round created",
      round: nextRound,
      pairs: pairs.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @openapi
 * /tornament/{tournamentId}/close:
 *   post:
 *     summary: Close a tournament and compute winner (admin only)
 *     tags: [Tournament]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Tournament closed
 */
// CLOSE TOURNAMENT: compute final standings, set winner and endedAt (admin only)
router.post("/:tournamentId/close", verifyTokenAdmin, async (req, res) => {
  const tournamentId = req.params.tournamentId;
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament)
      return res.status(404).json({ message: "Tournament not found" });

    // ensure there is at least one round
    const rounds = await prisma.match.findMany({
      where: { tournamentId },
      select: { round: true },
    });
    if (rounds.length === 0)
      return res.status(400).json({ message: "No rounds created" });

    const maxRound = Math.max(...rounds.map((r) => r.round));

    // ensure all rounds up to maxRound are complete
    for (let r = 1; r <= maxRound; r++) {
      const ms = await prisma.match.findMany({
        where: { tournamentId, round: r },
        select: { scoreA: true, scoreB: true },
      });
      const incomplete = ms.some(
        (m) => typeof m.scoreA !== "number" || typeof m.scoreB !== "number"
      );
      if (incomplete)
        return res.status(400).json({ message: `Round ${r} not complete` });
    }

    // compute points per participant
    const allMatches = await prisma.match.findMany({
      where: { tournamentId },
      select: { playerAId: true, playerBId: true, scoreA: true, scoreB: true },
    });
    const points = {};
    allMatches.forEach((m) => {
      if (m.playerAId)
        points[m.playerAId] = (points[m.playerAId] || 0) + (m.scoreA || 0);
      if (m.playerBId)
        points[m.playerBId] = (points[m.playerBId] || 0) + (m.scoreB || 0);
    });

    // find participant with max points (tie -> pick earliest created participant)
    const participants = await prisma.tournamentParticipant.findMany({
      where: { tournamentId },
      orderBy: { createdAt: "asc" },
    });
    let winnerId = null;
    let best = -1;
    participants.forEach((p) => {
      const pts = points[p.id] || 0;
      if (pts > best) {
        best = pts;
        winnerId = p.id;
      }
    });

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { endedAt: new Date(), winnerId },
    });

    const updated = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { participants: { include: { user: true } }, matches: true },
    });
    return res.json({
      message: "Tournament closed",
      tournament: updated,
      winnerId,
      points,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * @openapi
 * /tornament/{tournamentId}/reset:
 *   post:
 *     summary: Reset a tournament (delete matches, reset byes) (admin only)
 *     tags: [Tournament]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Tournament reset
 */
// RESET TOURNAMENT: remove all matches, reset started/ended, keep participants (admin only)
router.post("/:tournamentId/reset", verifyTokenAdmin, async (req, res) => {
  const tournamentId = req.params.tournamentId;
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament)
      return res.status(404).json({ message: "Tournament not found" });

    // delete matches and reset byeCount for participants
    await prisma.$transaction([
      prisma.match.deleteMany({ where: { tournamentId } }),
      prisma.tournamentParticipant.updateMany({
        where: { tournamentId },
        data: { byeCount: 0 },
      }),
    ]);

    const updated = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true, img: true } },
          },
        },
        matches: true,
      },
    });

    return res.json({ message: "Tournament reset", tournament: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * @openapi
 * /tornament/{tournamentId}:
 *   put:
 *     summary: Update tournament fields (admin only)
 *     tags: [Tournament]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tournamentId
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
 *               startedAt:
 *                 type: string
 *                 format: date-time
 *               endedAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       '200':
 *         description: Updated tournament
 */
// UPDATE a tournament (admin only)
router.put("/:tournamentId", verifyTokenAdmin, async (req, res) => {
  const tournamentId = req.params.tournamentId;
  const { name, startedAt, endedAt } = req.body;
  try {
    const data = {};
    if (name !== undefined) data.name = name;
    if (startedAt !== undefined)
      data.startedAt = startedAt ? new Date(startedAt) : null;
    if (endedAt !== undefined)
      data.endedAt = endedAt ? new Date(endedAt) : null;

    const updated = await prisma.tournament.update({
      where: { id: tournamentId },
      data,
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true, img: true } },
          },
        },
        matches: true,
      },
    });

    res.json(updated);
  } catch (err) {
    if (err?.code === "P2025") {
      return res.status(404).json({ message: "Tournament not found" });
    }
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @openapi
 * /tornament/{tournamentId}/update:
 *   post:
 *     summary: Update tournament including timeGame and winnerId (admin only)
 *     tags: [Tournament]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tournamentId
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
 *               startedAt:
 *                 type: string
 *                 format: date-time
 *               endedAt:
 *                 type: string
 *                 format: date-time
 *               timeGame:
 *                 type: integer
 *               winnerId:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       '200':
 *         description: Updated tournament
 */
// Alternate update endpoint (admin only) - accepts timeGame and winnerId as well
router.post("/:tournamentId/update", verifyTokenAdmin, async (req, res) => {
  const tournamentId = req.params.tournamentId;
  const { name, startedAt, endedAt, timeGame, winnerId } = req.body;
  try {
    const data = {};
    if (name !== undefined) data.name = name;
    if (startedAt !== undefined)
      data.startedAt = startedAt ? new Date(startedAt) : null;
    if (endedAt !== undefined)
      data.endedAt = endedAt ? new Date(endedAt) : null;
    if (timeGame !== undefined) {
      const tg = Number(timeGame);
      if (!Number.isInteger(tg) || tg <= 0)
        return res
          .status(400)
          .json({ message: "timeGame must be a positive integer (minutes)" });
      data.timeGame = tg;
    }
    if (winnerId !== undefined) {
      // validate winner is a participant of this tournament
      if (winnerId !== null) {
        const part = await prisma.tournamentParticipant.findUnique({
          where: { id: winnerId },
        });
        if (!part || part.tournamentId !== tournamentId)
          return res.status(400).json({ message: "Invalid winnerId" });
      }
      data.winnerId = winnerId;
    }

    const updated = await prisma.tournament.update({
      where: { id: tournamentId },
      data,
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true, img: true } },
          },
        },
        matches: true,
      },
    });

    res.json(updated);
  } catch (err) {
    if (err?.code === "P2025")
      return res.status(404).json({ message: "Tournament not found" });
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @openapi
 * /tornament/{tournamentId}:
 *   delete:
 *     summary: Delete a tournament and related data (admin only)
 *     tags: [Tournament]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Deleted
 */
// DELETE a tournament and its related data (admin only)
router.delete("/:tournamentId", verifyTokenAdmin, async (req, res) => {
  const tournamentId = req.params.tournamentId;
  try {
    // delete matches and participants first to avoid FK RESTRICT errors
    await prisma.$transaction([
      prisma.match.deleteMany({ where: { tournamentId } }),
      prisma.tournamentParticipant.deleteMany({ where: { tournamentId } }),
      prisma.tournament.delete({ where: { id: tournamentId } }),
    ]);

    res.json({ message: "Tournament and related data deleted" });
  } catch (err) {
    if (err?.code === "P2025") {
      return res.status(404).json({ message: "Tournament not found" });
    }
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

//MATCHESSSS
/**
 * @openapi
 * /tornament/{tournamentId}/matches:
 *   get:
 *     summary: Get matches for a tournament
 *     tags: [Tournament]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Array of matches
 */
// GET matches for a tournament
router.get("/:tournamentId/matches", async (req, res) => {
  const tournamentId = req.params.tournamentId;
  try {
    const matches = await prisma.match.findMany({
      where: { tournamentId },
      orderBy: [{ round: "asc" }],
      include: {
        playerA: { include: { user: true } },
        playerB: { include: { user: true } },
      },
    });
    res.json(matches);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @openapi
 * /tornament/{tournamentId}/matches/{matchId}/result:
 *   patch:
 *     summary: Set or update a match result (admin only)
 *     tags: [Tournament]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 properties:
 *                   result:
 *                     type: string
 *                     enum: [A, B, draw]
 *               - type: object
 *                 properties:
 *                   scoreA:
 *                     type: number
 *                   scoreB:
 *                     type: number
 *     responses:
 *       '200':
 *         description: Updated match
 */
// SET/UPDATE match result (admin/referee)
// Body: { result: 'A' | 'B' | 'draw' } OR { scoreA: number, scoreB: number }
router.patch(
  "/:tournamentId/matches/:matchId/result",
  verifyTokenAdmin,
  async (req, res) => {
    const { tournamentId, matchId } = req.params;
    const { result, scoreA, scoreB } = req.body;

    try {
      const match = await prisma.match.findUnique({ where: { id: matchId } });
      if (!match || match.tournamentId !== tournamentId) {
        return res.status(404).json({ message: "Match not found" });
      }

      // handle bye matches (playerBId == null)
      if (!match.playerBId) {
        // only allow giving the single player a bye (0.5)
        // accept result or explicit score
        let newScoreA = null;
        if (result) {
          if (result !== "A" && result !== "draw") {
            return res
              .status(400)
              .json({ message: "Invalid result for bye match" });
          }
          // for bye, treat as 0.5 (draw vs null)
          newScoreA = 0.5;
        } else if (typeof scoreA === "number") {
          if (scoreA !== 0.5)
            return res.status(400).json({ message: "Bye score must be 0.5" });
          newScoreA = 0.5;
        } else {
          return res
            .status(400)
            .json({ message: "Missing result for bye match" });
        }

        const updated = await prisma.match.update({
          where: { id: matchId },
          data: { scoreA: newScoreA, scoreB: 0 },
        });
        return res.json(updated);
      }

      // normalize based on provided payload
      let newA = null;
      let newB = null;
      if (result) {
        if (result === "A") {
          newA = 1;
          newB = 0;
        } else if (result === "B") {
          newA = 0;
          newB = 1;
        } else if (result === "draw") {
          newA = 0.5;
          newB = 0.5;
        } else return res.status(400).json({ message: "Invalid result value" });
      } else if (typeof scoreA === "number" && typeof scoreB === "number") {
        // validate allowed values
        const allowed = new Set([0, 0.5, 1]);
        if (!allowed.has(scoreA) || !allowed.has(scoreB)) {
          return res
            .status(400)
            .json({ message: "Scores must be 0, 0.5 or 1" });
        }
        // ensure they are consistent (sum 1 or draw both 0.5)
        const sum = Number(scoreA) + Number(scoreB);
        if (!(Math.abs(sum - 1) < 1e-9)) {
          return res.status(400).json({ message: "Scores must sum to 1" });
        }
        newA = Number(scoreA);
        newB = Number(scoreB);
      } else {
        return res
          .status(400)
          .json({ message: "Provide either result or both scoreA and scoreB" });
      }

      const updated = await prisma.match.update({
        where: { id: matchId },
        data: { scoreA: newA, scoreB: newB },
      });
      return res.json(updated);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

export default router;
