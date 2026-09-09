import { checkAvailability } from "../services/availability.service.js";

export async function getAvailability(req, res) {
  try {
    const { roomType, checkIn, checkOut, guests } = req.query;

    const rooms = await checkAvailability({
      roomType,
      checkIn,
      checkOut,
      guests: Number(guests),
    });

    return res.status(200).json({
      success: true,
      data: {
        count: rooms.length,
        rooms,
      },
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}
