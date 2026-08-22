import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  TrainFront, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  Clock, 
  FileText, 
  Network, 
  LayoutDashboard, 
  History, 
  Volume2, 
  VolumeX, 
  Trash2, 
  Settings as SettingsIcon,
  Database,
  Maximize2,
  X,
  LogOut
} from 'lucide-react';


import { MultiLanguageVoiceControl } from './components/MultiLanguageVoiceControl';
import RetentionPanel from './components/RetentionPanel';
import { NetworkTopology } from './components/NetworkTopology';
import { LoginPage } from './components/LoginPage';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [highlightAgents, setHighlightAgents] = useState(false);
  
  const [trains, setTrains] = useState([]);
  const [stations, setStations] = useState([]);
  
  const [selectedTrain, setSelectedTrain] = useState('');
  const [selectedStation, setSelectedStation] = useState('');
  const [delayMinutes, setDelayMinutes] = useState(30);
  const [reason, setReason] = useState('Signal Failure');
  
  const [logs, setLogs] = useState([]);
  const [reschedulePlan, setReschedulePlan] = useState({});
  const [report, setReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [historicalReports, setHistoricalReports] = useState([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [activeDelayStation, setActiveDelayStation] = useState(null);

  // New states for voice-over system
  const [settings, setSettings] = useState({
    audioEnabled: true,
    announcementLang: 'all',
    speechRate: 1.0,
    speechPitch: 1.0
  });
  const [announcementsLog, setAnnouncementsLog] = useState([]);
  const [toastNotifications, setToastNotifications] = useState([]);
  const [currentSeverity, setCurrentSeverity] = useState(null);
  const [currentExplanation, setCurrentExplanation] = useState(null);
  const [voicesStatus, setVoicesStatus] = useState({
    en: false,
    hi: false,
    ta: false,
    ja: false
  });

  // Authentication & Operator State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('railmind_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const handleLogout = () => {
    localStorage.removeItem('railmind_auth_user');
    setCurrentUser(null);
    showToast('info', 'Session Ended', 'Operator logged out securely.');
  };

  // Retention Subsystem States
  const [currentRole, setCurrentRole] = useState(() => {
    try {
      const saved = localStorage.getItem('railmind_auth_user');
      const user = saved ? JSON.parse(saved) : null;
      return user?.role || 'controller';
    } catch (e) {
      return 'controller';
    }
  });
  const [retentionRecords, setRetentionRecords] = useState([]);
  const [retentionLoading, setRetentionLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterEntityType, setFilterEntityType] = useState('');
  const [auditTrailModalRecord, setAuditTrailModalRecord] = useState(null);
  const [auditTrailList, setAuditTrailList] = useState([]);
  const [auditTrailLoading, setAuditTrailLoading] = useState(false);
  const [actionModal, setActionModal] = useState(null);

  const logsContainerRef = useRef(null);

  const latestSettings = useRef(settings);
  const speechQueueRef = useRef([]);
  const speechIndexRef = useRef(0);
  const speechTimeoutRef = useRef(null);
  const activeUtteranceRef = useRef(null);

  useEffect(() => {
    latestSettings.current = settings;
  }, [settings]);

  useEffect(() => {
    const checkVoices = () => {
      if (!window.speechSynthesis) return;
      const voices = window.speechSynthesis.getVoices();
      const status = {
        en: voices.some(v => v.lang.toLowerCase().startsWith('en') || v.lang.toLowerCase().includes('en')),
        hi: voices.some(v => v.lang.toLowerCase().startsWith('hi') || v.lang.toLowerCase().includes('hi')),
        ta: voices.some(v => v.lang.toLowerCase().startsWith('ta') || v.lang.toLowerCase().includes('ta')),
        ja: voices.some(v => v.lang.toLowerCase().startsWith('ja') || v.lang.toLowerCase().includes('ja'))
      };
      setVoicesStatus(status);
    };

    checkVoices();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = checkVoices;
    }
  }, []);

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    fetch('/api/initial-state')
      .then(res => res.json())
      .then(data => {
        setTrains(data.trains);
        setStations(data.stations);
        if (data.trains.length > 0) setSelectedTrain(data.trains[0].id);
        if (data.stations.length > 0) setSelectedStation(data.stations[0].code);
      })
      .catch(err => console.error("Error fetching state:", err));

    fetch('/api/announcements')
      .then(res => res.json())
      .then(data => setAnnouncementsLog(data))
      .catch(err => console.error("Error fetching announcements:", err));

    fetch('/api/incident-reports')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const formatted = data.map(item => ({
            id: item.id || Date.now(),
            date: item.created_at ? new Date(item.created_at).toLocaleString() : new Date().toLocaleString(),
            content: item.content
          })).reverse();
          setHistoricalReports(formatted);
        }
      })
      .catch(err => console.error("Error fetching incident reports:", err));

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);
    
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'log') {
        setLogs(prev => [...prev, msg.data]);
        setIsProcessing(true);
      } else if (msg.type === 'reschedule_plan') {
        setReschedulePlan(msg.data);
      } else if (msg.type === 'severity') {
        setCurrentSeverity(msg.data);
      } else if (msg.type === 'incident_explanation') {
        setCurrentExplanation(msg.data);
      } else if (msg.type === 'announcements') {
        setAnnouncementsLog(prev => [...msg.data, ...prev]);
        if (msg.data.length > 0) {
          enqueueAnnouncements(msg.data);
        }
      } else if (msg.type === 'report') {
        setReport(msg.data);
        setHistoricalReports(prev => [
          { id: Date.now(), date: new Date().toLocaleString(), content: msg.data },
          ...prev
        ]);
        setIsProcessing(false);
      }
    };

    return () => {
      ws.close();
      window.speechSynthesis && window.speechSynthesis.cancel();
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
    };
  }, []);

  const showToast = (type, title, message) => {
    const id = Date.now();
    setToastNotifications(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToastNotifications(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const fetchRetentionRecords = async () => {
    setRetentionLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterEntityType) params.append('entity_type', filterEntityType);
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/retention/records${queryStr}`, {
        headers: { 'X-Role': currentRole }
      });
      if (res.ok) {
        const data = await res.json();
        setRetentionRecords(data);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', 'Retention Error', err.detail || 'Failed to fetch retention records');
      }
    } catch (e) {
      console.error(e);
      showToast('error', 'Network Error', 'Failed to reach retention service');
    } finally {
      setRetentionLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'retention') {
      fetchRetentionRecords();
    }
  }, [activeTab, currentRole, filterStatus, filterEntityType]);

  const handleExecuteRetentionAction = async () => {
    if (!actionModal) return;
    const { type, record, reason } = actionModal;
    const endpointMap = {
      'archive': `/api/retention/archive/${record.id}`,
      'request-delete': `/api/retention/request-delete/${record.id}`,
      'restore': `/api/retention/restore/${record.id}`,
      'approve-delete': `/api/retention/approve-delete/${record.id}`
    };

    try {
      const res = await fetch(endpointMap[type], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Role': currentRole
        },
        body: JSON.stringify({ reason: reason || undefined })
      });

      if (res.ok) {
        const updated = await res.json();
        showToast('success', 'Status Updated', `Record ${record.id} is now ${updated.status}.`);
        setActionModal(null);
        fetchRetentionRecords();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', 'Action Denied', err.detail || `Cannot perform ${type} on record`);
      }
    } catch (e) {
      console.error(e);
      showToast('error', 'Error', 'Failed to perform retention action');
    }
  };

  const handleOpenAuditTrail = async (record) => {
    setAuditTrailModalRecord(record);
    setAuditTrailLoading(true);
    try {
      const res = await fetch(`/api/retention/audit-trail/${record.id}`, {
        headers: { 'X-Role': currentRole }
      });
      if (res.ok) {
        const data = await res.json();
        setAuditTrailList(data);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', 'Audit Trail Error', err.detail || 'Could not fetch audit trail');
      }
    } catch (e) {
      showToast('error', 'Error', 'Failed to load audit trail');
    } finally {
      setAuditTrailLoading(false);
    }
  };


  const clearSpeechQueue = () => {
    const synth = window.speechSynthesis;
    if (synth) {
      synth.cancel();
    }
    if (activeUtteranceRef.current && typeof activeUtteranceRef.current.pause === 'function') {
      try {
        activeUtteranceRef.current.pause();
      } catch (err) {
        console.error("Error pausing fallback audio:", err);
      }
    }
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
    speechQueueRef.current = [];
    speechIndexRef.current = 0;
    activeUtteranceRef.current = null;
  };

  const playQueue = () => {
    const synth = window.speechSynthesis;
    if (!synth) return;

    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }

    if (speechIndexRef.current >= speechQueueRef.current.length) {
      activeUtteranceRef.current = null;
      return;
    }

    const item = speechQueueRef.current[speechIndexRef.current];
    const currentIdx = speechIndexRef.current;

    const advanceQueue = () => {
      if (speechIndexRef.current === currentIdx) {
        activeUtteranceRef.current = null;
        speechIndexRef.current += 1;
        speechTimeoutRef.current = setTimeout(() => {
          playQueue();
        }, 1500);
      }
    };

    const tryBackendTTS = () => {
      try {
        const langCode = item.lang.split('-')[0];
        const encodedText = encodeURIComponent(item.text);
        const ttsUrl = `/api/tts?lang=${langCode}&text=${encodedText}`;
        
        const audio = new Audio(ttsUrl);
        activeUtteranceRef.current = audio;

        audio.onended = () => {
          advanceQueue();
        };

        audio.onerror = (e) => {
          console.warn("Backend TTS playback note:", e);
          advanceQueue();
        };

        audio.play().catch(err => {
          console.warn("Audio autoplay policy note:", err);
          advanceQueue();
        });
      } catch (err) {
        console.warn("TTS fallback execution notice:", err);
        advanceQueue();
      }
    };

    if (hasLocalVoice) {
      const utterance = new SpeechSynthesisUtterance(item.text);
      activeUtteranceRef.current = utterance; // Prevent garbage collection!

      const matchingVoice = voices.find(v => v.lang.startsWith(item.lang) || v.lang.includes(item.lang.split('-')[0]));
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }
      
      utterance.lang = item.lang;
      utterance.rate = latestSettings.current.speechRate || 1.0;
      utterance.pitch = latestSettings.current.speechPitch || 1.0;

      utterance.onend = () => {
        advanceQueue();
      };

      utterance.onerror = (e) => {
        console.warn("Speech synthesis note:", e);
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          tryBackendTTS();
        } else {
          advanceQueue();
        }
      };

      synth.speak(utterance);

      // Chrome resume-speaking loop to fix the random pauses
      const resumeSpeech = () => {
        if (activeUtteranceRef.current === utterance && window.speechSynthesis.speaking) {
          window.speechSynthesis.resume();
          setTimeout(resumeSpeech, 10000);
        }
      };
      setTimeout(resumeSpeech, 10000);
    } else {
      tryBackendTTS();
    }
  };


  const enqueueAnnouncements = (newAnnouncements) => {
    if (!latestSettings.current.audioEnabled) {
      newAnnouncements.forEach(ann => {
        showToast("info", "Audio Announcement", `Text notification: ${ann.text_en.slice(0, 50)}...`);
      });
      return;
    }

    const synth = window.speechSynthesis;
    if (!synth) {
      showToast("error", "TTS Unsupported", "Text-to-speech is not supported in this browser. Fallback to text notifications.");
      return;
    }

    const items = [];
    newAnnouncements.forEach(announcement => {
      if (latestSettings.current.announcementLang === 'en' || latestSettings.current.announcementLang === 'all') {
        items.push({ text: announcement.text_en, lang: 'en-IN' });
      }
      if (latestSettings.current.announcementLang === 'hi' || latestSettings.current.announcementLang === 'all') {
        items.push({ text: announcement.text_hi, lang: 'hi-IN' });
      }
      if (latestSettings.current.announcementLang === 'ta' || latestSettings.current.announcementLang === 'all') {
        items.push({ text: announcement.text_ta, lang: 'ta-IN' });
      }
      if (latestSettings.current.announcementLang === 'ja' || latestSettings.current.announcementLang === 'all') {
        items.push({ text: announcement.text_ja || announcement.text_en, lang: 'ja-JP' });
      }
    });

    if (items.length === 0) return;

    const wasEmptyOrFinished = speechIndexRef.current >= speechQueueRef.current.length;
    speechQueueRef.current = [...speechQueueRef.current, ...items];

    if (wasEmptyOrFinished) {
      playQueue();
    }
  };

  const testVoiceAnnouncement = () => {
    clearSpeechQueue();
    const mockAnnouncement = {
      text_en: "Attention passengers. Train number 12302, Rajdhani Express, is running late. We regret the inconvenience caused.",
      text_hi: "कृपया ध्यान दें। गाड़ी संख्या 12302, राजधानी एक्सप्रेस, अपने निर्धारित समय से देरी से चल रही है। आपको हुई असुविधा के लिए हमें खेद है।",
      text_ta: "பயணிகளின் கவனத்திற்கு. வண்டி எண் 12302, ராஜ்தானி எக்ஸ்பிரஸ், தாமதமாக இயங்குகிறது. உங்களுக்கு ஏற்பட்ட அசௌகரியத்திற்கு வருந்துகிறோம்.",
      text_ja: "乗客の皆様にご案内いたします。列車番号 12302、ラージダーニー・エクスプレス は遅れて運行しております。ご不便をおかけして大変申し訳ございません。"
    };
    enqueueAnnouncements([mockAnnouncement]);
  };

  const handleClearAnnouncements = async () => {
    try {
      await fetch('/api/clear-announcements', { method: 'POST' });
      setAnnouncementsLog([]);
      showToast("success", "Logs Cleared", "Successfully cleared all announcement audit logs.");
    } catch (err) {
      console.error(err);
      showToast("error", "Error", "Failed to clear announcement logs.");
    }
  };

  const handleClearIncidentReports = async () => {
    try {
      await fetch('/api/clear-incident-reports', { method: 'POST' });
      setHistoricalReports([]);
      showToast("success", "History Cleared", "Successfully cleared all historical incident reports.");
    } catch (err) {
      console.error(err);
      showToast("error", "Error", "Failed to clear incident reports.");
    }
  };

  const handleInjectDelay = async (customParams = null) => {
    const train_id = (customParams && customParams.train_id) || selectedTrain;
    const station_code = (customParams && customParams.station_code) || selectedStation;
    const delay_min = (customParams && customParams.delay_minutes !== undefined) ? customParams.delay_minutes : delayMinutes;
    const delay_reason = (customParams && customParams.reason) || reason;

    clearSpeechQueue();
    setLogs([]);
    setReschedulePlan({});
    setReport(null);
    setCurrentSeverity(null);
    setCurrentExplanation(null);
    setIsProcessing(true);
    setActiveDelayStation(station_code);
    setSelectedTrain(train_id);
    setSelectedStation(station_code);
    
    try {
      await fetch('/api/inject-delay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          train_id: train_id,
          station_code: station_code,
          delay_minutes: delay_min,
          reason: delay_reason
        })
      });
    } catch (err) {
      console.error("Error triggering delay simulation:", err);
      setIsProcessing(false);
      showToast('error', 'Simulation Error', 'Failed to trigger delay simulation.');
    }
  };

  const triggerAgentHighlight = () => {
    setHighlightAgents(true);
    setTimeout(() => {
      setHighlightAgents(false);
    }, 3000);
  };

  const handleVoiceCommand = async (commandResult) => {
    const { action, params } = commandResult;
    
    switch (action) {
      case 'reschedule': {
        const train_id = params.train_id;
        const new_time = params.new_time || params.time;
        
        if (!train_id) {
          showToast('error', 'Voice Reschedule', 'No train ID specified.');
          break;
        }

        // Find train by ID or name/number
        const train = trains.find(t => 
          t.id.toLowerCase() === train_id.toLowerCase() || 
          t.number === train_id || 
          t.name.toLowerCase().includes(train_id.toLowerCase())
        );

        if (!train) {
          showToast('error', 'Voice Reschedule', `Train "${train_id}" not found.`);
          break;
        }

        const stationCode = train.route[0] || 'NDLS';
        const origTime = train.schedule[stationCode];
        
        // Parse time to minutes to compute difference
        const parseTimeToMinutes = (timeStr) => {
          if (!timeStr) return null;
          const match = timeStr.match(/(\d{1,2})[:.](\d{2})\s*(am|pm)?/i);
          if (!match) {
            const hourMatch = timeStr.match(/(\d{1,2})/);
            if (hourMatch) return parseInt(hourMatch[1], 10) * 60;
            return null;
          }
          let hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const ampm = match[3];
          if (ampm) {
            if (ampm.toLowerCase() === 'pm' && hours < 12) hours += 12;
            if (ampm.toLowerCase() === 'am' && hours === 12) hours = 0;
          }
          return hours * 60 + minutes;
        };

        const origMin = parseTimeToMinutes(origTime);
        const newMin = parseTimeToMinutes(new_time);
        let delayMin = 30; // default delay if calculation fails

        if (origMin !== null && newMin !== null) {
          delayMin = newMin - origMin;
          if (delayMin < 0) {
            delayMin += 24 * 60; // handle overnight transition
          }
        }

        setSelectedTrain(train.id);
        setSelectedStation(stationCode);
        setDelayMinutes(delayMin);
        
        clearSpeechQueue();
        setLogs([]);
        setReschedulePlan({});
        setReport(null);
        setCurrentSeverity(null);
        setCurrentExplanation(null);
        setIsProcessing(true);
        setActiveDelayStation(stationCode);

        try {
          await fetch('/api/inject-delay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              train_id: train.id,
              station_code: stationCode,
              delay_minutes: delayMin,
              reason: 'Voice Reschedule'
            })
          });
        } catch (err) {
          console.error("Error triggering reschedule:", err);
          showToast('error', 'Simulation Error', 'Failed to trigger reschedule simulation.');
          setIsProcessing(false);
        }
        break;
      }

      case 'focus_train': {
        const train_id = params.train_id;
        if (!train_id) break;

        const train = trains.find(t => 
          t.id.toLowerCase() === train_id.toLowerCase() || 
          t.number === train_id || 
          t.name.toLowerCase().includes(train_id.toLowerCase())
        );

        if (train) {
          setSelectedTrain(train.id);
          showToast('info', 'Focus Train', `Focused on train: ${train.name}`);
        } else {
          showToast('error', 'Focus Train', `Train "${train_id}" not found.`);
        }
        break;
      }

      case 'show_delays':
        setActiveTab('dashboard');
        break;

      case 'escalate': {
        const targetTrainId = selectedTrain || (trains.length > 0 ? trains[0].id : null);
        if (!targetTrainId) {
          showToast('error', 'Escalation', 'No train available to escalate.');
          break;
        }

        const train = trains.find(t => t.id === targetTrainId);
        const stationCode = selectedStation || (train ? train.route[0] : 'NDLS');
        
        clearSpeechQueue();
        setLogs([]);
        setReschedulePlan({});
        setReport(null);
        setCurrentSeverity(null);
        setCurrentExplanation(null);
        setIsProcessing(true);
        setActiveDelayStation(stationCode);

        try {
          await fetch('/api/inject-delay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              train_id: targetTrainId,
              station_code: stationCode,
              delay_minutes: 90,
              reason: 'Voice Escalation Control'
            })
          });
        } catch (err) {
          console.error("Error triggering escalation:", err);
          showToast('error', 'Simulation Error', 'Failed to trigger escalation simulation.');
          setIsProcessing(false);
        }
        break;
      }

      case 'show_agents':
        setActiveTab('dashboard');
        setTimeout(triggerAgentHighlight, 100);
        break;

      case 'show_metrics': {
        setActiveTab('dashboard');
        let metricsMsg = 'No active incidents.';
        if (currentExplanation) {
          const passMatch = currentExplanation.match(/passenger impact: ([\d,]+)/i);
          const costMatch = currentExplanation.match(/cost estimate: ([^\s]+)/i);
          metricsMsg = `Active Incident Metrics: \nStranded Passengers: ${passMatch ? passMatch[1] : 'Calculating...'} \nFinancial Cost: ${costMatch ? costMatch[1] : 'Calculating...'}`;
        }
        showToast('info', 'System Metrics', metricsMsg);
        break;
      }

      case 'show_incidents':
        setActiveTab('reports');
        break;

      case 'show_retention':
        setActiveTab('retention');
        break;

      case 'show_status':
        showToast('info', 'System Status', 'System Operational. Websocket connected. Voice commands active.');
        break;

      case 'mute':
        setSettings(prev => ({ ...prev, audioEnabled: false }));
        break;

      case 'unmute':
        setSettings(prev => ({ ...prev, audioEnabled: true }));
        break;

      case 'enable_voice':
        showToast('info', 'Voice Control', 'Continuous listening mode initialized.');
        break;

      default:
        console.warn("Unhandled action:", action);
    }
  };

  const renderSidebar = () => (
    <div className="sidebar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', padding: '4px 6px' }}>
        <div style={{ background: '#0B2545', border: '2px solid #C5A059', padding: '10px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(197, 160, 89, 0.35)' }}>
          <TrainFront size={22} color="#C5A059" />
        </div>
        <div>
          <div style={{ color: '#C5A059', fontSize: '10px', fontWeight: '800', letterSpacing: '1.5px', textTransform: 'uppercase' }}>MINISTRY OF RAILWAYS</div>
          <h1 style={{ fontSize: '20px', fontFamily: 'Georgia, serif', color: '#FFFFFF', margin: 0, fontWeight: '700' }}>RailMind</h1>
        </div>
      </div>

      {/* Authenticated Operator Profile Badge */}
      {currentUser && (
        <div className="sidebar-user-badge animate-slide-in">
          <div className="sidebar-user-info">
            <div className="user-avatar-circle">
              {currentUser.avatar_badge || '👤'}
            </div>
            <div className="user-text-col">
              <span className="user-name-text">{currentUser.name}</span>
              <span className={`user-role-badge ${currentUser.role}`}>
                {currentUser.role?.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
          <button
            className="sidebar-logout-btn"
            onClick={handleLogout}
            title="Sign Out Operator"
          >
            <LogOut size={16} />
          </button>
        </div>
      )}
      
      <div 
        className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => setActiveTab('dashboard')}
      >
        <LayoutDashboard size={20} />
        Live Dashboard
      </div>
      <div 
        className={`nav-item ${activeTab === 'network' ? 'active' : ''}`}
        onClick={() => setActiveTab('network')}
      >
        <Network size={20} />
        Network Topology
      </div>
      <div 
        className={`nav-item ${activeTab === 'announcements' ? 'active' : ''}`}
        onClick={() => setActiveTab('announcements')}
      >
        <Volume2 size={20} />
        Announcement Audit
      </div>
      <div 
        className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
        onClick={() => setActiveTab('reports')}
      >
        <History size={20} />
        Incident History
      </div>
      <div 
        className={`nav-item ${activeTab === 'retention' ? 'active' : ''}`}
        onClick={() => setActiveTab('retention')}
      >
        <Database size={20} />
        Data Retention
      </div>
      <div 
        className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
        onClick={() => setActiveTab('settings')}
      >
        <SettingsIcon size={20} />
        Settings
      </div>


      <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <MultiLanguageVoiceControl onCommand={handleVoiceCommand} showToast={showToast} />
      </div>
    </div>
  );

  const renderNetworkTopology = () => (
    <NetworkTopology
      trains={trains}
      stations={stations}
      reschedulePlan={reschedulePlan}
      report={report}
      currentSeverity={currentSeverity}
      currentExplanation={currentExplanation}
      activeDelayStation={activeDelayStation}
      isProcessing={isProcessing}
      onInjectDelay={handleInjectDelay}
      selectedTrain={selectedTrain}
      selectedStation={selectedStation}
      onSelectTrain={(trainId) => setSelectedTrain(trainId)}
      onSelectStation={(stationCode) => setSelectedStation(stationCode)}
    />
  );

  const renderDashboard = () => (
    <>
      <header style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '15px', padding: '6px 0' }}>
        <div>
          <h1 style={{ fontSize: '24px', color: '#0F172A', fontWeight: '600', letterSpacing: '-0.01em' }}>Live Operations Command</h1>
          <p style={{ fontSize: '12px', fontWeight: '500', color: '#64748B', letterSpacing: '0.8px', textTransform: 'uppercase', marginTop: '3px' }}>
            Delay Propagation & Multi-Agent Recovery
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '6px 14px', borderRadius: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isProcessing ? '#D97706' : '#10B981', animation: isProcessing ? 'pulseGlow 1.5s infinite' : 'none' }}></div>
          <span style={{ fontSize: '11px', fontWeight: '600', color: '#334155', letterSpacing: '0.5px' }}>{isProcessing ? 'AGENTS ACTIVE' : 'SYSTEM READY'}</span>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr) minmax(0, 1fr)', gap: '20px', flex: 1, minHeight: 0 }}>
        
        {/* Control Panel */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 0, overflowY: 'auto' }}>
          <h2 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={20} color="var(--error)" /> Inject Delay
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Target Train</label>
            <select value={selectedTrain} onChange={(e) => setSelectedTrain(e.target.value)}>
              {trains.map(t => <option key={t.id} value={t.id}>{t.name} ({t.number})</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Location</label>
            <select value={selectedStation} onChange={(e) => setSelectedStation(e.target.value)}>
              {stations.map(s => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Delay (Minutes)</label>
            <input type="number" value={delayMinutes} onChange={(e) => setDelayMinutes(parseInt(e.target.value))} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Reason</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="Signal Failure">Signal Failure</option>
              <option value="Track Maintenance">Track Maintenance</option>
              <option value="Weather">Weather / Fog</option>
              <option value="Locomotive Issue">Locomotive Issue</option>
            </select>
          </div>

          <button className="btn-primary" onClick={handleInjectDelay} disabled={isProcessing} style={{ marginTop: '10px' }}>
            {isProcessing ? 'Processing...' : 'Trigger Simulation'}
          </button>
        </div>

        {/* Live Agent Logs */}
        <div className={`glass-panel ${highlightAgents ? 'highlight-panel' : ''}`} style={{ padding: '28px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <h2 style={{ fontSize: '22px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <Activity size={24} color="var(--accent-secondary)" /> Live Agent Activity
          </h2>
          
          <div ref={logsContainerRef} style={{ overflowY: 'auto', flex: 1, paddingRight: '10px' }}>
            {logs.length === 0 && !isProcessing && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>
                Waiting for events...
              </div>
            )}
            
            {logs.map((log, i) => (
              <div key={i} className="agent-node animate-slide-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{log.agent}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{log.timestamp}</span>
                </div>
                <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5', fontWeight: '500' }}>
                  {log.message}
                </div>
                {log.details && (
                  <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {Object.entries(log.details).map(([key, value]) => {
                      const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                      
                      if (typeof value === 'object' && value !== null) {
                        return (
                          <div key={key} style={{ width: '100%', marginTop: '4px' }}>
                            <div style={{ color: '#475569', fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>{formattedKey}:</div>
                            <pre style={{ margin: 0, padding: '12px', background: '#0F172A', borderRadius: '8px', fontSize: '12px', color: '#38BDF8', border: '1px solid #1E293B', fontFamily: 'JetBrains Mono, monospace', overflowX: 'auto' }}>
                              {JSON.stringify(value, null, 2)}
                            </pre>
                          </div>
                        );
                      }
                      
                      return (
                        <div key={key} style={{ background: '#F8FAFC', padding: '6px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '12px', display: 'flex', gap: '6px', color: '#0F172A' }}>
                          <span style={{ color: '#475569', fontWeight: '500' }}>{formattedKey}:</span>
                          <span style={{ color: '#0B2545', fontWeight: '700' }}>{String(value)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* System State & Report */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0, overflowY: 'auto' }}>
          
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', color: '#0F172A', margin: 0 }}>
              <Clock size={18} color="#D97706" /> Updated Schedules
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {trains.map(t => {
                const isAffected = reschedulePlan[t.id];
                return (
                  <div 
                    key={t.id} 
                    className="schedule-card"
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px',
                      padding: '14px 16px',
                      marginBottom: 0,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontWeight: '600', fontSize: '14px', color: '#0F172A' }}>{t.name}</span>
                      <span 
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          textTransform: 'uppercase',
                          background: isAffected ? 'rgba(217, 119, 6, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                          color: isAffected ? '#D97706' : '#10B981'
                        }}
                      >
                        {isAffected ? 'Rescheduled' : 'On Time'}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {t.route.map((st, i) => {
                        const newTime = isAffected ? reschedulePlan[t.id][st] : null;
                        const origTime = t.schedule[st];
                        const timeChanged = newTime && newTime !== origTime;
                        
                        return (
                          <div key={st} style={{ display: 'flex', alignItems: 'center', fontSize: '12px' }}>
                            <span style={{ color: '#64748B' }}>{st}</span>
                            <span style={{ color: timeChanged ? '#DC2626' : '#0F172A', marginLeft: '4px', fontWeight: timeChanged ? '600' : '400' }}>
                              {timeChanged ? newTime : origTime}
                            </span>
                            {i < t.route.length - 1 && <ChevronRight size={12} color="#94A3B8" style={{ margin: '0 2px' }} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Incident Explanation System */}
          {currentExplanation && (
            <div 
              className="glass-panel animate-slide-in"
              style={{
                padding: '18px 20px',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '12px',
                marginTop: '4px'
              }}
            >
              <h2 style={{ fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#DC2626' }}>
                <AlertTriangle size={16} /> Incident Explanation
              </h2>
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5', margin: 0 }}>
                {currentExplanation}
              </p>
            </div>
          )}

          {report && (
            <div 
              className="glass-panel animate-slide-in" 
              style={{ 
                padding: '20px 22px', 
                background: '#F0FDF4', 
                border: '1.5px solid #86EFAC', 
                borderRadius: '12px', 
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.08)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', color: '#047857', margin: 0 }}>
                  <FileText size={18} /> Incident Report
                </h2>
                <button
                  onClick={() => setShowReportModal(true)}
                  style={{
                    background: '#DCFCE7',
                    border: '1px solid #86EFAC',
                    color: '#047857',
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  title="Expand to Fullscreen View"
                >
                  <Maximize2 size={13} /> Expand View
                </button>
              </div>

              <div style={{ maxHeight: '280px', overflowY: 'auto', paddingRight: '6px' }}>
                <pre style={{ 
                  whiteSpace: 'pre-wrap', 
                  fontSize: '13px', 
                  color: '#1E293B', 
                  lineHeight: '1.6', 
                  fontFamily: 'Inter, system-ui, sans-serif', 
                  margin: 0 
                }}>
                  {report}
                </pre>
              </div>
            </div>
          )}


        </div>
      </div>
    </>
  );

  const renderAnnouncements = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0', width: '100%', maxWidth: '1200px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '600', color: '#0F172A', margin: 0 }}>Multi-Lingual Voice Broadcast Hub</h2>
          <p style={{ color: '#64748B', fontSize: '13px', marginTop: '2px' }}>Real-time public address announcement synthesis & audit trail.</p>
        </div>
        {announcementsLog.length > 0 && (
          <button 
            className="btn-primary" 
            onClick={handleClearAnnouncements}
            style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', boxShadow: 'none', padding: '8px 14px', fontSize: '12px', borderRadius: '8px' }}
          >
            <Trash2 size={14} style={{ marginRight: '6px', display: 'inline', verticalAlign: 'middle' }} /> Clear Audit Logs
          </button>
        )}
      </header>
      
      {announcementsLog.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <div style={{ textAlign: 'center', color: '#64748B' }}>
            <Volume2 size={40} style={{ opacity: 0.4, margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0F172A' }}>No Active Broadcast Logs</h3>
            <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>Trigger a delay simulation to synthesize multi-lingual PA announcements.</p>
          </div>
        </div>
      ) : (
        announcementsLog.map((ann, idx) => (
          <div key={idx} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', borderLeft: `4px solid ${ann.severity === 'Critical' ? '#DC2626' : ann.severity === 'Major' ? '#D97706' : '#0284C7'}`, padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A' }}>{ann.train_name} ({ann.train_number})</span>
                <span style={{ fontSize: '12px', color: '#64748B', marginLeft: '12px', fontWeight: '500' }}>ETA {ann.new_time} at {ann.station_name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '12px', background: ann.severity === 'Critical' ? '#FEF2F2' : '#FFFBEB', color: ann.severity === 'Critical' ? '#DC2626' : '#B45309' }}>
                  {ann.severity}
                </span>
                <span style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace' }}>{ann.timestamp}</span>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: '10px', fontWeight: '800', background: '#0B2545', color: '#FFFFFF', padding: '2px 6px', borderRadius: '4px', marginRight: '8px' }}>EN</span>
                <span style={{ fontSize: '13px', color: '#334155' }}>{ann.text_en}</span>
              </div>
              <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: '10px', fontWeight: '800', background: '#C5A059', color: '#FFFFFF', padding: '2px 6px', borderRadius: '4px', marginRight: '8px' }}>HI</span>
                <span style={{ fontSize: '13px', color: '#334155' }}>{ann.text_hi}</span>
              </div>
              <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: '10px', fontWeight: '800', background: '#0284C7', color: '#FFFFFF', padding: '2px 6px', borderRadius: '4px', marginRight: '8px' }}>TA</span>
                <span style={{ fontSize: '13px', color: '#334155' }}>{ann.text_ta}</span>
              </div>
              {ann.text_ja && (
                <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '10px', fontWeight: '800', background: '#475569', color: '#FFFFFF', padding: '2px 6px', borderRadius: '4px', marginRight: '8px' }}>JA</span>
                  <span style={{ fontSize: '13px', color: '#334155' }}>{ann.text_ja}</span>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderSettings = () => (
    <div className="glass-panel" style={{ flex: 1, padding: '40px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <h2 style={{ fontSize: '24px', marginBottom: '10px' }} className="text-gradient">System Settings</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>Configure voice announcements and notification preferences.</p>

      <div className="settings-grid">
        <div className="glass-panel settings-card" style={{ padding: '24px', background: 'rgba(0,0,0,0.2)' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Volume2 size={20} color="var(--accent-primary)" /> Voice Announcements
          </h3>
          
          <div className="switch-container" onClick={() => setSettings(prev => ({ ...prev, audioEnabled: !prev.audioEnabled }))}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600' }}>Enable Audio Announcements</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Play voice-overs on reschedule events</span>
            </div>
            <label className="switch" onClick={(e) => e.stopPropagation()}>
              <input 
                type="checkbox" 
                checked={settings.audioEnabled} 
                onChange={() => setSettings(prev => ({ ...prev, audioEnabled: !prev.audioEnabled }))} 
              />
              <span className="slider"></span>
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Announcement Language</label>
            <select 
              value={settings.announcementLang} 
              onChange={(e) => setSettings(prev => ({ ...prev, announcementLang: e.target.value }))}
            >
              <option value="en">English (India)</option>
              <option value="hi">Hindi (हिंदी)</option>
              <option value="ta">Tamil (தமிழ்)</option>
              <option value="ja">Japanese (日本語)</option>
              <option value="all">Play All (English + Hindi + Tamil + Japanese)</option>
            </select>
          </div>

          <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '16px' }}>
            <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px', fontWeight: '600' }}>Voice Status in your Browser:</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>English (en)</span>
                <span style={{ color: voicesStatus.en ? 'var(--success)' : 'var(--error)', fontWeight: '600' }}>
                  {voicesStatus.en ? '✓ Detected' : '✗ Missing'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>Hindi (hi)</span>
                <span style={{ color: voicesStatus.hi ? 'var(--success)' : 'var(--error)', fontWeight: '600' }}>
                  {voicesStatus.hi ? '✓ Detected' : '✗ Missing'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>Tamil (ta)</span>
                <span style={{ color: voicesStatus.ta ? 'var(--success)' : 'var(--error)', fontWeight: '600' }}>
                  {voicesStatus.ta ? '✓ Detected' : '✗ Missing'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>Japanese (ja)</span>
                <span style={{ color: voicesStatus.ja ? 'var(--success)' : 'var(--error)', fontWeight: '600' }}>
                  {voicesStatus.ja ? '✓ Detected' : '✗ Missing'}
                </span>
              </div>
            </div>
            {(!voicesStatus.ta || !voicesStatus.ja) && (
              <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--warning)', lineHeight: '1.4', background: 'rgba(245, 158, 11, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <strong>Note:</strong> Some languages are missing in your browser/OS. Chrome will download them if connected to the internet, or you can add them in OS speech settings.
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel settings-card" style={{ padding: '24px', background: 'rgba(0,0,0,0.2)' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} color="var(--accent-secondary)" /> Voice Configurations
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Speech Rate</span>
              <span>{settings.speechRate}x</span>
            </div>
            <input 
              type="range" 
              min="0.5" 
              max="2.0" 
              step="0.1" 
              value={settings.speechRate} 
              onChange={(e) => setSettings(prev => ({ ...prev, speechRate: parseFloat(e.target.value) }))} 
              style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', cursor: 'pointer', appearance: 'auto' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Speech Pitch</span>
              <span>{settings.speechPitch}x</span>
            </div>
            <input 
              type="range" 
              min="0.5" 
              max="1.5" 
              step="0.1" 
              value={settings.speechPitch} 
              onChange={(e) => setSettings(prev => ({ ...prev, speechPitch: parseFloat(e.target.value) }))} 
              style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', cursor: 'pointer', appearance: 'auto' }}
            />
          </div>

          <button 
            className="btn-primary" 
            onClick={testVoiceAnnouncement}
            style={{ marginTop: '16px', padding: '10px 18px', fontSize: '14px' }}
          >
            Test Audio Announcement
          </button>
        </div>
      </div>
    </div>
  );

  const renderRetention = () => {
    const stats = {
      active: retentionRecords.filter(r => r.status === 'active').length,
      archived: retentionRecords.filter(r => r.status === 'archived').length,
      pending_deletion: retentionRecords.filter(r => r.status === 'pending_deletion').length,
      deleted: retentionRecords.filter(r => r.status === 'deleted').length,
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '30px', height: '100%', overflowY: 'auto', flex: 1 }}>
        {/* Header & Role Switcher */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="text-gradient" style={{ fontSize: '28px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Database size={28} color="var(--accent-primary)" /> Data Retention & Lifecycle Management
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
              Manage policy lifecycles, scheduled purges, and regulatory compliance audit trails.
            </p>
          </div>

          {/* Role Header Switcher */}
          <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', gap: '10px', background: 'rgba(0,0,0,0.35)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Active Role (X-Role):</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { key: 'viewer', label: 'Viewer (Read-Only)', color: 'var(--text-secondary)' },
                { key: 'station_master', label: 'Station Master', color: 'var(--accent-secondary)' },
                { key: 'controller', label: 'Controller (Admin)', color: 'var(--accent-primary)' }
              ].map(role => (
                <button
                  key={role.key}
                  onClick={() => setCurrentRole(role.key)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: currentRole === role.key ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.08)',
                    background: currentRole === role.key ? 'rgba(139, 92, 246, 0.25)' : 'rgba(255,255,255,0.02)',
                    color: currentRole === role.key ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: currentRole === role.key ? '700' : '500',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div className="glass-panel" style={{ padding: '18px 20px', borderLeft: '4px solid var(--success)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Records</div>
            <div style={{ fontSize: '26px', fontWeight: '700', marginTop: '6px', color: 'var(--success)' }}>{stats.active}</div>
          </div>
          <div className="glass-panel" style={{ padding: '18px 20px', borderLeft: '4px solid var(--accent-secondary)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Archived</div>
            <div style={{ fontSize: '26px', fontWeight: '700', marginTop: '6px', color: 'var(--accent-secondary)' }}>{stats.archived}</div>
          </div>
          <div className="glass-panel" style={{ padding: '18px 20px', borderLeft: '4px solid var(--warning)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending Deletion</div>
            <div style={{ fontSize: '26px', fontWeight: '700', marginTop: '6px', color: 'var(--warning)' }}>{stats.pending_deletion}</div>
          </div>
          <div className="glass-panel" style={{ padding: '18px 20px', borderLeft: '4px solid var(--error)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Purged / Deleted</div>
            <div style={{ fontSize: '26px', fontWeight: '700', marginTop: '6px', color: 'var(--error)' }}>{stats.deleted}</div>
          </div>
        </div>

        {/* Controls & Filter Bar */}
        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={16} color="var(--text-secondary)" />
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Status:</span>
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: '13px' }}
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
                <option value="pending_deletion">Pending Deletion</option>
                <option value="deleted">Deleted</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Entity Type:</span>
              <select 
                value={filterEntityType} 
                onChange={(e) => setFilterEntityType(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: '13px' }}
              >
                <option value="">All Entity Types</option>
                <option value="announcement">Announcement</option>
                <option value="incident_report">Incident Report</option>
                <option value="signal_telemetry">Signal Telemetry</option>
                <option value="cctv_log">CCTV Log</option>
                <option value="train_schedule">Train Schedule</option>
              </select>
            </div>
          </div>

          <button 
            className="btn-primary" 
            onClick={fetchRetentionRecords}
            style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            <RefreshCw size={14} className={retentionLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Records Table / Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {retentionLoading && retentionRecords.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading retention data...
            </div>
          ) : retentionRecords.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Database size={40} style={{ opacity: 0.4, margin: '0 auto 12px' }} />
              <h3>No Records Found</h3>
              <p style={{ marginTop: '4px', fontSize: '13px' }}>Try adjusting your filters or triggering new incidents to populate records.</p>
            </div>
          ) : (
            retentionRecords.map((record) => {
              const statusColors = {
                active: { bg: 'rgba(16, 185, 129, 0.15)', text: 'var(--success)', border: 'rgba(16, 185, 129, 0.3)' },
                archived: { bg: 'rgba(14, 165, 233, 0.15)', text: 'var(--accent-secondary)', border: 'rgba(14, 165, 233, 0.3)' },
                pending_deletion: { bg: 'rgba(245, 158, 11, 0.15)', text: 'var(--warning)', border: 'rgba(245, 158, 11, 0.3)' },
                deleted: { bg: 'rgba(244, 63, 94, 0.15)', text: 'var(--error)', border: 'rgba(244, 63, 94, 0.3)' }
              };
              const colorTheme = statusColors[record.status] || statusColors.active;

              return (
                <div 
                  key={record.id} 
                  className="glass-panel" 
                  style={{ 
                    padding: '20px', 
                    borderLeft: `4px solid ${colorTheme.text}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: '700', fontSize: '15px', color: '#fff', letterSpacing: '0.5px' }}>{record.id}</span>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: '6px', color: 'var(--text-secondary)' }}>
                        {record.entity_type.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span 
                        style={{ 
                          fontSize: '12px', 
                          fontWeight: '700', 
                          padding: '4px 10px', 
                          borderRadius: '8px', 
                          background: colorTheme.bg, 
                          color: colorTheme.text,
                          border: `1px solid ${colorTheme.border}`,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}
                      >
                        {record.status.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Created: {new Date(record.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '13px', background: 'rgba(0,0,0,0.2)', padding: '12px 16px', borderRadius: '10px' }}>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Status Updated By: </span>
                      <span style={{ color: 'var(--accent-secondary)', fontWeight: '600' }}>{record.status_changed_by || 'System'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Status Updated At: </span>
                      <span style={{ color: '#fff' }}>{record.status_changed_at ? new Date(record.status_changed_at).toLocaleString() : 'N/A'}</span>
                    </div>
                    {record.scheduled_purge_at && (
                      <div>
                        <span style={{ color: 'var(--warning)' }}>Scheduled Purge: </span>
                        <span style={{ color: '#fff', fontWeight: '600' }}>{new Date(record.scheduled_purge_at).toLocaleString()}</span>
                      </div>
                    )}
                    {record.purged_at && (
                      <div>
                        <span style={{ color: 'var(--error)' }}>Purged At: </span>
                        <span style={{ color: '#fff', fontWeight: '600' }}>{new Date(record.purged_at).toLocaleString()} by {record.purged_by}</span>
                      </div>
                    )}
                  </div>

                  {record.reason && (
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic', paddingLeft: '4px' }}>
                      <span style={{ fontStyle: 'normal', color: 'var(--text-primary)', fontWeight: '600' }}>Reason: </span>
                      "{record.reason}"
                    </div>
                  )}

                  {/* Actions Row */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleOpenAuditTrail(record)}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Eye size={13} /> View Audit Trail
                    </button>

                    {record.status === 'active' && (
                      <>
                        <button
                          onClick={() => setActionModal({ type: 'archive', record, reason: 'Archiving record per policy' })}
                          style={{
                            background: 'rgba(14, 165, 233, 0.15)',
                            color: 'var(--accent-secondary)',
                            border: '1px solid rgba(14, 165, 233, 0.3)',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Archive size={13} /> Archive
                        </button>
                        <button
                          onClick={() => setActionModal({ type: 'request-delete', record, reason: 'Requesting deletion schedule' })}
                          style={{
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: 'var(--warning)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Trash2 size={13} /> Request Delete
                        </button>
                      </>
                    )}

                    {record.status === 'archived' && (
                      <>
                        <button
                          onClick={() => setActionModal({ type: 'restore', record, reason: 'Restoring record to active' })}
                          style={{
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: 'var(--success)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <RotateCcw size={13} /> Restore
                        </button>
                        <button
                          onClick={() => setActionModal({ type: 'request-delete', record, reason: 'Requesting deletion schedule' })}
                          style={{
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: 'var(--warning)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Trash2 size={13} /> Request Delete
                        </button>
                      </>
                    )}

                    {record.status === 'pending_deletion' && (
                      <>
                        <button
                          onClick={() => setActionModal({ type: 'restore', record, reason: 'Cancelling deletion request and restoring' })}
                          style={{
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: 'var(--success)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <RotateCcw size={13} /> Restore
                        </button>
                        <button
                          onClick={() => setActionModal({ type: 'approve-delete', record, reason: 'Controller permanent purge confirmed' })}
                          disabled={currentRole !== 'controller'}
                          title={currentRole !== 'controller' ? 'Only controller role can approve deletion' : 'Approve permanent deletion'}
                          style={{
                            background: currentRole === 'controller' ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255,255,255,0.05)',
                            color: currentRole === 'controller' ? 'var(--error)' : 'var(--text-secondary)',
                            border: currentRole === 'controller' ? '1px solid rgba(244, 63, 94, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            cursor: currentRole === 'controller' ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            opacity: currentRole === 'controller' ? 1 : 0.6
                          }}
                        >
                          <Shield size={13} /> Approve Delete {currentRole !== 'controller' && '(Controller Only)'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Action Confirmation Modal */}
        {actionModal && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div className="glass-panel animate-slide-in" style={{ width: '480px', maxWidth: '90vw', padding: '28px', background: '#121626' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', textTransform: 'capitalize', color: '#fff' }}>
                  Confirm {actionModal.type.replace(/-/g, ' ')}
                </h3>
                <button 
                  onClick={() => setActionModal(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px' }}
                >
                  &times;
                </button>
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Target Record: <strong style={{ color: '#fff' }}>{actionModal.record.id}</strong> ({actionModal.record.entity_type})
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Reason / Audit Justification:</label>
                <textarea
                  rows={3}
                  value={actionModal.reason}
                  onChange={(e) => setActionModal({ ...actionModal, reason: e.target.value })}
                  placeholder="Enter reason for this action..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontSize: '13px',
                    resize: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={() => setActionModal(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleExecuteRetentionAction}
                  style={{
                    padding: '8px 18px',
                    fontSize: '13px'
                  }}
                >
                  Confirm Action
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Audit Trail Modal */}
        {auditTrailModalRecord && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div className="glass-panel animate-slide-in" style={{ width: '650px', maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: '28px', background: '#121626' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <History size={18} color="var(--accent-secondary)" /> Audit Trail Timeline
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Record ID: <strong style={{ color: '#fff' }}>{auditTrailModalRecord.id}</strong> ({auditTrailModalRecord.entity_type})
                  </p>
                </div>
                <button 
                  onClick={() => setAuditTrailModalRecord(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px' }}
                >
                  &times;
                </button>
              </div>

              <div style={{ overflowY: 'auto', flex: 1, paddingRight: '6px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {auditTrailLoading ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>Loading audit history...</div>
                ) : auditTrailList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>No audit events found.</div>
                ) : (
                  auditTrailList.map((entry, idx) => (
                    <div 
                      key={entry.id || idx}
                      style={{
                        padding: '14px 16px',
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '10px',
                        borderLeft: '3px solid var(--accent-primary)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ textTransform: 'uppercase', fontWeight: '700', fontSize: '12px', color: 'var(--accent-secondary)' }}>
                            {entry.action.replace(/_/g, ' ')}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            ({entry.previous_status ? `${entry.previous_status} -> ` : ''}{entry.new_status})
                          </span>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          Performed by: <strong style={{ color: '#fff' }}>{entry.performed_by}</strong>
                        </span>
                      </div>

                      {entry.reason && (
                        <div style={{ fontSize: '12px', color: '#cbd5e1', fontStyle: 'italic', marginTop: '2px' }}>
                          "{entry.reason}"
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <button
                  className="btn-primary"
                  onClick={() => setAuditTrailModalRecord(null)}
                  style={{ padding: '6px 16px', fontSize: '12px' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleLoginSuccess = (authData) => {
    const user = authData.user;
    setCurrentUser(user);
    setCurrentRole(user.role || 'controller');
    try {
      localStorage.setItem('railmind_auth_user', JSON.stringify(user));
    } catch (e) {}
  };

  return (
    <>
      {!currentUser ? (
        <LoginPage onLoginSuccess={handleLoginSuccess} showToast={showToast} />
      ) : (
        <div className="app-container">
          {renderSidebar()}
          
          <div className="main-content">
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'network' && renderNetworkTopology()}
            {activeTab === 'announcements' && renderAnnouncements()}
            {activeTab === 'retention' && <RetentionPanel showToast={showToast} />}
            {activeTab === 'settings' && renderSettings()}
            {activeTab === 'reports' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '30px', height: '100%', overflowY: 'auto', flex: 1 }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <h2 className="text-gradient" style={{ fontSize: '28px' }}>Incident History</h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>A persistent historical record of all AI-generated incident reports.</p>
                  </div>
                  {historicalReports.length > 0 && (
                    <button 
                      className="btn-primary" 
                      onClick={handleClearIncidentReports}
                      style={{ background: 'rgba(244, 63, 94, 0.15)', color: 'var(--error)', border: '1px solid rgba(244, 63, 94, 0.3)', boxShadow: 'none', padding: '10px 18px', fontSize: '14px' }}
                    >
                      <Trash2 size={16} style={{ marginRight: '8px', display: 'inline', verticalAlign: 'middle' }} /> Clear Incident History
                    </button>
                  )}
                </header>

                {historicalReports.length === 0 ? (
                  <div className="glass-panel" style={{ padding: '40px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <History size={48} style={{ opacity: 0.5, margin: '0 auto 15px' }} />
                      <h2>No Historical Data Yet</h2>
                      <p>Run a simulation on the dashboard to generate reports.</p>
                    </div>
                  </div>
                ) : (
                  historicalReports.map(hr => (
                    <div key={hr.id} className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid var(--accent-primary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                          <Clock size={16} /> Generated: {hr.date}
                        </div>
                      </div>
                      <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.6', fontFamily: 'inherit' }}>
                        {hr.content}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen/Expanded Incident Report Modal */}
      {showReportModal && report && (
        <div 
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '24px'
          }}
          onClick={() => setShowReportModal(false)}
        >
          <div 
            className="animate-slide-in"
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '720px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #CBD5E1',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#DCFCE7', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={20} color="#047857" />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0F172A', margin: 0 }}>
                    AI Comprehensive Incident Report
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    Generated by RailMind Recovery Orchestrator
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setShowReportModal(false)}
                style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              <pre style={{
                whiteSpace: 'pre-wrap',
                fontSize: '14px',
                color: '#1E293B',
                lineHeight: '1.7',
                fontFamily: 'Inter, system-ui, sans-serif',
                margin: 0,
                background: '#F8FAFC',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #E2E8F0'
              }}>
                {report}
              </pre>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', background: '#F8FAFC' }}>
              <button 
                className="btn-primary" 
                onClick={() => setShowReportModal(false)}
                style={{ padding: '8px 20px', fontSize: '13px' }}
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="toast-container">

        {toastNotifications.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '600', fontSize: '14px', color: 'white' }}>{t.title}</span>
              <button 
                onClick={() => setToastNotifications(prev => prev.filter(item => item.id !== t.id))}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px', lineHeight: '1' }}
              >
                &times;
              </button>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t.message}</span>
          </div>
        ))}
      </div>
    </>
  );
}
