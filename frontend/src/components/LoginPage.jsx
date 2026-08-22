import React, { useState, useEffect, useRef } from 'react';
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
  Radio,
  Sliders,
  ChevronRight
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

  // Handle Biometric Fingerprint / WebAuthn Scan
  const handleBiometricScan = async () => {
    if (scanState === 'scanning' || scanState === 'verifying') return;

    setScanState('scanning');
    setScanProgress(0);

    // Audio cue synthesis
    try {
      if ('speechSynthesis' in window && window.speechSynthesis) {
        // Subtle audio feedback
      }
    } catch (e) {}

    // Multi-phase scanner simulation
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 15) + 12;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setScanProgress(100);
        setScanState('verifying');
        
        // Execute server biometric verification handshake
        setTimeout(async () => {
          try {
            // Attempt WebAuthn if supported in browser environment
            if (window.PublicKeyCredential && navigator.credentials) {
              console.log("WebAuthn platform authenticator available.");
            }

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
              }, 900);
            } else {
              setScanState('failed');
              if (showToast) {
                showToast('error', 'Biometric Match Failed', 'Fingerprint pattern does not match authorized registry.');
              }
            }
          } catch (err) {
            console.error("Biometric Verification Error:", err);
            setScanState('failed');
            if (showToast) {
              showToast('error', 'Authentication Error', 'Biometric gateway communication timeout.');
            }
          }
        }, 600);
      } else {
        setScanProgress(progress);
      }
    }, 90);
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
      handleBiometricScan();
    }
  };

  return (
    <div className="login-portal-backdrop">
      {/* Background Cyber Railway Ambiance */}
      <div className="login-ambient-grid"></div>
      <div className="login-ambient-glow"></div>

      <div className="login-portal-card glass-panel animate-slide-in">
        {/* Portal Header */}
        <div className="login-header">
          <div className="login-emblem-badge">
            <TrainFront size={28} color="#fff" />
          </div>
          <div className="login-brand-title">
            <span className="brand-gov">INDIAN RAILWAYS • CRIS COMMAND NETWORK</span>
            <h1 className="brand-name">RailMind Operations AI</h1>
            <span className="brand-sub">National Train Control & Cascading Dispatch System</span>
          </div>
        </div>

        {/* Security Clearance Tag */}
        <div className="login-security-banner">
          <ShieldCheck size={16} color="var(--accent-secondary)" />
          <span>SECURITY CLEARANCE REQUIRED • RESTRICTED ACCESS GATEWAY</span>
        </div>

        {/* Auth Mode Tabs */}
        <div className="login-mode-tabs">
          <button
            type="button"
            className={`login-tab-btn ${authMode === 'biometric' ? 'active' : ''}`}
            onClick={() => {
              setAuthMode('biometric');
              setScanState('idle');
              setScanProgress(0);
            }}
          >
            <Fingerprint size={18} /> Biometric Scanner
          </button>
          <button
            type="button"
            className={`login-tab-btn ${authMode === 'credentials' ? 'active' : ''}`}
            onClick={() => setAuthMode('credentials')}
          >
            <KeyRound size={18} /> Service Credentials
          </button>
        </div>

        {/* Mode 1: Biometric Verification */}
        {authMode === 'biometric' && (
          <div className="biometric-auth-section animate-slide-in">
            {/* Identity Profile Badge */}
            <div className="bio-identity-selector">
              <label className="bio-label">Designated Operator Profile:</label>
              <select
                value={selectedBioProfile}
                onChange={(e) => setSelectedBioProfile(e.target.value)}
                className="bio-select"
                disabled={scanState === 'scanning' || scanState === 'verifying'}
              >
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.avatar_badge} {p.name} — {p.designation} ({p.role.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {/* Fingerprint Touch Surface */}
            <div className="fingerprint-scanner-container">
              <div
                className={`fingerprint-touchpad ${scanState}`}
                onClick={handleBiometricScan}
                role="button"
                tabIndex={0}
              >
                {/* Outer Glow Wave Rings */}
                <div className="touchpad-ripple-1"></div>
                <div className="touchpad-ripple-2"></div>

                {/* Laser Sweep Line */}
                {(scanState === 'scanning' || scanState === 'verifying') && (
                  <div className="laser-sweep-line"></div>
                )}

                {/* Fingerprint Vector Graphic */}
                <Fingerprint
                  size={96}
                  className={`fingerprint-svg-icon ${scanState}`}
                />

                {/* Success Indicator Overlay */}
                {scanState === 'success' && (
                  <div className="scan-success-overlay">
                    <CheckCircle2 size={42} color="var(--success)" />
                  </div>
                )}

                {/* Failed Indicator Overlay */}
                {scanState === 'failed' && (
                  <div className="scan-failed-overlay">
                    <ShieldAlert size={42} color="var(--error)" />
                  </div>
                )}
              </div>

              {/* Status Message & Scanner Progress */}
              <div className="scanner-status-box">
                {scanState === 'idle' && (
                  <div className="scan-hint">
                    <Zap size={14} color="var(--accent-secondary)" />
                    <span>Touch or click fingerprint sensor to authenticate</span>
                  </div>
                )}
                {scanState === 'scanning' && (
                  <div className="scan-progress-wrapper">
                    <div className="scan-progress-bar">
                      <div className="scan-progress-fill" style={{ width: `${scanProgress}%` }}></div>
                    </div>
                    <span className="scan-progress-text">Acquiring Ridge Biometrics... {scanProgress}%</span>
                  </div>
                )}
                {scanState === 'verifying' && (
                  <div className="scan-verifying-text">
                    <RefreshCw size={14} className="spin-icon" />
                    <span>Verifying Cryptographic Biometric Hash...</span>
                  </div>
                )}
                {scanState === 'success' && (
                  <div className="scan-success-text">
                    <CheckCircle2 size={16} color="var(--success)" />
                    <span>Biometric Match Confirmed • Authenticating Session</span>
                  </div>
                )}
                {scanState === 'failed' && (
                  <div className="scan-failed-text">
                    <ShieldAlert size={16} color="var(--error)" />
                    <span>Biometric Mismatch • Try Again or Switch to PIN</span>
                  </div>
                )}
              </div>

              {/* Hash Telemetry */}
              {activeFingerprintHash && (
                <div className="bio-hash-telemetry">
                  <span>SHA256 Token: </span>
                  <code>{activeFingerprintHash}</code>
                </div>
              )}
            </div>

            <button
              type="button"
              className="btn-primary bio-scan-trigger-btn"
              onClick={handleBiometricScan}
              disabled={scanState === 'scanning' || scanState === 'verifying'}
            >
              <Fingerprint size={18} />
              {scanState === 'scanning' ? 'Scanning Sensor...' : scanState === 'verifying' ? 'Verifying Token...' : 'Scan & Verify Biometrics'}
            </button>
          </div>
        )}

        {/* Mode 2: Credentials Form */}
        {authMode === 'credentials' && (
          <form className="credentials-auth-section animate-slide-in" onSubmit={handleCredentialsLogin}>
            <div className="form-group">
              <label>Employee Service ID / Badge Number</label>
              <div className="input-with-icon">
                <UserCheck size={18} className="input-icon" />
                <input
                  type="text"
                  placeholder="e.g. CR-CTRL-8891"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Security Access PIN / Passcode</label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input
                  type={showPin ? "text" : "password"}
                  placeholder="Enter 4-digit security PIN (1234)"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPin(!showPin)}
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary credentials-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <RefreshCw size={18} className="spin-icon" />
              ) : (
                <Lock size={18} />
              )}
              {isLoading ? 'Verifying Credentials...' : 'Sign In to Operations Console'}
            </button>
          </form>
        )}

        {/* Fast Demo Profile Switcher */}
        <div className="quick-profiles-container">
          <span className="quick-profiles-label">
            <Sparkles size={13} color="var(--accent-primary)" />
            Quick Demo Profiles (1-Click Switch):
          </span>
          <div className="quick-profiles-grid">
            {profiles.map(p => (
              <button
                key={p.id}
                type="button"
                className="quick-profile-pill"
                onClick={() => handleSelectQuickProfile(p)}
              >
                <span className="pill-badge">{p.avatar_badge}</span>
                <div className="pill-info">
                  <div className="pill-name">{p.name}</div>
                  <div className="pill-role">{p.role.toUpperCase()} • {p.id}</div>
                </div>
                <ChevronRight size={14} className="pill-arrow" />
              </button>
            ))}
          </div>
        </div>

        {/* Footer Security Badges */}
        <div className="login-footer">
          <div className="footer-cert">
            <span>🔒 CRIS Interlocking Security Layer 4.8</span>
            <span>•</span>
            <span>256-Bit Protocol</span>
            <span>•</span>
            <span>Ministry of Railways</span>
          </div>
        </div>
      </div>
    </div>
  );
}
