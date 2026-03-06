import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import CostDashboard from "./pages/aws_cost_dashboard";
import ScenarioDashboard from "./pages/aws_scenario_dashboard";
import MatrixDashboard from "./pages/aws_cost_matrix_dashboard";
import FinalDashboard from "./pages/aws_final_dashboard";

export default function App() {
  return (
    <BrowserRouter basename="/">
      <nav style={{ display: "flex", gap: 12, padding: 16, background: "#111" }}>
        <Link to="/" style={{ color: "#60A5FA" }}>기본 분석</Link>
        <Link to="/scenario" style={{ color: "#60A5FA" }}>시나리오 비교</Link>
        <Link to="/matrix" style={{ color: "#60A5FA" }}>빈도×전달방식</Link>
        <Link to="/final" style={{ color: "#60A5FA" }}>최종 ROI</Link>
      </nav>
      <Routes>
        <Route path="/" element={<CostDashboard />} />
        <Route path="/scenario" element={<ScenarioDashboard />} />
        <Route path="/matrix" element={<MatrixDashboard />} />
        <Route path="/final" element={<FinalDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}