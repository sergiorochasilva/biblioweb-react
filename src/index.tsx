import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./css/styles.css";

import HomeView from "./view/HomeView";

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <HomeView />
    </StrictMode>
  );
} else {
  console.error("Failed to find the root element");
}