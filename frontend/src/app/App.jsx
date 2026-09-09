import { Navigate, Route, Routes } from "react-router";

import { AppShell } from "../components/layout/AppShell.jsx";
import { ProtectedRoute } from "../features/auth/ProtectedRoute.jsx";
import { HomePage } from "../pages/HomePage.jsx";
import { LoginPage } from "../pages/LoginPage.jsx";
import { RegisterPage } from "../pages/RegisterPage.jsx";
import { PortalPage } from "../pages/PortalPage.jsx";
import { NotFoundPage } from "../pages/NotFoundPage.jsx";
import { RoomsPage } from "../pages/RoomsPage.jsx";
import { RoomDetailPage } from "../pages/RoomDetailPage.jsx";
import { AvailabilityPage } from "../pages/AvailabilityPage.jsx";
import { BookingPage } from "../pages/BookingPage.jsx";
import { PaymentCallbackPage } from "../pages/PaymentCallbackPage.jsx";
import { PortalLayout } from "../components/layout/PortalLayout.jsx";
import { ReservationsPage } from "../pages/ReservationsPage.jsx";
import { ReservationDetailPage } from "../pages/ReservationDetailPage.jsx";
import { ServiceRequestsPage } from "../pages/ServiceRequestsPage.jsx";
import { ServiceRequestDetailPage } from "../pages/ServiceRequestDetailPage.jsx";
import { AiConciergePage } from "../pages/AiConciergePage.jsx";
import { AdminLayout } from "../components/layout/AdminLayout.jsx";
import { AdminDashboardPage } from "../pages/AdminDashboardPage.jsx";
import { AdminModulePlaceholder } from "../pages/AdminModulePlaceholder.jsx";
import { AdminReservationsPage } from "../pages/AdminReservationsPage.jsx";
import { AdminReservationDetailPage } from "../pages/AdminReservationDetailPage.jsx";
import { AdminRoomsPage } from "../pages/AdminRoomsPage.jsx";
import { AdminServiceRequestsPage } from "../pages/AdminServiceRequestsPage.jsx";
import { AdminServiceRequestDetailPage } from "../pages/AdminServiceRequestDetailPage.jsx";
import { AdminPaymentsPage } from "../pages/AdminPaymentsPage.jsx";
import { AdminPaymentDetailPage } from "../pages/AdminPaymentDetailPage.jsx";
import { AdminStaffPage } from "../pages/AdminStaffPage.jsx";
import { AdminStaffDetailPage } from "../pages/AdminStaffDetailPage.jsx";

const staffRoles = ["SUPER_ADMIN", "ADMIN", "FRONT_DESK", "RESERVATION_MANAGER", "ACCOUNTANT", "SERVICE_MANAGER"];

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="rooms" element={<RoomsPage />} />
        <Route path="rooms/:roomTypeId" element={<RoomDetailPage />} />
        <Route path="availability" element={<AvailabilityPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="book" element={<BookingPage />} />
          <Route path="payment/callback" element={<PaymentCallbackPage />} />
        </Route>
        <Route path="404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={["CUSTOMER"]} />}>
        <Route element={<PortalLayout />}>
          <Route path="portal" element={<PortalPage />} />
          <Route path="portal/reservations" element={<ReservationsPage />} />
          <Route path="portal/reservations/:reservationId" element={<ReservationDetailPage />} />
          <Route path="portal/requests" element={<ServiceRequestsPage />} />
          <Route path="portal/requests/:requestId" element={<ServiceRequestDetailPage />} />
          <Route path="portal/concierge" element={<AiConciergePage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={staffRoles} />}>
        <Route element={<AdminLayout />}>
          <Route path="admin" element={<AdminDashboardPage />} />
          <Route path="admin/reservations" element={<AdminReservationsPage />} />
          <Route path="admin/reservations/:reservationId" element={<AdminReservationDetailPage />} />
          <Route path="admin/rooms" element={<AdminRoomsPage />} />
          <Route path="admin/requests" element={<AdminServiceRequestsPage />} />
          <Route path="admin/requests/:requestId" element={<AdminServiceRequestDetailPage />} />
          <Route path="admin/payments" element={<AdminPaymentsPage />} />
          <Route path="admin/payments/:paymentId" element={<AdminPaymentDetailPage />} />
          <Route element={<ProtectedRoute allowedRoles={["SUPER_ADMIN"]} />}>
            <Route path="admin/staff" element={<AdminStaffPage />} />
            <Route path="admin/staff/:userId" element={<AdminStaffDetailPage />} />
          </Route>
          <Route path="admin/*" element={<AdminModulePlaceholder />} />
        </Route>
      </Route>
    </Routes>
  );
}
