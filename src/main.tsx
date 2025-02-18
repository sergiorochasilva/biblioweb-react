import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import "./css/styles.css";

import HomeView from "./view/HomeView.tsx";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HomeView />
  </StrictMode>,
)
