import React, { useState, useEffect } from 'react';
import { 
  Database, 
  ShieldCheck, 
  Archive, 
  Trash2, 
  RotateCcw, 
  CheckCircle2, 
  FileText, 
  Filter, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  UserCheck, 
  Clock, 
  ShieldAlert, 
  Check, 
  X, 
  Activity, 
  Volume2, 
  TrainFront, 
  Mic 
} from 'lucide-react';

// Default mock data shape aligned with backend store schema
const INITIAL_MOCK_RECORDS = [
  {
    id: "rec-sched-505",
    entity_type: "train_log",
    status: "active",
    created_at: new Date(Date.now() - 45 * 86400000).toISOString(),
    status_changed_at: new Date(Date.now() - 45 * 86400000).toISOString(),
    status_changed_by: "system",
    reason: "Automated system ingestion",
    scheduled_purge_at: null,
    purged_at: null,
    purged_by: null,
    risk_score: 88,
    score_label: "High Priority"
  },
  {
    id: "rec-rep-202",
    entity_type: "incident_report",
    status: "archived",
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
    status_changed_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    status_changed_by: "station_master",
    reason: "Routine quarterly archiving of incident reports",
    scheduled_purge_at: null,
    purged_at: null,
    purged_by: null,
    risk_score: 64,
    score_label: "Medium"
  },
  {
    id: "rec-ann-101",
    entity_type: "announcement",
    status: "pending_deletion",
    created_at: new Date(Date.now() - 120 * 86400000).toISOString(),
    status_changed_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    status_changed_by: "controller",
    reason: "GDPR / Compliance data erasure request",
    scheduled_purge_at: new Date(Date.now() + 5 * 86400000).toISOString(),
    purged_at: null,
    purged_by: null,
    risk_score: 95,
    score_label: "Critical"
  },
  {
    id: "rec-tel-303",
    entity_type: "voice_transcript",
    status: "deleted",
    created_at: new Date(Date.now() - 180 * 86400000).toISOString(),
    status_changed_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    status_changed_by: "controller",
    reason: "Approved deletion order #8841",
    scheduled_purge_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    purged_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    purged_by: "controller",
    risk_score: 30,
    score_label: "Low"
  }
];


