import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Shell } from "./Shell";
import "./styles.css";
import "./product-polish.css";

const pathname = window.location.pathname;

if (pathname === "/callback") {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  if (code) {
    fetch(
      `/api/auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state ?? "")}`,
      { redirect: "manual" },
    )
      .catch(() => undefined)
      .finally(() => window.location.replace("/"));
  } else {
    window.location.replace("/");
  }
} else {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Shell />
    </StrictMode>,
  );
}
