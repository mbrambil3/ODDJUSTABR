import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import MatchAnalysis from "@/pages/MatchAnalysis";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/jogo/:matchId" element={<MatchAnalysis />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
