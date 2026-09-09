import multer from "multer";

const storage = multer.memoryStorage();

function isAllowedImage(file) {
  const { buffer } = file;

  if (!buffer || buffer.length < 12) {
    return false;
  }

  const isJpeg =
    buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
  const gifSignature = buffer.subarray(0, 6).toString("ascii");
  const isGif = gifSignature === "GIF87a" || gifSignature === "GIF89a";
  const isWebp =
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";
  const avifBrand = buffer.subarray(8, 12).toString("ascii");
  const isAvif =
    buffer.subarray(4, 8).toString("ascii") === "ftyp" &&
    (avifBrand === "avif" || avifBrand === "avis");

  return isJpeg || isPng || isGif || isWebp || isAvif;
}

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10,
  },
});

export function uploadRoomTypeImages(req, res, next) {
  upload.array("images", 10)(req, res, (error) => {
    if (!error) {
      const invalidFile = req.files?.find((file) => !isAllowedImage(file));

      if (!invalidFile) {
        return next();
      }

      return res.status(400).json({
        success: false,
        message: "Only JPEG, PNG, WebP, GIF, and AVIF images are allowed.",
      });
    }

    let message = error.message;

    if (error instanceof multer.MulterError) {
      const messages = {
        LIMIT_FILE_SIZE: "Each image must be 5 MB or smaller.",
        LIMIT_FILE_COUNT: "A maximum of 10 images can be uploaded at once.",
        LIMIT_UNEXPECTED_FILE:
          'Only the "images" file field is accepted, with a maximum of 10 files.',
      };

      message = messages[error.code] || error.message;
    }

    return res.status(400).json({
      success: false,
      message,
    });
  });
}

export default upload;