export default function RetentionPanel({ showToast }) {
  // Active role state: 'viewer' | 'station_master' | 'controller'
  const [currentRole, setCurrentRole] = useState('controller');
  
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
    type: null, // 'archive' | 'request-delete'
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

  const API_BASE = 'http://localhost:8001';

  // Fetch records from backend API endpoint with mock fallback
  const fetchRecords = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/api/retention/records`;
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (entityFilter !== 'all') params.append('entity_type', entityFilter);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, {
        headers: {
          'X-Role': currentRole
        }
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
        setIsLiveConnected(true);
      } else {
        throw new Error(`Server returned ${res.status}`);
      }
    } catch (err) {
      console.warn("Backend API unavailable or error fetching, using mock state:", err.message);
      setIsLiveConnected(false);
      // Filter mock state locally if offline
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

  // Compute status strip count metrics
  const statusCounts = {
    active: records.filter(r => r.status === 'active').length,
    pending_deletion: records.filter(r => r.status === 'pending_deletion').length,
    archived: records.filter(r => r.status === 'archived').length,
    deleted: records.filter(r => r.status === 'deleted').length,
    total: records.length
  };

  // Helper formatting routines
  const formatDate = (isoStr) => {
    if (!isoStr) return 'N/A';
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getPurgeCountdown = (record) => {
    if (record.status === 'deleted') return <span style={{ color: 'var(--text-secondary)' }}>Purged ({formatDate(record.purged_at)})</span>;
    if (record.status !== 'pending_deletion' || !record.scheduled_purge_at) return <span style={{ color: 'var(--text-secondary)' }}>N/A</span>;
    
    const diffMs = new Date(record.scheduled_purge_at) - new Date();
    if (diffMs <= 0) return <span style={{ color: 'var(--error)', fontWeight: 'bold' }}>Purge Overdue</span>;
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return (
      <span style={{ color: 'var(--warning)', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <Clock size={13} /> {days > 0 ? `${days}d ${hours}h left` : `${hours}h left`}
      </span>
    );
  };

  const getEntityIcon = (type) => {
    switch (type) {
      case 'train_log': return <TrainFront size={16} color="var(--accent-secondary)" />;
      case 'announcement': return <Volume2 size={16} color="var(--warning)" />;
      case 'incident_report': return <AlertTriangle size={16} color="var(--error)" />;
      case 'voice_transcript': return <Mic size={16} color="var(--accent-primary)" />;
      default: return <Activity size={16} color="var(--accent-tertiary)" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className="status-badge status-ontime" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12} /> Active</span>;
      case 'archived':
        return <span className="status-badge" style={{ background: 'rgba(14, 165, 233, 0.15)', color: 'var(--accent-secondary)', border: '1px solid rgba(14, 165, 233, 0.3)' }}><Archive size={12} style={{ marginRight: 2 }} /> Archived</span>;
      case 'pending_deletion':
        return <span className="status-badge status-delayed" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)', border: '1px solid rgba(245, 158, 11, 0.3)' }}><Clock size={12} style={{ marginRight: 2 }} /> Pending Deletion</span>;
      case 'deleted':
        return <span className="status-badge" style={{ background: 'rgba(244, 63, 94, 0.15)', color: 'var(--error)', border: '1px solid rgba(244, 63, 94, 0.3)', opacity: 0.8 }}><Trash2 size={12} style={{ marginRight: 2 }} /> Deleted</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  // Action execution routines
  const handleOpenActionModal = (type, record) => {
    setActionModal({
      open: true,
      type,
      record,
      reason: ''
    });
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
        setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
        if (showToast) showToast('success', 'Action Executed', `Record ${record.id} set to ${updated.status}.`);
      } else {
        const errData = await res.json();
        throw new Error(errData.detail || 'Action failed');
      }
    } catch (err) {
      console.warn("API request failed, updating local state:", err.message);
      // Local state fallback update
      const newStatus = type === 'archive' ? 'archived' : 'pending_deletion';
      setRecords(prev => prev.map(r => {
        if (r.id === record.id) {
          return {
            ...r,
            status: newStatus,
            status_changed_at: new Date().toISOString(),
            status_changed_by: currentRole,
            reason: reason || 'Local state modification',
            scheduled_purge_at: type === 'request-delete' ? new Date(Date.now() + 7 * 86400000).toISOString() : r.scheduled_purge_at
          };
        }
        return r;
      }));
      if (showToast) showToast('info', 'Local State Updated', `Record ${record.id} updated locally.`);
    } finally {
      setActionModal({ open: false, type: null, record: null, reason: '' });
    }
  };

  const handleRestore = async (record) => {
    try {
      const res = await fetch(`${API_BASE}/api/retention/restore/${record.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Role': currentRole
        },
        body: JSON.stringify({ reason: "Restored to active status" })
      });

      if (res.ok) {
        const updated = await res.json();
        setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
        if (showToast) showToast('success', 'Record Restored', `Record ${record.id} restored to Active.`);
      } else {
        const errData = await res.json();
        throw new Error(errData.detail || 'Restore failed');
      }
    } catch (err) {
      console.warn("API failed, fallback to local state:", err.message);
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, status: 'active', scheduled_purge_at: null, status_changed_at: new Date().toISOString(), status_changed_by: currentRole } : r));
      if (showToast) showToast('info', 'Record Restored (Local)', `Record ${record.id} set to Active.`);
    }
  };

  const handleApproveDelete = async (record) => {
    if (currentRole !== 'controller') {
      if (showToast) showToast('error', 'Permission Denied', 'Approve Delete is restricted to Controller role.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/retention/approve-delete/${record.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Role': currentRole
        },
        body: JSON.stringify({ reason: "Final deletion approval executed by Controller" })
      });

      if (res.ok) {
        const updated = await res.json();
        setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
        if (showToast) showToast('success', 'Deletion Approved', `Record ${record.id} permanently purged.`);
      } else {
        const errData = await res.json();
        throw new Error(errData.detail || 'Approve Delete failed');
      }
    } catch (err) {
      console.warn("API failed, fallback local:", err.message);
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, status: 'deleted', purged_at: new Date().toISOString(), purged_by: currentRole, status_changed_at: new Date().toISOString() } : r));
      if (showToast) showToast('info', 'Record Deleted (Local)', `Record ${record.id} marked as deleted.`);
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
        throw new Error("Audit trail fetch failed");
      }
    } catch (err) {
      // Local fallback audit log
      const fallbackTrail = [
        {
          timestamp: record.created_at,
          action: "CREATE",
          performed_by: "system",
          reason: record.reason || "Record created",
          previous_status: null,
          new_status: "active"
        }
      ];
      if (record.status !== 'active') {
        fallbackTrail.push({
          timestamp: record.status_changed_at,
          action: record.status.toUpperCase(),
          performed_by: record.status_changed_by || currentRole,
          reason: record.reason || "Status updated",
          previous_status: "active",
          new_status: record.status
        });
      }
      setAuditModal({ open: true, record, trail: fallbackTrail, loading: false });
    }
  };

  // Filter records by search query
  const filteredRecords = records.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      r.entity_type.toLowerCase().includes(q) ||
      r.status.toLowerCase().includes(q) ||
      (r.reason && r.reason.toLowerCase().includes(q))
    );
  });

  // Permission checkers based on role
  const canArchive = currentRole === 'station_master' || currentRole === 'controller';
  const canRequestDelete = currentRole === 'station_master' || currentRole === 'controller';
  const canRestore = currentRole === 'station_master' || currentRole === 'controller';
  const canApproveDelete = currentRole === 'controller';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '30px', height: '100%', overflowY: 'auto', flex: 1 }}>
      
      {/* Top Header & Role Selector Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Database size={28} color="var(--accent-primary)" />
            <h2 className="text-gradient" style={{ fontSize: '28px' }}>Data Retention Management</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '14px' }}>
            Manage record lifecycle, archive old logs, schedule deletions, and enforce role-gated governance policies.
          </p>
        </div>

        {/* Role Selector Box */}
        <div className="glass-panel" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '600' }}>
            <UserCheck size={16} color="var(--accent-secondary)" />
            Active Header Role:
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['viewer', 'station_master', 'controller'].map(role => (
              <button
                key={role}
                onClick={() => setCurrentRole(role)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '10px',
                  border: '1px solid',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  borderColor: currentRole === role ? 'var(--accent-primary)' : 'rgba(255,255,255,0.08)',
                  background: currentRole === role ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(14, 165, 233, 0.3))' : 'rgba(0,0,0,0.2)',
                  color: currentRole === role ? '#fff' : 'var(--text-secondary)',
                  boxShadow: currentRole === role ? '0 0 12px rgba(139, 92, 246, 0.3)' : 'none'
                }}
              >
                {role.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '11px', color: isLiveConnected ? 'var(--success)' : 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: isLiveConnected ? 'var(--success)' : 'var(--warning)' }}></span>
            {isLiveConnected ? 'API Live' : 'Mock Mode'}
          </span>
        </div>
      </div>

      {/* 4 Counts Status Summary Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        
        {/* Active Count */}
        <div 
          className="glass-panel" 
          onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
          style={{ 
            padding: '20px', 
            cursor: 'pointer',
            borderColor: statusFilter === 'active' ? 'var(--success)' : 'var(--panel-border)',
            background: statusFilter === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'var(--panel-bg)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Active Records</span>
            <CheckCircle2 size={20} color="var(--success)" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', marginTop: '10px', color: 'var(--success)' }}>
            {statusCounts.active}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Healthy & in retention cycle
          </div>
        </div>

        {/* Pending Deletion Count */}
        <div 
          className="glass-panel" 
          onClick={() => setStatusFilter(statusFilter === 'pending_deletion' ? 'all' : 'pending_deletion')}
          style={{ 
            padding: '20px', 
            cursor: 'pointer',
            borderColor: statusFilter === 'pending_deletion' ? 'var(--warning)' : 'var(--panel-border)',
            background: statusFilter === 'pending_deletion' ? 'rgba(245, 158, 11, 0.1)' : 'var(--panel-bg)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Pending Deletion</span>
            <Clock size={20} color="var(--warning)" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', marginTop: '10px', color: 'var(--warning)' }}>
            {statusCounts.pending_deletion}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Awaiting controller approval
          </div>
        </div>

        {/* Archived Count */}
        <div 
          className="glass-panel" 
          onClick={() => setStatusFilter(statusFilter === 'archived' ? 'all' : 'archived')}
          style={{ 
            padding: '20px', 
            cursor: 'pointer',
            borderColor: statusFilter === 'archived' ? 'var(--accent-secondary)' : 'var(--panel-border)',
            background: statusFilter === 'archived' ? 'rgba(14, 165, 233, 0.1)' : 'var(--panel-bg)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Archived Records</span>
            <Archive size={20} color="var(--accent-secondary)" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', marginTop: '10px', color: 'var(--accent-secondary)' }}>
            {statusCounts.archived}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Long-term cold storage
          </div>
        </div>

        {/* Deleted Count */}
        <div 
          className="glass-panel" 
          onClick={() => setStatusFilter(statusFilter === 'deleted' ? 'all' : 'deleted')}
          style={{ 
            padding: '20px', 
            cursor: 'pointer',
            borderColor: statusFilter === 'deleted' ? 'var(--error)' : 'var(--panel-border)',
            background: statusFilter === 'deleted' ? 'rgba(244, 63, 94, 0.1)' : 'var(--panel-bg)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Deleted / Purged</span>
            <Trash2 size={20} color="var(--error)" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', marginTop: '10px', color: 'var(--error)' }}>
            {statusCounts.deleted}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Permanently purged records
          </div>
        </div>
      </div>

      {/* Main Glass Table Container */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Filters & Actions Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search record ID, entity, reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '40px' }}
              />
            </div>

            {/* Status Select */}
            <div style={{ width: '180px' }}>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="pending_deletion">Pending Deletion</option>
                <option value="archived">Archived</option>
                <option value="deleted">Deleted</option>
              </select>
            </div>

            {/* Entity Select */}
            <div style={{ width: '180px' }}>
              <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
                <option value="all">All Entity Types</option>
                <option value="train_log">Train Log</option>
                <option value="announcement">Announcement</option>
                <option value="incident_report">Incident Report</option>
                <option value="voice_transcript">Voice Transcript</option>
                <option value="telemetry_snapshot">Telemetry Snapshot</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              className="btn-primary"
              onClick={fetchRecords}
              disabled={loading}
              style={{ padding: '10px 18px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Record Table */}
        <div style={{ overflowX: 'auto', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: 'rgba(0, 0, 0, 0.3)', borderBottom: '1px solid var(--panel-border)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '14px 18px', fontWeight: '600' }}>Record & Entity Type</th>
                <th style={{ padding: '14px 18px', fontWeight: '600' }}>Status Badge</th>
                <th style={{ padding: '14px 18px', fontWeight: '600' }}>Retention Score</th>
                <th style={{ padding: '14px 18px', fontWeight: '600' }}>Purge Countdown</th>
                <th style={{ padding: '14px 18px', fontWeight: '600' }}>Created / Changed</th>
                <th style={{ padding: '14px 18px', fontWeight: '600', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No retention records found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map(rec => {
                  const isPending = rec.status === 'pending_deletion';
                  const isArchived = rec.status === 'archived';
                  const isActive = rec.status === 'active';
                  const isDeleted = rec.status === 'deleted';

                  return (
                    <tr 
                      key={rec.id}
                      style={{ 
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        transition: 'background 0.2s ease',
                        opacity: isDeleted ? 0.6 : 1
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* ID & Entity Type */}
                      <td style={{ padding: '16px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '10px', display: 'flex' }}>
                            {getEntityIcon(rec.entity_type)}
                          </div>
                          <div>
                            <div style={{ fontWeight: '700', color: '#fff', fontSize: '14px' }}>{rec.id}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                              {rec.entity_type.replace('_', ' ')}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td style={{ padding: '16px 18px' }}>
                        {getStatusBadge(rec.status)}
                      </td>

                      {/* Score Placeholder */}
                      <td style={{ padding: '16px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ 
                            width: '36px', 
                            height: '36px', 
                            borderRadius: '50%', 
                            border: `2px solid ${rec.risk_score > 80 ? 'var(--error)' : rec.risk_score > 60 ? 'var(--warning)' : 'var(--success)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: '700',
                            color: '#fff'
                          }}>
                            {rec.risk_score}%
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {rec.score_label || 'Priority'}
                          </span>
                        </div>
                      </td>

                      {/* Purge Countdown Placeholder */}
                      <td style={{ padding: '16px 18px', fontSize: '13px' }}>
                        {getPurgeCountdown(rec)}
                      </td>

                      {/* Timestamps */}
                      <td style={{ padding: '16px 18px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <div>Created: {formatDate(rec.created_at)}</div>
                        <div style={{ marginTop: '2px', color: 'rgba(255,255,255,0.4)' }}>
                          Updated: {formatDate(rec.status_changed_at)} ({rec.status_changed_by || 'system'})
                        </div>
                      </td>

                      {/* Action Icon Buttons */}
                      <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          
                          {/* Archive Button */}
                          <button
                            title={!canArchive ? "Requires Station Master or Controller role" : "Archive Record"}
                            disabled={!canArchive || !isActive}
                            onClick={() => handleOpenActionModal('archive', rec)}
                            style={{
                              background: 'rgba(14, 165, 233, 0.1)',
                              border: '1px solid rgba(14, 165, 233, 0.2)',
                              color: 'var(--accent-secondary)',
                              padding: '8px',
                              borderRadius: '8px',
                              cursor: (canArchive && isActive) ? 'pointer' : 'not-allowed',
                              opacity: (canArchive && isActive) ? 1 : 0.3,
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <Archive size={16} />
                          </button>

                          {/* Request Delete Button */}
                          <button
                            title={!canRequestDelete ? "Requires Station Master or Controller role" : "Request Deletion"}
                            disabled={!canRequestDelete || isPending || isDeleted}
                            onClick={() => handleOpenActionModal('request-delete', rec)}
                            style={{
                              background: 'rgba(245, 158, 11, 0.1)',
                              border: '1px solid rgba(245, 158, 11, 0.2)',
                              color: 'var(--warning)',
                              padding: '8px',
                              borderRadius: '8px',
                              cursor: (canRequestDelete && !isPending && !isDeleted) ? 'pointer' : 'not-allowed',
                              opacity: (canRequestDelete && !isPending && !isDeleted) ? 1 : 0.3,
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <Trash2 size={16} />
                          </button>

                          {/* Restore Button */}
                          <button
                            title={!canRestore ? "Requires Station Master or Controller role" : "Restore to Active"}
                            disabled={!canRestore || (!isArchived && !isPending)}
                            onClick={() => handleRestore(rec)}
                            style={{
                              background: 'rgba(16, 185, 129, 0.1)',
                              border: '1px solid rgba(16, 185, 129, 0.2)',
                              color: 'var(--success)',
                              padding: '8px',
                              borderRadius: '8px',
                              cursor: (canRestore && (isArchived || isPending)) ? 'pointer' : 'not-allowed',
                              opacity: (canRestore && (isArchived || isPending)) ? 1 : 0.3,
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <RotateCcw size={16} />
                          </button>

                          {/* Approve Delete / Purge Button (Controller only!) */}
                          <button
                            title={!canApproveDelete ? "Controller role required to approve purge" : "Approve Final Deletion"}
                            disabled={!canApproveDelete || !isPending}
                            onClick={() => handleApproveDelete(rec)}
                            style={{
                              background: 'rgba(244, 63, 94, 0.15)',
                              border: '1px solid rgba(244, 63, 94, 0.3)',
                              color: 'var(--error)',
                              padding: '8px',
                              borderRadius: '8px',
                              cursor: (canApproveDelete && isPending) ? 'pointer' : 'not-allowed',
                              opacity: (canApproveDelete && isPending) ? 1 : 0.3,
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <ShieldAlert size={16} />
                          </button>

                          {/* View Audit Trail Button */}
                          <button
                            title="View Record Audit Trail"
                            onClick={() => handleViewAuditTrail(rec)}
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: '#fff',
                              padding: '8px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <FileText size={16} />
                          </button>

                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Reason Input Modal */}
      {actionModal.open && (
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
          <div className="glass-panel" style={{ width: '450px', padding: '30px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px' }} className="text-gradient">
                {actionModal.type === 'archive' ? 'Archive Record' : 'Request Record Deletion'}
              </h3>
              <button 
                onClick={() => setActionModal({ open: false, type: null, record: null, reason: '' })}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Confirm action for record <strong style={{ color: '#fff' }}>{actionModal.record?.id}</strong> under role <strong style={{ color: 'var(--accent-primary)' }}>{currentRole}</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Reason / Policy Reference:</label>
              <textarea
                rows="3"
                placeholder="Enter justification or compliance ticket ID..."
                value={actionModal.reason}
                onChange={(e) => setActionModal(prev => ({ ...prev, reason: e.target.value }))}
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid var(--panel-border)',
                  color: '#fff',
                  padding: '12px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  outline: 'none',
                  resize: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
              <button
                onClick={() => setActionModal({ open: false, type: null, record: null, reason: '' })}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-secondary)',
                  padding: '10px 18px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={submitAction}
                style={{ padding: '10px 20px', fontSize: '14px' }}
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Trail Log Modal */}
      {auditModal.open && (
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
          <div className="glass-panel" style={{ width: '600px', maxHeight: '80vh', padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '18px' }} className="text-gradient">Audit Trail Log</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Record: {auditModal.record?.id}</span>
              </div>
              <button 
                onClick={() => setAuditModal({ open: false, record: null, trail: [], loading: false })}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {auditModal.trail.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                  No audit events recorded yet.
                </div>
              ) : (
                auditModal.trail.map((entry, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--accent-secondary)' }}>
                        {entry.action}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {formatDate(entry.timestamp)}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#fff', marginTop: '2px' }}>
                      Performed By: <strong style={{ color: 'var(--accent-primary)' }}>{entry.performed_by}</strong>
                    </div>
                    {entry.reason && (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '2px' }}>
                        "{entry.reason}"
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setAuditModal({ open: false, record: null, trail: [], loading: false })}
                className="btn-primary"
                style={{ padding: '8px 18px', fontSize: '13px' }}
              >
                Close Log
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
