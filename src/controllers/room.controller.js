import {
  createRoom,
  getAllRooms,
  getRoomById,
  updateRoomById,
  deleteRoomById,
} from "../services/room.service.js";

export async function postRoom(req, res) {
  try {
    const { roomNumber, roomTypeId, status } = req.body;

    const room = await createRoom({
      roomNumber,
      roomTypeId,
      status,
    });

    return res.status(201).json({
      success: true,
      data: room,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

export async function getRooms(req, res) {
  try {
    const rooms = await getAllRooms();

    return res.status(200).json({
      success: true,
      data: rooms,
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }
}

export async function getRoom(req, res) {
  try {
    const { roomId } = req.params;

    const room = await getRoomById(roomId);

    return res.status(200).json({
      success: true,
      data: room,
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }
}

export async function updateRoom(req, res) {
  try {
    const { roomId } = req.params;
    const { roomNumber, roomTypeId, status } = req.body;

    const room = await updateRoomById(roomId, {
      roomNumber,
      roomTypeId,
      status,
    });

    return res.status(200).json({
      success: true,
      data: room,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

export async function deleteRoom(req, res) {
  try {
    const { roomId } = req.params;

    await deleteRoomById(roomId);

    return res.status(200).json({
      success: true,
      message: "Room deleted successfully.",
    });
  } catch (error) {
    return res.status(error.statusCode || 404).json({
      success: false,
      message: error.message,
    });
  }
}
