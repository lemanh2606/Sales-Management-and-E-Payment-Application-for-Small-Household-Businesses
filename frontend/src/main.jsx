//src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./style.css";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from "react-hot-toast";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #22c55e, #10b981)',
              color: 'white',
              fontWeight: 600,
              padding: '14px 22px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
            },
            success: { icon: '🌟', duration: 4000 },
            error: { icon: '⚠️', duration: 4000 },
            loading: { icon: '⏳', duration: 3000 },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
