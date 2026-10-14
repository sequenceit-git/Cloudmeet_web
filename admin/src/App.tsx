import React, { useState, useEffect, useCallback } from 'react';
import { ENV } from './config/env';
import { adminTranslations } from './i18n';
import {
  adminApi,
  type AdminUser,
  type RealHost,
  type RealMeeting,
} from './services/api';
import {
  Users,
  Video,
  Shield,
  Activity,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Radio,
  Server,
  Trash2,
  UserCheck,
  UserX,
  Sparkles,
  Globe,
  LogOut,
  Lock,
  Mail,
  RefreshCw,
  AlertCircle,
  Clock,
  Calendar,
  PowerOff,
} from 'lucide-react';

export function App() {
  // Chinese by default for enterprise compliance
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const t = adminTranslations[lang];

  // Auth State
  const [adminUser, setAdminUser] = useState<AdminUser | null>(() => adminApi.getUser());
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // App Navigation & Filter State
  const [activeTab, setActiveTab] = useState<'hosts' | 'meetings' | 'trtc'>('hosts');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddHostModal, setShowAddHostModal] = useState(false);

  // Real Data State (No mock data!)
  const [hosts, setHosts] = useState<RealHost[]>([]);
  const [meetings, setMeetings] = useState<RealMeeting[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState<{
    activeMeetingsCount: number;
    totalMeetingsCount: number;
    totalHostsCount: number;
    liveParticipants: number;
    sdkAppId: number;
    sdkConfigured: boolean;
  }>({
    activeMeetingsCount: 0,
    totalMeetingsCount: 0,
    totalHostsCount: 0,
    liveParticipants: 0,
    sdkAppId: 0,
    sdkConfigured: false,
  });
  const [apiLatencyMs, setApiLatencyMs] = useState<number | null>(null);

  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // New Host Form State
  const [newHostName, setNewHostName] = useState('');
  const [newHostEmail, setNewHostEmail] = useState('');
  const [newHostPassword, setNewHostPassword] = useState('');
  const [isCreatingHost, setIsCreatingHost] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Listen for session expiry
  useEffect(() => {
    const handleUnauthorized = () => {
      setAdminUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  // Fetch Live Real Data from API
  const fetchAllData = useCallback(async (silent = false) => {
    if (!adminApi.getToken()) return;
    if (!silent) setLoadingData(true);
    setDataError(null);

    try {
      const started = performance.now();
      const [dashRes, hostsRes, meetingsRes] = await Promise.all([
        adminApi.getDashboard().catch(() => ({
          activeMeetingsCount: 0,
          totalMeetingsCount: 0,
          totalHostsCount: 0,
          liveParticipants: 0,
          sdkAppId: 0,
          sdkConfigured: false,
          recentMeetings: [],
        })),
        adminApi.getHosts().catch(() => ({ hosts: [] })),
        adminApi.getMeetings().catch(() => ({ meetings: [] })),
      ]);
      setApiLatencyMs(Math.max(1, Math.round(performance.now() - started)));

      setDashboardMetrics({
        activeMeetingsCount: dashRes.activeMeetingsCount || 0,
        totalMeetingsCount: dashRes.totalMeetingsCount || 0,
        totalHostsCount: dashRes.totalHostsCount || (hostsRes.hosts ? hostsRes.hosts.length : 0),
        liveParticipants: dashRes.liveParticipants || 0,
        sdkAppId: dashRes.sdkAppId || 0,
        sdkConfigured: Boolean(dashRes.sdkConfigured),
      });

      setHosts(hostsRes.hosts || []);
      setMeetings(meetingsRes.meetings || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to backend server';
      setDataError(msg);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (!adminUser) return;
    fetchAllData();
    const timer = window.setInterval(() => fetchAllData(true), 10000);
    return () => window.clearInterval(timer);
  }, [adminUser, fetchAllData]);

  // Handle Admin Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await adminApi.login(loginEmail, loginPassword);
      setAdminUser(res.user);
      setLoginPassword('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setLoginError(msg);
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Admin Logout
  const handleLogout = () => {
    adminApi.logout();
    setAdminUser(null);
    setHosts([]);
    setMeetings([]);
  };

  // Handle Toggle Host Active/Disabled
  const handleToggleHost = async (host: RealHost) => {
    try {
      const updated = await adminApi.toggleHostStatus(host.id, !host.isDisabled);
      setHosts((prev) =>
        prev.map((h) => (h.id === host.id ? { ...h, isDisabled: updated.host.isDisabled } : h))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operation failed';
      alert(msg);
    }
  };

  // Handle Delete Host
  const handleDeleteHost = async (host: RealHost) => {
    const confirmPrompt =
      lang === 'zh'
        ? `确定要删除主持人账号 "${host.displayName}" (${host.email}) 吗？`
        : `Are you sure you want to delete host "${host.displayName}" (${host.email})?`;

    if (!window.confirm(confirmPrompt)) return;

    try {
      await adminApi.deleteHost(host.id);
      setHosts((prev) => prev.filter((h) => h.id !== host.id));
      setDashboardMetrics((prev) => ({
        ...prev,
        totalHostsCount: Math.max(0, prev.totalHostsCount - 1),
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      alert(msg);
    }
  };

  // Handle Create Real Host
  const handleCreateHost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHostName.trim() || !newHostEmail.trim() || !newHostPassword) return;

    setModalError(null);
    setIsCreatingHost(true);

    try {
      const res = await adminApi.createHost({
        displayName: newHostName.trim(),
        email: newHostEmail.trim().toLowerCase(),
        password: newHostPassword,
      });

      setHosts((prev) => [res.host, ...prev]);
      setDashboardMetrics((prev) => ({
        ...prev,
        totalHostsCount: prev.totalHostsCount + 1,
      }));

      setNewHostName('');
      setNewHostEmail('');
      setNewHostPassword('');
      setShowAddHostModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create host';
      setModalError(msg);
    } finally {
      setIsCreatingHost(false);
    }
  };

  // Handle Forcibly Terminate Active Meeting
  const handleTerminateMeeting = async (meetingId: string) => {
    if (!window.confirm(t.terminateConfirm)) return;

    try {
      await adminApi.endMeeting(meetingId);
      setMeetings((prev) =>
        prev.map((m) => (m.id === meetingId ? { ...m, status: 'ENDED', endedAt: new Date().toISOString() } : m))
      );
      setDashboardMetrics((prev) => ({
        ...prev,
        activeMeetingsCount: Math.max(0, prev.activeMeetingsCount - 1),
      }));
      alert(t.terminateSuccess);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to terminate meeting';
      alert(msg);
    }
  };

  const filteredHosts = hosts.filter(
    (h) =>
      h.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ==========================================
  // VIEW 1: ADMIN LOGIN PANEL (When Unauthenticated)
  // ==========================================
  if (!adminUser) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          background: 'radial-gradient(ellipse at 50% -20%, #1e1b4b, #030712 70%)',
          position: 'relative',
        }}
      >
        {/* Top-Right Language Switcher */}
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <button
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            className="btn btn-secondary"
            style={{
              borderRadius: 20,
              padding: '6px 12px',
              fontSize: '0.8125rem',
              gap: 6,
              borderColor: 'rgba(99, 102, 241, 0.3)',
              color: 'var(--accent-cyan)',
            }}
          >
            <Globe size={15} />
            <strong>{lang === 'zh' ? '中文 / EN' : 'EN / 中文'}</strong>
          </button>
        </div>

        {/* Login Card */}
        <div
          className="glass-panel login-card-responsive"
          style={{
            width: '100%',
            maxWidth: 440,
            padding: '36px 32px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          }}
        >
          {/* Logo & Title */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div
              style={{
                width: 52,
                height: 52,
                margin: '0 auto 16px',
                borderRadius: 14,
                background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 25px rgba(99, 102, 241, 0.45)',
              }}
            >
              <Video size={28} color="#ffffff" />
            </div>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                background: 'linear-gradient(to right, #ffffff, #cbd5e1)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: 6,
              }}
            >
              {t.loginTitle}
            </h1>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
              {t.loginSubtitle}
            </p>
          </div>

          {/* Error Message */}
          {loginError && (
            <div
              style={{
                marginBottom: 20,
                padding: '12px 14px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertCircle size={16} />
              <span>{loginError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 18 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: 6,
                }}
              >
                {t.emailLabel}
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={16}
                  color="var(--text-dim)"
                  style={{ position: 'absolute', left: 12, top: 12 }}
                />
                <input
                  type="email"
                  required
                  placeholder={t.loginEmailPlaceholder}
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: 38 }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: 6,
                }}
              >
                {t.pwdLabel}
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  color="var(--text-dim)"
                  style={{ position: 'absolute', left: 12, top: 12 }}
                />
                <input
                  type="password"
                  required
                  placeholder={t.loginPwdPlaceholder}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: 38 }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '0.875rem',
                fontWeight: 600,
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
              }}
            >
              {loginLoading ? (
                <>
                  <RefreshCw size={16} className="pulsing-dot" />
                  {t.loginLoading}
                </>
              ) : (
                t.loginBtn
              )}
            </button>
          </form>

          {/* Quick Credential Hint */}
          <div
            style={{
              marginTop: 24,
              padding: '12px 14px',
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.75rem',
              color: 'var(--text-dim)',
              textAlign: 'center',
            }}
          >
            <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>💡 提示：</span>
            <span>{t.defaultCredsNotice}</span>
          </div>
        </div>

        {/* Footer info */}
        <div style={{ marginTop: 24, fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center' }}>
          CloudMeet Enterprise · Tencent TRTC Inside · SDKAppID: {ENV.TRTC_SDK_APP_ID}
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: AUTHENTICATED ADMIN DASHBOARD (Mobile Responsive)
  // ==========================================
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Responsive Header */}
      <header className="glass-nav app-header">
        <div className="app-header-inner">
          {/* 1. Brand Section */}
          <div className="header-brand">
            <div className="brand-logo">
              <Video size={20} color="#ffffff" />
            </div>
            <div className="brand-info">
              <div className="brand-title-row">
                <span className="brand-title">{t.portalTitle}</span>
                <span className="badge-admin">{t.adminBadge}</span>
              </div>
              <p className="brand-subtitle">{t.portalSub}</p>
            </div>
          </div>

          {/* 2. Desktop Navigation Segmented Tabs */}
          <nav className="header-nav header-nav-desktop">
            <button
              onClick={() => setActiveTab('hosts')}
              className={`nav-tab-btn ${activeTab === 'hosts' ? 'active' : ''}`}
            >
              <Users size={16} />
              <span>{t.navHosts}</span>
            </button>
            <button
              onClick={() => setActiveTab('meetings')}
              className={`nav-tab-btn ${activeTab === 'meetings' ? 'active' : ''}`}
            >
              <Video size={16} />
              <span>{t.navMeetings}</span>
              {dashboardMetrics.activeMeetingsCount > 0 && (
                <span className="nav-badge-pulse">{dashboardMetrics.activeMeetingsCount}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('trtc')}
              className={`nav-tab-btn ${activeTab === 'trtc' ? 'active' : ''}`}
            >
              <Server size={16} />
              <span>{t.navTrtc}</span>
            </button>
          </nav>

          {/* 3. Utility Actions */}
          <div className="header-actions">
            {/* TRTC Online Status Indicator */}
            <div className="status-pill" title={t.trtcOnline}>
              <div className="pulsing-dot" />
              <span className="status-pill-text">TRTC</span>
            </div>

            {/* Refresh Live Data */}
            <button
              onClick={() => fetchAllData()}
              disabled={loadingData}
              title={lang === 'zh' ? '刷新实时数据' : 'Refresh live data'}
              className="btn btn-secondary btn-icon"
            >
              <RefreshCw size={15} className={loadingData ? 'pulsing-dot' : ''} />
            </button>

            {/* Language Toggle Button */}
            <button
              onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
              className="btn btn-secondary btn-lang"
              title={lang === 'zh' ? '切换为英文' : 'Switch to Chinese'}
            >
              <Globe size={14} />
              <span>{lang === 'zh' ? '中文' : 'EN'}</span>
            </button>

            {/* Admin User Profile */}
            <div className="admin-profile-pill">
              <div className="admin-avatar">
                {lang === 'zh' ? '管' : 'SA'}
              </div>
              <div className="admin-user-text">
                <span className="admin-user-name">
                  {lang === 'en' && adminUser.name === '超级管理员' ? t.superAdmin : (adminUser.name || t.superAdmin)}
                </span>
                <span className="admin-user-email">{adminUser.email}</span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="btn btn-secondary btn-logout"
              title={t.logoutBtn}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>

        {/* 4. Mobile Segmented Navigation Bar */}
        <nav className="header-nav header-nav-mobile">
          <button
            onClick={() => setActiveTab('hosts')}
            className={`nav-tab-btn ${activeTab === 'hosts' ? 'active' : ''}`}
          >
            <Users size={15} />
            <span>{t.navHosts}</span>
          </button>
          <button
            onClick={() => setActiveTab('meetings')}
            className={`nav-tab-btn ${activeTab === 'meetings' ? 'active' : ''}`}
          >
            <Video size={15} />
            <span>{t.navMeetings}</span>
            {dashboardMetrics.activeMeetingsCount > 0 && (
              <span className="nav-badge-pulse">{dashboardMetrics.activeMeetingsCount}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('trtc')}
            className={`nav-tab-btn ${activeTab === 'trtc' ? 'active' : ''}`}
          >
            <Server size={15} />
            <span>{t.navTrtc}</span>
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="app-main">
        {/* Error notification banner if any */}
        {dataError && (
          <div
            style={{
              marginBottom: 20,
              padding: '12px 16px',
              borderRadius: 10,
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertCircle size={16} />
              <span>{dataError}</span>
            </div>
            <button
              onClick={() => fetchAllData()}
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            >
              重试 / Retry
            </button>
          </div>
        )}

        {/* Real Metrics Cards Grid (Responsive 1-3 cols) */}
        <div className="metrics-grid">
          {/* Card 1: Active Meetings */}
          <div className="glass-panel card-metric">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {t.activeMeetings}
                </p>
                <h3 style={{ fontSize: '1.875rem', fontWeight: 800, marginTop: 4, color: '#ffffff' }}>
                  {dashboardMetrics.activeMeetingsCount}
                </h3>
              </div>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: 'rgba(6, 182, 212, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(6, 182, 212, 0.2)',
                }}
              >
                <Radio size={20} color="var(--accent-cyan)" />
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 12,
                fontSize: '0.75rem',
                color: dashboardMetrics.activeMeetingsCount > 0 ? 'var(--accent-emerald)' : 'var(--text-dim)',
              }}
            >
              <Activity size={14} />
              {dashboardMetrics.activeMeetingsCount > 0
                ? `${dashboardMetrics.activeMeetingsCount} ${t.streamingNow}`
                : lang === 'zh'
                ? '暂无活跃推流会话'
                : 'No active streams'}
            </div>
          </div>

          {/* Card 2: Registered Hosts */}
          <div className="glass-panel card-metric">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {t.registeredHosts}
                </p>
                <h3 style={{ fontSize: '1.875rem', fontWeight: 800, marginTop: 4, color: '#ffffff' }}>
                  {hosts.length}
                </h3>
              </div>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: 'rgba(99, 102, 241, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                }}
              >
                <Users size={20} color="var(--accent-indigo)" />
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 12,
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
              }}
            >
              {hosts.filter((h) => !h.isDisabled).length} {t.permittedHosts}
            </div>
          </div>

          {/* Card 3: TRTC Status */}
          <div className="glass-panel card-metric">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {t.trtcStatus}
                </p>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: 8, color: dataError || !dashboardMetrics.sdkConfigured ? '#f87171' : '#34d399' }}>
                  {dataError || !dashboardMetrics.sdkConfigured ? t.unavailable : t.operational}
                </h3>
              </div>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: 'rgba(16, 185, 129, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                }}
              >
                <Shield size={20} color="var(--accent-emerald)" />
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 12,
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
              }}
            >
              {t.avgLatency}: <strong style={{ color: '#ffffff' }}>{apiLatencyMs == null ? '—' : `${apiLatencyMs}ms`}</strong> · {dashboardMetrics.liveParticipants} {t.zeroLoss}
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* Tab 1: Real Host Management (Mobile Responsive) */}
        {/* ==================================================== */}
        {activeTab === 'hosts' && (
          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            {/* Host Section Header */}
            <div
              className="panel-header-responsive"
              style={{
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-subtle)',
                gap: 16,
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{t.hostTitle}</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>{t.hostSubtitle}</p>
              </div>

              {/* Search & Add Button */}
              <div className="search-action-group" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ position: 'relative', minWidth: 240 }}>
                  <Search
                    size={16}
                    color="var(--text-dim)"
                    style={{ position: 'absolute', left: 12, top: 12 }}
                  />
                  <input
                    type="text"
                    placeholder={t.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-field"
                    style={{ paddingLeft: 38 }}
                  />
                </div>

                <button onClick={() => setShowAddHostModal(true)} className="btn btn-primary">
                  <Plus size={16} /> {t.createNewHost}
                </button>
              </div>
            </div>

            {loadingData && hosts.length === 0 ? (
              <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-dim)' }}>
                <RefreshCw size={24} className="pulsing-dot" style={{ margin: '0 auto 12px' }} />
                <p>{t.loadingData}</p>
              </div>
            ) : filteredHosts.length === 0 ? (
              <div style={{ padding: '56px 20px', textAlign: 'center' }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: 'rgba(99, 102, 241, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                  }}
                >
                  <Users size={22} color="var(--accent-indigo)" />
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 6 }}>
                  {searchQuery ? (lang === 'zh' ? '未找到匹配的主持人' : 'No matching hosts found') : t.emptyHostsTitle}
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', maxWidth: 420, margin: '0 auto 20px' }}>
                  {searchQuery
                    ? (lang === 'zh' ? '请尝试更换搜索关键字' : 'Try adjusting your search query')
                    : t.emptyHostsSub}
                </p>
                {!searchQuery && (
                  <button onClick={() => setShowAddHostModal(true)} className="btn btn-primary">
                    <Plus size={16} /> {t.createNewHost}
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* 1. Desktop Data Table View */}
                <div className="desktop-table-view table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t.colHost}</th>
                        <th>{t.colEmail}</th>
                        <th>{t.colTotalMeetings}</th>
                        <th>{t.colStatus}</th>
                        <th>{t.colCreated}</th>
                        <th style={{ textAlign: 'right' }}>{t.colActions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHosts.map((host) => (
                        <tr key={host.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #1e293b, #334155)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: '0.875rem',
                                  border: '1px solid var(--border-subtle)',
                                  flexShrink: 0,
                                }}
                              >
                                {host.displayName ? host.displayName.slice(0, 1).toUpperCase() : 'H'}
                              </div>
                              <span style={{ fontWeight: 600 }}>{host.displayName}</span>
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>{host.email}</td>
                          <td>
                            <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff' }}>
                              {host._count?.meetings ?? 0} {t.sessions}
                            </span>
                          </td>
                          <td>
                            {host.isDisabled ? (
                              <span className="badge badge-disabled">
                                <XCircle size={12} /> {t.statusSuspended}
                              </span>
                            ) : (
                              <span className="badge badge-active">
                                <CheckCircle2 size={12} /> {t.statusActive}
                              </span>
                            )}
                          </td>
                          <td style={{ color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
                            {host.createdAt ? new Date(host.createdAt).toLocaleDateString() : '-'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => handleToggleHost(host)}
                                className={`btn ${host.isDisabled ? 'btn-success' : 'btn-secondary'}`}
                                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                              >
                                {host.isDisabled ? <UserCheck size={14} /> : <UserX size={14} />}
                                {host.isDisabled ? t.btnEnable : t.btnSuspend}
                              </button>
                              <button
                                onClick={() => handleDeleteHost(host)}
                                className="btn btn-danger"
                                style={{ padding: '6px 10px' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 2. Mobile Responsive Card List View */}
                <div className="mobile-card-list">
                  {filteredHosts.map((host) => (
                    <div key={host.id} className="mobile-data-card">
                      {/* Top: Avatar, Name, and Status Badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #1e293b, #334155)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.875rem',
                              border: '1px solid var(--border-subtle)',
                              flexShrink: 0,
                            }}
                          >
                            {host.displayName ? host.displayName.slice(0, 1).toUpperCase() : 'H'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{host.displayName}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{host.email}</div>
                          </div>
                        </div>

                        {host.isDisabled ? (
                          <span className="badge badge-disabled">
                            <XCircle size={12} /> {t.statusSuspended}
                          </span>
                        ) : (
                          <span className="badge badge-active">
                            <CheckCircle2 size={12} /> {t.statusActive}
                          </span>
                        )}
                      </div>

                      {/* Info Row: Meetings count & created date */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 10px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          borderRadius: 6,
                          fontSize: '0.75rem',
                          color: 'var(--text-dim)',
                        }}
                      >
                        <span style={{ color: '#ffffff' }}>
                          <strong>{host._count?.meetings ?? 0}</strong> {t.sessions}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={12} />
                          <span>{host.createdAt ? new Date(host.createdAt).toLocaleDateString() : '-'}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button
                          onClick={() => handleToggleHost(host)}
                          className={`btn ${host.isDisabled ? 'btn-success' : 'btn-secondary'}`}
                          style={{ flex: 1, padding: '8px', fontSize: '0.8125rem' }}
                        >
                          {host.isDisabled ? <UserCheck size={14} /> : <UserX size={14} />}
                          {host.isDisabled ? t.btnEnable : t.btnSuspend}
                        </button>
                        <button
                          onClick={() => handleDeleteHost(host)}
                          className="btn btn-danger"
                          style={{ padding: '8px 12px' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* Tab 2: Live & Recent Real Meetings (Mobile Responsive) */}
        {/* ==================================================== */}
        {activeTab === 'meetings' && (
          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{t.meetingMonitorTitle}</h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>{t.meetingMonitorSub}</p>
            </div>

            {loadingData && meetings.length === 0 ? (
              <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-dim)' }}>
                <RefreshCw size={24} className="pulsing-dot" style={{ margin: '0 auto 12px' }} />
                <p>{t.loadingData}</p>
              </div>
            ) : meetings.length === 0 ? (
              <div style={{ padding: '56px 20px', textAlign: 'center' }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: 'rgba(6, 182, 212, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    border: '1px solid rgba(6, 182, 212, 0.2)',
                  }}
                >
                  <Video size={22} color="var(--accent-cyan)" />
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 6 }}>
                  {t.emptyMeetingsTitle}
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', maxWidth: 420, margin: '0 auto' }}>
                  {t.emptyMeetingsSub}
                </p>
              </div>
            ) : (
              <>
                {/* 1. Desktop Data Table View */}
                <div className="desktop-table-view table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t.colMeetingCode}</th>
                        <th>{t.colTitle}</th>
                        <th>{t.colHost}</th>
                        <th>{t.colAttendees}</th>
                        <th>{t.colStatus}</th>
                        <th>{t.colElapsed}</th>
                        <th style={{ textAlign: 'right' }}>{t.colActions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meetings.map((m) => (
                        <tr key={m.id}>
                          <td>
                            <span className="badge badge-code">{m.meetingCode}</span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{m.title}</td>
                          <td>
                            <div>
                              <div>{m.host?.displayName || '-'}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                                {m.host?.email || '-'}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Users size={14} color="var(--accent-cyan)" />
                              <strong>{m._count?.participants ?? 1}</strong>
                            </div>
                          </td>
                          <td>
                            {m.status === 'ACTIVE' ? (
                              <span className="badge badge-active">
                                <Radio size={12} className="pulsing-dot" /> {t.liveNow}
                              </span>
                            ) : (
                              <span
                                className="badge"
                                style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-dim)' }}
                              >
                                {t.finished}
                              </span>
                            )}
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={12} />
                              {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {m.status === 'ACTIVE' ? (
                              <button
                                onClick={() => handleTerminateMeeting(m.id)}
                                className="btn btn-danger"
                                style={{
                                  padding: '5px 10px',
                                  fontSize: '0.75rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                }}
                                title={t.terminateSession}
                              >
                                <PowerOff size={13} />
                                <span>{t.terminateSession}</span>
                              </button>
                            ) : (
                              <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 2. Mobile Responsive Card List View */}
                <div className="mobile-card-list">
                  {meetings.map((m) => (
                    <div key={m.id} className="mobile-data-card">
                      {/* Top: Meeting Code & Status */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="badge badge-code">{m.meetingCode}</span>
                        {m.status === 'ACTIVE' ? (
                          <span className="badge badge-active">
                            <Radio size={12} className="pulsing-dot" /> {t.liveNow}
                          </span>
                        ) : (
                          <span
                            className="badge"
                            style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-dim)' }}
                          >
                            {t.finished}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#ffffff' }}>
                        {m.title}
                      </div>

                      {/* Host & Attendees */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 10px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          borderRadius: 6,
                          fontSize: '0.75rem',
                        }}
                      >
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>{m.host?.displayName || '-'}</div>
                          <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>{m.host?.email || '-'}</div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--accent-cyan)' }}>
                          <Users size={14} />
                          <strong>{m._count?.participants ?? 1}</strong>
                        </div>
                      </div>

                      {/* Start time */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        <Clock size={12} />
                        <span>{m.createdAt ? new Date(m.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}</span>
                      </div>

                      {/* Mobile Terminate Button if Active */}
                      {m.status === 'ACTIVE' && (
                        <div style={{ marginTop: 8 }}>
                          <button
                            onClick={() => handleTerminateMeeting(m.id)}
                            className="btn btn-danger"
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              fontSize: '0.8125rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                            }}
                          >
                            <PowerOff size={14} />
                            <span>{t.terminateSession}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* Tab 3: TRTC Infrastructure Status (Responsive Grid) */}
        {/* ==================================================== */}
        {activeTab === 'trtc' && (
          <div className="trtc-grid">
            <div className="glass-panel" style={{ padding: '24px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Server size={20} color="#ffffff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{t.trtcIntegrationTitle}</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{t.trtcIntegrationSub}</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    padding: 14,
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.6875rem',
                      color: 'var(--text-dim)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    TRTC SDKAppID
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '1.05rem',
                      fontWeight: 600,
                      marginTop: 4,
                      color: 'var(--accent-cyan)',
                    }}
                  >
                    {ENV.TRTC_SDK_APP_ID}
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    padding: 14,
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.6875rem',
                      color: 'var(--text-dim)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Server-Side Secret Key
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8125rem',
                      marginTop: 4,
                      color: 'var(--text-muted)',
                      wordBreak: 'break-all',
                    }}
                  >
                    •••••••••••••••••••••••••••••••• ({t.serverKeyNotice})
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    padding: 14,
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.6875rem',
                      color: 'var(--text-dim)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {t.algoTitle}
                  </div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginTop: 4, color: '#ffffff' }}>
                    HMAC-SHA256 (TLSSigAPIv2)
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Activity size={20} color="#ffffff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{t.healthTitle}</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{t.healthSub}</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    {t.globalAvailability}
                  </span>
                  <strong style={{ color: '#34d399' }}>{dashboardMetrics.activeMeetingsCount}</strong>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    {t.audioProcessing}
                  </span>
                  <strong style={{ color: '#34d399' }}>{dashboardMetrics.liveParticipants > 0 ? t.audioActive : t.audioIdle}</strong>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    {t.videoCodec}
                  </span>
                  <strong style={{ color: 'var(--accent-cyan)' }}>{dashboardMetrics.sdkAppId || '—'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    {t.deepLinkGateway}
                  </span>
                  <strong style={{ color: '#ffffff' }}>cloudmeet://join/*</strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ==================================================== */}
      {/* Modal: Create Real Host Account (Mobile Responsive) */}
      {/* ==================================================== */}
      {showAddHostModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: 460,
              padding: '24px 20px',
              background: '#111827',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Sparkles size={20} color="var(--accent-indigo)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{t.modalTitle}</h3>
              </div>
              <button
                onClick={() => {
                  setShowAddHostModal(false);
                  setModalError(null);
                }}
                className="btn btn-secondary"
                style={{ padding: 6 }}
              >
                <XCircle size={18} />
              </button>
            </div>

            {modalError && (
              <div
                style={{
                  marginBottom: 16,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#fca5a5',
                  fontSize: '0.8125rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertCircle size={15} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateHost}>
              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    marginBottom: 6,
                  }}
                >
                  {t.nameLabel}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t.namePlaceholder}
                  value={newHostName}
                  onChange={(e) => setNewHostName(e.target.value)}
                  className="input-field"
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    marginBottom: 6,
                  }}
                >
                  {t.emailLabel}
                </label>
                <input
                  type="email"
                  required
                  placeholder="zhang.san@company.cn"
                  value={newHostEmail}
                  onChange={(e) => setNewHostEmail(e.target.value)}
                  className="input-field"
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    marginBottom: 6,
                  }}
                >
                  {t.pwdLabel}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••••••"
                  value={newHostPassword}
                  onChange={(e) => setNewHostPassword(e.target.value)}
                  className="input-field"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddHostModal(false);
                    setModalError(null);
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isCreatingHost}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  {isCreatingHost ? (
                    <>
                      <RefreshCw size={14} className="pulsing-dot" />
                      {lang === 'zh' ? '正在开通...' : 'Creating...'}
                    </>
                  ) : (
                    t.submitCreate
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
