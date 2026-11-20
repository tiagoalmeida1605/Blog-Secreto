import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { AppProviders } from "./app/providers";
import "./styles/index.css";
import brandFavicon from "../assets/nexus-symbol-blue-primary.png";

const favicon = document.getElementById("nexus-favicon");
if (favicon instanceof HTMLLinkElement) favicon.href = brandFavicon;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
);
