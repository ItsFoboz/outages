import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Dynamically inject Google Maps script if key is configured
const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
if (mapsKey) {
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${mapsKey}&loading=async`;
  script.async = true;
  document.head.appendChild(script);
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
