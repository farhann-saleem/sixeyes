import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Shell } from "./Shell";
import "./styles.css";
import "./product-polish.css";

const pathname = window.location.pathname;

if (pathname === "/callback") {
  // Navigate through the server callback so Google errors and the saved return path
  // survive the redirect, and the HttpOnly cookie is set by a normal navigation.
  window.location.replace(`/api/auth/callback${window.location.search}`);
} else {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Shell />
    </StrictMode>,
  );
}
