import { getManagementDashboard } from "../services/management.service.js";

export async function managementDashboard(req, res) {
  try {
    const dashboard = await getManagementDashboard({
      date: req.query.date,
      upcomingDays: req.query.upcomingDays,
    });

    return res.status(200).json({ success: true, data: dashboard });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
}
