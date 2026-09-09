import {
  createStaff,
  getAssignableStaffRoles,
  getStaffById,
  getStaffMembers,
  replaceStaffRoles,
  updateStaffStatus,
} from "../services/staff.service.js";

function sendError(res, error) {
  return res.status(error.statusCode || 400).json({
    success: false,
    message: error.message,
  });
}

export async function postStaff(req, res) {
  try {
    const staff = await createStaff(req.body);
    return res.status(201).json({
      success: true,
      message: staff.onboardingEmail.status === "SENT"
        ? "Staff account created and onboarding email sent."
        : "Staff account created, but the onboarding email could not be sent.",
      data: staff,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function listStaff(req, res) {
  try {
    const result = await getStaffMembers(req.query);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getStaff(req, res) {
  try {
    const staff = await getStaffById(req.params.userId);
    return res.status(200).json({ success: true, data: staff });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function putStaffRoles(req, res) {
  try {
    const staff = await replaceStaffRoles({
      userId: req.params.userId,
      roles: req.body.roles,
      actorUserId: req.user.id,
    });
    return res.status(200).json({
      success: true,
      message: "Staff roles updated successfully.",
      data: staff,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function listStaffRoles(req, res) {
  try {
    const roles = await getAssignableStaffRoles();
    return res.status(200).json({ success: true, data: roles });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function patchStaffStatus(req, res) {
  try {
    const staff = await updateStaffStatus({
      userId: req.params.userId,
      status: req.body.status,
      actorUserId: req.user.id,
    });
    return res.status(200).json({
      success: true,
      message: "Staff status updated successfully.",
      data: staff,
    });
  } catch (error) {
    return sendError(res, error);
  }
}
