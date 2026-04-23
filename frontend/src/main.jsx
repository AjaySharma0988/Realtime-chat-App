import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";

// Popup call windows (window.opener is set) do NOT need StrictMode.
// StrictMode's double-invoke causes the mock cleanup to fire, which posts
// CALL_ENDED via BroadcastChannel and makes the main window close the popup.
const isPopupWindow = !!window.opener;

const AppTree = (
  <BrowserRouter>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </BrowserRouter>
);

createRoot(document.getElementById("root")).render(
  isPopupWindow ? AppTree : <StrictMode>{AppTree}</StrictMode>
);
