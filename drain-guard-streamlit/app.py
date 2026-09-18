import streamlit as st
import requests
import pandas as pd
from datetime import datetime

# ============================================================
# PAGE CONFIGURATION
# ============================================================

st.set_page_config(
    page_title="DrainGuard AI",
    page_icon="💧",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ============================================================
# CONFIGURATION
# ============================================================

API_URL = "https://drain-guard-api.onrender.com/api"

# ============================================================
# CUSTOM CSS
# ============================================================

st.markdown(
    """
    <style>

    .main {
        background-color: #f5f7fb;
    }

    .block-container {
        padding-top: 2rem;
        padding-bottom: 2rem;
    }

    .hero {
        padding: 25px;
        border-radius: 18px;
        background: linear-gradient(135deg, #0f172a, #1e3a8a);
        color: white;
        margin-bottom: 25px;
    }

    .hero h1 {
        font-size: 38px;
        margin-bottom: 5px;
    }

    .hero p {
        font-size: 17px;
        opacity: 0.9;
    }

    .status-online {
        display: inline-block;
        padding: 6px 12px;
        border-radius: 20px;
        background: #dcfce7;
        color: #166534;
        font-weight: 700;
        font-size: 13px;
    }

    .status-critical {
        display: inline-block;
        padding: 6px 12px;
        border-radius: 20px;
        background: #fee2e2;
        color: #991b1b;
        font-weight: 700;
    }

    .status-warning {
        display: inline-block;
        padding: 6px 12px;
        border-radius: 20px;
        background: #fef3c7;
        color: #92400e;
        font-weight: 700;
    }

    .status-normal {
        display: inline-block;
        padding: 6px 12px;
        border-radius: 20px;
        background: #dcfce7;
        color: #166534;
        font-weight: 700;
    }

    .section-title {
        font-size: 25px;
        font-weight: 800;
        margin-top: 20px;
        margin-bottom: 15px;
    }

    .drain-box {
        padding: 18px;
        border-radius: 15px;
        border: 1px solid #e5e7eb;
        background: white;
        margin-bottom: 15px;
    }

    .critical-box {
        border-left: 6px solid #dc2626;
    }

    .warning-box {
        border-left: 6px solid #f59e0b;
    }

    .normal-box {
        border-left: 6px solid #16a34a;
    }

    .footer {
        text-align: center;
        padding: 25px;
        color: #64748b;
        font-size: 13px;
    }

    </style>
    """,
    unsafe_allow_html=True
)

# ============================================================
# SIDEBAR
# ============================================================

with st.sidebar:

    st.markdown("## 💧 DrainGuard AI")

    st.caption("IoT Drainage Monitoring Platform")

    st.divider()

    st.markdown("### 🔗 Backend")

    st.code(API_URL, language="text")

    st.success("Cloud Backend Configured")

    st.divider()

    st.markdown("### ⚡ System")

    st.write("🛰️ IoT Monitoring")
    st.write("🤖 AI Risk Engine")
    st.write("🚨 Alert Engine")
    st.write("🧹 Cleaning Verification")

    st.divider()

    if st.button("🔄 Refresh Dashboard", use_container_width=True):
        st.rerun()

# ============================================================
# HERO
# ============================================================

st.markdown(
    """
    <div class="hero">
        <h1>💧 DrainGuard AI</h1>
        <p>
            IoT Drainage Monitoring & Early Overflow Detection
        </p>
        <span class="status-online">
            ● CLOUD BACKEND CONNECTED
        </span>
    </div>
    """,
    unsafe_allow_html=True
)

# ============================================================
# LOAD BACKEND DATA
# ============================================================

try:

    response = requests.get(
        f"{API_URL}/dashboard",
        timeout=20
    )

    if response.status_code != 200:
        st.error(
            f"Backend returned HTTP {response.status_code}"
        )
        st.stop()

    data = response.json()

except requests.exceptions.Timeout:

    st.warning(
        "⏳ Backend is waking up. Render's free service may "
        "take some time after inactivity."
    )

    st.info(
        "Please click 'Refresh Dashboard' after a few seconds."
    )

    st.stop()

except requests.exceptions.RequestException as error:

    st.error(
        f"❌ Could not connect to DrainGuard backend.\n\n{error}"
    )

    st.stop()

except Exception as error:

    st.error(
        f"❌ Unexpected error: {error}"
    )

    st.stop()

# ============================================================
# EXTRACT DATA
# ============================================================

stats = data.get("stats", {})
drains = data.get("drains", [])
notifications = data.get("notifications", [])
incidents = data.get("incidents", [])

# ============================================================
# TOP STATISTICS
# ============================================================

st.markdown(
    '<div class="section-title">📊 System Overview</div>',
    unsafe_allow_html=True
)

col1, col2, col3, col4 = st.columns(4)

with col1:
    st.metric(
        "Total Drains",
        stats.get("total_drains", len(drains))
    )

with col2:
    st.metric(
        "Critical",
        stats.get("critical", 0)
    )

with col3:
    st.metric(
        "Warnings",
        stats.get("warning", 0)
    )

with col4:
    average = stats.get("average_water_level", 0)

    st.metric(
        "Average Water Level",
        f"{average}%"
    )

# ============================================================
# LIVE DRAIN MONITORING
# ============================================================

st.markdown(
    '<div class="section-title">🚨 Live Drain Monitoring</div>',
    unsafe_allow_html=True
)

if not drains:

    st.warning("No drain data received from backend.")

else:

    for drain in drains:

        name = drain.get(
            "name",
            drain.get("drain_name", "Unknown Drain")
        )

        location = drain.get(
            "location",
            "Unknown Location"
        )

        level = float(
            drain.get(
                "water_level",
                drain.get("current_water_level", 0)
            )
            or 0
        )

        risk_score = drain.get(
            "risk_score",
            0
        )

        status = str(
            drain.get(
                "status",
                "NORMAL"
            )
        ).upper()

        recommendation = drain.get(
            "recommendation",
            "Continue monitoring."
        )

        if level >= 90 or status == "CRITICAL":

            icon = "🔴"
            box_class = "critical-box"
            status_html = (
                '<span class="status-critical">'
                'CRITICAL'
                '</span>'
            )

        elif level >= 75 or status == "WARNING":

            icon = "🟠"
            box_class = "warning-box"
            status_html = (
                '<span class="status-warning">'
                'WARNING'
                '</span>'
            )

        else:

            icon = "🟢"
            box_class = "normal-box"
            status_html = (
                '<span class="status-normal">'
                'NORMAL'
                '</span>'
            )

        st.markdown(
            f"""
            <div class="drain-box {box_class}">

                <h3>
                    {icon} {name}
                </h3>

                <p>
                    📍 <b>{location}</b>
                </p>

                <p>
                    Status: {status_html}
                </p>

            </div>
            """,
            unsafe_allow_html=True
        )

        c1, c2, c3 = st.columns(3)

        with c1:

            st.metric(
                "💧 Water Level",
                f"{level:.0f}%"
            )

        with c2:

            st.metric(
                "🤖 Risk Score",
                risk_score
            )

        with c3:

            st.metric(
                "📡 Sensor",
                "ONLINE"
            )

        st.progress(
            min(max(level / 100, 0), 1)
        )

        st.info(
            f"🤖 **AI Recommendation:** {recommendation}"
        )

# ============================================================
# NOTIFICATIONS
# ============================================================

st.markdown(
    '<div class="section-title">🔔 Live Notifications</div>',
    unsafe_allow_html=True
)

if notifications:

    for notification in notifications[:10]:

        message = notification.get(
            "message",
            "DrainGuard notification"
        )

        notification_type = str(
            notification.get(
                "type",
                "INFO"
            )
        ).upper()

        if "CRITICAL" in notification_type:

            st.error(
                f"🚨 {message}"
            )

        elif "WARNING" in notification_type:

            st.warning(
                f"⚠️ {message}"
            )

        elif "SUCCESS" in notification_type:

            st.success(
                f"✅ {message}"
            )

        else:

            st.info(
                f"ℹ️ {message}"
            )

else:

    st.success(
        "✅ No active notifications."
    )

# ============================================================
# INCIDENT CENTER
# ============================================================

st.markdown(
    '<div class="section-title">📋 Incident Center</div>',
    unsafe_allow_html=True
)

if incidents:

    incident_rows = []

    for incident in incidents:

        incident_rows.append(
            {
                "ID": incident.get("id"),
                "Drain": incident.get(
                    "drain_name",
                    f"Drain {incident.get('drain_id', '-')}"
                ),
                "Severity": incident.get(
                    "severity",
                    "-"
                ),
                "Risk Score": incident.get(
                    "risk_score",
                    "-"
                ),
                "Status": incident.get(
                    "status",
                    "-"
                ),
                "Water Level": (
                    f"{incident.get('current_water_level', 0)}%"
                )
            }
        )

    if incident_rows:

        df = pd.DataFrame(
            incident_rows
        )

        st.dataframe(
            df,
            use_container_width=True,
            hide_index=True
        )

else:

    st.success(
        "✅ No active incidents."
    )

# ============================================================
# AI RISK COMMAND CENTER
# ============================================================

st.markdown(
    '<div class="section-title">🤖 AI Risk Command Center</div>',
    unsafe_allow_html=True
)

critical_drains = [
    d for d in drains
    if float(
        d.get(
            "water_level",
            d.get("current_water_level", 0)
        )
        or 0
    ) >= 90
]

warning_drains = [
    d for d in drains
    if 75 <= float(
        d.get(
            "water_level",
            d.get("current_water_level", 0)
        )
        or 0
    ) < 90
]

ai1, ai2, ai3 = st.columns(3)

with ai1:

    st.metric(
        "🔴 Critical Nodes",
        len(critical_drains)
    )

with ai2:

    st.metric(
        "🟠 Warning Nodes",
        len(warning_drains)
    )

with ai3:

    st.metric(
        "🧠 AI Engine",
        "READY"
    )

if critical_drains:

    st.error(
        f"🚨 **Immediate attention required:** "
        f"{len(critical_drains)} drainage node(s) "
        f"are at critical water levels."
    )

elif warning_drains:

    st.warning(
        "⚠️ Drainage levels are elevated. "
        "Continue monitoring."
    )

else:

    st.success(
        "🟢 All monitored drainage nodes are "
        "currently below warning level."
    )

# ============================================================
# CLOSED LOOP WORKFLOW
# ============================================================

st.markdown(
    '<div class="section-title">🔄 Closed-Loop IoT Workflow</div>',
    unsafe_allow_html=True
)

workflow = st.columns(6)

steps = [
    ("1", "📡", "Sensor"),
    ("2", "💧", "Detect"),
    ("3", "🤖", "AI Risk"),
    ("4", "🚨", "Alert"),
    ("5", "🧹", "Clean"),
    ("6", "✅", "Verify")
]

for column, step in zip(workflow, steps):

    number, icon, label = step

    with column:

        st.markdown(
            f"""
            <div style="
                text-align:center;
                padding:15px;
                border:1px solid #e5e7eb;
                border-radius:12px;
                background:white;
            ">
                <div style="font-size:28px;">
                    {icon}
                </div>
                <b>{number}. {label}</b>
            </div>
            """,
            unsafe_allow_html=True
        )

# ============================================================
# BACKEND STATUS
# ============================================================

st.markdown(
    '<div class="section-title">🖥️ Backend Status</div>',
    unsafe_allow_html=True
)

status_col1, status_col2 = st.columns(2)

with status_col1:

    st.success(
        "🟢 DrainGuard API: ONLINE"
    )

with status_col2:

    st.info(
        f"🌐 Backend: {API_URL}"
    )

# ============================================================
# FOOTER
# ============================================================

st.divider()

st.markdown(
    """
    <div class="footer">

        <b>DrainGuard AI</b><br>

        AI-powered IoT Drainage Monitoring,
        Early Overflow Detection &
        Automatic Cleaning Verification

        <br><br>

        Built for Smart City Infrastructure

    </div>
    """,
    unsafe_allow_html=True
)