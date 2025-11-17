import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import keycloak from "./keycloak";

keycloak
    .init({ onLoad: "login-required" })
    .then((authenticated) => {
        if (authenticated) {
            console.log("✅ Keycloak login successfully");
            localStorage.setItem("token", keycloak.token || "");

            createRoot(document.getElementById("root")!).render(
                <StrictMode>
                    <App />
                </StrictMode>
            );
        } else {
            console.warn("❌ keycloak logining.....");
            keycloak.login();
        }
    })
    .catch((err) => console.error("Keycloak init failed:", err));