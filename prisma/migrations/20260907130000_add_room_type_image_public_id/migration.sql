-- Cloudinary public IDs are required to manage and delete uploaded assets.
ALTER TABLE "RoomTypeImage"
ADD COLUMN "publicId" TEXT NOT NULL;
