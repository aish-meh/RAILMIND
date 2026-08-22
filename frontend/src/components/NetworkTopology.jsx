import React, { useState, useEffect, useMemo } from 'react';
import {
  TrainFront,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  Zap,
  Radio,
  Gauge,
  Sliders,
  Sparkles,
  RefreshCw,
  Eye,
  Info,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  Maximize2
} from 'lucide-react';

const STATION_METADATA = {
  NDLS: { name: "New Delhi", km: 0, platforms: 16, zone: "NR", lat: 28.6139, lon: 77.2090, weather: "Clear 28°C" },
  CNB: { name: "Kanpur Central", km: 440, platforms: 10, zone: "NCR", lat: 26.4499, lon: 80.3319, weather: "Dense Fog 19°C" },
  PRYJ: { name: "Prayagraj Jn", km: 635, platforms: 10, zone: "NCR", lat: 25.4358, lon: 81.8463, weather: "Hazy 24°C" },
  BSB: { name: "Varanasi Jn", km: 760, platforms: 9, zone: "NR/NER", lat: 25.3176, lon: 82.9739, weather: "Clear 26°C" },
  PNBE: { name: "Patna Jn", km: 1000, platforms: 10, zone: "ECR", lat: 25.5941, lon: 85.1376, weather: "Clear 29°C" },
  HWH: { name: "Howrah Jn", km: 1445, platforms: 23, zone: "ER", lat: 22.5850, lon: 88.3426, weather: "Overcast 31°C" }
};

const MAIN_CORRIDOR = ["NDLS", "CNB", "PRYJ", "BSB", "PNBE", "HWH"];

