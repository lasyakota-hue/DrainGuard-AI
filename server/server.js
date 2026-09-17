import express from "express";
import cors from "cors";

const app = express();
const PORT = 5000;

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(cors());
app.use(express.json());

/* =========================================================
   PROJECT CONFIGURATION
========================================================= */

const PROJECT_NAME = "DrainGuard AI";
const VERSION = "4.0.0";

/* =========================================================
   DRAIN NODES
========================================================= */

const drains = [
  {
    id: 1,
    name: "Drain Node A1",
    location: "Hyderabad Central Zone",
    latitude: 17.385,
    longitude: 78.4867,
    water_level: 32,
    temperature: 28,
    status: "NORMAL",
    risk_score: 10,
    risk_level: "LOW",
    updated_at: new Date().toISOString()
  },

  {
    id: 2,
    name: "Drain Node A2",
    location: "Hitech City",
    latitude: 17.4483,
    longitude: 78.3915,
    water_level: 46,
    temperature: 29,
    status: "NORMAL",
    risk_score: 30,
    risk_level: "LOW",
    updated_at: new Date().toISOString()
  },

  {
    id: 3,
    name: "Drain Node B1",
    location: "Kukatpally",
    latitude: 17.4849,
    longitude: 78.4138,
    water_level: 68,
    temperature: 30,
    status: "NORMAL",
    risk_score: 55,
    risk_level: "MEDIUM",
    updated_at: new Date().toISOString()
  },

  {
    id: 4,
    name: "Drain Node B2",
    location: "Madhapur",
    latitude: 17.4486,
    longitude: 78.3908,
    water_level: 91,
    temperature: 31,
    status: "CRITICAL",
    risk_score: 95,
    risk_level: "CRITICAL",
    updated_at: new Date().toISOString()
  }
];

/* =========================================================
   APPLICATION DATA
========================================================= */

const incidents = [];
const notifications = [];
const sensorHistory = [];

/* =========================================================
   UTILITY FUNCTIONS
========================================================= */

function normalizeWaterLevel(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.max(0, Math.min(100, number));
}

function normalizeTemperature(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return number;
}

/* =========================================================
   STATUS ENGINE
========================================================= */

function calculateStatus(level) {
  if (level >= 90) {
    return "CRITICAL";
  }

  if (level >= 75) {
    return "WARNING";
  }

  return "NORMAL";
}

/* =========================================================
   AI RISK ENGINE
========================================================= */

/*
   Risk score is based on water-level capacity.

   0-39%   -> 10
   40-59%  -> 30
   60-74%  -> 55
   75-84%  -> 75
   85-89%  -> 88
   90-94%  -> 95
   95-100% -> 99
*/

function calculateRiskScore(level) {
  if (level >= 95) {
    return 99;
  }

  if (level >= 90) {
    return 95;
  }

  if (level >= 85) {
    return 88;
  }

  if (level >= 75) {
    return 75;
  }

  if (level >= 60) {
    return 55;
  }

  if (level >= 40) {
    return 30;
  }

  return 10;
}

/*
   Risk level is now directly aligned with
   the calculated risk score.
*/

function getRiskLevel(score) {
  if (score >= 90) {
    return "CRITICAL";
  }

  if (score >= 75) {
    return "HIGH";
  }

  if (score >= 50) {
    return "MEDIUM";
  }

  return "LOW";
}

/* =========================================================
   COMPLETE RISK ANALYSIS
========================================================= */

function analyzeRisk(level) {
  const riskScore = calculateRiskScore(level);
  const riskLevel = getRiskLevel(riskScore);

  let recommendation = "Continue normal monitoring.";

  if (riskLevel === "MEDIUM") {
    recommendation = "Increase monitoring frequency.";
  }

  if (riskLevel === "HIGH") {
    recommendation = "Inspection recommended.";
  }

  if (riskLevel === "CRITICAL") {
    recommendation = "Immediate drainage cleaning required.";
  }

  return {
    risk_score: riskScore,
    risk_level: riskLevel,
    recommendation
  };
}

