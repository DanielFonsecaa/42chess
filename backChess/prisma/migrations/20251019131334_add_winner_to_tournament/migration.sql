/*
  Warnings:

  - A unique constraint covering the columns `[tournamentId,userId]` on the table `TournamentParticipant` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Match" ALTER COLUMN "scoreA" SET DEFAULT 0,
ALTER COLUMN "scoreB" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "winnerId" TEXT;

-- AlterTable
ALTER TABLE "TournamentParticipant" ALTER COLUMN "tournamentId" SET DEFAULT '1';

-- CreateIndex
CREATE INDEX "TournamentParticipant_tournamentId_idx" ON "TournamentParticipant"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentParticipant_tournamentId_userId_key" ON "TournamentParticipant"("tournamentId", "userId");
