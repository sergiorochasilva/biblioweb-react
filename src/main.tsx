// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, theme } from "antd";
import "antd/dist/reset.css";
import "./styles/global.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#1B78D6",
          borderRadius: 16,
          fontFamily: "\"Manrope\", \"Segoe UI\", sans-serif",
        },
      }}
    >
      <BrowserRouter basename="/biblioweb-react">
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </StrictMode>
);