/* =========================================================
   NOTIFICATION ENGINE
========================================================= */

function addNotification(type, message, incidentId = null) {
  notifications.unshift({
    id: notifications.length + 1,
    incident_id: incidentId,
    type,
    message,
    created_at: new Date().toISOString()
  });

  /*
     Keep memory small during long demonstrations.
  */

  if (notifications.length > 100) {
    notifications.pop();
  }
}

/* =========================================================
   INCIDENT CREATION
========================================================= */

function createAlert(drain) {
  const existing = incidents.find(function (incident) {
    return (
      incident.drain_id === drain.id &&
      incident.status !== "CLOSED"
    );
  });

  /*
     Prevent duplicate alerts.
  */

  if (existing) {
    return existing;
  }

  /*
     Normal drains do not create incidents.
  */

  if (drain.status === "NORMAL") {
    return null;
  }

  const risk = analyzeRisk(drain.water_level);

  const incident = {
    id: incidents.length + 1,

    drain_id: drain.id,

    drain_name: drain.name,

    location: drain.location,

    severity: drain.status,

    risk_score: risk.risk_score,

    risk_level: risk.risk_level,

    title:
      drain.status === "CRITICAL"
        ? "Critical Drainage Overflow Risk"
        : "Drainage Blockage Warning",

    description:
      drain.status === "CRITICAL"
        ? `${drain.name} has reached ${drain.water_level}% capacity. Immediate cleaning required.`
        : `${drain.name} has reached ${drain.water_level}% capacity. Inspection required.`,

    status: "OPEN",

    initial_water_level: drain.water_level,

    current_water_level: drain.water_level,

    created_at: new Date().toISOString()
  };

  incidents.unshift(incident);

  /*
     Send notification to officials.
  */

  if (drain.status === "CRITICAL") {
    addNotification(
      "CRITICAL",
      `🚨 CRITICAL ALERT: ${drain.name} requires immediate cleaning.`,
      incident.id
    );
  } else {
    addNotification(
      "WARNING",
      `⚠️ WARNING: ${drain.name} requires inspection.`,
      incident.id
    );
  }

  return incident;
}

/* =========================================================
   AUTOMATIC IoT CLEANING VERIFICATION
========================================================= */

function verifyCleaningFromSensor(drain) {
  const incident = incidents.find(function (item) {
    return (
      item.drain_id === drain.id &&
      item.status !== "CLOSED"
    );
  });

  /*
     No active incident.
  */

  if (!incident) {
    return false;
  }

  const initialLevel = Number(
    incident.initial_water_level
  );

  const currentLevel = Number(
    drain.water_level
  );

  const reduction =
    initialLevel - currentLevel;

  /*
     AUTOMATIC VERIFICATION RULES

     1. Incident must originally be critical.
     2. Initial level >= 90%.
     3. Current level < 75%.
     4. Water reduction >= 15%.
  */

  const verified =
    initialLevel >= 90 &&
    currentLevel < 75 &&
    reduction >= 15;

  /*
     Cleaning not yet verified.
  */

  if (!verified) {
    incident.current_water_level =
      currentLevel;

    return false;
  }

  /*
     CLEANING VERIFIED
  */

  incident.status = "CLOSED";

  incident.cleaned_at =
    new Date().toISOString();

  incident.final_water_level =
    currentLevel;

  incident.current_water_level =
    currentLevel;

  incident.water_level_reduction =
    reduction;

  incident.verification =
    "IoT SENSOR VERIFIED";

  incident.verification_method =
    "AUTOMATIC SENSOR RECOVERY ANALYSIS";

  incident.message =
    "Drain cleaning successfully verified by IoT sensor.";

  addNotification(
    "SUCCESS",
    `✅ ${drain.name} cleaning successfully verified by IoT sensor. Water level reduced from ${initialLevel}% to ${currentLevel}%.`,
    incident.id
  );

  return true;
}

