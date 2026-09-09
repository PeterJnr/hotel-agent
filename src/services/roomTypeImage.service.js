import cloudinary from "../lib/cloudinary.js";
import { prisma } from "../lib/prisma.js";

async function deleteCloudinaryAssets(uploadResults) {
  await Promise.allSettled(
    uploadResults.map((uploadResult) =>
      cloudinary.uploader.destroy(uploadResult.public_id, {
        resource_type: "image",
      }),
    ),
  );
}

export async function uploadRoomTypeImages({ roomTypeId, files, altText }) {
  if (!files || files.length === 0) {
    throw new Error("At least one image is required.");
  }

  const roomType = await prisma.roomType.findUnique({
    where: {
      id: roomTypeId,
    },
  });

  if (!roomType) {
    throw new Error("Room type not found.");
  }

  const [existingImageCount, lastImage] = await Promise.all([
    prisma.roomTypeImage.count({
      where: {
        roomTypeId,
      },
    }),
    prisma.roomTypeImage.findFirst({
      where: {
        roomTypeId,
      },
      orderBy: {
        displayOrder: "desc",
      },
      select: {
        displayOrder: true,
      },
    }),
  ]);

  const nextDisplayOrder = (lastImage?.displayOrder ?? -1) + 1;
  const uploadResults = [];

  try {
    for (const file of files) {
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `hotel-ai/room-types/${roomType.name.toLowerCase()}`,
            resource_type: "image",
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          },
        );

        uploadStream.end(file.buffer);
      });

      uploadResults.push(uploadResult);
    }

    return await prisma.$transaction(
      uploadResults.map((uploadResult, index) =>
        prisma.roomTypeImage.create({
          data: {
            roomTypeId,
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            altText: altText || null,
            displayOrder: nextDisplayOrder + index,
            isPrimary: existingImageCount === 0 && index === 0,
          },
        }),
      ),
    );
  } catch (error) {
    await deleteCloudinaryAssets(uploadResults);
    throw error;
  }
}

export async function getRoomTypeImages(roomTypeId) {
  const roomType = await prisma.roomType.findUnique({
    where: {
      id: roomTypeId,
    },
  });

  if (!roomType) {
    throw new Error("Room type not found.");
  }

  return prisma.roomTypeImage.findMany({
    where: {
      roomTypeId,
    },
    orderBy: {
      displayOrder: "asc",
    },
  });
}

export async function setPrimaryRoomTypeImage({ roomTypeId, imageId }) {
  const image = await prisma.roomTypeImage.findFirst({
    where: {
      id: imageId,
      roomTypeId,
    },
  });

  if (!image) {
    throw new Error("Room type image not found.");
  }

  const [, primaryImage] = await prisma.$transaction([
    prisma.roomTypeImage.updateMany({
      where: {
        roomTypeId,
      },
      data: {
        isPrimary: false,
      },
    }),
    prisma.roomTypeImage.update({
      where: {
        id: imageId,
      },
      data: {
        isPrimary: true,
      },
    }),
  ]);

  return primaryImage;
}

export async function reorderRoomTypeImages({ roomTypeId, imageIds }) {
  const images = await prisma.roomTypeImage.findMany({
    where: {
      roomTypeId,
    },
    select: {
      id: true,
    },
  });

  if (images.length !== imageIds.length) {
    throw new Error("All room type images must be included when reordering.");
  }

  const requestedIds = new Set(imageIds);

  if (requestedIds.size !== imageIds.length) {
    throw new Error("Each room type image must appear exactly once.");
  }

  const existingIds = new Set(images.map((image) => image.id));

  for (const imageId of requestedIds) {
    if (!existingIds.has(imageId)) {
      throw new Error("Invalid image ID in reorder request.");
    }
  }

  await prisma.$transaction(
    imageIds.map((imageId, index) =>
      prisma.roomTypeImage.update({
        where: {
          id: imageId,
        },
        data: {
          displayOrder: index,
        },
      }),
    ),
  );

  return getRoomTypeImages(roomTypeId);
}

export async function deleteRoomTypeImage({ roomTypeId, imageId }) {
  const image = await prisma.roomTypeImage.findFirst({
    where: {
      id: imageId,
      roomTypeId,
    },
  });

  if (!image) {
    throw new Error("Room type image not found.");
  }

  await cloudinary.uploader.destroy(image.publicId, {
    resource_type: "image",
  });

  await prisma.$transaction(async (tx) => {
    await tx.roomTypeImage.delete({
      where: {
        id: imageId,
      },
    });

    const remainingImages = await tx.roomTypeImage.findMany({
      where: {
        roomTypeId,
      },
      orderBy: {
        displayOrder: "asc",
      },
      select: {
        id: true,
      },
    });

    for (const [index, remainingImage] of remainingImages.entries()) {
      await tx.roomTypeImage.update({
        where: {
          id: remainingImage.id,
        },
        data: {
          displayOrder: index,
          ...(image.isPrimary && index === 0 ? { isPrimary: true } : {}),
        },
      });
    }
  });

  return {
    deletedImageId: imageId,
  };
}
