-- Preserve the first primary image by display order if inconsistent data exists.
WITH "RankedPrimaryImages" AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "roomTypeId"
      ORDER BY "displayOrder" ASC, "createdAt" ASC, "id" ASC
    ) AS "primaryRank"
  FROM "RoomTypeImage"
  WHERE "isPrimary" = true
)
UPDATE "RoomTypeImage"
SET "isPrimary" = false
FROM "RankedPrimaryImages"
WHERE "RoomTypeImage"."id" = "RankedPrimaryImages"."id"
  AND "RankedPrimaryImages"."primaryRank" > 1;

-- PostgreSQL partial unique indexes are not representable in Prisma schema syntax.
CREATE UNIQUE INDEX "RoomTypeImage_one_primary_per_room_type"
ON "RoomTypeImage"("roomTypeId")
WHERE "isPrimary" = true;
