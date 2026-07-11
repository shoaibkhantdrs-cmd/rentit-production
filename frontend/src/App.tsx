import { useEffect, useState } from "react";
import { env } from "@/config/env";
import "./App.css";

type ApiStatus = "checking" | "online" | "offline";

function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");

  useEffect(() => {
    let cancelled = false;

    fetch(`${env.apiBaseUrl}/health`)
      .then((res) => {
        if (!cancelled) setApiStatus(res.ok ? "online" : "offline");
      })
      .catch(() => {
        if (!cancelled) setApiStatus("offline");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app">
      <h1>RentIt</h1>
      <p>Frontend scaffold is running.</p>
      <p className="app__status">Backend API: {apiStatus}</p>
    </div>
  );
}

export default App;
