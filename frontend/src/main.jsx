import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import { AppProviders } from "./app/AppProviders.jsx";
import { App } from "./app/App.jsx";
import "./styles/global.css";
import "./styles/booking.css";
import "./styles/portal.css";
import "./styles/admin.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AppProviders>
        <App />
      </AppProviders>
    </BrowserRouter>
  </StrictMode>,
);
