import { apiUrl } from "./api";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Shell } from "./Shell";
import "./styles.css";
import "./product-polish.css";
import "./avatar-studio.css";

const pathname = window.location.pathname;

if (import.meta.env.PROD && window.location.hostname === "marketingstudioie.site") {
  window.location.replace(`https://www.marketingstudioie.site${pathname}${window.location.search}${window.location.hash}`);
} else if (pathname === "/callback") {
  // Navigate through the server callback so Google errors and the saved return path
  // survive the redirect, and the HttpOnly cookie is set by a normal navigation.
  window.location.replace(apiUrl(`/api/auth/callback${window.location.search}`));
} else {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Shell />
    </StrictMode>,
  );
}
