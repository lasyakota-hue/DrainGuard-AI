import { useEffect, useMemo, useState } from "react";

const API = "http://localhost:5000/api";

const initialDrains = [
  {
    id: 1,
    name: "Drain 01",
    location: "Hyderabad Central",
    water_level: 42,
    temperature: 29,
    status: "NORMAL",
    risk_score: 28,
  },
  {
    id: 2,
    name: "Drain 02",
    location: "Madhapur",
    water_level: 78,
    temperature: 31,
    status: "WARNING",
    risk_score: 68,
  },
  {
    id: 3,
    name: "Drain 03",
    location: "Gachibowli",
    water_level: 93,
    temperature: 32,
    status: "CRITICAL",
    risk_score: 94,
  },
  {
    id: 4,
    name: "Drain 04",
    location: "Kukatpally",
    water_level: 55,
    temperature: 30,
    status: "NORMAL",
    risk_score: 40,
  },
];

function statusFor(level) {
  if (level >= 90) return "CRITICAL";
  if (level >= 75) return "WARNING";
  return "NORMAL";
}

function riskFor(level) {
  if (level >= 90) return Math.min(100, Math.round(80 + (level - 90) * 2));
  if (level >= 75) return Math.round(55 + (level - 75) * 1.6);
  return Math.round(15 + level * 0.45);
}

function statusColor(status) {
  if (status === "CRITICAL") return "#ef4444";
  if (status === "WARNING") return "#f59e0b";
  return "#22c55e";
}

function riskLabel(score) {
  if (score >= 80) return "HIGH";
  if (score >= 50) return "MEDIUM";
  return "LOW";
}

