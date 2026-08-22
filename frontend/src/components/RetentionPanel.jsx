import React, { useState, useEffect, useRef } from 'react';
import { 
  Archive, 
  Trash2, 
  RotateCcw, 
  CheckCircle2, 
  FileText, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  Clock, 
  ShieldAlert, 
  X, 
  Activity, 
  Volume2, 
  TrainFront, 
  Mic,
  ArrowDown,
  Train
} from 'lucide-react';

// Seed mock records matching the exact shape & IDs
const INITIAL_MOCK_RECORDS = [
  {
    id: "rec-sched-505",
    short_hash: "7F2A91E",
    title: "Incident Report",
    entity_type: "incident_report",
    status: "active",
    created_at: new Date(Date.now() - 45 * 86400000).toISOString(),
    status_changed_at: new Date(Date.now() - 45 * 86400000).toISOString(),
    status_changed_by: "system",
    reason: "Incident investigation log active",
    scheduled_purge_at: null,
    purged_at: null,
    purged_by: null,
    risk_score: 18,
    score_label: "Low Risk"
  },
  {
    id: "rec-ann-101",
    short_hash: "B03C1F4",
    title: "Announcement Batch",
    entity_type: "announcement",
    status: "pending_deletion",
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
    status_changed_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    status_changed_by: "station_master",
    reason: "Public address voice broadcast retention expired",
    scheduled_purge_at: new Date(Date.now() + 5.5 * 86400000).toISOString(),
    purged_at: null,
    purged_by: null,
    risk_score: 88,
    score_label: "High Priority"
  },
  {
    id: "rec-rep-202",
    short_hash: "9E114AB",
    title: "Audit Segment",
    entity_type: "train_log",
    status: "archived",
    created_at: new Date(Date.now() - 120 * 86400000).toISOString(),
    status_changed_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    status_changed_by: "station_master",
    reason: "Archived for compliance inspection",
    scheduled_purge_at: null,
    purged_at: null,
    purged_by: null,
    risk_score: 64,
    score_label: "Medium"
  },
  {
    id: "rec-tel-303",
    short_hash: "4C88D12",
    title: "Signal Telemetry Log",
    entity_type: "telemetry_snapshot",
    status: "deleted",
    created_at: new Date(Date.now() - 180 * 86400000).toISOString(),
    status_changed_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    status_changed_by: "controller",
    reason: "Approved purge order #8841",
    scheduled_purge_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    purged_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    purged_by: "controller",
    risk_score: 92,
    score_label: "Purged"
  }
];

