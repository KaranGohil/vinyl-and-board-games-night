import { Link, Route, Routes } from "react-router-dom";
import { CreateEvent } from "./pages/CreateEvent";
import { EventPage } from "./pages/EventPage";

export function App() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-disc" aria-hidden="true" />
          Vinyl &amp; Board Games Night
        </Link>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<CreateEvent />} />
          <Route path="/e/:id" element={<EventPage />} />
          <Route path="*" element={<p className="muted">Page not found.</p>} />
        </Routes>
      </main>
      <footer className="footer">
        Self-hosted, open source.{" "}
        <a href="https://github.com/KaranGohil/vinyl-and-board-games-night" target="_blank" rel="noreferrer">
          Run your own
        </a>
      </footer>
    </div>
  );
}