/* =========================================================
   PROCESS SENSOR DATA
========================================================= */

function processSensorData(
  drain,
  level,
  temperature,
  source = "IoT"
) {
  const previousLevel =
    drain.water_level;

  /*
     Update drain.
  */

  drain.water_level = level;

  drain.temperature = temperature;

  drain.status =
    calculateStatus(level);

  const risk =
    analyzeRisk(level);

  drain.risk_score =
    risk.risk_score;

  drain.risk_level =
    risk.risk_level;

  drain.risk_recommendation =
    risk.recommendation;

  drain.updated_at =
    new Date().toISOString();

  /*
     Save sensor history.
  */

  sensorHistory.push({
    drain_id: drain.id,

    water_level: level,

    previous_water_level:
      previousLevel,

    water_level_change:
      level - previousLevel,

    temperature,

    status: drain.status,

    risk_score:
      drain.risk_score,

    risk_level:
      drain.risk_level,

    source,

    timestamp:
      new Date().toISOString()
  });

  /*
     Automatic cleaning verification
     happens BEFORE creating a new alert.
  */

  const existingIncident =
    incidents.find(function (incident) {
      return (
        incident.drain_id === drain.id &&
        incident.status !== "CLOSED"
      );
    });

  let cleaningVerified = false;

  if (existingIncident) {
    cleaningVerified =
      verifyCleaningFromSensor(drain);
  }

  /*
     If cleaning wasn't verified,
     create alert when required.
  */

  if (!cleaningVerified) {
    createAlert(drain);
  }

  return {
    cleaning_verified:
      cleaningVerified,

    previous_water_level:
      previousLevel,

    water_level:
      drain.water_level,

    status:
      drain.status,

    risk_score:
      drain.risk_score,

    risk_level:
      drain.risk_level,

    risk_recommendation:
      drain.risk_recommendation,

    drain
  };
}

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
  "/api/health",
  function (req, res) {
    res.json({
      status: "online",

      service:
        PROJECT_NAME,

      version:
        VERSION,

      iot:
        "ready",

      ai_engine:
        "ready",

      risk_engine:
        "ready",

      verification_engine:
        "ready",

      simulator:
        "ready",

      drains:
        drains.length,

      active_incidents:
        incidents.filter(function (incident) {
          return incident.status !== "CLOSED";
        }).length,

      verified_incidents:
        incidents.filter(function (incident) {
          return incident.status === "CLOSED";
        }).length,

      server_time:
        new Date().toISOString()
    });
  }
);

/* =========================================================
   DASHBOARD API
========================================================= */

app.get(
  "/api/dashboard",
  function (req, res) {
    const total =
      drains.length;

    const normal =
      drains.filter(function (d) {
        return d.status === "NORMAL";
      }).length;

    const warning =
      drains.filter(function (d) {
        return d.status === "WARNING";
      }).length;

    const critical =
      drains.filter(function (d) {
        return d.status === "CRITICAL";
      }).length;

    const averageWaterLevel =
      total === 0
        ? 0
        : drains.reduce(function (sum, drain) {
            return sum + Number(drain.water_level);
          }, 0) / total;

    const openIncidents =
      incidents.filter(function (incident) {
        return incident.status !== "CLOSED";
      }).length;

    const verifiedIncidents =
      incidents.filter(function (incident) {
        return incident.status === "CLOSED";
      }).length;

    res.json({
      project: {
        name: PROJECT_NAME,
        version: VERSION,
        system_status: "ONLINE",
        ai_status: "ACTIVE",
        iot_status: "READY"
      },

      stats: {
        totalDrains: total,

        normal,

        warning,

        critical,

        openIncidents,

        verifiedIncidents,

        averageWaterLevel:
          Number(
            averageWaterLevel.toFixed(1)
          )
      },

      drains,

      incidents,

      notifications,

      system: {
        sensor_history_count:
          sensorHistory.length,

        ai_engine:
          "ACTIVE",

        verification_engine:
          "ACTIVE",

        automatic_alerts:
          "ACTIVE",

        automatic_cleaning_verification:
          "ACTIVE"
      }
    });
  }
);