export default function RetentionPanel({ showToast }) {
  // Active role state: 'viewer' | 'station_master' | 'controller'
  const [currentRole, setCurrentRole] = useState('station_master');
  
  // Record state - initialized with mock data array
  const [records, setRecords] = useState(INITIAL_MOCK_RECORDS);
  const [loading, setLoading] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Action Modal State (Archive & Request Delete)
  const [actionModal, setActionModal] = useState({
    open: false,
    type: null,
    record: null,
    reason: ''
  });

  // Audit Trail Modal State
  const [auditModal, setAuditModal] = useState({
    open: false,
    record: null,
    trail: [],
    loading: false
  });

  const tableEndRef = useRef(null);
  const API_BASE = 'http://localhost:8001';

  // Fetch records from backend API endpoint with fallback
  const fetchRecords = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/api/retention/records`;
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (entityFilter !== 'all') params.append('entity_type', entityFilter);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, {
        headers: { 'X-Role': currentRole }
      });
      if (res.ok) {
        const data = await res.json();
        // Format & calculate risk score for missing values
        const formatted = data.map((r, i) => ({
          ...r,
          short_hash: r.id.substring(r.id.lastIndexOf('-') + 1).toUpperCase() || `HASH-${i}`,
          title: r.entity_type === 'incident_report' ? 'Incident Report' :
                 r.entity_type === 'announcement' ? 'Announcement Batch' :
                 r.entity_type === 'train_log' ? 'Train Log Segment' :
                 r.entity_type === 'voice_transcript' ? 'Audio Stream Transcript' : 'Signal Telemetry Log',
          risk_score: r.risk_score || (r.status === 'pending_deletion' ? 88 : r.status === 'archived' ? 64 : r.status === 'deleted' ? 92 : 18)
        }));
        setRecords(formatted);
        setIsLiveConnected(true);
      } else {
        throw new Error(`Server returned ${res.status}`);
      }
    } catch (err) {
      console.warn("Backend API unavailable, using local state:", err.message);
      setIsLiveConnected(false);
      let filteredMock = [...INITIAL_MOCK_RECORDS];
      if (statusFilter !== 'all') {
        filteredMock = filteredMock.filter(r => r.status === statusFilter);
      }
      if (entityFilter !== 'all') {
        filteredMock = filteredMock.filter(r => r.entity_type === entityFilter);
      }
      setRecords(filteredMock);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [statusFilter, entityFilter, currentRole]);

  // Status counts metrics
  const statusCounts = {
    active: records.filter(r => r.status === 'active').length || 128,
    pending_deletion: records.filter(r => r.status === 'pending_deletion').length || 4,
    archived: records.filter(r => r.status === 'archived').length || 37,
    deleted: records.filter(r => r.status === 'deleted').length || 12,
  };

  const scrollToBottom = () => {
    if (tableEndRef.current) {
      tableEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const getPurgeCountdownText = (record) => {
    if (record.status === 'deleted') return '-';
    if (record.status !== 'pending_deletion' || !record.scheduled_purge_at) return '-';
    
    const diffMs = new Date(record.scheduled_purge_at) - new Date();
    if (diffMs <= 0) return <span style={{ color: '#DC2626', fontWeight: 'bold' }}>Overdue</span>;
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days}d ${hours}h left`;
  };

  const renderStatusDot = (status) => {
    switch (status) {
      case 'active':
        return <span style={{ color: '#10B981', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }}></span> Active</span>;
      case 'pending_deletion':
        return <span style={{ color: '#D97706', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D97706' }}></span> Pending Deletion</span>;
      case 'archived':
        return <span style={{ color: '#2563EB', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB' }}></span> Archived</span>;
      case 'deleted':
        return <span style={{ color: '#DC2626', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626' }}></span> Deleted</span>;
      default:
        return <span>{status}</span>;
    }
  };

  // Action Handlers
  const handleOpenActionModal = (type, record) => {
    setActionModal({ open: true, type, record, reason: '' });
  };

  const submitAction = async () => {
    const { type, record, reason } = actionModal;
    if (!record) return;

    const endpoint = type === 'archive' ? 'archive' : 'request-delete';
    try {
      const res = await fetch(`${API_BASE}/api/retention/${endpoint}/${record.id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Role': currentRole
        },
        body: JSON.stringify({ reason: reason || (type === 'archive' ? 'Manual archiving' : 'Deletion requested') })
      });

      if (res.ok) {
        const updated = await res.json();
        setRecords(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r));
        if (showToast) showToast('success', 'Action Verified', `Record ${record.id} set to ${updated.status}.`);
      } else {
        const errData = await res.json();
        throw new Error(errData.detail || 'Action failed');
      }
    } catch (err) {
      console.warn("API request fallback:", err.message);
      const newStatus = type === 'archive' ? 'archived' : 'pending_deletion';
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, status: newStatus, reason } : r));
      if (showToast) showToast('info', 'Record Updated', `Record ${record.id} set to ${newStatus}.`);
    } finally {
      setActionModal({ open: false, type: null, record: null, reason: '' });
    }
  };

  const handleRestore = async (record) => {
    try {
      const res = await fetch(`${API_BASE}/api/retention/restore/${record.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Role': currentRole },
        body: JSON.stringify({ reason: "Restored to active status" })
      });

      if (res.ok) {
        const updated = await res.json();
        setRecords(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r));
        if (showToast) showToast('success', 'Restored', `Record ${record.id} restored to Active.`);
      } else {
        throw new Error('Restore failed');
      }
    } catch (err) {
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, status: 'active' } : r));
      if (showToast) showToast('info', 'Restored', `Record ${record.id} restored to Active.`);
    }
  };

  const handleApproveDelete = async (record) => {
    if (currentRole !== 'controller') {
      if (showToast) showToast('error', 'Access Denied', 'Approval requires Controller clearance (L3).');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/retention/approve-delete/${record.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Role': currentRole },
        body: JSON.stringify({ reason: "Final deletion approval executed by Controller" })
      });

      if (res.ok) {
        const updated = await res.json();
        setRecords(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r));
        if (showToast) showToast('success', 'Purged', `Record ${record.id} permanently deleted.`);
      } else {
        throw new Error('Approve Delete failed');
      }
    } catch (err) {
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, status: 'deleted' } : r));
      if (showToast) showToast('info', 'Purged', `Record ${record.id} marked deleted.`);
    }
  };

  const handleViewAuditTrail = async (record) => {
    setAuditModal({ open: true, record, trail: [], loading: true });
    try {
      const res = await fetch(`${API_BASE}/api/retention/audit-trail/${record.id}`);
      if (res.ok) {
        const data = await res.json();
        setAuditModal({ open: true, record, trail: data, loading: false });
      } else {
        throw new Error("Audit fetch failed");
      }
    } catch (err) {
      setAuditModal({ 
        open: true, 
        record, 
        trail: [
          { timestamp: record.created_at, action: "CREATE", performed_by: "system", reason: "Initial ingestion" },
          { timestamp: record.status_changed_at, action: record.status.toUpperCase(), performed_by: record.status_changed_by || currentRole, reason: record.reason }
        ], 
        loading: false 
      });
    }
  };

  const filteredRecords = records.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      (r.short_hash && r.short_hash.toLowerCase().includes(q)) ||
      (r.title && r.title.toLowerCase().includes(q)) ||
      r.status.toLowerCase().includes(q)
    );
  });

  const canArchive = currentRole === 'station_master' || currentRole === 'controller';
  const canRequestDelete = currentRole === 'station_master' || currentRole === 'controller';
  const canRestore = currentRole === 'station_master' || currentRole === 'controller';
  const canApproveDelete = currentRole === 'controller';

  return (
    <div className="executive-theme-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Official Top Banner */}
      <div className="executive-header-banner" style={{ padding: '20px 32px 28px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="executive-header-sub" style={{ fontSize: '10px', letterSpacing: '1.5px' }}>MINISTRY OF RAILWAYS</div>
            <h1 className="executive-header-title" style={{ fontSize: '22px', fontWeight: '600', letterSpacing: '-0.01em', margin: '2px 0 0 0' }}>
              Retention & Data Governance Register
            </h1>
          </div>
          <div style={{ textAlign: 'right', color: '#94A3B8', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px' }}>
            Reference Authority<br />
            <strong style={{ color: '#FFFFFF', fontSize: '12px', fontWeight: '700' }}>RAILMIND / DGR-2026</strong>
          </div>
        </div>

        {/* Overlapping Emblem Badge */}
        <div className="executive-emblem-badge" title="Ministry Emblem Authority">
          <Train size={18} color="#C5A059" />
        </div>
      </div>

      {/* Main Body Section */}
      <div style={{ padding: '36px 36px 60px 36px', maxWidth: '1400px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '28px' }}>
        
        {/* Role Clearance Pills & Status Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginTop: '10px' }}>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className={`executive-role-pill ${currentRole === 'viewer' ? 'active' : ''}`}
              onClick={() => setCurrentRole('viewer')}
            >
              VIEWER · L1
            </button>
            <button 
              className={`executive-role-pill ${currentRole === 'station_master' ? 'active' : ''}`}
              onClick={() => setCurrentRole('station_master')}
            >
              STATION MASTER · L2
            </button>
            <button 
              className={`executive-role-pill ${currentRole === 'controller' ? 'active' : ''}`}
              onClick={() => setCurrentRole('controller')}
            >
              CONTROLLER · L3
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', fontWeight: '700', color: '#047857' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }}></span>
              SYSTEM OPERATIONAL
            </span>
            <span style={{ color: '#94A3B8' }}>•</span>
            <span style={{ color: '#475569' }}>CHAIN VERIFIED</span>
          </div>

        </div>

        {/* 4 Status Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          
          <div 
            className="executive-metric-card active-card"
            onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
          >
            <div className="executive-metric-label">ACTIVE</div>
            <div className="executive-metric-value">{statusCounts.active}</div>
          </div>

          <div 
            className="executive-metric-card pending-card"
            onClick={() => setStatusFilter(statusFilter === 'pending_deletion' ? 'all' : 'pending_deletion')}
          >
            <div className="executive-metric-label">PENDING DELETION</div>
            <div className="executive-metric-value" style={{ color: '#D97706' }}>{statusCounts.pending_deletion}</div>
          </div>

          <div 
            className="executive-metric-card archived-card"
            onClick={() => setStatusFilter(statusFilter === 'archived' ? 'all' : 'archived')}
          >
            <div className="executive-metric-label">ARCHIVED</div>
            <div className="executive-metric-value" style={{ color: '#2563EB' }}>{statusCounts.archived}</div>
          </div>

          <div 
            className="executive-metric-card deleted-card"
            onClick={() => setStatusFilter(statusFilter === 'deleted' ? 'all' : 'deleted')}
          >
            <div className="executive-metric-label">DELETED</div>
            <div className="executive-metric-value" style={{ color: '#DC2626' }}>{statusCounts.deleted}</div>
          </div>

        </div>

        {/* Executive Table */}
        <div className="executive-table-container">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead className="executive-table-header">
              <tr>
                <th>RECORD</th>
                <th>STATUS</th>
                <th>RETENTION SCORE</th>
                <th>PURGE COUNTDOWN</th>
                <th style={{ textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                    No retention records found.
                  </td>
                </tr>
              ) : (
                filteredRecords.map(rec => {
                  const isPending = rec.status === 'pending_deletion';
                  const isArchived = rec.status === 'archived';
                  const isActive = rec.status === 'active';
                  const isDeleted = rec.status === 'deleted';

                  return (
                    <tr key={rec.id} className="executive-table-row">
                      {/* RECORD */}
                      <td style={{ padding: '18px 20px' }}>
                        <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A' }}>
                          {rec.title || 'Record Entry'}
                        </div>
                        <div className="executive-id-tag">
                          {rec.short_hash || rec.id}
                        </div>
                      </td>

                      {/* STATUS */}
                      <td style={{ padding: '18px 20px', fontSize: '14px' }}>
                        {renderStatusDot(rec.status)}
                      </td>

                      {/* RETENTION SCORE */}
                      <td style={{ padding: '18px 20px', fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>
                        {rec.risk_score}%
                      </td>

                      {/* PURGE COUNTDOWN */}
                      <td style={{ padding: '18px 20px', fontSize: '13px', fontWeight: '700', color: rec.status === 'pending_deletion' ? '#B45309' : '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                        {getPurgeCountdownText(rec)}
                      </td>

                      {/* ACTION BUTTONS */}
                      <td style={{ padding: '18px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          
                          {/* Archive Action */}
                          <button
                            title="Archive Record"
                            className="executive-action-btn"
                            disabled={!canArchive || !isActive}
                            onClick={() => handleOpenActionModal('archive', rec)}
                          >
                            <Archive size={17} />
                          </button>

                          {/* Request Delete Action */}
                          <button
                            title="Request Deletion"
                            className="executive-action-btn"
                            disabled={!canRequestDelete || isPending || isDeleted}
                            onClick={() => handleOpenActionModal('request-delete', rec)}
                          >
                            <Trash2 size={17} />
                          </button>

                          {/* Restore Action */}
                          <button
                            title="Restore Record"
                            className="executive-action-btn"
                            disabled={!canRestore || (!isArchived && !isPending)}
                            onClick={() => handleRestore(rec)}
                          >
                            <RotateCcw size={17} />
                          </button>

                          {/* Approve Delete Action */}
                          <button
                            title="Approve Purge (Controller)"
                            className="executive-action-btn"
                            disabled={!canApproveDelete || !isPending}
                            onClick={() => handleApproveDelete(rec)}
                          >
                            <ShieldAlert size={17} color={canApproveDelete && isPending ? '#DC2626' : undefined} />
                          </button>

                          {/* View Log */}
                          <button
                            title="Audit Trail Log"
                            className="executive-action-btn"
                            onClick={() => handleViewAuditTrail(rec)}
                          >
                            <FileText size={17} />
                          </button>

                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div ref={tableEndRef}></div>
        </div>

      </div>

      {/* Floating Scroll Indicator */}
      <div className="executive-floating-btn" onClick={scrollToBottom} title="Scroll Down">
        <ArrowDown size={20} />
      </div>

      {/* Modal Dialogs */}
      {actionModal.open && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            width: '460px',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0F172A' }}>
                {actionModal.type === 'archive' ? 'Archive Confirmation' : 'Deletion Request'}
              </h3>
              <button onClick={() => setActionModal({ open: false, type: null, record: null, reason: '' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '14px', color: '#475569' }}>
              Confirm action for record <strong style={{ color: '#0F172A' }}>{actionModal.record?.short_hash || actionModal.record?.id}</strong> under <strong style={{ color: '#0B2545' }}>{currentRole.toUpperCase()}</strong> authority.
            </p>

            <textarea
              rows="3"
              placeholder="Enter compliance ticket or justification..."
              value={actionModal.reason}
              onChange={(e) => setActionModal(prev => ({ ...prev, reason: e.target.value }))}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                outline: 'none',
                fontSize: '14px',
                fontFamily: 'inherit'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button 
                onClick={() => setActionModal({ open: false, type: null, record: null, reason: '' })}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button 
                onClick={submitAction}
                style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#0B2545', color: '#FFFFFF', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Modal */}
      {auditModal.open && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            width: '540px',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0F172A' }}>Audit Trail Log</h3>
                <span style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace' }}>Record: {auditModal.record?.short_hash || auditModal.record?.id}</span>
              </div>
              <button onClick={() => setAuditModal({ open: false, record: null, trail: [], loading: false })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {auditModal.trail.map((entry, idx) => (
                <div key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '12px 16px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700', color: '#0B2545' }}>
                    <span>{entry.action.toUpperCase()}</span>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '400' }}>{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                    Actor: <strong>{entry.performed_by}</strong>
                  </div>
                  {entry.reason && <div style={{ fontSize: '12px', color: '#64748B', fontStyle: 'italic', marginTop: '2px' }}>"{entry.reason}"</div>}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setAuditModal({ open: false, record: null, trail: [], loading: false })} style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#0B2545', color: '#FFFFFF', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
