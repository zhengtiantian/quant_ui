import React from "react";
import PerformancePanel from "./PerformancePanel";
import SignalsPanel from "./SignalsPanel";

// The stock-ranking model on one page: its backtest against SPY first, then today's ranks.
const QuantModelPanel: React.FC = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <PerformancePanel />
        <div style={{ borderTop: "1px solid #434b56" }} />
        <SignalsPanel />
    </div>
);

export default QuantModelPanel;