/* =========================================================
   IoT SENSOR API
========================================================= */

app.post(
  "/api/sensor",
  function (req, res) {
    const drainId =
      Number(req.body.drain_id);

    const level =
      normalizeWaterLevel(
        req.body.water_level
      );

    const temperature =
      normalizeTemperature(
        req.body.temperature
      );

    /*
       VALIDATION
    */

    if (
      !Number.isFinite(drainId) ||
      level === null
    ) {
      return res.status(400).json({
        success: false,

        error:
          "Invalid sensor data. drain_id and water_level are required."
      });
    }

    /*
       FIND DRAIN
    */

    const drain =
      drains.find(function (item) {
        return item.id === drainId;
      });

    if (!drain) {
      return res.status(404).json({
        success: false,

        error:
          "Drain not found"
      });
    }

    /*
       PROCESS SENSOR DATA
    */

    const result =
      processSensorData(
        drain,
        level,
        temperature,
        "ESP32 / IoT"
      );

    /*
       RESPONSE
    */

    res.json({
      success: true,

      message:
        "IoT sensor data received successfully.",

      source:
        "ESP32 / IoT",

      ...result
    });
  }
);

/* =========================================================
   INCIDENTS API
========================================================= */

app.get(
  "/api/incidents",
  function (req, res) {
    res.json(incidents);
  }
);

/* =========================================================
   ACKNOWLEDGE INCIDENT
========================================================= */

app.patch(
  "/api/incidents/:id/acknowledge",
  function (req, res) {
    const incident =
      incidents.find(function (item) {
        return (
          item.id ===
          Number(req.params.id)
        );
      });

    if (!incident) {
      return res.status(404).json({
        success: false,

        error:
          "Incident not found"
      });
    }

    if (
      incident.status ===
      "CLOSED"
    ) {
      return res.json({
        success: true,

        message:
          "Incident already closed",

        incident
      });
    }

    incident.status =
      "ACKNOWLEDGED";

    incident.acknowledged_at =
      new Date().toISOString();

    addNotification(
      "INFO",
      `👮 Official acknowledged the alert for ${incident.drain_name}.`,
      incident.id
    );

    res.json({
      success: true,

      message:
        "Incident acknowledged",

      incident
    });
  }
);

/* =========================================================
   START CLEANING
========================================================= */

app.patch(
  "/api/incidents/:id/clean",
  function (req, res) {
    const incident =
      incidents.find(function (item) {
        return (
          item.id ===
          Number(req.params.id)
        );
      });

    if (!incident) {
      return res.status(404).json({
        success: false,

        error:
          "Incident not found"
      });
    }

    if (
      incident.status ===
      "CLOSED"
    ) {
      return res.json({
        success: true,

        message:
          "Incident already verified and closed",

        incident
      });
    }

    incident.status =
      "CLEANING";

    incident.cleaning_started_at =
      new Date().toISOString();

    addNotification(
      "INFO",
      `🧹 Cleaning operation started for ${incident.drain_name}. IoT verification is active.`,
      incident.id
    );

    res.json({
      success: true,

      message:
        "Cleaning operation started",

      incident
    });
  }
);

/* =========================================================
   SENSOR HISTORY
========================================================= */

app.get(
  "/api/history/:drainId",
  function (req, res) {
    const drainId =
      Number(req.params.drainId);

    if (!Number.isFinite(drainId)) {
      return res.status(400).json({
        success: false,

        error:
          "Invalid drain ID"
      });
    }

    const history =
      sensorHistory.filter(function (item) {
        return (
          item.drain_id ===
          drainId
        );
      });

    res.json(history);
  }
);

