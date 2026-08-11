import { Routes, Route } from "react-router-dom";
import ListView from "./pages/ListView";
import DetailView from "./pages/DetailView";

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Verdikt</h1>
        <p>Architectural Decision Records for this repo</p>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<ListView />} />
          <Route path="/adr/:slug" element={<DetailView />} />
        </Routes>
      </main>
    </div>
  );
}
