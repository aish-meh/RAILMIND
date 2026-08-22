import React, { useState, useEffect } from 'react';
import {
  Fingerprint,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  TrainFront,
  Sparkles,
  Lock,
  UserCheck,
  Zap,
  CheckCircle2,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronRight,
  Activity,
  Gauge,
  Cpu,
  Radio,
  MapPin,
  Clock,
  BatteryCharging,
  Sliders,
  Shield
} from 'lucide-react';

export function LoginPage({ onLoginSuccess, showToast }) {
  const [authMode, setAuthMode] = useState('biometric'); // 'biometric' | 'credentials'
  const [employeeId, setEmployeeId] = useState('CR-CTRL-8891');
  const [pin, setPin] = useState('1234');
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [profiles, setProfiles] = useState([]);
  
  // Biometric scanning state
  const [scanState, setScanState] = useState('idle'); // 'idle' | 'scanning' | 'verifying' | 'success' | 'failed'
  const [scanProgress, setScanProgress] = useState(0);
  const [activeFingerprintHash, setActiveFingerprintHash] = useState('');
  const [selectedBioProfile, setSelectedBioProfile] = useState('CR-CTRL-8891');

  // Load profiles for fast switching
  useEffect(() => {
    fetch('/api/auth/profiles')
      .then(res => res.json())
      .then(data => {
        setProfiles(data);
      })
      .catch(err => {
        console.error("Error fetching profiles:", err);
      });
  }, []);

  const activeProfile = profiles.find(p => p.id === (authMode === 'biometric' ? selectedBioProfile : employeeId)) || {
    name: 'S. K. Verma',
    role: 'controller',
    designation: 'Chief Operations Controller',
    zone: 'Northern Railway HQ (NDLS)',
    avatar_badge: '👑',
    security_clearance: 'Level 4 (Interlocking Authority)'
  };

  // Handle Biometric Fingerprint / WebAuthn Scan
  const handleBiometricScan = async () => {
    if (scanState === 'scanning' || scanState === 'verifying') return;

    setScanState('scanning');
    setScanProgress(0);

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 16) + 14;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setScanProgress(100);
        setScanState('verifying');
        
        setTimeout(async () => {
          try {
            const res = await fetch('/api/auth/biometric/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                employee_id: selectedBioProfile,
                biometric_type: 'fingerprint'
              })
            });

            if (res.ok) {
              const data = await res.json();
              setActiveFingerprintHash(data.biometric_hash);
              setScanState('success');
              if (showToast) {
                showToast('success', 'Biometric Verified', `Access Granted: ${data.user.name} (${data.user.designation})`);
              }
              setTimeout(() => {
                onLoginSuccess(data);
              }, 800);
            } else {
              setScanState('failed');
              if (showToast) {
                showToast('error', 'Biometric Mismatch', 'Fingerprint pattern not recognized.');
              }
            }
          } catch (err) {
            console.error("Biometric Verification Error:", err);
            setScanState('failed');
            if (showToast) {
              showToast('error', 'Authentication Error', 'Biometric gateway communication timeout.');
            }
          }
        }, 500);
      } else {
        setScanProgress(progress);
      }
    }, 80);
  };

  // Handle Credentials Login
  const handleCredentialsLogin = async (e) => {
    e?.preventDefault();
    if (!employeeId) {
      if (showToast) showToast('warning', 'Missing ID', 'Please enter your Employee Service ID.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId.trim(),
          pin: pin.trim()
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (showToast) {
          showToast('success', 'Authentication Successful', `Welcome, ${data.user.name}`);
        }
        onLoginSuccess(data);
      } else {
        const err = await res.json().catch(() => ({}));
        if (showToast) {
          showToast('error', 'Login Failed', err.detail || 'Invalid Service ID or PIN.');
        }
      }
    } catch (err) {
      console.error("Login Error:", err);
      if (showToast) {
        showToast('error', 'Network Error', 'Failed to reach authentication service.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Quick 1-Click Profile Selection
  const handleSelectQuickProfile = (prof) => {
    setEmployeeId(prof.id);
    setSelectedBioProfile(prof.id);
    setPin('1234');
    if (authMode === 'biometric') {
      setTimeout(() => {
        handleBiometricScan();
      }, 50);
    }
  };

  return (
    <div className="login-portal-backdrop translucent-theme">
      {/* Dynamic Translucent Background Elements */}
      <div className="translucent-bg-stars"></div>
      <div className="translucent-glow-orb orb-1"></div>
      <div className="translucent-glow-orb orb-2"></div>
      <div className="translucent-grid-pattern"></div>

      <div className="login-translucent-container animate-slide-in">
        {/* Top Operational Bar */}
        <header className="login-top-bar glass-panel-translucent">
          <div className="bar-left-brand">
            <div className="railmind-emblem">
              <TrainFront size={22} color="#38bdf8" />
            </div>
            <div>
              <div className="bar-gov-title">MINISTRY OF RAILWAYS • CRIS DISPATCH NETWORK</div>
              <h1 className="bar-system-name">RailMind Operations AI</h1>
            </div>
          </div>

          <div className="bar-right-telemetry">
            <div className="telemetry-pill">
              <span className="pill-dot pulse-green"></span>
              <span>GRID STATUS: <strong>25kV NORMAL</strong></span>
            </div>
            <div className="telemetry-pill">
              <ShieldCheck size={14} color="#38bdf8" />
              <span>SECURITY: <strong>SIL-4 ACTIVE</strong></span>
            </div>
            <div className="telemetry-pill">
              <Clock size={14} color="#fbbf24" />
              <span>CORRIDOR: <strong>HDN-1 (NDLS - HWH)</strong></span>
            </div>
          </div>
        </header>

        {/* Main Content Grid: Locomotive Hero & Auth Console */}
        <div className="login-main-grid">
          {/* Left Column: Operator & High-Speed Locomotive Showcase */}
          <div className="login-hero-column">
            {/* Operator Profile Card */}
            <div className="operator-hero-card glass-panel-translucent">
              <div className="operator-avatar-wrapper">
                <div className="operator-avatar-ring">
                  <span className="operator-emoji">{activeProfile.avatar_badge || '👑'}</span>
                </div>
                <div className="operator-clearance-tag">LVL 4</div>
              </div>
              <div className="operator-details">
                <div className="operator-role-tag">{activeProfile.role?.toUpperCase()} • ACTIVE DUTY</div>
                <h3 className="operator-name">{activeProfile.name}</h3>
                <p className="operator-sub">{activeProfile.designation} — {activeProfile.zone}</p>
              </div>
              <div className="operator-perk-badges">
                <div className="perk-badge" title="Traction Interlocking Authorized">⚡</div>
                <div className="perk-badge" title="AI Rescheduling Clearance">🤖</div>
                <div className="perk-badge" title="Emergency Override Authority">🛡️</div>
                <div className="perk-badge" title="Corridor Telemetry Access">🛰️</div>
              </div>
            </div>

            {/* Locomotive Showcase Card */}
            <div className="locomotive-showcase-card glass-panel-translucent">
              <div className="locomotive-card-header">
                <div className="loco-title-group">
                  <span className="loco-sub-label">PRIMARY HDN-1 LOCOMOTIVE</span>
                  <h2 className="loco-name">VANDE BHARAT EXP (22436)</h2>
                </div>
                <span className="loco-status-badge">🟢 ON ROUTE • CLEAR LINE</span>
              </div>

              {/* Aerodynamic High-Speed Bullet Train Visual */}
              <div className="locomotive-visual-container">
                <svg className="locomotive-svg-render" viewBox="0 0 520 220" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="trainNoseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="60%" stopColor="#f1f5f9" />
                      <stop offset="100%" stopColor="#e2e8f0" />
                    </linearGradient>
                    <linearGradient id="trainYellowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#d97706" />
                    </linearGradient>
                    <linearGradient id="trainGlassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#0f172a" stopOpacity="0.95" />
                      <stop offset="100%" stopColor="#1e293b" stopOpacity="0.85" />
                    </linearGradient>
                    <linearGradient id="glowLaser" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0" />
                      <stop offset="50%" stopColor="#38bdf8" stopOpacity="1" />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
                    </linearGradient>
                    <filter id="headlightGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="8" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {/* Ground Cyber Track Rails & Sleepers */}
                  <line x1="10" y1="190" x2="510" y2="190" stroke="#334155" strokeWidth="4" />
                  <line x1="10" y1="196" x2="510" y2="196" stroke="#0ea5e9" strokeWidth="2" strokeOpacity="0.4" />
                  {[40, 90, 140, 190, 240, 290, 340, 390, 440, 490].map((x, i) => (
                    <rect key={i} x={x} y="188" width="8" height="12" rx="2" fill="#1e293b" />
                  ))}

                  {/* Train Aerodynamic Main Body */}
                  <path
                    d="M 40 60 L 310 60 Q 440 62 490 140 Q 500 158 470 175 L 40 175 Z"
                    fill="url(#trainNoseGrad)"
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth="2"
                  />

                  {/* Yellow/Orange High-Speed Aerodynamic Skirt */}
                  <path
                    d="M 40 120 L 330 120 Q 420 120 480 150 Q 485 168 460 175 L 40 175 Z"
                    fill="url(#trainYellowGrad)"
                  />

                  {/* Modern Aerodynamic Cab Windshield */}
                  <path
                    d="M 330 70 L 410 70 Q 450 75 470 115 L 330 115 Z"
                    fill="url(#trainGlassGrad)"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                  />
                  {/* Driver Silhouette & Cockpit Glow */}
                  <circle cx="370" cy="95" r="10" fill="#38bdf8" fillOpacity="0.4" />

                  {/* Passenger Windows */}
                  <rect x="60" y="75" width="45" height="30" rx="4" fill="#0f172a" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <rect x="120" y="75" width="45" height="30" rx="4" fill="#0f172a" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <rect x="180" y="75" width="45" height="30" rx="4" fill="#0f172a" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <rect x="240" y="75" width="45" height="30" rx="4" fill="#0f172a" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

                  {/* High-Intensity LED Headlights with Projector Beam */}
                  <circle cx="475" cy="155" r="7" fill="#ffffff" filter="url(#headlightGlow)" />
                  <circle cx="475" cy="155" r="4" fill="#38bdf8" />
                  <polygon points="485,155 520,135 520,175" fill="url(#glowLaser)" fillOpacity="0.6" />

                  {/* Pantograph / Catenary Hook on Roof */}
                  <path d="M 120 60 L 150 25 L 180 25 L 150 60" stroke="#cbd5e1" strokeWidth="3" fill="none" />
                  <line x1="140" y1="25" x2="190" y2="25" stroke="#f59e0b" strokeWidth="4" />
                  <circle cx="165" cy="25" r="3" fill="#38bdf8" filter="url(#headlightGlow)" />

                  {/* Wheels & Bogies */}
                  <circle cx="90" cy="180" r="12" fill="#0f172a" stroke="#64748b" strokeWidth="3" />
                  <circle cx="130" cy="180" r="12" fill="#0f172a" stroke="#64748b" strokeWidth="3" />
                  <circle cx="260" cy="180" r="12" fill="#0f172a" stroke="#64748b" strokeWidth="3" />
                  <circle cx="300" cy="180" r="12" fill="#0f172a" stroke="#64748b" strokeWidth="3" />
                </svg>
              </div>

              {/* Locomotive Telemetry Metrics */}
              <div className="loco-telemetry-grid">
                <div className="loco-stat-item">
                  <div className="loco-stat-header">
                    <span className="stat-label">Traction Health</span>
                    <span className="stat-value-highlight">98%</span>
                  </div>
                  <div className="loco-stat-bar">
                    <div className="loco-bar-fill green-fill" style={{ width: '98%' }}></div>
                  </div>
                </div>

                <div className="loco-stat-item">
                  <div className="loco-stat-header">
                    <span className="stat-label">Catenary Voltage</span>
                    <span className="stat-value-highlight">25.2 kV</span>
                  </div>
                  <div className="loco-stat-bar">
                    <div className="loco-bar-fill yellow-fill" style={{ width: '85%' }}></div>
                  </div>
                </div>

                <div className="loco-stat-item">
                  <div className="loco-stat-header">
                    <span className="stat-label">Velocity / Max Limit</span>
                    <span className="stat-value-highlight">130 / 160 KM/H</span>
                  </div>
                  <div className="loco-stat-bar">
                    <div className="loco-bar-fill cyan-fill" style={{ width: '81%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Authentication Console Card */}
          <div className="login-auth-column">
            <div className="auth-console-card glass-panel-translucent">
              {/* Header Title */}
              <div className="auth-card-header">
                <div className="auth-header-icon">
                  <Lock size={20} color="#38bdf8" />
                </div>
                <div>
                  <h2 className="auth-title">Executive Sign In</h2>
                  <p className="auth-subtitle">Verify identity to access live interlocking dispatch</p>
                </div>
              </div>

              {/* Tab Switcher */}
              <div className="auth-tab-pills">
                <button
                  type="button"
                  className={`auth-tab-pill ${authMode === 'biometric' ? 'active' : ''}`}
                  onClick={() => {
                    setAuthMode('biometric');
                    setScanState('idle');
                    setScanProgress(0);
                  }}
                >
                  <Fingerprint size={16} /> Biometric Scanner
                </button>
                <button
                  type="button"
                  className={`auth-tab-pill ${authMode === 'credentials' ? 'active' : ''}`}
                  onClick={() => setAuthMode('credentials')}
                >
                  <KeyRound size={16} /> Service PIN
                </button>
              </div>

              {/* Mode 1: Biometric Verification */}
              {authMode === 'biometric' && (
                <div className="auth-body-biometric animate-slide-in">
                  <div className="profile-selector-box">
                    <label className="input-field-label">Target Operator Profile:</label>
                    <select
                      value={selectedBioProfile}
                      onChange={(e) => setSelectedBioProfile(e.target.value)}
                      className="translucent-select"
                      disabled={scanState === 'scanning' || scanState === 'verifying'}
                    >
                      {profiles.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.avatar_badge} {p.name} — {p.designation}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Fingerprint Touch Surface */}
                  <div className="bio-touchpad-wrapper">
                    <div
                      className={`bio-scanner-pad ${scanState}`}
                      onClick={handleBiometricScan}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="bio-ripple-ring ring-1"></div>
                      <div className="bio-ripple-ring ring-2"></div>

                      {(scanState === 'scanning' || scanState === 'verifying') && (
                        <div className="bio-laser-line"></div>
                      )}

                      <Fingerprint size={78} className={`bio-fingerprint-icon ${scanState}`} />

                      {scanState === 'success' && (
                        <div className="bio-overlay-badge success-glow">
                          <CheckCircle2 size={36} color="#10b981" />
                        </div>
                      )}

                      {scanState === 'failed' && (
                        <div className="bio-overlay-badge error-glow">
                          <ShieldAlert size={36} color="#f43f5e" />
                        </div>
                      )}
                    </div>

                    {/* Scanner Status & Progression */}
                    <div className="bio-feedback-box">
                      {scanState === 'idle' && (
                        <div className="bio-hint-row">
                          <Zap size={14} color="#38bdf8" />
                          <span>Tap sensor to scan fingerprint</span>
                        </div>
                      )}
                      {scanState === 'scanning' && (
                        <div className="bio-progress-container">
                          <div className="bio-bar-track">
                            <div className="bio-bar-thumb" style={{ width: `${scanProgress}%` }}></div>
                          </div>
                          <span className="bio-progress-text">Acquiring Biometrics... {scanProgress}%</span>
                        </div>
                      )}
                      {scanState === 'verifying' && (
                        <div className="bio-status-row verifying">
                          <RefreshCw size={14} className="spin-icon" />
                          <span>Handshaking with CRIS Interlocking HSM...</span>
                        </div>
                      )}
                      {scanState === 'success' && (
                        <div className="bio-status-row success">
                          <CheckCircle2 size={15} color="#10b981" />
                          <span>Biometric Match Verified • Entering System</span>
                        </div>
                      )}
                      {scanState === 'failed' && (
                        <div className="bio-status-row failed">
                          <ShieldAlert size={15} color="#f43f5e" />
                          <span>Mismatch Detected • Please Try Again</span>
                        </div>
                      )}
                    </div>

                    {activeFingerprintHash && (
                      <div className="bio-hash-badge">
                        <span>SHA256 Token: </span>
                        <code>{activeFingerprintHash}</code>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn-primary auth-action-btn"
                    onClick={handleBiometricScan}
                    disabled={scanState === 'scanning' || scanState === 'verifying'}
                  >
                    <Fingerprint size={18} />
                    {scanState === 'scanning' ? 'Reading Sensor...' : scanState === 'verifying' ? 'Validating Token...' : 'Scan & Verify Biometrics'}
                  </button>
                </div>
              )}

              {/* Mode 2: Service Credentials */}
              {authMode === 'credentials' && (
                <form className="auth-body-credentials animate-slide-in" onSubmit={handleCredentialsLogin}>
                  <div className="form-group-item">
                    <label className="input-field-label">Employee Service ID</label>
                    <div className="translucent-input-wrap">
                      <UserCheck size={18} className="input-prefix-icon" />
                      <input
                        type="text"
                        placeholder="e.g. CR-CTRL-8891"
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        required
                        className="translucent-input"
                      />
                    </div>
                  </div>

                  <div className="form-group-item">
                    <label className="input-field-label">Security Access PIN</label>
                    <div className="translucent-input-wrap">
                      <Lock size={18} className="input-prefix-icon" />
                      <input
                        type={showPin ? "text" : "password"}
                        placeholder="Enter 4-digit security PIN (1234)"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        required
                        className="translucent-input"
                      />
                      <button
                        type="button"
                        className="input-suffix-btn"
                        onClick={() => setShowPin(!showPin)}
                      >
                        {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn-primary auth-action-btn"
                    disabled={isLoading}
                  >
                    {isLoading ? <RefreshCw size={18} className="spin-icon" /> : <Lock size={18} />}
                    {isLoading ? 'Verifying Credentials...' : 'Sign In to Operations Console'}
                  </button>
                </form>
              )}

              {/* 1-Click Fast Profile Switcher */}
              <div className="quick-switch-section">
                <span className="quick-switch-title">
                  <Sparkles size={13} color="#a78bfa" />
                  Quick Demo Profile (1-Click Switch):
                </span>
                <div className="quick-switch-list">
                  {profiles.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className="quick-switch-item"
                      onClick={() => handleSelectQuickProfile(p)}
                    >
                      <span className="switch-badge">{p.avatar_badge}</span>
                      <div className="switch-text">
                        <div className="switch-name">{p.name}</div>
                        <div className="switch-meta">{p.role.toUpperCase()} • {p.id}</div>
                      </div>
                      <ChevronRight size={14} className="switch-arrow" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Executive Metrics Row */}
        <footer className="login-bottom-metrics">
          <div className="metric-glass-pill">
            <div className="pill-icon-box bg-blue">
              <Clock size={16} color="#38bdf8" />
            </div>
            <div>
              <div className="pill-metric-val">99.98%</div>
              <div className="pill-metric-lbl">SYSTEM UPTIME</div>
            </div>
          </div>

          <div className="metric-glass-pill">
            <div className="pill-icon-box bg-purple">
              <MapPin size={16} color="#c084fc" />
            </div>
            <div>
              <div className="pill-metric-val">1,445 KM</div>
              <div className="pill-metric-lbl">HDN-1 CORRIDOR</div>
            </div>
          </div>

          <div className="metric-glass-pill">
            <div className="pill-icon-box bg-green">
              <Zap size={16} color="#34d399" />
            </div>
            <div>
              <div className="pill-metric-val">25 kV AC</div>
              <div className="pill-metric-lbl">CATENARY TRACTION</div>
            </div>
          </div>

          <div className="metric-glass-pill">
            <div className="pill-icon-box bg-yellow">
              <Shield size={16} color="#fbbf24" />
            </div>
            <div>
              <div className="pill-metric-val">SIL-4 SECURE</div>
              <div className="pill-metric-lbl">QUANTUM INTERLOCKING</div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