function formatTime(value) {
  if (!value) return "--";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function App() {
  const [drains, setDrains] = useState(initialDrains);
  const [incidents, setIncidents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedDrain, setSelectedDrain] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backendOnline, setBackendOnline] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [phoneMode, setPhoneMode] = useState(false);
  const [toast, setToast] = useState("");
  const [simulating, setSimulating] = useState(false);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 3500);
  };

  async function loadDashboard() {
    try {
      const response = await fetch(`${API}/dashboard`);

      if (!response.ok) {
        throw new Error("Backend unavailable");
      }

      const data = await response.json();

      if (Array.isArray(data.drains)) {
        setDrains(data.drains);
      }

      if (Array.isArray(data.incidents)) {
        setIncidents(data.incidents);
      }

      if (Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
      }

      setBackendOnline(true);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (error) {
      setBackendOnline(false);
      setLoading(false);
    }
  }

  async function loadIncidents() {
    try {
      const response = await fetch(`${API}/incidents`);

      if (!response.ok) return;

      const data = await response.json();

      if (Array.isArray(data)) {
        setIncidents(data);
      }
    } catch {
      // Backend polling failure handled by dashboard.
    }
  }

  async function loadHistory(drainId) {
    try {
      const response = await fetch(`${API}/history/${drainId}`);

      if (!response.ok) {
        setHistory([]);
        return;
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        setHistory(data);
      } else if (Array.isArray(data.history)) {
        setHistory(data.history);
      } else {
        setHistory([]);
      }
    } catch {
      setHistory([]);
    }
  }

  useEffect(() => {
    loadDashboard();

    const timer = setInterval(() => {
      loadDashboard();
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedDrain) {
      loadHistory(selectedDrain.id);
    }
  }, [selectedDrain]);

  const criticalCount = drains.filter(
    (drain) => drain.status === "CRITICAL"
  ).length;

  const warningCount = drains.filter(
    (drain) => drain.status === "WARNING"
  ).length;

  const normalCount = drains.filter(
    (drain) => drain.status === "NORMAL"
  ).length;

  const averageLevel = useMemo(() => {
    if (!drains.length) return 0;

    return Math.round(
      drains.reduce(
        (total, drain) => total + Number(drain.water_level || 0),
        0
      ) / drains.length
    );
  }, [drains]);

  const highestRiskDrain = useMemo(() => {
    if (!drains.length) return null;

    return [...drains].sort(
      (a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0)
    )[0];
  }, [drains]);

  async function simulateDrain(drainId, level) {
    setSimulating(true);

    try {
      const response = await fetch(`${API}/simulator/${drainId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          water_level: level,
        }),
      });

      if (!response.ok) {
        throw new Error("Simulation failed");
      }

      const data = await response.json();

      if (data.drain) {
        setDrains((current) =>
          current.map((drain) =>
            drain.id === drainId ? data.drain : drain
          )
        );
      }

      if (data.cleaning_verified) {
        showToast("✓ IoT SENSOR VERIFIED: Drain cleaning confirmed");
      } else if (level >= 90) {
        showToast("🚨 CRITICAL ALERT: Officials notified");
      } else {
        showToast(`Sensor updated: water level ${level}%`);
      }

      await loadDashboard();
      await loadIncidents();
    } catch {
      showToast("Unable to connect to backend");
    } finally {
      setSimulating(false);
    }
  }

  async function acknowledgeIncident(id) {
    try {
      const response = await fetch(
        `${API}/incidents/${id}/acknowledge`,
        {
          method: "PATCH",
        }
      );

      if (!response.ok) throw new Error();

      showToast("Incident acknowledged by official");
      await loadDashboard();
      await loadIncidents();
    } catch {
      showToast("Could not acknowledge incident");
    }
  }

  async function markCleaned(id) {
    try {
      const response = await fetch(`${API}/incidents/${id}/clean`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error();

      showToast("Cleaning action recorded");
      await loadDashboard();
      await loadIncidents();
    } catch {
      showToast("Could not update cleaning status");
    }
  }

  function openDrain(drain) {
    setSelectedDrain(drain);
    loadHistory(drain.id);
  }

  return (
    <div className="app">
      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: #f4f7fb;
          color: #172033;
        }

        button {
          font-family: inherit;
        }

        .app {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(59,130,246,.08), transparent 32%),
            #f4f7fb;
        }

        .topbar {
          height: 74px;
          background: rgba(255,255,255,.96);
          border-bottom: 1px solid #e5eaf1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 34px;
          position: sticky;
          top: 0;
          z-index: 20;
          backdrop-filter: blur(12px);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .brandIcon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #172033;
          color: white;
          font-size: 23px;
          font-weight: 800;
        }

        .brandTitle {
          font-size: 19px;
          font-weight: 800;
          letter-spacing: -.3px;
        }

        .brandSub {
          color: #7b8798;
          font-size: 11px;
          margin-top: 2px;
        }

        .topActions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .connection {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 13px;
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          background: #fff;
          font-size: 12px;
          font-weight: 700;
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 0 4px rgba(34,197,94,.12);
        }

        .dot.offline {
          background: #ef4444;
          box-shadow: 0 0 0 4px rgba(239,68,68,.12);
        }

        .phoneButton {
          border: 0;
          background: #172033;
          color: white;
          padding: 11px 16px;
          border-radius: 10px;
          font-weight: 700;
          cursor: pointer;
        }

        .container {
          width: min(1450px, calc(100% - 48px));
          margin: 0 auto;
          padding: 30px 0 60px;
        }

        .hero {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: flex-end;
          margin-bottom: 25px;
        }

        .eyebrow {
          color: #2563eb;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .hero h1 {
          font-size: clamp(28px, 4vw, 44px);
          margin: 0;
          letter-spacing: -1.5px;
          line-height: 1.05;
        }

        .hero p {
          margin: 11px 0 0;
          color: #68758a;
          max-width: 690px;
          font-size: 14px;
          line-height: 1.6;
        }

        .liveBadge {
          background: #fff;
          border: 1px solid #e4e9f0;
          padding: 13px 16px;
          border-radius: 12px;
          color: #536074;
          font-size: 12px;
          white-space: nowrap;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin-bottom: 25px;
        }

        .stat {
          background: #fff;
          border: 1px solid #e5eaf1;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 5px 20px rgba(15,23,42,.035);
        }

        .statTop {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .statLabel {
          color: #718096;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .5px;
        }

        .statIcon {
          width: 34px;
          height: 34px;
          display: flex;
          justify-content: center;
          align-items: center;
          border-radius: 10px;
          background: #f1f5f9;
          font-size: 17px;
        }

        .statValue {
          font-size: 30px;
          font-weight: 850;
          margin-top: 13px;
        }

        .statNote {
          font-size: 11px;
          color: #8a95a6;
          margin-top: 5px;
        }

        .sectionTitle {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 30px 0 14px;
        }

        .sectionTitle h2 {
          margin: 0;
          font-size: 18px;
          letter-spacing: -.3px;
        }

        .sectionTitle span {
          color: #8994a5;
          font-size: 12px;
        }

        .drainGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
        }

        .drainCard {
          background: white;
          border: 1px solid #e5eaf1;
          border-radius: 16px;
          padding: 18px;
          cursor: pointer;
          transition: .2s ease;
          box-shadow: 0 5px 20px rgba(15,23,42,.035);
        }

        .drainCard:hover {
          transform: translateY(-2px);
          border-color: #cbd5e1;
          box-shadow: 0 12px 30px rgba(15,23,42,.07);
        }

        .drainHead {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }

        .drainName {
          font-weight: 800;
          font-size: 16px;
        }

        .drainLocation {
          color: #8290a3;
          font-size: 11px;
          margin-top: 4px;
        }

        .status {
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .5px;
        }

        .levelArea {
          margin-top: 22px;
        }

        .levelTop {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 12px;
          color: #68758a;
        }

        .levelValue {
          font-size: 27px;
          color: #172033;
          font-weight: 850;
        }

        .progress {
          height: 10px;
          background: #edf1f5;
          border-radius: 99px;
          overflow: hidden;
        }

        .progressFill {
          height: 100%;
          border-radius: 99px;
          transition: width .4s ease;
        }

        .drainBottom {
          display: flex;
          justify-content: space-between;
          margin-top: 15px;
          padding-top: 14px;
          border-top: 1px solid #edf1f5;
          font-size: 11px;
          color: #778398;
        }

        .risk {
          font-weight: 800;
        }

        .dashboardGrid {
          display: grid;
          grid-template-columns: 1.25fr .75fr;
          gap: 16px;
          margin-top: 25px;
        }

        .panel {
          background: #fff;
          border: 1px solid #e5eaf1;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 5px 20px rgba(15,23,42,.035);
        }

        .panelHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
        }

        .panelHeader h3 {
          margin: 0;
          font-size: 16px;
        }

        .panelHeader p {
          margin: 4px 0 0;
          font-size: 11px;
          color: #8a95a6;
        }

        .aiCard {
          background: linear-gradient(135deg, #172033, #263247);
          color: white;
          border-radius: 14px;
          padding: 19px;
        }

        .aiTop {
          display: flex;
          justify-content: space-between;
          gap: 20px;
        }

        .aiTitle {
          font-size: 15px;
          font-weight: 800;
        }

        .aiDesc {
          margin-top: 5px;
          color: #aab6c7;
          font-size: 11px;
          line-height: 1.5;
        }

        .riskCircle {
          min-width: 75px;
          height: 75px;
          border: 5px solid #f59e0b;
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .riskCircle strong {
          font-size: 21px;
        }

        .riskCircle span {
          font-size: 8px;
          color: #cbd5e1;
        }

        .aiMetrics {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-top: 18px;
        }

        .aiMetric {
          background: rgba(255,255,255,.07);
          padding: 11px;
          border-radius: 10px;
        }

        .aiMetric span {
          display: block;
          color: #9aa8ba;
          font-size: 9px;
        }

        .aiMetric strong {
          display: block;
          margin-top: 4px;
          font-size: 13px;
        }

        .incidentList {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 330px;
          overflow: auto;
        }

        .incident {
          border: 1px solid #e7ebf1;
          border-radius: 12px;
          padding: 13px;
        }

        .incidentTop {
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }

        .incidentTitle {
          font-weight: 800;
          font-size: 12px;
        }

        .incidentMeta {
          color: #8994a5;
          font-size: 10px;
          margin-top: 4px;
        }

        .incidentMessage {
          font-size: 11px;
          color: #667388;
          margin: 9px 0;
          line-height: 1.45;
        }

        .incidentActions {
          display: flex;
          gap: 7px;
        }

        .smallButton {
          border: 1px solid #dbe2ea;
          background: white;
          padding: 7px 10px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 10px;
          font-weight: 700;
        }

        .smallButton:hover {
          background: #f5f7fa;
        }

        .workflow {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .workflowStep {
          position: relative;
          padding: 17px;
          border: 1px solid #e5eaf1;
          background: #fff;
          border-radius: 13px;
        }

        .workflowNumber {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #172033;
          color: white;
          font-size: 11px;
          font-weight: 800;
          margin-bottom: 12px;
        }

        .workflowStep strong {
          display: block;
          font-size: 12px;
        }

        .workflowStep p {
          margin: 5px 0 0;
          color: #8490a2;
          font-size: 10px;
          line-height: 1.5;
        }

        .simulation {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .simButton {
          border: 1px solid #dbe2ea;
          background: white;
          border-radius: 9px;
          padding: 9px 11px;
          cursor: pointer;
          font-size: 10px;
          font-weight: 800;
        }

        .simButton:hover {
          background: #f1f5f9;
        }

        .simButton.critical {
          border-color: #fecaca;
          color: #b91c1c;
        }

        .simButton.clean {
          border-color: #bbf7d0;
          color: #15803d;
        }

        .notifications {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .notification {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          border-bottom: 1px solid #edf1f5;
          padding-bottom: 10px;
        }

        .notificationIcon {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: #f1f5f9;
          font-size: 12px;
        }

        .notificationText {
          font-size: 11px;
          line-height: 1.4;
        }

        .notificationTime {
          display: block;
          margin-top: 3px;
          color: #97a1b0;
          font-size: 9px;
        }

        .empty {
          color: #8c98a9;
          text-align: center;
          padding: 25px 10px;
          font-size: 12px;
        }

        .footer {
          text-align: center;
          color: #94a0b0;
          font-size: 10px;
          padding: 30px 0 0;
        }

        .modalBackdrop {
          position: fixed;
          inset: 0;
          background: rgba(15,23,42,.62);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 50;
        }

        .modal {
          width: min(850px, 100%);
          max-height: 90vh;
          overflow: auto;
          background: white;
          border-radius: 18px;
          padding: 22px;
          box-shadow: 0 30px 80px rgba(0,0,0,.25);
        }

        .modalHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .close {
          border: 0;
          background: #f1f5f9;
          width: 34px;
          height: 34px;
          border-radius: 9px;
          cursor: pointer;
          font-size: 18px;
        }

        .chart {
          height: 180px;
          display: flex;
          align-items: flex-end;
          gap: 5px;
          padding: 15px;
          background: #f7f9fb;
          border-radius: 12px;
          overflow: hidden;
        }

        .bar {
          flex: 1;
          min-width: 4px;
          max-width: 18px;
          background: #2563eb;
          border-radius: 5px 5px 0 0;
        }

        .phoneOverlay {
          position: fixed;
          inset: 0;
          background: #0b1120;
          color: white;
          z-index: 100;
          padding: 22px;
          overflow: auto;
        }

        .phoneShell {
          width: min(430px, 100%);
          margin: 0 auto;
          min-height: 100%;
        }

        .phoneTop {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 22px;
        }

        .phoneTitle {
          font-size: 20px;
          font-weight: 850;
        }

        .phoneSub {
          color: #94a3b8;
          font-size: 10px;
          margin-top: 4px;
        }

        .emergency {
          border: 1px solid rgba(239,68,68,.4);
          background: rgba(239,68,68,.1);
          color: #fca5a5;
          padding: 8px 10px;
          border-radius: 8px;
          font-size: 9px;
          font-weight: 900;
        }

        .phoneCard {
          background: #111827;
          border: 1px solid #253044;
          border-radius: 17px;
          padding: 18px;
          margin-bottom: 12px;
        }

        .phoneDrain {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .phoneLevel {
          font-size: 42px;
          font-weight: 900;
          margin: 20px 0 8px;
        }

        .phoneProgress {
          height: 9px;
          background: #263244;
          border-radius: 99px;
          overflow: hidden;
        }

        .phoneProgress div {
          height: 100%;
          border-radius: 99px;
        }

        .phoneGrid {
          display: grid;
          grid-template-columns: repeat(2,1fr);
          gap: 8px;
          margin-top: 14px;
        }

        .phoneMetric {
          background: #182234;
          border-radius: 10px;
          padding: 11px;
        }

        .phoneMetric span {
          display: block;
          color: #8290a5;
          font-size: 9px;
        }

        .phoneMetric strong {
          display: block;
          margin-top: 5px;
          font-size: 14px;
        }

        .alertOfficial {
          width: 100%;
          padding: 15px;
          border: 0;
          border-radius: 11px;
          background: #ef4444;
          color: white;
          font-weight: 900;
          cursor: pointer;
          margin-top: 12px;
        }

        .toast {
          position: fixed;
          right: 20px;
          bottom: 20px;
          z-index: 200;
          background: #172033;
          color: white;
          padding: 13px 17px;
          border-radius: 11px;
          box-shadow: 0 15px 35px rgba(0,0,0,.2);
          font-size: 12px;
          font-weight: 700;
          max-width: 350px;
        }

        @media (max-width: 1100px) {
          .drainGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .dashboardGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .topbar {
            padding: 0 16px;
          }

          .brandSub {
            display: none;
          }

          .connection {
            display: none;
          }

          .container {
            width: min(100% - 28px, 1450px);
            padding-top: 22px;
          }

          .hero {
            align-items: flex-start;
            flex-direction: column;
          }

          .liveBadge {
            white-space: normal;
          }

          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .drainGrid {
            grid-template-columns: 1fr;
          }

          .workflow {
            grid-template-columns: 1fr 1fr;
          }

          .aiMetrics {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 430px) {
          .stats {
            grid-template-columns: 1fr;
          }

          .workflow {
            grid-template-columns: 1fr;
          }

          .phoneButton {
            padding: 9px 11px;
            font-size: 10px;
          }
        }
      `}</style>

      <header className="topbar">
        <div className="brand">
          <div className="brandIcon">≋</div>

          <div>
            <div className="brandTitle">DrainGuard AI</div>
            <div className="brandSub">
              Intelligent Urban Drainage Management
            </div>
          </div>
        </div>

        <div className="topActions">
          <div className="connection">
            <span className={`dot ${backendOnline ? "" : "offline"}`} />

            {backendOnline
              ? "SYSTEM ONLINE"
              : "BACKEND OFFLINE"}
          </div>

          <button
            className="phoneButton"
            onClick={() => setPhoneMode(true)}
          >
            📱 iQOO Emergency Mode
          </button>
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <div>
            <div className="eyebrow">AI + IoT COMMAND CENTER</div>

            <h1>
              Drainage intelligence,
              <br />
              from sensor to action.
            </h1>

            <p>
              Real-time water-level monitoring, AI risk assessment,
              automated official alerts and IoT-based cleaning
              verification in one closed-loop platform.
            </p>
          </div>

          <div className="liveBadge">
            <strong>● LIVE MONITORING</strong>
            <br />
            Last update: {formatTime(lastUpdate)}
          </div>
        </section>

        <section className="stats">
          <div className="stat">
            <div className="statTop">
              <span className="statLabel">Total Drains</span>
              <span className="statIcon">💧</span>
            </div>

            <div className="statValue">{drains.length}</div>

            <div className="statNote">
              IoT-connected monitoring points
            </div>
          </div>

          <div className="stat">
            <div className="statTop">
              <span className="statLabel">Critical</span>
              <span className="statIcon">🚨</span>
            </div>

            <div className="statValue" style={{ color: "#ef4444" }}>
              {criticalCount}
            </div>

            <div className="statNote">
              Immediate intervention required
            </div>
          </div>

          <div className="stat">
            <div className="statTop">
              <span className="statLabel">Warning</span>
              <span className="statIcon">⚠️</span>
            </div>

            <div className="statValue" style={{ color: "#f59e0b" }}>
              {warningCount}
            </div>

            <div className="statNote">
              Requires monitoring
            </div>
          </div>

          <div className="stat">
            <div className="statTop">
              <span className="statLabel">Avg Water Level</span>
              <span className="statIcon">📊</span>
            </div>

            <div className="statValue">
              {averageLevel}%
            </div>

            <div className="statNote">
              {normalCount} drains currently normal
            </div>
          </div>
        </section>

        <div className="sectionTitle">
          <h2>Live Drain Network</h2>
          <span>
            Click a drain for sensor history
          </span>
        </div>

        <section className="drainGrid">
          {loading && drains.length === 0 ? (
            <div className="empty">
              Loading IoT network...
            </div>
          ) : (
            drains.map((drain) => {
              const level = Number(drain.water_level || 0);
              const status =
                drain.status || statusFor(level);

              const risk =
                Number(drain.risk_score) ||
                riskFor(level);

              return (
                <div
                  className="drainCard"
                  key={drain.id}
                  onClick={() => openDrain(drain)}
                >
                  <div className="drainHead">
                    <div>
                      <div className="drainName">
                        {drain.name || `Drain ${drain.id}`}
                      </div>

                      <div className="drainLocation">
                        📍 {drain.location || "Connected location"}
                      </div>
                    </div>

                    <span
                      className="status"
                      style={{
                        color: statusColor(status),
                        background:
                          status === "CRITICAL"
                            ? "#fee2e2"
                            : status === "WARNING"
                            ? "#fef3c7"
                            : "#dcfce7",
                      }}
                    >
                      {status}
                    </span>
                  </div>

                  <div className="levelArea">
                    <div className="levelTop">
                      <span>Water Level</span>

                      <span className="levelValue">
                        {level}%
                      </span>
                    </div>

                    <div className="progress">
                      <div
                        className="progressFill"
                        style={{
                          width: `${Math.min(level, 100)}%`,
                          background: statusColor(status),
                        }}
                      />
                    </div>
                  </div>

                  <div className="drainBottom">
                    <span>
                      🌡️ {drain.temperature ?? "--"}°C
                    </span>

                    <span className="risk">
                      AI Risk {risk}/100
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </section>

        <section className="dashboardGrid">
          <div className="panel">
            <div className="panelHeader">
              <div>
                <h3>🤖 AI Risk Command Center</h3>
                <p>
                  Continuous risk scoring from live IoT sensor data
                </p>
              </div>
            </div>

            {highestRiskDrain ? (
              <div className="aiCard">
                <div className="aiTop">
                  <div>
                    <div className="aiTitle">
                      Highest Priority:{" "}
                      {highestRiskDrain.name ||
                        `Drain ${highestRiskDrain.id}`}
                    </div>

                    <div className="aiDesc">
                      {highestRiskDrain.location ||
                        "Connected drainage point"}{" "}
                      is currently being prioritized by
                      the AI risk engine.
                    </div>
                  </div>

                  <div className="riskCircle">
                    <strong>
                      {highestRiskDrain.risk_score || 0}
                    </strong>

                    <span>
                      {riskLabel(
                        highestRiskDrain.risk_score || 0
                      )}
                    </span>
                  </div>
                </div>

                <div className="aiMetrics">
                  <div className="aiMetric">
                    <span>WATER LEVEL</span>
                    <strong>
                      {highestRiskDrain.water_level || 0}%
                    </strong>
                  </div>

                  <div className="aiMetric">
                    <span>STATUS</span>
                    <strong>
                      {highestRiskDrain.status || "NORMAL"}
                    </strong>
                  </div>

                  <div className="aiMetric">
                    <span>TEMPERATURE</span>
                    <strong>
                      {highestRiskDrain.temperature ?? "--"}°C
                    </strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty">
                Waiting for sensor data...
              </div>
            )}

            <div className="sectionTitle">
              <h2 style={{ fontSize: "14px" }}>
                Demo Sensor Controls
              </h2>

              <span>
                Simulates ESP32 data
              </span>
            </div>

            <div className="simulation">
              {drains.map((drain) => (
                <div
                  key={drain.id}
                  style={{
                    display: "flex",
                    gap: "5px",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <strong
                    style={{
                      fontSize: "10px",
                      marginRight: "3px",
                    }}
                  >
                    D{drain.id}
                  </strong>

                  <button
                    className="simButton"
                    disabled={simulating}
                    onClick={(event) => {
                      event.stopPropagation();
                      simulateDrain(drain.id, 40);
                    }}
                  >
                    40%
                  </button>

                  <button
                    className="simButton"
                    disabled={simulating}
                    onClick={(event) => {
                      event.stopPropagation();
                      simulateDrain(drain.id, 78);
                    }}
                  >
                    78%
                  </button>

                  <button
                    className="simButton critical"
                    disabled={simulating}
                    onClick={(event) => {
                      event.stopPropagation();
                      simulateDrain(drain.id, 95);
                    }}
                  >
                    95%
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panelHeader">
              <div>
                <h3>🔔 Notifications</h3>
                <p>
                  Automated system events
                </p>
              </div>
            </div>

            <div className="notifications">
              {notifications.length === 0 ? (
                <div className="empty">
                  No new notifications
                </div>
              ) : (
                notifications.slice(0, 7).map((notification, index) => (
                  <div
                    className="notification"
                    key={
                      notification.id ||
                      `${notification.created_at}-${index}`
                    }
                  >
                    <div className="notificationIcon">
                      {notification.type === "SUCCESS"
                        ? "✓"
                        : notification.type === "CRITICAL"
                        ? "🚨"
                        : "🔔"}
                    </div>

                    <div className="notificationText">
                      {notification.message ||
                        "System notification"}

                      <span className="notificationTime">
                        {formatTime(notification.created_at)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <div className="sectionTitle">
          <h2>Incident Center</h2>
          <span>
            Closed-loop response management
          </span>
        </div>

        <section className="panel">
          <div className="incidentList">
            {incidents.length === 0 ? (
              <div className="empty">
                ✓ No active incidents
              </div>
            ) : (
              incidents.slice(0, 10).map((incident) => (
                <div
                  className="incident"
                  key={incident.id}
                >
                  <div className="incidentTop">
                    <div>
                      <div className="incidentTitle">
                        🚨{" "}
                        {incident.title ||
                          `Drain ${incident.drain_id} Alert`}
                      </div>

                      <div className="incidentMeta">
                        Drain {incident.drain_id} ·{" "}
                        {incident.status || "OPEN"} ·{" "}
                        {formatTime(incident.created_at)}
                      </div>
                    </div>

                    <span
                      className="status"
                      style={{
                        color:
                          incident.status === "CLOSED"
                            ? "#15803d"
                            : "#b91c1c",
                        background:
                          incident.status === "CLOSED"
                            ? "#dcfce7"
                            : "#fee2e2",
                      }}
                    >
                      {incident.status || "OPEN"}
                    </span>
                  </div>

                  <div className="incidentMessage">
                    {incident.message ||
                      "Drainage risk detected by IoT sensor."}

                    {incident.verification ===
                      "IOT SENSOR VERIFIED" && (
                      <strong
                        style={{
                          display: "block",
                          color: "#15803d",
                          marginTop: "5px",
                        }}
                      >
                        ✓ IoT sensor verified cleaning
                      </strong>
                    )}

                    {incident.verification ===
                      "IoT SENSOR VERIFIED" && (
                      <strong
                        style={{
                          display: "block",
                          color: "#15803d",
                          marginTop: "5px",
                        }}
                      >
                        ✓ IoT sensor verified cleaning
                      </strong>
                    )}
                  </div>

                  {incident.status !== "CLOSED" && (
                    <div className="incidentActions">
                      <button
                        className="smallButton"
                        onClick={() =>
                          acknowledgeIncident(incident.id)
                        }
                      >
                        Acknowledge
                      </button>

                      <button
                        className="smallButton"
                        onClick={() =>
                          markCleaned(incident.id)
                        }
                      >
                        Mark Cleaned
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <div className="sectionTitle">
          <h2>Closed-Loop Workflow</h2>
          <span>
            Sensor → AI → Official → Verification
          </span>
        </div>

        <section className="workflow">
          <div className="workflowStep">
            <div className="workflowNumber">1</div>

            <strong>IoT Detects</strong>

            <p>
              Waterproof ultrasonic sensor continuously
              measures drainage water level.
            </p>
          </div>

          <div className="workflowStep">
            <div className="workflowNumber">2</div>

            <strong>AI Assesses Risk</strong>

            <p>
              Water level is converted into a live risk
              score and operational status.
            </p>
          </div>

          <div className="workflowStep">
            <div className="workflowNumber">3</div>

            <strong>Officials Alerted</strong>

            <p>
              Critical drainage conditions automatically
              create an incident and notification.
            </p>
          </div>

          <div className="workflowStep">
            <div className="workflowNumber">4</div>

            <strong>Cleaning Verified</strong>

            <p>
              Sensor detects the water-level reduction
              after cleaning and closes the incident.
            </p>
          </div>
        </section>

        <div className="footer">
          DrainGuard AI · AI + IoT Urban Drainage Management
          · Live monitoring enabled
        </div>
      </main>

      {selectedDrain && (
        <div
          className="modalBackdrop"
          onClick={() => setSelectedDrain(null)}
        >
          <div
            className="modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modalHead">
              <div>
                <h2 style={{ margin: 0 }}>
                  {selectedDrain.name ||
                    `Drain ${selectedDrain.id}`}
                </h2>

                <div
                  style={{
                    color: "#8994a5",
                    fontSize: "11px",
                    marginTop: "4px",
                  }}
                >
                  📍{" "}
                  {selectedDrain.location ||
                    "Connected drainage point"}
                </div>
              </div>

              <button
                className="close"
                onClick={() => setSelectedDrain(null)}
              >
                ×
              </button>
            </div>

            <div className="stats">
              <div className="stat">
                <span className="statLabel">
                  Current Level
                </span>

                <div className="statValue">
                  {selectedDrain.water_level || 0}%
                </div>
              </div>

              <div className="stat">
                <span className="statLabel">
                  AI Risk
                </span>

                <div className="statValue">
                  {selectedDrain.risk_score || 0}
                </div>
              </div>

              <div className="stat">
                <span className="statLabel">
                  Status
                </span>

                <div
                  className="statValue"
                  style={{
                    color: statusColor(
                      selectedDrain.status ||
                        statusFor(
                          selectedDrain.water_level || 0
                        )
                    ),
                    fontSize: "21px",
                  }}
                >
                  {selectedDrain.status ||
                    statusFor(
                      selectedDrain.water_level || 0
                    )}
                </div>
              </div>

              <div className="stat">
                <span className="statLabel">
                  Temperature
                </span>

                <div className="statValue">
                  {selectedDrain.temperature ?? "--"}°
                </div>
              </div>
            </div>

            <div className="panelHeader">
              <div>
                <h3>Sensor History</h3>
                <p>
                  Recent readings from this drainage point
                </p>
              </div>
            </div>

            {history.length > 0 ? (
              <div className="chart">
                {history.slice(-35).map((item, index) => {
                  const level = Number(
                    item.water_level ||
                      item.level ||
                      0
                  );

                  return (
                    <div
                      className="bar"
                      key={index}
                      title={`${level}%`}
                      style={{
                        height: `${Math.max(
                          3,
                          Math.min(level, 100)
                        )}%`,
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="empty">
                No historical sensor readings yet.
                <br />
                Use the demo sensor controls to create
                readings.
              </div>
            )}
          </div>
        </div>
      )}

      {phoneMode && (
        <div className="phoneOverlay">
          <div className="phoneShell">
            <div className="phoneTop">
              <div>
                <div className="phoneTitle">
                  DrainGuard AI
                </div>

                <div className="phoneSub">
                  iQOO Emergency Command Mode
                </div>
              </div>

              <button
                className="close"
                onClick={() => setPhoneMode(false)}
              >
                ×
              </button>
            </div>

            <div className="emergency">
              ● EMERGENCY MONITORING ACTIVE
            </div>

            {highestRiskDrain && (
              <>
                <div className="phoneCard">
                  <div className="phoneDrain">
                    <div>
                      <strong>
                        {highestRiskDrain.name ||
                          `Drain ${highestRiskDrain.id}`}
                      </strong>

                      <div
                        style={{
                          color: "#94a3b8",
                          fontSize: "10px",
                          marginTop: "4px",
                        }}
                      >
                        {highestRiskDrain.location}
                      </div>
                    </div>

                    <span
                      className="status"
                      style={{
                        color: "#fca5a5",
                        background:
                          "rgba(239,68,68,.15)",
                      }}
                    >
                      {highestRiskDrain.status}
                    </span>
                  </div>

                  <div className="phoneLevel">
                    {highestRiskDrain.water_level || 0}%
                  </div>

                  <div
                    style={{
                      color: "#94a3b8",
                      fontSize: "10px",
                      marginBottom: "8px",
                    }}
                  >
                    CURRENT WATER LEVEL
                  </div>

                  <div className="phoneProgress">
                    <div
                      style={{
                        width: `${Math.min(
                          highestRiskDrain.water_level || 0,
                          100
                        )}%`,
                        background:
                          statusColor(
                            highestRiskDrain.status
                          ),
                      }}
                    />
                  </div>

                  <div className="phoneGrid">
                    <div className="phoneMetric">
                      <span>AI RISK</span>
                      <strong>
                        {highestRiskDrain.risk_score || 0}/100
                      </strong>
                    </div>

                    <div className="phoneMetric">
                      <span>STATUS</span>
                      <strong>
                        {highestRiskDrain.status}
                      </strong>
                    </div>

                    <div className="phoneMetric">
                      <span>TEMPERATURE</span>
                      <strong>
                        {highestRiskDrain.temperature ?? "--"}°C
                      </strong>
                    </div>

                    <div className="phoneMetric">
                      <span>NETWORK</span>
                      <strong>
                        {backendOnline
                          ? "ONLINE"
                          : "OFFLINE"}
                      </strong>
                    </div>
                  </div>

                  <button
                    className="alertOfficial"
                    onClick={() =>
                      showToast(
                        "🚨 Emergency alert sent to officials"
                      )
                    }
                  >
                    🚨 ALERT OFFICIALS NOW
                  </button>
                </div>

                <div className="phoneCard">
                  <strong>
                    📡 Connected IoT Network
                  </strong>

                  <div
                    style={{
                      marginTop: "12px",
                      color: "#94a3b8",
                      fontSize: "11px",
                      lineHeight: 1.6,
                    }}
                  >
                    {drains.length} drainage sensors
                    connected.
                    <br />
                    Continuous water-level monitoring
                    enabled.
                    <br />
                    AI risk engine operational.
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="toast">
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;