/* =========================================================
   SINGLE DRAIN
========================================================= */

app.get(
  "/api/drains/:id",
  function (req, res) {
    const drain =
      drains.find(function (item) {
        return (
          item.id ===
          Number(req.params.id)
        );
      });

    if (!drain) {
      return res.status(404).json({
        success: false,

        error:
          "Drain not found"
      });
    }

    res.json(drain);
  }
);

/* =========================================================
   SIMULATOR API
   Used for hackathon demonstrations.
========================================================= */

app.post(
  "/api/simulator/:drainId",
  function (req, res) {
    const drainId =
      Number(req.params.drainId);

    const level =
      normalizeWaterLevel(
        req.body.water_level
      );

    const temperature =
      normalizeTemperature(
        req.body.temperature ?? 28
      );

    if (
      !Number.isFinite(drainId) ||
      level === null
    ) {
      return res.status(400).json({
        success: false,

        error:
          "Invalid simulator data"
      });
    }

    const drain =
      drains.find(function (item) {
        return item.id === drainId;
      });

    if (!drain) {
      return res.status(404).json({
        success: false,

        error:
          "Drain not found"
      });
    }

    /*
       Simulator uses exactly the same
       processing pipeline as ESP32.
    */

    const result =
      processSensorData(
        drain,
        level,
        temperature,
        "DEMO SIMULATOR"
      );

    res.json({
      success: true,

      simulator: true,

      message:
        "Simulator data processed successfully.",

      ...result
    });
  }
);

/* =========================================================
   SYSTEM SUMMARY API
========================================================= */

app.get(
  "/api/system",
  function (req, res) {
    res.json({
      project:
        PROJECT_NAME,

      version:
        VERSION,

      architecture: [
        "ESP32",
        "Ultrasonic Sensor",
        "IoT API",
        "AI Risk Engine",
        "Alert Engine",
        "Official Dashboard",
        "Cleaning Workflow",
        "Automatic IoT Verification"
      ],

      features: {
        real_time_monitoring:
          true,

        automatic_alerts:
          true,

        ai_risk_analysis:
          true,

        incident_management:
          true,

        cleaning_tracking:
          true,

        automatic_sensor_verification:
          true,

        sensor_history:
          true,

        demo_simulator:
          true
      },

      status:
        "ONLINE"
    });
  }
);

/* =========================================================
   404 HANDLER
========================================================= */

app.use(
  function (req, res) {
    res.status(404).json({
      success: false,

      error:
        "API endpoint not found",

      path:
        req.originalUrl
    });
  }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  function (err, req, res, next) {
    console.error(
      "SERVER ERROR:",
      err
    );

    res.status(500).json({
      success: false,

      error:
        "Internal server error"
    });
  }
);

/* =========================================================
   START SERVER
========================================================= */

app.listen(
  PORT,
  function () {
    console.log("");

    console.log(
      "=============================================="
    );

    console.log(
      "             DRAINGUARD AI"
    );

    console.log(
      "=============================================="
    );

    console.log(
      `Server : http://localhost:${PORT}`
    );

    console.log(
      `Health : http://localhost:${PORT}/api/health`
    );

    console.log(
      `Dashboard API : http://localhost:${PORT}/api/dashboard`
    );

    console.log(
      `IoT API : http://localhost:${PORT}/api/sensor`
    );

    console.log(
      `Incidents : http://localhost:${PORT}/api/incidents`
    );

    console.log(
      `System : http://localhost:${PORT}/api/system`
    );

    console.log(
      "----------------------------------------------"
    );

    console.log(
      "IoT    : READY"
    );

    console.log(
      "AI     : READY"
    );

    console.log(
      "Risk   : READY"
    );

    console.log(
      "Alerts : READY"
    );

    console.log(
      "Verify : READY"
    );

    console.log(
      "Status : ONLINE"
    );

    console.log(
      "=============================================="
    );

    console.log("");
  }
);