export function NetworkTopology({
  trains = [],
  stations = [],
  reschedulePlan = {},
  report = null,
  currentSeverity = null,
  currentExplanation = null,
  activeDelayStation = null,
  isProcessing = false,
  onInjectDelay = null,
  selectedTrain: parentSelectedTrain = '',
  selectedStation: parentSelectedStation = '',
  onSelectTrain = null,
  onSelectStation = null
}) {
  const [viewMode, setViewMode] = useState('schematic'); // 'schematic' | 'cascading' | 'matrix'
  const [focusedTrainId, setFocusedTrainId] = useState('all');
  const [inspectedStation, setInspectedStation] = useState(null);
  const [animOffset, setAnimOffset] = useState(0);

  // Quick simulation state
  const [simTrain, setSimTrain] = useState(parentSelectedTrain || (trains[0]?.id || 't1'));
  const [simStation, setSimStation] = useState(parentSelectedStation || 'CNB');
  const [simDelay, setSimDelay] = useState(35);
  const [simReason, setSimReason] = useState('Signal Failure');

  // Animation pulse loop for glowing track energy
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimOffset(prev => (prev + 1) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Set defaults if parent selections change
  useEffect(() => {
    if (parentSelectedTrain) setSimTrain(parentSelectedTrain);
  }, [parentSelectedTrain]);

  useEffect(() => {
    if (parentSelectedStation) setSimStation(parentSelectedStation);
  }, [parentSelectedStation]);

  // Color calculation based on severity
  const severityColor = useMemo(() => {
    if (currentSeverity === 'Critical') return '#f43f5e';
    if (currentSeverity === 'Major') return '#f59e0b';
    return '#0ea5e9';
  }, [currentSeverity]);

  // Corridor Health Index calculation
  const networkHealth = useMemo(() => {
    const affectedCount = Object.keys(reschedulePlan).length;
    if (affectedCount === 0 && !activeDelayStation) return 99.4;
    if (currentSeverity === 'Critical') return 64.2;
    if (currentSeverity === 'Major') return 78.5;
    return 89.0;
  }, [reschedulePlan, activeDelayStation, currentSeverity]);

  // Determine if a station has active downstream delay
  const isStationDelayed = (code) => {
    if (!activeDelayStation) return false;
    const originIdx = MAIN_CORRIDOR.indexOf(activeDelayStation);
    const currIdx = MAIN_CORRIDOR.indexOf(code);
    return originIdx !== -1 && currIdx !== -1 && currIdx >= originIdx;
  };

  // Determine if station is the root point of failure
  const isStationOrigin = (code) => code === activeDelayStation;

  // Filtered trains
  const visibleTrains = useMemo(() => {
    if (focusedTrainId === 'all') return trains;
    return trains.filter(t => t.id === focusedTrainId);
  }, [trains, focusedTrainId]);

  // Handle Quick Delay Injection
  const handleTriggerSimulation = () => {
    if (onInjectDelay) {
      onInjectDelay({
        train_id: simTrain,
        station_code: simStation,
        delay_minutes: simDelay,
        reason: simReason
      });
    }
  };

  return (
    <div className="network-topology-root">
      {/* Top Corridor HUD Bar */}
      <div className="topology-hud-bar glass-panel">
        <div className="hud-title-group">
          <div className="topology-badge-icon">
            <Radio size={20} className={activeDelayStation ? "pulse-red" : "pulse-cyan"} />
          </div>
          <div>
            <div className="hud-main-title">
              Northern-Eastern Trunk Corridor <span className="corridor-id">HDN-1 (NDLS - HWH)</span>
            </div>
            <div className="hud-subtitle">
              Interactive 1,445 km Backbone • Real-Time AI Cascading Delay Telemetry
            </div>
          </div>
        </div>

        {/* Live Metrics Badges */}
        <div className="hud-metrics-group">
          <div className="hud-metric-card">
            <span className="metric-label">Corridor Health</span>
            <div className="metric-value-row">
              <Activity size={15} color={networkHealth > 85 ? "var(--success)" : networkHealth > 70 ? "var(--warning)" : "var(--error)"} />
              <span style={{ color: networkHealth > 85 ? "var(--success)" : networkHealth > 70 ? "var(--warning)" : "var(--error)" }}>
                {networkHealth}%
              </span>
            </div>
          </div>

          <div className="hud-metric-card">
            <span className="metric-label">Corridor Status</span>
            <div className="metric-value-row">
              {activeDelayStation ? (
                <>
                  <AlertTriangle size={15} color={severityColor} />
                  <span style={{ color: severityColor, fontWeight: 700 }}>
                    {currentSeverity ? `${currentSeverity.toUpperCase()} DELAY` : 'ACTIVE DELAY'}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} color="var(--success)" />
                  <span style={{ color: "var(--success)" }}>NORMAL FLOW</span>
                </>
              )}
            </div>
          </div>

          <div className="hud-metric-card">
            <span className="metric-label">Active Disruption</span>
            <div className="metric-value-row">
              <span style={{ color: activeDelayStation ? severityColor : "var(--text-secondary)" }}>
                {activeDelayStation ? `@ ${activeDelayStation} (${simReason})` : 'None Detected'}
              </span>
            </div>
          </div>

          <div className="hud-metric-card">
            <span className="metric-label">Monitored Trains</span>
            <div className="metric-value-row">
              <TrainFront size={15} color="var(--accent-secondary)" />
              <span style={{ color: "var(--text-primary)" }}>{trains.length} Units</span>
            </div>
          </div>
        </div>
      </div>

      {/* Control & View Mode Switcher Toolbar */}
      <div className="topology-toolbar glass-panel">
        <div className="view-mode-tabs">
          <button
            className={`mode-tab ${viewMode === 'schematic' ? 'active' : ''}`}
            onClick={() => setViewMode('schematic')}
          >
            <Zap size={16} /> ⚡ Live Cyber Grid
          </button>
          <button
            className={`mode-tab ${viewMode === 'cascading' ? 'active' : ''}`}
            onClick={() => setViewMode('cascading')}
          >
            <Radio size={16} /> 🌊 Cascading Dynamics
          </button>
          <button
            className={`mode-tab ${viewMode === 'matrix' ? 'active' : ''}`}
            onClick={() => setViewMode('matrix')}
          >
            <Clock size={16} /> 📊 Schedule & ETA Matrix
          </button>
        </div>

        {/* Train Route Filter Dropdown */}
        <div className="train-filter-controls">
          <span className="filter-label">Focus Train:</span>
          <select
            value={focusedTrainId}
            onChange={(e) => {
              setFocusedTrainId(e.target.value);
              if (e.target.value !== 'all' && onSelectTrain) {
                onSelectTrain(e.target.value);
              }
            }}
            className="topology-select"
          >
            <option value="all">⚡ All Corridor Trains (Overview)</option>
            {trains.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.number}) - {t.route.join(' → ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Interactive Display Area */}
      <div className="topology-main-viewport">
        {viewMode === 'schematic' && (
          <div className="schematic-canvas-card glass-panel">
            {/* SVG Interactive Canvas */}
            <div className="svg-canvas-wrapper">
              <svg className="corridor-svg" viewBox="0 0 1200 480" preserveAspectRatio="xMidYMid meet">
                <defs>
                  {/* Glowing Track Gradients */}
                  <linearGradient id="normalTrack" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.8" />
                  </linearGradient>

                  <linearGradient id="delayedTrack" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.7" />
                  </linearGradient>

                  {/* Laser flow pattern for track energy */}
                  <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                  </pattern>

                  {/* Glow Filters */}
                  <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  <filter id="hazard-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="10" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Cyber Grid Background */}
                <rect width="100%" height="100%" fill="url(#grid-pattern)" />

                {/* Electrification Overhead Catenary Wire (Top line) */}
                <path
                  d="M 100 190 Q 300 185 500 190 T 900 190 T 1100 190"
                  fill="none"
                  stroke="rgba(14, 165, 233, 0.2)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />

                {/* Track Base Lines (Double Track Railway) */}
                {MAIN_CORRIDOR.map((code, index) => {
                  if (index >= MAIN_CORRIDOR.length - 1) return null;
                  const startX = 100 + index * 200;
                  const endX = 100 + (index + 1) * 200;
                  const nextCode = MAIN_CORRIDOR[index + 1];
                  
                  const isSegmentDelayed = activeDelayStation && 
                    MAIN_CORRIDOR.indexOf(nextCode) > MAIN_CORRIDOR.indexOf(activeDelayStation);

                  return (
                    <g key={`track-seg-${code}-${nextCode}`}>
                      {/* Outer Glow Line */}
                      <line
                        x1={startX}
                        y1={240}
                        x2={endX}
                        y2={240}
                        stroke={isSegmentDelayed ? severityColor : "rgba(14, 165, 233, 0.4)"}
                        strokeWidth={isSegmentDelayed ? "8" : "4"}
                        filter={isSegmentDelayed ? "url(#hazard-glow)" : "url(#neon-glow)"}
                        strokeOpacity={isSegmentDelayed ? 0.7 : 0.4}
                      />

                      {/* Main Up-Line */}
                      <line
                        x1={startX}
                        y1={235}
                        x2={endX}
                        y2={235}
                        stroke={isSegmentDelayed ? severityColor : "#0ea5e9"}
                        strokeWidth="3"
                      />

                      {/* Main Down-Line */}
                      <line
                        x1={startX}
                        y1={245}
                        x2={endX}
                        y2={245}
                        stroke={isSegmentDelayed ? severityColor : "#8b5cf6"}
                        strokeWidth="3"
                      />

                      {/* Track Sleepers / Cross ties */}
                      {Array.from({ length: 9 }).map((_, sleeperIdx) => {
                        const sleeperX = startX + (sleeperIdx + 1) * 20;
                        return (
                          <line
                            key={`sleeper-${sleeperIdx}`}
                            x1={sleeperX}
                            y1={230}
                            x2={sleeperX}
                            y2={250}
                            stroke="rgba(255, 255, 255, 0.15)"
                            strokeWidth="2"
                          />
                        );
                      })}

                      {/* Flowing Laser Dash Animation for active tracks */}
                      <line
                        x1={startX}
                        y1={240}
                        x2={endX}
                        y2={240}
                        stroke={isSegmentDelayed ? "#f43f5e" : "#38bdf8"}
                        strokeWidth="2"
                        strokeDasharray="10 20"
                        strokeDashoffset={-animOffset}
                      />

                      {/* Distance Kilometers Marker Between Stations */}
                      <g transform={`translate(${(startX + endX) / 2}, 268)`}>
                        <rect
                          x="-35"
                          y="-10"
                          width="70"
                          height="20"
                          rx="10"
                          fill="rgba(10, 14, 26, 0.85)"
                          stroke="rgba(255, 255, 255, 0.1)"
                          strokeWidth="1"
                        />
                        <text
                          textAnchor="middle"
                          y="4"
                          fill="var(--text-secondary)"
                          fontSize="10"
                          fontWeight="600"
                          letterSpacing="0.5"
                        >
                          {STATION_METADATA[nextCode].km - STATION_METADATA[code].km} km
                        </text>
                      </g>
                    </g>
                  );
                })}

                {/* Station Nodes & Indicators */}
                {MAIN_CORRIDOR.map((code, index) => {
                  const stationX = 100 + index * 200;
                  const stationY = 240;
                  const meta = STATION_METADATA[code] || {};
                  const isDelayed = isStationDelayed(code);
                  const isOrigin = isStationOrigin(code);
                  const isInspected = inspectedStation === code;

                  // Signal aspect color: Green (Safe), Amber (Caution / Affected), Red (Origin delay)
                  const signalColor = isOrigin ? '#f43f5e' : isDelayed ? '#f59e0b' : '#10b981';

                  return (
                    <g
                      key={`station-${code}`}
                      className="station-svg-node"
                      onClick={() => setInspectedStation(code === inspectedStation ? null : code)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Shockwave Radar Ripple if origin of delay */}
                      {isOrigin && (
                        <>
                          <circle
                            cx={stationX}
                            cy={stationY}
                            r="32"
                            fill="none"
                            stroke={severityColor}
                            strokeWidth="2"
                            opacity="0.8"
                            className="radar-ripple-1"
                          />
                          <circle
                            cx={stationX}
                            cy={stationY}
                            r="50"
                            fill="none"
                            stroke={severityColor}
                            strokeWidth="1.5"
                            opacity="0.4"
                            className="radar-ripple-2"
                          />
                        </>
                      )}

                      {/* Outer Selection Highlight Ring */}
                      {isInspected && (
                        <circle
                          cx={stationX}
                          cy={stationY}
                          r="28"
                          fill="none"
                          stroke="var(--accent-primary)"
                          strokeWidth="2"
                          strokeDasharray="4 4"
                          className="pulse-spin"
                        />
                      )}

                      {/* Station Platform Building Base */}
                      <rect
                        x={stationX - 22}
                        y={stationY - 22}
                        width="44"
                        height="44"
                        rx="12"
                        fill="rgba(15, 23, 42, 0.95)"
                        stroke={isDelayed ? severityColor : isInspected ? "var(--accent-primary)" : "rgba(255,255,255,0.2)"}
                        strokeWidth={isOrigin ? "3" : isDelayed ? "2" : "1.5"}
                        filter="url(#neon-glow)"
                      />

                      {/* Inner Node Circle */}
                      <circle
                        cx={stationX}
                        cy={stationY}
                        r="10"
                        fill={isOrigin ? severityColor : isDelayed ? '#f59e0b' : '#10b981'}
                        filter="url(#neon-glow)"
                      />

                      {/* Railway Signal Semaphore Pole (Top of station) */}
                      <line
                        x1={stationX}
                        y1={stationY - 22}
                        x2={stationX}
                        y2={stationY - 48}
                        stroke="rgba(255,255,255,0.3)"
                        strokeWidth="2"
                      />
                      <rect
                        x={stationX - 7}
                        y={stationY - 66}
                        width="14"
                        height="20"
                        rx="4"
                        fill="#0b0f19"
                        stroke="rgba(255,255,255,0.2)"
                      />
                      <circle
                        cx={stationX}
                        cy={stationY - 56}
                        r="4"
                        fill={signalColor}
                        filter="url(#neon-glow)"
                      />

                      {/* Station Code Badge (Top) */}
                      <text
                        x={stationX}
                        y={stationY - 76}
                        textAnchor="middle"
                        fill={isDelayed ? severityColor : "#fff"}
                        fontSize="14"
                        fontWeight="800"
                        letterSpacing="1"
                      >
                        {code}
                      </text>

                      {/* Station Full Name (Bottom) */}
                      <text
                        x={stationX}
                        y={stationY + 44}
                        textAnchor="middle"
                        fill="#f1f5f9"
                        fontSize="13"
                        fontWeight="600"
                      >
                        {meta.name || code}
                      </text>

                      {/* Cumulative KM & Zone Badge (Bottom) */}
                      <text
                        x={stationX}
                        y={stationY + 62}
                        textAnchor="middle"
                        fill="var(--text-secondary)"
                        fontSize="10"
                        fontWeight="500"
                      >
                        {meta.km} km • {meta.zone}
                      </text>

                      {/* Platforms count badge */}
                      <g transform={`translate(${stationX - 25}, ${stationY + 74})`}>
                        <rect
                          width="50"
                          height="18"
                          rx="9"
                          fill="rgba(255,255,255,0.05)"
                          stroke="rgba(255,255,255,0.1)"
                        />
                        <text
                          x="25"
                          y="13"
                          textAnchor="middle"
                          fill="var(--text-secondary)"
                          fontSize="9"
                          fontWeight="600"
                        >
                          {meta.platforms} Plats
                        </text>
                      </g>
                    </g>
                  );
                })}

                {/* Animated Dynamic Train Avatars on Track */}
                {visibleTrains.map((train, tIdx) => {
                  // Determine train position along corridor
                  let currentPosIdx = 0;
                  if (train.id === 't1') currentPosIdx = 1.3; // between CNB and PRYJ
                  else if (train.id === 't2') currentPosIdx = 2.7; // between PRYJ and BSB / PNBE
                  else if (train.id === 't3') currentPosIdx = 0.5; // between NDLS and CNB

                  const trainX = 100 + currentPosIdx * 200;
                  const trainY = tIdx % 2 === 0 ? 218 : 262; // Offset Up/Down line
                  const isTrainAffected = reschedulePlan[train.id];

                  return (
                    <g
                      key={`train-avatar-${train.id}`}
                      className="train-avatar-group"
                      style={{ transition: 'all 0.5s ease' }}
                    >
                      {/* Train Laser Trail */}
                      <line
                        x1={trainX - 45}
                        y1={trainY}
                        x2={trainX}
                        y2={trainY}
                        stroke={isTrainAffected ? severityColor : "var(--accent-secondary)"}
                        strokeWidth="3"
                        strokeLinecap="round"
                        opacity="0.6"
                      />

                      {/* Train Beacon Body */}
                      <rect
                        x={trainX - 24}
                        y={trainY - 12}
                        width="48"
                        height="24"
                        rx="12"
                        fill={isTrainAffected ? "rgba(244, 63, 94, 0.9)" : "rgba(14, 165, 233, 0.9)"}
                        stroke="#fff"
                        strokeWidth="1.5"
                        filter="url(#neon-glow)"
                      />

                      {/* Train Number Icon inside badge */}
                      <text
                        x={trainX}
                        y={trainY + 4}
                        textAnchor="middle"
                        fill="#fff"
                        fontSize="10"
                        fontWeight="800"
                      >
                        {train.number}
                      </text>

                      {/* Floating Train Name Pill */}
                      <g transform={`translate(${trainX}, ${trainY + (tIdx % 2 === 0 ? -24 : 32)})`}>
                        <rect
                          x="-55"
                          y="-11"
                          width="110"
                          height="22"
                          rx="6"
                          fill="rgba(10, 14, 26, 0.92)"
                          stroke={isTrainAffected ? severityColor : "rgba(14, 165, 233, 0.5)"}
                          strokeWidth="1"
                        />
                        <text
                          textAnchor="middle"
                          y="4"
                          fill={isTrainAffected ? severityColor : "#38bdf8"}
                          fontSize="9.5"
                          fontWeight="700"
                        >
                          {train.name.split(' ')[0]} {isTrainAffected ? '⚠️ Delayed' : '⚡ 130 km/h'}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Quick Interactive Legend */}
            <div className="schematic-footer-legend">
              <div className="legend-item">
                <span className="legend-dot green"></span> Clear Block (Signal Green)
              </div>
              <div className="legend-item">
                <span className="legend-dot amber"></span> Cascading Caution Zone
              </div>
              <div className="legend-item">
                <span className="legend-dot red"></span> Disruption Epicenter
              </div>
              <div className="legend-item">
                <span className="legend-dot blue"></span> 2x 25kV Catenary Tracks
              </div>
              <div className="legend-hint">
                <Info size={14} /> Click any station node to open technical inspector & quick controls.
              </div>
            </div>
          </div>
        )}

        {/* View 2: Cascading Dynamics Flow View */}
        {viewMode === 'cascading' && (
          <div className="cascading-flow-container">
            <div className="glass-panel cascading-summary-card">
              <div className="card-header-with-icon">
                <Radio size={22} color={severityColor} />
                <div>
                  <h3 style={{ fontSize: '18px', color: '#fff' }}>
                    Cascading Delay Ripple Propagation Engine
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    AI-computed downstream ripple coefficients and dynamic recovery buffers across all stations.
                  </p>
                </div>
              </div>

              {activeDelayStation ? (
                <div className="propagation-timeline">
                  {MAIN_CORRIDOR.map((code, idx) => {
                    const meta = STATION_METADATA[code] || {};
                    const isOrigin = isStationOrigin(code);
                    const isDelayed = isStationDelayed(code);
                    const origIdx = MAIN_CORRIDOR.indexOf(activeDelayStation);
                    const hops = idx - origIdx;
                    
                    // Buffer absorbed per hop (mock calculation for high fidelity)
                    const delayMinutesCalc = Math.max(0, simDelay - (hops * 8));

                    return (
                      <div key={code} className={`propagation-step ${isDelayed ? 'affected' : 'unaffected'}`}>
                        <div className="step-badge-col">
                          <div className={`step-circle ${isOrigin ? 'origin' : isDelayed ? 'downstream' : 'clear'}`}>
                            {isOrigin ? '⚡' : isDelayed ? `+${hops}` : '✓'}
                          </div>
                          {idx < MAIN_CORRIDOR.length - 1 && <div className="step-connector"></div>}
                        </div>

                        <div className="step-content glass-panel">
                          <div className="step-header">
                            <div>
                              <span className="step-station-name">{meta.name}</span>
                              <span className="step-code">({code})</span>
                            </div>
                            <span className={`step-status-tag ${isOrigin ? 'tag-origin' : isDelayed ? 'tag-delayed' : 'tag-clear'}`}>
                              {isOrigin ? 'EPICENTER' : isDelayed ? `CASCADING +${delayMinutesCalc}m` : 'NORMAL'}
                            </span>
                          </div>

                          <div className="step-metrics-grid">
                            <div className="step-metric">
                              <span className="lbl">Distance</span>
                              <span className="val">{meta.km} km</span>
                            </div>
                            <div className="step-metric">
                              <span className="lbl">Disruption Impact</span>
                              <span className="val" style={{ color: isDelayed ? severityColor : 'var(--success)' }}>
                                {isOrigin ? `Root Cause: ${simReason}` : isDelayed ? `Buffer Absorbed: ${hops * 8}m` : 'Zero Impact'}
                              </span>
                            </div>
                            <div className="step-metric">
                              <span className="lbl">Track Block</span>
                              <span className="val">{isDelayed ? 'Caution Aspect' : 'Clear Line'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-cascading-state">
                  <CheckCircle2 size={48} color="var(--success)" style={{ opacity: 0.8 }} />
                  <h4>No Active Cascading Disruption</h4>
                  <p>All corridor track blocks are operating at peak efficiency. Use the simulation panel below to test a disruption.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* View 3: Schedule & ETA Matrix */}
        {viewMode === 'matrix' && (
          <div className="matrix-table-container glass-panel">
            <div className="matrix-header">
              <div>
                <h3 style={{ fontSize: '18px', color: '#fff' }}>Corridor Timetable & Real-Time Reschedule Matrix</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Side-by-side comparison of baseline scheduled arrival vs AI-optimized dynamic departure slots.
                </p>
              </div>
            </div>

            <div className="matrix-table-wrapper">
              <table className="topology-matrix-table">
                <thead>
                  <tr>
                    <th>Train Details</th>
                    {MAIN_CORRIDOR.map(code => (
                      <th key={code}>
                        <div>{code}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 400 }}>
                          {STATION_METADATA[code].name}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trains.map(train => {
                    const isAffected = reschedulePlan[train.id];
                    return (
                      <tr key={train.id} className={isAffected ? 'row-delayed' : ''}>
                        <td>
                          <div className="train-cell-info">
                            <TrainFront size={16} color={isAffected ? severityColor : "var(--accent-secondary)"} />
                            <div>
                              <div style={{ fontWeight: 700, color: '#fff' }}>{train.name}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>#{train.number}</div>
                            </div>
                          </div>
                        </td>
                        {MAIN_CORRIDOR.map(code => {
                          const origTime = train.schedule[code];
                          const newTime = isAffected ? reschedulePlan[train.id]?.[code] : null;
                          const hasTimeChange = newTime && newTime !== origTime;

                          if (!origTime) {
                            return <td key={code} className="cell-skip">—</td>;
                          }

                          return (
                            <td key={code} className={`cell-time ${hasTimeChange ? 'time-delayed' : ''}`}>
                              {hasTimeChange ? (
                                <div className="time-delta-box">
                                  <span className="orig-time-strike">{origTime}</span>
                                  <span className="new-time-badge" style={{ color: severityColor }}>{newTime}</span>
                                </div>
                              ) : (
                                <span className="ontime-val">{origTime}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Station Technical Inspector Drawer (Pop-up when clicking a station) */}
      {inspectedStation && (
        <div className="station-inspector-card glass-panel animate-slide-in">
          <div className="inspector-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="inspector-station-badge">{inspectedStation}</div>
              <div>
                <h4 style={{ color: '#fff', fontSize: '16px', margin: 0 }}>
                  {STATION_METADATA[inspectedStation]?.name} Junction
                </h4>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Zone: {STATION_METADATA[inspectedStation]?.zone} • Cumulative: {STATION_METADATA[inspectedStation]?.km} km
                </span>
              </div>
            </div>
            <button
              onClick={() => setInspectedStation(null)}
              className="inspector-close-btn"
            >
              &times;
            </button>
          </div>

          <div className="inspector-body-grid">
            <div className="inspector-stat">
              <span className="stat-label">Platform Capacity</span>
              <span className="stat-value">{STATION_METADATA[inspectedStation]?.platforms} Platforms (High Speed)</span>
            </div>
            <div className="inspector-stat">
              <span className="stat-label">Current Weather</span>
              <span className="stat-value">{STATION_METADATA[inspectedStation]?.weather}</span>
            </div>
            <div className="inspector-stat">
              <span className="stat-label">Track Circuit Status</span>
              <span className="stat-value" style={{ color: isStationDelayed(inspectedStation) ? severityColor : "var(--success)" }}>
                {isStationDelayed(inspectedStation) ? '⚠️ Alert: Cascading Delay Warning' : '✓ Normal Electronic Interlocking (EI)'}
              </span>
            </div>
            <div className="inspector-stat">
              <span className="stat-label">Active Passing Trains</span>
              <span className="stat-value">
                {trains.filter(t => t.route.includes(inspectedStation)).map(t => t.number).join(', ') || 'None'}
              </span>
            </div>
          </div>

          <div className="inspector-actions">
            <button
              className="btn-primary"
              style={{ fontSize: '13px', padding: '8px 16px', width: '100%' }}
              onClick={() => {
                setSimStation(inspectedStation);
                handleTriggerSimulation();
              }}
              disabled={isProcessing}
            >
              <AlertTriangle size={15} style={{ marginRight: '6px' }} />
              Simulate Disruption at {inspectedStation}
            </button>
          </div>
        </div>
      )}

      {/* Bottom Quick-Simulation Bar */}
      <div className="topology-sim-bar glass-panel">
        <div className="sim-bar-title">
          <Sliders size={18} color="var(--accent-primary)" />
          <span>Quick Corridor Disruption Injection:</span>
        </div>

        <div className="sim-bar-controls">
          <div className="sim-ctrl-item">
            <label>Train</label>
            <select value={simTrain} onChange={(e) => setSimTrain(e.target.value)}>
              {trains.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.number})</option>
              ))}
            </select>
          </div>

          <div className="sim-ctrl-item">
            <label>Location</label>
            <select value={simStation} onChange={(e) => setSimStation(e.target.value)}>
              {MAIN_CORRIDOR.map(code => (
                <option key={code} value={code}>{STATION_METADATA[code]?.name} ({code})</option>
              ))}
            </select>
          </div>

          <div className="sim-ctrl-item">
            <label>Delay (Min)</label>
            <input
              type="number"
              min="5"
              max="180"
              value={simDelay}
              onChange={(e) => setSimDelay(parseInt(e.target.value) || 0)}
              style={{ width: '80px' }}
            />
          </div>

          <div className="sim-ctrl-item">
            <label>Disruption Reason</label>
            <select value={simReason} onChange={(e) => setSimReason(e.target.value)}>
              <option value="Signal Failure">Signal Failure</option>
              <option value="Track Maintenance">Track Maintenance</option>
              <option value="Dense Fog / Weather">Dense Fog / Weather</option>
              <option value="Locomotive Failure">Locomotive Failure</option>
              <option value="Overhead Wire Defect">Overhead Wire Defect</option>
            </select>
          </div>

          <button
            className="btn-primary sim-btn"
            onClick={handleTriggerSimulation}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <RefreshCw size={16} className="spin-icon" />
            ) : (
              <Sparkles size={16} />
            )}
            {isProcessing ? 'Processing AI Dispatch...' : 'Trigger Simulation'}
          </button>
        </div>
      </div>
    </div>
  );
}
