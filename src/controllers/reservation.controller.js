import {
  createReservation,
  cancelReservations,
  getCustomerReservations,
  getReservationById,
  getAllReservations,
  updateReservationStatus,
} from "../services/reservation.service.js";

export async function postReservation(req, res) {
  try {
    const { roomId, checkIn, checkOut, guests } = req.body;

    const reservation = await createReservation({
      userId: req.user.id,
      roomId,
      checkIn,
      checkOut,
      guests: Number(guests),
    });

    return res.status(201).json({
      success: true,
      data: reservation,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

export async function cancelReservation(req, res) {
  try {
    const { reservationId } = req.body;

    if (!reservationId) {
      return res.status(400).json({
        success: false,
        message: "reservationId is required.",
      });
    }

    const reservation = await cancelReservations({
      reservationId,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: "Reservation cancelled successfully.",
      data: reservation,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

export async function customerReservations(req, res) {
  try {
    const reservations = await getCustomerReservations(req.user.id);
    return res.status(200).json({ success: true, data: reservations });
  } catch (error) {
    return res.status(404).json({ success: false, message: error.message });
  }
}

export async function getReservation(req, res) {
  try {
    const { reservationId } = req.params;
    const reservation = await getReservationById({
      reservationId,
      userId: req.user.id,
      userRoles: req.user.roles,
    });
    return res.status(200).json({ success: true, data: reservation });
  } catch (error) {
    return res
      .status(error.statusCode || 404)
      .json({ success: false, message: error.message });
  }
}

export async function patchReservationStatus(req, res) {
  try {
    const { reservationId } = req.params;
    const { status } = req.body;

    const reservation = await updateReservationStatus({
      reservationId,
      status: typeof status === "string" ? status.toUpperCase() : status,
    });

    return res.status(200).json({
      success: true,
      message: `Reservation ${reservation.status.toLowerCase()} successfully.`,
      data: reservation,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

export async function getReservations(req, res) {
  try {
    const { status, roomId, roomTypeId, checkIn, checkOut } = req.query;
    const reservations = await getAllReservations({
      status: status?.toUpperCase(),
      roomId,
      roomTypeId,
      checkIn,
      checkOut,
    });
    return res.status(200).json({ success: true, data: reservations });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}
