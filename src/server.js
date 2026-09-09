import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import aiRoutes from "./routes/ai.routes.js";

import authRoutes from "./routes/auth.routes.js";
import emailTemplateRoutes from "./routes/emailTemplate.routes.js";
import managementRoutes from "./routes/management.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import refundRoutes from "./routes/refund.routes.js";
import roomRoutes from "./routes/room.routes.js";
import reservationRoutes from "./routes/reservation.routes.js";
import roomTypeRoutes from "./routes/roomType.routes.js";
import roomTypeImageRoutes from "./routes/roomTypeImage.routes.js";
import staffRoutes from "./routes/staff.routes.js";
import serviceRequestRoutes from "./routes/serviceRequest.routes.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(
  express.json({
    verify: (req, res, buffer) => {
      req.rawBody = Buffer.from(buffer);
    },
  }),
);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Hotel AI API is running.",
  });
});

const PORT = process.env.PORT || 6000;

app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/management/email-templates", emailTemplateRoutes);
app.use("/api/management", managementRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/management/payments", refundRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/room-types", roomTypeRoutes);
app.use("/api/room-types", roomTypeImageRoutes);
app.use("/api/management/staff", staffRoutes);
app.use("/api/service-requests", serviceRequestRoutes);

app.listen(PORT, () => {
  console.log(`Hotel AI API running on port ${PORT}`);
});
