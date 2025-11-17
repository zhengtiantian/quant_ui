import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginRegister from "./components/LoginRegister";
import Dashboard from "./pages/Dashboard";

const App: React.FC = () => {
    const token = localStorage.getItem("token");

    return (
        <Router>
            <Routes>
                <Route path="/" element={token ? <Navigate to="/dashboard" /> : <LoginRegister />} />
                <Route path="/dashboard" element={token ? <Dashboard /> : <Navigate to="/" />} />
            </Routes>
        </Router>
    );
};

export default App;