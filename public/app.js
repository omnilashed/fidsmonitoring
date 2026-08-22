// Application State
let devices = [];
let logs = [];
let currentFilter = 'ALL';
let currentStatusFilter = 'ALL';
let activeView = 'grid';
let currentTab = 'overview'; // 'overview' | 'FIDS' | 'IP PABX' | 'CCTV' | 'Fire Alarm'
let ws = null;
let statusChart = null;
let isMuted = false;
let offlineAlarmEnabled = true;
let perfPollInterval = null; // Server Performance Metrics polling interval
let ipClusters = []; // IP Clusters list state

// Equipment type group definitions (mutable)
const EQUIPMENT_GROUPS = {
  'FIDS':        ['Server FIDS', 'FIDS'],
  'IP PABX':     ['IP PABX'],
  'CCTV':        ['Server CCTV', 'CCTV'],
  'Fire Alarm':  ['Server Fire Alarm System', 'Fire Alarm System']
};

function ipToInt(ipStr) {
  if (!ipStr || typeof ipStr !== 'string') return 0;
  const parts = ipStr.trim().split('.');
  if (parts.length !== 4) return 0;
  return parts.reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

function findMatchingIpCluster(ipStr) {
  if (!ipStr || !ipClusters || !ipClusters.length) return null;
  const targetIpInt = ipToInt(ipStr);
  if (!targetIpInt) return null;

  for (const cluster of ipClusters) {
    const isActive = cluster.is_active === 1 || cluster.is_active === '1' || cluster.is_active === true;
    if (!isActive) continue;
    const startInt = ipToInt(cluster.ip_start);
    const endInt = ipToInt(cluster.ip_end);
    if (startInt && endInt && targetIpInt >= startInt && targetIpInt <= endInt) {
      return cluster;
    }
  }
  return null;
}

function getStandardTabKey(eqType) {
  if (!eqType || typeof eqType !== 'string') return null;
  const s = eqType.toLowerCase().trim();
  if (s.includes('fids')) return 'FIDS';
  if (s.includes('cctv')) return 'CCTV';
  if (s.includes('pabx')) return 'IP PABX';
  if (s.includes('fire') || s.includes('alarm') || s.includes('fas')) return 'Fire Alarm';
  return null;
}

function updateEquipmentGroupsFromClusters() {
  // Reset standard groups
  EQUIPMENT_GROUPS['FIDS'] = ['Server FIDS', 'FIDS'];
  EQUIPMENT_GROUPS['IP PABX'] = ['IP PABX'];
  EQUIPMENT_GROUPS['CCTV'] = ['Server CCTV', 'CCTV'];
  EQUIPMENT_GROUPS['Fire Alarm'] = ['Server Fire Alarm System', 'Fire Alarm System'];

  // Remove any stale dynamic keys matching standard tab categories
  Object.keys(EQUIPMENT_GROUPS).forEach(k => {
    if (!['FIDS', 'IP PABX', 'CCTV', 'Fire Alarm'].includes(k) && getStandardTabKey(k)) {
      delete EQUIPMENT_GROUPS[k];
    }
  });

  const processEqType = (eqType) => {
    if (!eqType) return;
    const stdKey = getStandardTabKey(eqType);
    if (stdKey) {
      if (!EQUIPMENT_GROUPS[stdKey].includes(eqType)) {
        EQUIPMENT_GROUPS[stdKey].push(eqType);
      }
    } else {
      if (!EQUIPMENT_GROUPS[eqType]) {
        EQUIPMENT_GROUPS[eqType] = [eqType];
      }
    }
  };

  if (ipClusters) {
    ipClusters.forEach(cl => processEqType(cl.equipment_type));
  }

  if (devices) {
    devices.forEach(d => processEqType(d.equipment_type));
  }

  renderDynamicNavTabs();
  updateFormEquipmentTypes();
}

function renderDynamicNavTabs() {
  const container = document.getElementById('nav-tabs-container');
  if (!container) return;

  const defaultTabs = [
    { key: 'overview', name: 'All Systems Overview', icon: 'fa-chart-pie', color: '#38bdf8' },
    { key: 'FIDS', name: 'FIDS Monitors', icon: 'fa-tv', color: '#3b82f6' },
    { key: 'IP PABX', name: 'PABX Telephony', icon: 'fa-phone-volume', color: '#a855f7' },
    { key: 'CCTV', name: 'CCTV Surveillance', icon: 'fa-video', color: '#06b6d4' },
    { key: 'Fire Alarm', name: 'Fire Alarm Systems', icon: 'fa-fire-extinguisher', color: '#ef4444' }
  ];

  const customTabKeys = Object.keys(EQUIPMENT_GROUPS).filter(k => !['FIDS', 'IP PABX', 'CCTV', 'Fire Alarm'].includes(k));

  let html = defaultTabs.map(t => {
    const activeClass = currentTab === t.key ? 'active' : '';
    const styleStr = currentTab === t.key 
      ? 'background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1);' 
      : 'background: transparent; color: var(--text-muted); border: 1px solid transparent;';
    return `<button class="nav-tab ${activeClass}" data-tab="${t.key}" onclick="switchDashboardTab('${t.key}')" style="${styleStr} padding: 8px 16px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13px; transition: all 0.2s;"><i class="fa-solid ${t.icon}" style="color: ${t.color};"></i> ${t.name}</button>`;
  }).join('');

  customTabKeys.forEach(key => {
    const activeClass = currentTab === key ? 'active' : '';
    const styleStr = currentTab === key 
      ? 'background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3);' 
      : 'background: transparent; color: var(--text-muted); border: 1px solid transparent;';
    html += `<button class="nav-tab ${activeClass}" data-tab="${key}" onclick="switchDashboardTab('${key}')" style="${styleStr} padding: 8px 16px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13px; transition: all 0.2s;"><i class="fa-solid fa-network-wired" style="color: #a855f7;"></i> ${key}</button>`;
  });

  const sysTabs = [
    { key: 'Ping Manager', name: 'Ping Manager', icon: 'fa-gears', color: '#f59e0b' },
    { key: 'Analytics', name: 'Analytics & Uptime', icon: 'fa-chart-line', color: '#ec4899' }
  ];

  sysTabs.forEach(t => {
    const activeClass = currentTab === t.key ? 'active' : '';
    const styleStr = currentTab === t.key 
      ? 'background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1);' 
      : 'background: transparent; color: var(--text-muted); border: 1px solid transparent;';
    html += `<button class="nav-tab ${activeClass}" data-tab="${t.key}" onclick="switchDashboardTab('${t.key}')" style="${styleStr} padding: 8px 16px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13px; transition: all 0.2s;"><i class="fa-solid ${t.icon}" style="color: ${t.color};"></i> ${t.name}</button>`;
  });

  container.innerHTML = html;
}

function updateFormEquipmentTypes() {
  const selectEl = document.getElementById('device-equipment-type');
  const dataListEl = document.getElementById('equipment-type-datalist');
  if (!selectEl) return;

  const typeSet = new Set([
    'Server FIDS', 'FIDS', 'IP PABX', 'Server CCTV', 'CCTV', 'Server Fire Alarm System', 'Fire Alarm System'
  ]);

  if (ipClusters) {
    ipClusters.forEach(cl => { if (cl.equipment_type) typeSet.add(cl.equipment_type); });
  }

  const currentVal = selectEl.value;
  selectEl.innerHTML = Array.from(typeSet).map(t => `<option value="${t}">${t}</option>`).join('');
  if (currentVal && typeSet.has(currentVal)) {
    selectEl.value = currentVal;
  }

  if (dataListEl) {
    dataListEl.innerHTML = Array.from(typeSet).map(t => `<option value="${t}">`).join('');
  }
}

// Terminal zone display names (T1 / T2 / T3 → human-readable label)
const TERMINAL_NAMES = {
  'T1': 'Terminal 1',
  'T2': 'Perkantoran Bandara',
  'T3': 'Luar Gedung Terminal'
};
function terminalLabel(code) {
  return TERMINAL_NAMES[code] || code;
}

// Pagination State Variables
let gridCurrentPage = 1;
const gridItemsPerPage = 6;
let tableCurrentPage = 1;
const tableItemsPerPage = 10;

let allLogsCurrentPage = 1;
const allLogsItemsPerPage = 10;

// Web Audio API Synth Alert Helper
let audioCtx = null;
function playAlertSound(type) {
  if (isMuted) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    if (type === 'critical') {
      // Low dual-tone warning siren
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.4);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === 'warning') {
      // Double high-pitch blip
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.setValueAtTime(0.01, now + 0.1);
      
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1200, now + 0.15);
      gain2.gain.setValueAtTime(0.15, now + 0.15);
      gain2.gain.setValueAtTime(0.01, now + 0.25);
      
      osc.start(now);
      osc.stop(now + 0.12);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.27);
    } else if (type === 'info') {
      // Positive soft chime
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.3); // G5
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  } catch (err) {
    console.error('Audio synthesis failed:', err);
  }
}

// Initialize Application UI
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme') || 'dark-mode';
  applyTheme(savedTheme);
  setupClock();
  setupEventListeners();
  initWebSocket();
  initChart();
  setupAdminEvents();
  updateAuthUI();
  // Start server performance polling immediately — Overview tab is active on load
  startPerformanceMonitorPolling();
});

// Setup Clock Updates
function setupClock() {
  const clockEl = document.getElementById('live-time');
  setInterval(() => {
    const d = new Date();
    clockEl.textContent = d.toLocaleTimeString('id-ID');
  }, 1000);
}

// Setup Page Interactivity Events
function setupEventListeners() {
  // Mute Audio Alert Button
  const muteBtn = document.getElementById('mute-alert-btn');
  muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    const icon = muteBtn.querySelector('i');
    if (isMuted) {
      icon.className = 'fa-solid fa-volume-xmark';
      muteBtn.style.color = '#ef4444';
    } else {
      icon.className = 'fa-solid fa-volume-high';
      muteBtn.style.color = '';
    }
  });

  // Switch View Panel
  document.getElementById('btn-grid-mode').addEventListener('click', (e) => {
    setViewMode('grid');
  });
  document.getElementById('btn-map-mode').addEventListener('click', (e) => {
    setViewMode('map');
  });

  // Terminal Filter buttons
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.getAttribute('data-terminal');
      // Reset pagination on filter change
      gridCurrentPage = 1;
      tableCurrentPage = 1;
      renderDashboard();
    });
  });

  // Table Search Input
  document.getElementById('table-search').addEventListener('input', () => {
    // Reset table page on typing search query
    tableCurrentPage = 1;
    renderTable();
  });



  // Close Ping Modal Listener
  document.getElementById('close-ping-btn').addEventListener('click', () => {
    document.getElementById('ping-modal').classList.remove('active');
  });

  // Close Device Logs Modal Listener
  document.getElementById('close-device-logs-btn').addEventListener('click', () => {
    document.getElementById('device-logs-modal').classList.remove('active');
  });

  // Theme Toggle Listener
  document.getElementById('theme-toggle-btn').addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark-mode');
    const newTheme = isDark ? 'light-mode' : 'dark-mode';
    applyTheme(newTheme);
  });

  // Open All Logs Modal Listener
  document.getElementById('open-all-logs-btn').addEventListener('click', () => {
    document.getElementById('all-logs-modal').classList.add('active');
    allLogsCurrentPage = 1;
    fetchAllLogs();
  });

  // Close All Logs Modal Listener
  document.getElementById('close-all-logs-btn').addEventListener('click', () => {
    document.getElementById('all-logs-modal').classList.remove('active');
  });

  // Close CCTV View Modal Listener
  document.getElementById('close-cctv-view-btn').addEventListener('click', () => {
    closeCctvModal();
  });

  // Close Login Modal Listener
  document.getElementById('close-login-btn').addEventListener('click', () => {
    document.getElementById('login-modal').classList.remove('active');
    document.getElementById('login-error-msg').style.display = 'none';
  });
}

// WebSocket Connection Setup
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  ws = new WebSocket(wsUrl);
  const statusPill = document.getElementById('ws-status');

  ws.onopen = () => {
    statusPill.className = 'connection-pill active';
    statusPill.innerHTML = '<span class="pulse-dot"></span> Connected';
  };

  ws.onclose = () => {
    statusPill.className = 'connection-pill disconnected';
    statusPill.innerHTML = '<span class="pulse-dot"></span> Disconnected';
    // Retry connection after 5 seconds
    setTimeout(initWebSocket, 5000);
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'INIT_DATA') {
      devices = data.devices;
      logs = data.logs.slice(0, 30);
      if (data.config) {
        if (data.config.offlineAlarmEnabled !== undefined) {
          offlineAlarmEnabled = data.config.offlineAlarmEnabled === true || data.config.offlineAlarmEnabled === 'true';
        }
      }
      
      // Update Database Status Pill
      const dbPill = document.getElementById('db-status-pill');
      if (dbPill && data.dbStatus) {
        dbPill.style.display = 'flex';
        if (data.dbStatus === 'connecting') {
          dbPill.style.background = 'rgba(245, 158, 11, 0.15)';
          dbPill.style.color = '#fbbf24';
          dbPill.style.borderColor = 'rgba(245, 158, 11, 0.25)';
          dbPill.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Database: Loading Cache';
        } else if (data.dbStatus === 'connected') {
          dbPill.style.background = 'rgba(16, 185, 129, 0.15)';
          dbPill.style.color = '#10b981';
          dbPill.style.borderColor = 'rgba(16, 185, 129, 0.25)';
          dbPill.innerHTML = '<i class="fa-solid fa-database"></i> Database: MySQL Connected';
          // Automatically hide after 5 seconds of success
          setTimeout(() => {
            if (dbPill.innerHTML.includes('MySQL Connected')) {
              dbPill.style.display = 'none';
            }
          }, 5000);
        } else if (data.dbStatus === 'fallback') {
          dbPill.style.background = 'rgba(56, 189, 248, 0.15)';
          dbPill.style.color = '#38bdf8';
          dbPill.style.borderColor = 'rgba(56, 189, 248, 0.25)';
          dbPill.innerHTML = '<i class="fa-solid fa-file-code"></i> Database: Local JSON DB';
        }
      }

      if (data.clusters) {
        ipClusters = data.clusters;
        updateEquipmentGroupsFromClusters();
        renderIpClustersTable();
      }

      renderDashboard();
      if (document.getElementById('admin-modal').classList.contains('active')) {
        renderAdminDevices();
      }
    } else if (data.type === 'IP_CLUSTERS_UPDATED') {
      ipClusters = data.clusters || [];
      updateEquipmentGroupsFromClusters();
      renderIpClustersTable();
      renderDashboard();
    } else if (data.type === 'CONFIG_UPDATED') {
      if (data.config.offlineAlarmEnabled !== undefined) {
        offlineAlarmEnabled = data.config.offlineAlarmEnabled === true || data.config.offlineAlarmEnabled === 'true';
      }
    } else if (data.type === 'DEVICE_CREATED') {
      devices.push(data.device);
      renderDashboard();
      if (document.getElementById('admin-modal').classList.contains('active')) {
        renderAdminDevices();
      }
    } else if (data.type === 'DEVICE_UPDATED') {
      const idx = devices.findIndex(d => d.id === data.device.id);
      if (idx !== -1) {
        const oldDevice = devices[idx];
        devices[idx] = data.device;
        
        // Trigger alerts on specific status changes
        if (oldDevice.status !== data.device.status) {
          if (data.device.status === 'Offline') {
            if (offlineAlarmEnabled) {
              playAlertSound('critical');
              showToastBanner(data.device, 'critical');
            }
          } else if (data.device.status === 'Anomaly') {
            playAlertSound('warning');
            showToastBanner(data.device, 'warning');
          } else if (data.device.status === 'Online') {
            if (offlineAlarmEnabled) {
              playAlertSound('info');
            }
          }
        }
      } else {
        devices.push(data.device);
      }
      renderDashboard();
      if (document.getElementById('admin-modal').classList.contains('active')) {
        renderAdminDevices();
      }
    } else if (data.type === 'DEVICE_DELETED') {
      devices = devices.filter(d => d.id !== data.deviceId);
      renderDashboard();
      if (document.getElementById('admin-modal').classList.contains('active')) {
        renderAdminDevices();
      }
    } else if (data.type === 'NEW_LOG') {
      logs.unshift(data.log);
      if (logs.length > 30) logs.pop();
      renderLogs();
    }
  };
}

// Toast popup alerts inside Operator Screen
function showToastBanner(device, severity) {
  const container = document.getElementById('alert-banner-container');
  const alertEl = document.createElement('div');
  alertEl.className = `alert-banner glass ${severity}`;
  
  const icon = severity === 'critical' ? 'fa-circle-xmark text-red' : 'fa-triangle-exclamation text-yellow';
  const label = severity === 'critical' ? 'CRITICAL DEVICE OFFLINE' : 'WARNING ANOMALY DETECTED';
  const message = severity === 'critical' 
    ? `${device.name} (${device.ip_address}) is unreachable on ${device.location}.`
    : `${device.name} detected an anomaly: "${device.anomaly_type || 'Unspecified anomaly'}".`;

  alertEl.innerHTML = `
    <div class="alert-content">
      <i class="fa-solid ${icon} fa-xl"></i>
      <div>
        <strong style="display:block; font-size: 11px; letter-spacing: 0.5px;">${label}</strong>
        <span>${message}</span>
      </div>
    </div>
    <button class="alert-close"><i class="fa-solid fa-xmark"></i></button>
  `;
  
  alertEl.querySelector('.alert-close').addEventListener('click', () => {
    alertEl.remove();
  });
  
  container.appendChild(alertEl);
  
  // Auto remove after 10 seconds
  setTimeout(() => {
    if (alertEl.parentElement) alertEl.remove();
  }, 10000);
}

// Toggle View (Grid vs Map Mode)
function setViewMode(mode) {
  activeView = mode;
  document.getElementById('btn-grid-mode').className = `toggle-btn ${mode === 'grid' ? 'active' : ''}`;
  document.getElementById('btn-map-mode').className = `toggle-btn ${mode === 'map' ? 'active' : ''}`;
  
  document.getElementById('fids-grid-view').className = `view-panel ${mode === 'grid' ? 'active' : ''}`;
  document.getElementById('fids-map-view').className = `view-panel ${mode === 'map' ? 'active' : ''}`;
}

// Render everything
function renderDashboard() {
  updateSummaryMetrics();
  renderGrid();
  renderMap();
  renderLogs();
  renderTable();
  updateChartData();
}

// Update Top level statistics counters (filters to current tab context)
function updateSummaryMetrics() {
  // Filter to devices in the current tab's equipment group
  const tabDevices = currentTab === 'overview'
    ? devices
    : devices.filter(d => (EQUIPMENT_GROUPS[currentTab] || []).includes(d.equipment_type));

  const total   = tabDevices.length;
  const online  = tabDevices.filter(d => d.status === 'Online').length;
  const offline = tabDevices.filter(d => d.status === 'Offline').length;
  const anomaly = tabDevices.filter(d => d.status === 'Anomaly').length;

  document.getElementById('total-fids').textContent  = total;
  document.getElementById('online-fids').textContent  = online;
  document.getElementById('offline-fids').textContent = offline;
  document.getElementById('anomaly-fids').textContent = anomaly;

  // Dynamic Total Displays title matching active tab
  const totalCardTitle = document.getElementById('total-fids-card-title');
  if (totalCardTitle) {
    if (currentTab === 'overview') {
      totalCardTitle.textContent = 'Total Devices';
    } else if (currentTab === 'FIDS') {
      totalCardTitle.textContent = 'Total FIDS Displays';
    } else if (currentTab === 'IP PABX') {
      totalCardTitle.textContent = 'Total IP PABX Devices';
    } else if (currentTab === 'CCTV') {
      totalCardTitle.textContent = 'Total CCTV Devices';
    } else if (currentTab === 'Fire Alarm') {
      totalCardTitle.textContent = 'Total Fire Alarm Devices';
    } else {
      totalCardTitle.textContent = `Total ${currentTab} Devices`;
    }
  }

  document.getElementById('online-pct').textContent  = total > 0 ? `${Math.round((online / total) * 100)}% Online` : '0% Online';
  document.getElementById('offline-pct').textContent = total > 0 ? `${Math.round((offline / total) * 100)}% Down` : '0% Down';

  // Average uptime for the filtered set
  if (total > 0) {
    const sumUptime = tabDevices.reduce((sum, d) => sum + parseFloat(d.uptime_pct || 0), 0);
    document.getElementById('avg-uptime').textContent = `${(sumUptime / total).toFixed(2)}%`;
  } else {
    document.getElementById('avg-uptime').textContent = '100.00%';
  }

  // Always update the overview panel widgets
  updateOverviewMetrics();
}

// Build per-system stats for the Overview tab
function updateOverviewMetrics() {
  const groups = [
    { key: 'fids',       types: ['FIDS'],                                               color: '#3b82f6' },
    { key: 'pabx',       types: ['IP PABX'],                                            color: '#a855f7' },
    { key: 'cctv',       types: ['Server CCTV', 'CCTV'],                               color: '#06b6d4' },
    { key: 'firealarm',  types: ['Server Fire Alarm System', 'Fire Alarm System'],     color: '#ef4444' }
  ];

  let globalOnline = 0, globalTotal = 0, globalAnomaly = 0, globalUptimeSum = 0;

  groups.forEach(g => {
    const grpDevices = devices.filter(d => g.types.includes(d.equipment_type));
    const total   = grpDevices.length;
    const online  = grpDevices.filter(d => d.status === 'Online').length;
    const offline = grpDevices.filter(d => d.status === 'Offline').length;
    const anomaly = grpDevices.filter(d => d.status === 'Anomaly').length;
    const uptimeSum = grpDevices.reduce((s, d) => s + parseFloat(d.uptime_pct || 100), 0);
    const sla     = total > 0 ? (uptimeSum / total).toFixed(1) : '100.0';
    const slaPct  = parseFloat(sla);

    const safeGet = id => document.getElementById(id);

    if (safeGet(`overview-total-${g.key}`))   safeGet(`overview-total-${g.key}`).textContent   = total;
    if (safeGet(`overview-online-${g.key}`))  safeGet(`overview-online-${g.key}`).textContent  = online;
    if (safeGet(`overview-offline-${g.key}`)) safeGet(`overview-offline-${g.key}`).textContent = offline;
    if (safeGet(`overview-sla-${g.key}`))     safeGet(`overview-sla-${g.key}`).textContent     = `${sla}%`;
    if (safeGet(`overview-progress-${g.key}`)) {
      safeGet(`overview-progress-${g.key}`).style.width      = `${slaPct}%`;
      safeGet(`overview-progress-${g.key}`).style.background = g.color;
    }
    // Status tag
    const tagEl = safeGet(`overview-status-${g.key}`);
    if (tagEl) {
      const hasOffline = offline > 0 || anomaly > 0;
      tagEl.textContent = hasOffline ? (anomaly > 0 ? 'ANOMALY' : 'DEGRADED') : 'ONLINE';
      tagEl.className = `system-tag${hasOffline ? ' offline' : ''}`;
    }

    globalTotal     += total;
    globalOnline    += online;
    globalAnomaly   += anomaly;
    globalUptimeSum += uptimeSum;
  });

  // Global health radial dial
  const globalSla = globalTotal > 0 ? ((globalUptimeSum / globalTotal)).toFixed(1) : '100.0';
  const slaPctG   = parseFloat(globalSla);
  const dialEl    = document.getElementById('global-health-radial');
  const valEl     = document.getElementById('global-health-val');
  const ratioEl   = document.getElementById('global-stats-ratio');
  const anomEl    = document.getElementById('global-stats-anomalies');

  if (dialEl) {
    const dialColor = slaPctG >= 98 ? '#10b981' : slaPctG >= 90 ? '#fbbf24' : '#ef4444';
    dialEl.style.background = `radial-gradient(closest-side, var(--glass-bg) 79%, transparent 80% 100%), conic-gradient(${dialColor} ${slaPctG}%, rgba(255,255,255,0.05) 0%)`;
    dialEl.style.boxShadow  = `0 0 20px ${dialColor}22`;
  }
  if (valEl)   valEl.textContent  = `${globalSla}%`;
  if (ratioEl) ratioEl.textContent = `${globalOnline}/${globalTotal} Active Nodes`;
  if (anomEl)  anomEl.textContent  = `${globalAnomaly} Active Anomalies`;

  // Overview incident log (most recent offline / anomaly events)
  renderOverviewLogs();
  renderPriorityIncidents();
}

// Render overview recent critical incidents log panel
function renderOverviewLogs() {
  const container = document.getElementById('overview-recent-logs');
  if (!container) return;
  const criticalLogs = logs.filter(l => l.status === 'Offline' || l.status === 'Anomaly').slice(0, 8);
  if (criticalLogs.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 20px; color:var(--text-muted); font-size: 12px;"><i class="fa-solid fa-shield-check text-green"></i> No critical incidents detected</div>`;
    return;
  }
  container.innerHTML = '';
  criticalLogs.forEach(log => {
    const item = document.createElement('div');
    item.className = `log-item ${log.status.toLowerCase()}`;
    const formattedTime = new Date(log.timestamp).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
    item.innerHTML = `
      <div class="log-icon"><i class="fa-solid ${log.status === 'Offline' ? 'fa-circle-xmark text-red' : 'fa-triangle-exclamation text-yellow'}"></i></div>
      <div class="log-content">
        <div class="log-time" style="font-size: 9px; opacity: 0.7;">${formattedTime}</div>
        <div class="log-body">
          <div class="log-tag ${log.status.toLowerCase()}" style="font-size: 9px;">${log.status}</div>
          <div class="log-desc" style="font-size: 11px;">${log.message}</div>
        </div>
      </div>`;
    container.appendChild(item);
  });
}

// Tab switching — show/hide relevant panel sections
function switchDashboardTab(tab) {
  currentTab = tab;

  // Update nav tab button styles
  document.querySelectorAll('.nav-tab').forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle('active', isActive);
    btn.style.background = isActive ? 'rgba(255,255,255,0.05)' : 'transparent';
    btn.style.color      = isActive ? '#fff' : 'var(--text-muted)';
    btn.style.borderColor = isActive ? 'rgba(255,255,255,0.1)' : 'transparent';
  });

  const overviewEl = document.getElementById('overview-tab-content');
  const detailEl   = document.getElementById('system-detail-tab-content');
  const pingMgrEl  = document.getElementById('ping-manager-tab-content');
  const analyticsEl = document.getElementById('analytics-tab-content');

  // Hide all panels initially
  overviewEl.style.display = 'none';
  detailEl.style.display   = 'none';
  pingMgrEl.style.display  = 'none';
  if (analyticsEl) analyticsEl.style.display = 'none';

  // Stop polling metrics
  stopPerformanceMonitorPolling();

  if (tab === 'overview') {
    overviewEl.style.display = 'block';
    startPerformanceMonitorPolling();
    updateOverviewMetrics();
    renderPriorityIncidents();
  } else if (tab === 'Ping Manager') {
    pingMgrEl.style.display = 'block';
    startPerformanceMonitorPolling();
    fetchSchedulerConfig();
    renderBatchesVisualizer();
  } else if (tab === 'Analytics') {
    if (analyticsEl) {
      analyticsEl.style.display = 'block';
      setTimeout(() => { initializeAnalyticsTab(); }, 50);
    }
  } else {
    detailEl.style.display   = 'block';
    // Reset page on tab switch
    gridCurrentPage  = 1;
    tableCurrentPage = 1;
    renderDashboard();
  }
}
window.switchDashboardTab = switchDashboardTab;

// Render grid display panel
function renderGrid() {
  const container = document.getElementById('fids-grid');
  container.innerHTML = '';
  
  // Filter by terminal AND the active tab's equipment group AND status filter
  const tabTypes = currentTab !== 'overview' ? (EQUIPMENT_GROUPS[currentTab] || null) : null;
  const filtered = devices.filter(d => {
    const matchTerminal  = currentFilter === 'ALL' || d.terminal === currentFilter;
    const matchEquipment = !tabTypes || tabTypes.includes(d.equipment_type);
    
    let matchStatus = true;
    const isSusp = isDeviceSuspended(d) || (d.health_status_detail && d.health_status_detail.startsWith('Suspended'));
    if (currentStatusFilter === 'Online') {
      matchStatus = d.status === 'Online';
    } else if (currentStatusFilter === 'Offline') {
      matchStatus = d.status === 'Offline' && !isSusp;
    } else if (currentStatusFilter === 'Anomaly') {
      matchStatus = d.status === 'Anomaly';
    } else if (currentStatusFilter === 'Isolated') {
      matchStatus = d.health_status_detail === 'Isolated (Low Ping)';
    } else if (currentStatusFilter === 'Suspended') {
      matchStatus = isSusp;
    } else if (currentStatusFilter === 'Suspended-Rusak') {
      matchStatus = isSusp && d.health_status_detail && d.health_status_detail.includes('Rusak');
    } else if (currentStatusFilter === 'Suspended-Maintenance') {
      matchStatus = isSusp && d.health_status_detail && d.health_status_detail.includes('Maintenance');
    }

    return matchTerminal && matchEquipment && matchStatus;
  });

  // Sort by latency if selected
  if (currentLatencySort === 'LATENCY_DESC') {
    filtered.sort((a, b) => {
      const latA = (a.status === 'Online' && a.latency_ms !== null) ? parseFloat(a.latency_ms) : -1;
      const latB = (b.status === 'Online' && b.latency_ms !== null) ? parseFloat(b.latency_ms) : -1;
      return latB - latA;
    });
  } else if (currentLatencySort === 'LATENCY_ASC') {
    filtered.sort((a, b) => {
      const latA = (a.status === 'Online' && a.latency_ms !== null) ? parseFloat(a.latency_ms) : 999999;
      const latB = (b.status === 'Online' && b.latency_ms !== null) ? parseFloat(b.latency_ms) : 999999;
      return latA - latB;
    });
  }

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / gridItemsPerPage) || 1;
  
  // Keep current page boundary safe
  if (gridCurrentPage > totalPages) gridCurrentPage = totalPages;
  if (gridCurrentPage < 1) gridCurrentPage = 1;
  
  const startIdx = (gridCurrentPage - 1) * gridItemsPerPage;
  const sliced = filtered.slice(startIdx, startIdx + gridItemsPerPage);
  
  if (filtered.length === 0) {
    container.innerHTML = `<div class="glass" style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-muted);">No devices matching this filter criteria</div>`;
    renderGridPagination(1);
    return;
  }
  
  sliced.forEach(device => {
    const card = document.createElement('div');
    const isUpdating = device._isUpdating === true;
    const suspended = isDeviceSuspended(device);
    let statusLabel = device.status;
    let suspendType = '';

    if (isUpdating) {
      statusLabel = device._updatingMsg || 'Reconnecting...';
    } else if (suspended || (device.health_status_detail && device.health_status_detail.startsWith('Suspended'))) {
      if (device.health_status_detail && device.health_status_detail.includes('Rusak')) {
        suspendType = 'Rusak';
        statusLabel = 'Offline (Suspended - Rusak)';
      } else if (device.health_status_detail && device.health_status_detail.includes('Maintenance')) {
        suspendType = 'Maintenance';
        statusLabel = 'Offline (Suspended - Maintenance)';
      } else {
        suspendType = 'Manual';
        statusLabel = 'Offline (Suspended)';
      }
    } else if (device.health_status_detail === 'Isolated (Low Ping)') {
      suspendType = 'Isolated';
      statusLabel = 'Offline (Isolated - 30m+)';
    } else if (device.status === 'Online' && device.health_status_detail) {
      statusLabel = `Online (${device.health_status_detail})`;
    }

    const isActuallySuspended = !isUpdating && suspendType !== '';
    let cardClass = device.status.toLowerCase();
    if (isUpdating) {
      cardClass = 'updating';
    } else if (isActuallySuspended) {
      if (suspendType === 'Rusak') cardClass = 'suspended-rusak';
      else if (suspendType === 'Maintenance') cardClass = 'suspended-maintenance';
      else if (suspendType === 'Isolated') cardClass = 'isolated';
      else cardClass = 'suspended';
    }

    card.className = `device-card glass ${cardClass}`;
    
    let statusBadge = '';
    if (isUpdating) {
      statusBadge = `<span class="status-indicator updating"><i class="fa-solid fa-spinner fa-spin"></i> ${statusLabel}</span>`;
    } else if (isActuallySuspended) {
      if (suspendType === 'Rusak') {
        statusBadge = `<span class="status-indicator suspended-rusak"><i class="fa-solid fa-triangle-exclamation"></i> ${statusLabel}</span>`;
      } else if (suspendType === 'Maintenance') {
        statusBadge = `<span class="status-indicator suspended-maintenance"><i class="fa-solid fa-screwdriver-wrench"></i> ${statusLabel}</span>`;
      } else if (suspendType === 'Isolated') {
        statusBadge = `<span class="status-indicator isolated"><i class="fa-solid fa-shield-halved"></i> ${statusLabel}</span>`;
      } else {
        statusBadge = `<span class="status-indicator suspended">${statusLabel}</span>`;
      }
    } else if (device.status === 'Anomaly') {
      statusBadge = `<span class="status-indicator anomaly tooltip" data-tooltip="${device.anomaly_type}">${device.status}</span>`;
    } else {
      statusBadge = `<span class="status-indicator ${device.status.toLowerCase()}">${statusLabel}</span>`;
    }
    
    // Action buttons based on status
    let actionBtnHtml = '';
    if (isUpdating) {
      actionBtnHtml = `<button disabled style="opacity: 0.8; cursor: wait; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);"><i class="fa-solid fa-spinner fa-spin"></i> Processing...</button>`;
    } else if (isActuallySuspended) {
      actionBtnHtml = `<button onclick="manuallyReactivateDevice(${device.id})" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.25);"><i class="fa-solid fa-play"></i> Resume</button>`;
    } else if (device.status === 'Anomaly') {
      let mainAction = '';
      if (device.anomaly_type === 'Force Logout') {
        mainAction = `<button class="primary-btn" onclick="triggerDeviceAction(${device.id}, 'force-login')">Force Login</button>`;
      } else {
        mainAction = `<button class="primary-btn" onclick="triggerDeviceAction(${device.id}, 'restart-app')">Restart App</button>`;
      }
      actionBtnHtml = `
        ${mainAction}
        <button onclick="manuallySuspendDevice(${device.id})" style="background: rgba(244, 63, 94, 0.15); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.25);"><i class="fa-solid fa-ban"></i> Suspend</button>
      `;
    } else if (device.status === 'Offline') {
      actionBtnHtml = `
        <button onclick="triggerDeviceAction(${device.id}, 'ping-test')">Ping Test</button>
        <button onclick="manuallySuspendDevice(${device.id})" style="background: rgba(244, 63, 94, 0.15); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.25);"><i class="fa-solid fa-ban"></i> Suspend</button>
      `;
    } else {
      actionBtnHtml = `<button onclick="triggerDeviceAction(${device.id}, 'ping-test')">Ping Test</button>`;
    }
    
    // Conditional operational buttons based on equipment type
    let typeActionsHtml = '';
    if (device.equipment_type === 'FIDS' || device.equipment_type === 'Server FIDS') {
      typeActionsHtml = `<button class="vnc-btn" onclick="openRemoteVnc('${device.ip_address}', '${device.name}')" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8;"><i class="fa-solid fa-desktop"></i> Remote</button>`;
    } else if (device.equipment_type === 'Server CCTV') {
      typeActionsHtml = `
        <button class="vnc-btn" onclick="openRemoteVnc('${device.ip_address}', '${device.name}')" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 4px 8px; font-size:10px;"><i class="fa-solid fa-desktop"></i> VNC</button>
        <button class="rdp-btn" onclick="downloadRdpConfig('${device.ip_address}', '${device.name}')" style="background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 4px 8px; font-size:10px;"><i class="fa-solid fa-network-wired"></i> RDP</button>
      `;
    } else if (device.equipment_type === 'CCTV' || device.equipment_type === 'IP PABX') {
      typeActionsHtml = `<button class="view-btn" onclick="openDeviceWebView('${device.ip_address}', '${device.name}', '${device.equipment_type}')" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b;"><i class="fa-solid fa-eye"></i> View</button>`;
    }

    const latencyVal = !isActuallySuspended && device.status !== 'Offline' && device.latency_ms !== null ? `${device.latency_ms} ms` : '-';
    const latencyColor = isActuallySuspended || device.status === 'Offline' ? 'var(--text-muted)' : (device.latency_ms < 50 ? '#10b981' : (device.latency_ms < 150 ? '#fbbf24' : '#ef4444'));

    card.innerHTML = `
      <div class="card-top">
        <div class="device-title">
          <h4><i class="fa-solid ${isActuallySuspended ? 'fa-screwdriver-wrench' : 'fa-display'} status-icon ${isActuallySuspended ? 'suspended' : device.status.toLowerCase()}"></i> ${device.name}</h4>
          <span class="device-ip">${device.ip_address}</span>
        </div>
        ${statusBadge}
      </div>
      <div class="card-details">
        <div class="detail-item">
          <span class="detail-label">Zona / Terminal</span>
          <span class="detail-val">${terminalLabel(device.terminal)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Latency</span>
          <span class="detail-val" style="color: ${latencyColor}; font-weight: 700;">${latencyVal}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Location</span>
          <span class="detail-val">${device.location}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Uptime</span>
          <span class="detail-val" style="color: ${parseFloat(device.uptime_pct) > 98 ? '#10b981' : '#f87171'}">${device.uptime_pct}%</span>
        </div>
      </div>
      <div class="card-actions">
        ${actionBtnHtml}
        <button onclick="showDeviceLogs(${device.id})"><i class="fa-solid fa-clock-rotate-left"></i> Logs</button>
        ${typeActionsHtml}
      </div>
    `;
    container.appendChild(card);
  });

  renderGridPagination(totalPages);
}

// Generate pagination controls for the Grid view
function renderGridPagination(totalPages) {
  const pagEl = document.getElementById('grid-pagination');
  if (!pagEl) return;
  
  pagEl.innerHTML = `
    <button id="grid-prev-btn" ${gridCurrentPage === 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i> Prev</button>
    <span class="page-num">Page ${gridCurrentPage} of ${totalPages}</span>
    <button id="grid-next-btn" ${gridCurrentPage === totalPages ? 'disabled' : ''}>Next <i class="fa-solid fa-chevron-right"></i></button>
  `;
  
  document.getElementById('grid-prev-btn').addEventListener('click', () => {
    if (gridCurrentPage > 1) {
      gridCurrentPage--;
      renderGrid();
    }
  });
  
  document.getElementById('grid-next-btn').addEventListener('click', () => {
    if (gridCurrentPage < totalPages) {
      gridCurrentPage++;
      renderGrid();
    }
  });
}

// Render dynamic positioning node indicators inside Floorplans
function renderMap() {
  const t1Nodes = document.getElementById('nodes-T1');
  const t2Nodes = document.getElementById('nodes-T2');
  const t3Nodes = document.getElementById('nodes-T3');
  
  t1Nodes.innerHTML = '';
  t2Nodes.innerHTML = '';
  t3Nodes.innerHTML = '';
  
  // Custom mock layout positions for the nodes depending on their IP ending or name for realistic layout
  const mapPositions = {
    '172.23.1.10': { left: '15%', top: '40%' },  // FIDS-T1-Checkin-01 (T1)
    '172.23.1.20': { left: '45%', top: '60%' },  // FIDS-T1-Gate-01A (T1)
    '172.23.1.30': { left: '60%', top: '35%' },  // FIDS-T2-Checkin-05 (T2)
    '172.23.1.60': { left: '25%', top: '50%' },  // FIDS-T2-Gate-02 (T2)
    '172.23.1.100': { left: '20%', top: '30%' }, // FIDS-T3-Checkin-01 (T3)
    '172.23.1.110': { left: '50%', top: '40%' }, // FIDS-T3-Gate-03 (T3)
    '172.23.1.150': { left: '75%', top: '70%' }, // FIDS-T3-Baggage-02 (T3)
    '172.23.1.200': { left: '80%', top: '30%' }, // FIDS-T3-Arrival-Main (T3)
  };
  
  // Only render FIDS devices on the floorplan map
  const fidsDevices = devices.filter(d => d.equipment_type === 'FIDS' || !d.equipment_type);
  fidsDevices.forEach(device => {
    // Determine target terminal container
    let container = null;
    if (device.terminal === 'T1') container = t1Nodes;
    else if (device.terminal === 'T2') container = t2Nodes;
    else if (device.terminal === 'T3') container = t3Nodes;
    
    if (!container) return;
    
    // Assign position
    const pos = mapPositions[device.ip_address] || { left: `${10 + Math.random() * 80}%`, top: `${20 + Math.random() * 60}%` };
    
    const node = document.createElement('div');
    node.className = `map-node ${device.status.toLowerCase()} tooltip`;
    node.style.left = pos.left;
    node.style.top = pos.top;
    node.setAttribute('data-tooltip', `${device.name} (${device.ip_address}) - ${device.status}`);
    
    node.innerHTML = `
      <div class="node-monitor"><i class="fa-solid fa-display"></i></div>
      <div class="node-label">${device.name}</div>
    `;
    
    node.addEventListener('click', () => {
      // Filter main table to this specific device by inserting its name in the search bar
      const searchBox = document.getElementById('table-search');
      searchBox.value = device.name;
      renderTable();
      searchBox.scrollIntoView({ behavior: 'smooth' });
    });
    
    container.appendChild(node);
  });
}

// Render dynamic activity logs on the right column
function renderLogs() {
  const container = document.getElementById('logs-container');
  container.innerHTML = '';
  
  if (logs.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 20px; color:var(--text-muted);">No activity logs recorded.</div>`;
    return;
  }
  
  logs.forEach(log => {
    const item = document.createElement('div');
    item.className = `log-item ${log.status.toLowerCase()}`;
    
    const formattedTime = new Date(log.timestamp).toLocaleTimeString('id-ID');
    
    item.innerHTML = `
      <div class="log-time">${formattedTime}</div>
      <div class="log-body">
        <div class="log-tag ${log.status.toLowerCase()}">${log.name || 'Device'} - ${log.status}</div>
        <div class="log-desc">${log.message}</div>
      </div>
    `;
    container.appendChild(item);
  });
}

// Render table data list
function renderTable() {
  const body = document.getElementById('fids-table-body');
  body.innerHTML = '';
  
  const searchVal = document.getElementById('table-search').value.toLowerCase();
  
  const tabTypes = currentTab !== 'overview' ? (EQUIPMENT_GROUPS[currentTab] || null) : null;
  const filtered = devices.filter(device => {
    const matchesTerminal  = currentFilter === 'ALL' || device.terminal === currentFilter;
    const matchesEquipment = !tabTypes || tabTypes.includes(device.equipment_type);
    const matchesSearch    = device.name.toLowerCase().includes(searchVal)
      || device.ip_address.includes(searchVal)
      || device.location.toLowerCase().includes(searchVal);

    let matchesStatus = true;
    const isSusp = isDeviceSuspended(device) || (device.health_status_detail && device.health_status_detail.startsWith('Suspended'));
    if (currentStatusFilter === 'Online') {
      matchesStatus = device.status === 'Online';
    } else if (currentStatusFilter === 'Offline') {
      matchesStatus = device.status === 'Offline' && !isSusp;
    } else if (currentStatusFilter === 'Anomaly') {
      matchesStatus = device.status === 'Anomaly';
    } else if (currentStatusFilter === 'Isolated') {
      matchesStatus = device.health_status_detail === 'Isolated (Low Ping)';
    } else if (currentStatusFilter === 'Suspended') {
      matchesStatus = isSusp;
    } else if (currentStatusFilter === 'Suspended-Rusak') {
      matchesStatus = isSusp && device.health_status_detail && device.health_status_detail.includes('Rusak');
    } else if (currentStatusFilter === 'Suspended-Maintenance') {
      matchesStatus = isSusp && device.health_status_detail && device.health_status_detail.includes('Maintenance');
    }

    return matchesTerminal && matchesEquipment && matchesSearch && matchesStatus;
  });

  // Sort by latency if selected
  if (currentLatencySort === 'LATENCY_DESC') {
    filtered.sort((a, b) => {
      const latA = (a.status === 'Online' && a.latency_ms !== null) ? parseFloat(a.latency_ms) : -1;
      const latB = (b.status === 'Online' && b.latency_ms !== null) ? parseFloat(b.latency_ms) : -1;
      return latB - latA;
    });
  } else if (currentLatencySort === 'LATENCY_ASC') {
    filtered.sort((a, b) => {
      const latA = (a.status === 'Online' && a.latency_ms !== null) ? parseFloat(a.latency_ms) : 999999;
      const latB = (b.status === 'Online' && b.latency_ms !== null) ? parseFloat(b.latency_ms) : 999999;
      return latA - latB;
    });
  }
  
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / tableItemsPerPage) || 1;
  
  // Keep current page boundary safe
  if (tableCurrentPage > totalPages) tableCurrentPage = totalPages;
  if (tableCurrentPage < 1) tableCurrentPage = 1;
  
  const startIdx = (tableCurrentPage - 1) * tableItemsPerPage;
  const sliced = filtered.slice(startIdx, startIdx + tableItemsPerPage);
  
  if (filtered.length === 0) {
    document.getElementById('table-row-count').textContent = `Showing 0 of 0 devices`;
    body.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:30px; color: var(--text-muted);">No matching devices found in inventory.</td></tr>`;
    renderTablePagination(1);
    return;
  }
  
  document.getElementById('table-row-count').textContent = `Showing ${startIdx + 1}-${Math.min(startIdx + tableItemsPerPage, totalItems)} of ${totalItems} devices`;
  
  sliced.forEach(device => {
    const row = document.createElement('tr');
    
    const isUpdating = device._isUpdating === true;
    const suspended = isDeviceSuspended(device);
    let statusLabel = 'Online';
    let suspendType = '';

    if (isUpdating) {
      statusLabel = device._updatingMsg || 'Reconnecting...';
    } else if (suspended || (device.health_status_detail && device.health_status_detail.startsWith('Suspended'))) {
      if (device.health_status_detail && device.health_status_detail.includes('Rusak')) {
        suspendType = 'Rusak';
        statusLabel = 'Offline (Suspended - Rusak)';
      } else if (device.health_status_detail && device.health_status_detail.includes('Maintenance')) {
        suspendType = 'Maintenance';
        statusLabel = 'Offline (Suspended - Maintenance)';
      } else {
        suspendType = 'Manual';
        statusLabel = 'Offline (Suspended)';
      }
    } else if (device.health_status_detail === 'Isolated (Low Ping)') {
      suspendType = 'Isolated';
      statusLabel = 'Offline (Isolated - 30m+)';
    } else if (device.health_status_detail) {
      statusLabel = `Online (${device.health_status_detail})`;
    }

    const isActuallySuspended = !isUpdating && suspendType !== '';
    
    let statusText = `<span class="text-green"><i class="fa-solid fa-display"></i> ${statusLabel}</span>`;
    if (isUpdating) {
      statusText = `<span style="color: #38bdf8;"><i class="fa-solid fa-spinner fa-spin"></i> ${statusLabel}</span>`;
    } else if (isActuallySuspended) {
      if (suspendType === 'Rusak') {
        statusText = `<span style="color: #f87171;"><i class="fa-solid fa-triangle-exclamation"></i> Offline (Suspended - Rusak)</span>`;
      } else if (suspendType === 'Maintenance') {
        statusText = `<span style="color: #fbbf24;"><i class="fa-solid fa-screwdriver-wrench"></i> Offline (Suspended - Maintenance)</span>`;
      } else if (suspendType === 'Isolated') {
        statusText = `<span style="color: #c084fc;"><i class="fa-solid fa-shield-halved"></i> Offline (Isolated - 30m+)</span>`;
      } else {
        statusText = `<span style="color: #9ca3af;"><i class="fa-solid fa-ban"></i> Offline (Suspended)</span>`;
      }
    } else if (device.status === 'Offline') {
      statusText = `<span class="text-red"><i class="fa-solid fa-display"></i> Offline</span>`;
    } else if (device.status === 'Anomaly') {
      statusText = `<span class="text-yellow"><i class="fa-solid fa-display"></i> Anomaly</span>`;
    }
    
    // Anomaly column text details
    const anomalyDetails = !isActuallySuspended && !isUpdating && device.anomaly_type 
      ? `<span class="table-tag text-yellow">${device.anomaly_type}</span>` 
      : '<span style="color:var(--text-muted);">-</span>';
    
    // Operations buttons
    let actionsHtml = '';
    if (isUpdating) {
      actionsHtml = `<button disabled style="opacity: 0.8; cursor: wait; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);"><i class="fa-solid fa-spinner fa-spin"></i> Processing...</button>`;
    } else if (isActuallySuspended) {
      actionsHtml = `<button onclick="manuallyReactivateDevice(${device.id})" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.25);"><i class="fa-solid fa-play"></i> Resume</button>`;
    } else if (device.status === 'Anomaly') {
      let mainAction = '';
      if (device.anomaly_type === 'Force Logout') {
        mainAction = `
          <button class="login-btn" onclick="triggerDeviceAction(${device.id}, 'force-login')"><i class="fa-solid fa-right-to-bracket"></i> Force Login</button>
          <button class="restart-btn" onclick="triggerDeviceAction(${device.id}, 'restart-app')"><i class="fa-solid fa-arrows-rotate"></i> Restart App</button>
        `;
      } else {
        mainAction = `<button class="restart-btn" onclick="triggerDeviceAction(${device.id}, 'restart-app')"><i class="fa-solid fa-arrows-rotate"></i> Restart App</button>`;
      }
      actionsHtml = `
        ${mainAction}
        <button onclick="manuallySuspendDevice(${device.id})" style="background: rgba(244, 63, 94, 0.15); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.25);"><i class="fa-solid fa-ban"></i> Suspend</button>
      `;
    } else if (device.status === 'Offline') {
      actionsHtml = `
        <button onclick="triggerDeviceAction(${device.id}, 'ping-test')"><i class="fa-solid fa-terminal"></i> Ping Test</button>
        <button onclick="manuallySuspendDevice(${device.id})" style="background: rgba(244, 63, 94, 0.15); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.25);"><i class="fa-solid fa-ban"></i> Suspend</button>
      `;
    } else {
      actionsHtml = `<button onclick="triggerDeviceAction(${device.id}, 'ping-test')"><i class="fa-solid fa-terminal"></i> Ping Test</button>`;
    }
    
    // Add Logs button to all rows
    actionsHtml += `<button onclick="showDeviceLogs(${device.id})" style="background: rgba(167, 139, 250, 0.15); color: #c084fc;"><i class="fa-solid fa-clock-rotate-left"></i> Logs</button>`;
    
    // Add specific VNC/RDP/Open View buttons based on equipment type
    if (device.equipment_type === 'FIDS' || device.equipment_type === 'Server FIDS') {
      actionsHtml += `<button class="vnc-btn" onclick="openRemoteVnc('${device.ip_address}', '${device.name}')" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8;"><i class="fa-solid fa-desktop"></i> Remote PC</button>`;
    } else if (device.equipment_type === 'Server CCTV') {
      actionsHtml += `
        <button class="vnc-btn" onclick="openRemoteVnc('${device.ip_address}', '${device.name}')" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8;"><i class="fa-solid fa-desktop"></i> Remote VNC</button>
        <button class="rdp-btn" onclick="downloadRdpConfig('${device.ip_address}', '${device.name}')" style="background: rgba(16, 185, 129, 0.15); color: #34d399;"><i class="fa-solid fa-network-wired"></i> Remote RDP</button>
      `;
    } else if (device.equipment_type === 'CCTV' || device.equipment_type === 'IP PABX') {
      actionsHtml += `<button class="view-btn" onclick="openDeviceWebView('${device.ip_address}', '${device.name}', '${device.equipment_type}')" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b;"><i class="fa-solid fa-eye"></i> Open View</button>`;
    }
    
    // Equipment type badge
    const typeIcons = {
      'Server FIDS':             { icon: 'fa-server',            color: '#3b82f6' },
      'FIDS':                    { icon: 'fa-tv',               color: '#3b82f6' },
      'IP PABX':                 { icon: 'fa-phone-volume',      color: '#a855f7' },
      'Server CCTV':             { icon: 'fa-server',            color: '#06b6d4' },
      'CCTV':                    { icon: 'fa-video',             color: '#06b6d4' },
      'Server Fire Alarm System':{ icon: 'fa-server',            color: '#ef4444' },
      'Fire Alarm System':       { icon: 'fa-fire-extinguisher', color: '#ef4444' }
    };
    const typeInfo = typeIcons[device.equipment_type] || { icon: 'fa-microchip', color: '#94a3b8' };
    const typeBadge = `<span style="font-size:10px; color:${typeInfo.color};"><i class="fa-solid ${typeInfo.icon}"></i> ${device.equipment_type || 'FIDS'}</span>`;

    const latencyVal = !isActuallySuspended && device.status !== 'Offline' && device.latency_ms !== null ? `${device.latency_ms} ms` : '-';
    const latencyColor = isActuallySuspended || device.status === 'Offline' ? 'var(--text-muted)' : (device.latency_ms < 50 ? '#10b981' : (device.latency_ms < 150 ? '#fbbf24' : '#ef4444'));
    const latencyBadge = `<span style="font-weight:600; color:${latencyColor};">${latencyVal}</span>`;

    row.innerHTML = `
      <td>${statusText}</td>
      <td class="table-ip">${device.ip_address}</td>
      <td>${latencyBadge}</td>
      <td><strong>${device.name}</strong></td>
      <td>${typeBadge}</td>
      <td><span class="table-tag" style="white-space:nowrap;">${terminalLabel(device.terminal)}</span></td>
      <td>${device.location}</td>
      <td>${device.downtime_count} times</td>
      <td>${device.failed_access_count} times</td>
      <td>${anomalyDetails}</td>
      <td style="text-align: right;">
        <div class="table-action-btns">
          ${actionsHtml}
        </div>
      </td>
    `;
    body.appendChild(row);
  });

  renderTablePagination(totalPages);
}

// Generate pagination controls for the Inventories Table
function renderTablePagination(totalPages) {
  const pagEl = document.getElementById('table-pagination');
  if (!pagEl) return;
  
  pagEl.innerHTML = `
    <button id="table-prev-btn" ${tableCurrentPage === 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i> Prev</button>
    <span class="page-num">Page ${tableCurrentPage} of ${totalPages}</span>
    <button id="table-next-btn" ${tableCurrentPage === totalPages ? 'disabled' : ''}>Next <i class="fa-solid fa-chevron-right"></i></button>
  `;
  
  document.getElementById('table-prev-btn').addEventListener('click', () => {
    if (tableCurrentPage > 1) {
      tableCurrentPage--;
      renderTable();
    }
  });
  
  document.getElementById('table-next-btn').addEventListener('click', () => {
    if (tableCurrentPage < totalPages) {
      tableCurrentPage++;
      renderTable();
    }
  });
}

// Chart.js Setup
function initChart() {
  const ctx = document.getElementById('downtimeChart').getContext('2d');
  
  statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Online', 'Offline', 'Anomaly'],
      datasets: [{
        data: [0, 0, 0],
        backgroundColor: [
          '#10b981', // green
          '#ef4444', // red
          '#fbbf24'  // yellow
        ],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#94a3b8',
            font: {
              family: 'Outfit'
            }
          }
        }
      },
      cutout: '70%'
    }
  });
}

// Update Chart state values
function updateChartData() {
  if (!statusChart) return;
  
  const online = devices.filter(d => d.status === 'Online').length;
  const offline = devices.filter(d => d.status === 'Offline').length;
  const anomaly = devices.filter(d => d.status === 'Anomaly').length;
  
  statusChart.data.datasets[0].data = [online, offline, anomaly];
  statusChart.update();
}

function isDeviceSuspended(device) {
  if (device.status !== 'Offline') return false;
  if (device.health_status_detail && device.health_status_detail.startsWith('Suspended')) return true;
  if (!device.offline_since) return false;
  const elapsedMs = Date.now() - new Date(device.offline_since).getTime();
  return elapsedMs > 2 * 60 * 60 * 1000;
}
window.isDeviceSuspended = isDeviceSuspended;

function manuallySuspendDevice(deviceId) {
  try {
    const device = devices.find(d => String(d.id) === String(deviceId));
    if (!device) {
      console.warn('Device not found for ID:', deviceId);
      alert('Device not found in active list');
      return;
    }
    
    const targetInput = document.getElementById('suspend-target-device-id');
    const nameEl = document.getElementById('suspend-modal-device-name');
    const ipEl = document.getElementById('suspend-modal-device-ip');
    const noteEl = document.getElementById('suspend-note');
    
    if (targetInput) targetInput.value = device.id;
    if (nameEl) nameEl.textContent = device.name || 'Device';
    if (ipEl) ipEl.textContent = `${device.ip_address || ''} • ${device.location || ''}`;
    if (noteEl) noteEl.value = '';
    
    const radioRusak = document.querySelector('input[name="suspend-reason"][value="Rusak"]');
    if (radioRusak) radioRusak.checked = true;

    const modal = document.getElementById('suspend-modal');
    if (modal) {
      modal.classList.add('active');
    } else {
      console.error('#suspend-modal element not found in DOM');
      alert('Error: Modal element #suspend-modal not found');
    }
  } catch (err) {
    console.error('Error launching suspend dialog:', err);
    alert('Error launching suspend dialog: ' + err.message);
  }
}
window.manuallySuspendDevice = manuallySuspendDevice;

function closeSuspendModal() {
  const modal = document.getElementById('suspend-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}
window.closeSuspendModal = closeSuspendModal;

async function submitDeviceSuspend() {
  const targetInput = document.getElementById('suspend-target-device-id');
  const deviceId = targetInput ? targetInput.value : null;
  const reasonRadio = document.querySelector('input[name="suspend-reason"]:checked');
  const reason = reasonRadio ? reasonRadio.value : 'Rusak';
  const noteEl = document.getElementById('suspend-note');
  const note = noteEl ? noteEl.value.trim() : '';

  if (!deviceId) {
    alert('Invalid device selected for suspend');
    return;
  }

  try {
    const res = await fetch('/api/suspend-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, reason, note })
    });
    const result = await res.json();
    if (result.success) {
      closeSuspendModal();
    } else {
      alert(`Failed to suspend device: ${result.error}`);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}
window.submitDeviceSuspend = submitDeviceSuspend;

function onStatusFilterChange() {
  const sel = document.getElementById('status-filter');
  if (sel) {
    currentStatusFilter = sel.value;
    gridCurrentPage = 1;
    tableCurrentPage = 1;
    renderGrid();
    renderTable();
  }
}
window.onStatusFilterChange = onStatusFilterChange;

async function manuallyReactivateDevice(deviceId) {
  const device = devices.find(d => String(d.id) === String(deviceId));
  const deviceLabel = device ? `"${device.name}" (${device.ip_address})` : 'perangkat ini';
  const confirmMsg = `Apakah Anda yakin ingin mengaktifkan kembali (Resume) pemantauan otomatis untuk ${deviceLabel}?`;

  if (!confirm(confirmMsg)) return;

  if (device) {
    device._isUpdating = true;
    device._updatingMsg = 'Reconnecting...';
    renderDashboard();
  }

  try {
    const res = await fetch('/api/resume-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId })
    });
    const result = await res.json();
    if (!result.success) {
      if (device) delete device._isUpdating;
      renderDashboard();
      alert(`Gagal mengaktifkan kembali perangkat: ${result.error}`);
    }
  } catch (err) {
    if (device) delete device._isUpdating;
    renderDashboard();
    alert(`Error: ${err.message}`);
  }
}
window.manuallyReactivateDevice = manuallyReactivateDevice;

async function submitDeviceSuspend() {
  const targetInput = document.getElementById('suspend-target-device-id');
  const deviceId = targetInput ? targetInput.value : null;
  const reasonRadio = document.querySelector('input[name="suspend-reason"]:checked');
  const reason = reasonRadio ? reasonRadio.value : 'Rusak';
  const noteEl = document.getElementById('suspend-note');
  const note = noteEl ? noteEl.value.trim() : '';

  if (!deviceId) {
    alert('Invalid device selected for suspend');
    return;
  }

  const device = devices.find(d => String(d.id) === String(deviceId));
  if (device) {
    device._isUpdating = true;
    device._updatingMsg = `Suspending (${reason})...`;
    renderDashboard();
  }
  closeSuspendModal();

  try {
    const res = await fetch('/api/suspend-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, reason, note })
    });
    const result = await res.json();
    if (!result.success) {
      if (device) delete device._isUpdating;
      renderDashboard();
      alert(`Failed to suspend device: ${result.error}`);
    }
  } catch (err) {
    if (device) delete device._isUpdating;
    renderDashboard();
    alert(`Error: ${err.message}`);
  }
}
window.submitDeviceSuspend = submitDeviceSuspend;

// Trigger control commands via API
async function triggerDeviceAction(deviceId, endpoint) {
  if (endpoint === 'ping-test') {
    runLivePingDiagnostic(deviceId);
    return;
  }

  const device = devices.find(d => String(d.id) === String(deviceId));
  if (device) {
    device._isUpdating = true;
    device._updatingMsg = 'Executing command...';
    renderDashboard();
  }

  try {
    const response = await fetch(`/api/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ deviceId })
    });
    const result = await response.json();
    
    if (!result.success) {
      if (device) delete device._isUpdating;
      renderDashboard();
      alert(`Action failed: ${result.error}`);
    }
  } catch (err) {
    if (device) delete device._isUpdating;
    renderDashboard();
    console.error('Failed to dispatch device command:', err);
    alert('Failed to connect to backend server endpoint.');
  }
}

// Opens modal and loops ping 5x displaying output
async function runLivePingDiagnostic(deviceId) {
  const device = devices.find(d => d.id === deviceId);
  if (!device) return;

  const pingModal = document.getElementById('ping-modal');
  const consoleOut = document.getElementById('ping-console-output');
  const summaryOut = document.getElementById('ping-summary-output');

  // Open Modal
  pingModal.classList.add('active');
  summaryOut.style.display = 'none';
  consoleOut.innerHTML = `<div>[DIAGNOSTIC] Initializing ping diagnostics for ${device.name}...</div>`;
  consoleOut.innerHTML += `<div>[DIAGNOSTIC] Target IP Address: ${device.ip_address}</div>`;
  consoleOut.innerHTML += `<div>[DIAGNOSTIC] Sending 5 sequential ping loops to test connection stability.</div><hr style="border: 0; border-top: 1px dashed rgba(255,255,255,0.15); margin: 6px 0;">`;

  document.getElementById('ping-modal-name').textContent = device.name;
  document.getElementById('ping-modal-ip').textContent = device.ip_address;
  document.getElementById('ping-modal-terminal').textContent = terminalLabel(device.terminal);

  let successfulPings = 0;
  let totalLatency = 0;
  let latencies = [];

  for (let i = 1; i <= 5; i++) {
    // Stop diagnostic loop if modal was closed
    if (!pingModal.classList.contains('active')) return;

    const requestLine = document.createElement('div');
    requestLine.textContent = `[Ping ${i}/5] Sending request to ${device.ip_address}...`;
    consoleOut.appendChild(requestLine);
    consoleOut.scrollTop = consoleOut.scrollHeight;

    try {
      const response = await fetch('/api/ping-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: device.id })
      });
      const result = await response.json();

      if (!pingModal.classList.contains('active')) return;

      // Remove "Sending request..." status line
      requestLine.remove();

      const resultLine = document.createElement('div');
      if (result.success) {
        successfulPings++;
        const latVal = parseFloat(result.latency) || 0;
        totalLatency += latVal;
        latencies.push(latVal);
        resultLine.style.color = '#34d399';
        resultLine.innerHTML = `<i class="fa-solid fa-check"></i> [Ping ${i}/5] Reply from ${result.ip_address}: time=${result.latency} (RTT Success)`;
      } else {
        resultLine.style.color = '#f87171';
        resultLine.innerHTML = `<i class="fa-solid fa-xmark"></i> [Ping ${i}/5] Request timed out / Destination host unreachable.`;
      }
      consoleOut.appendChild(resultLine);
    } catch (err) {
      if (!pingModal.classList.contains('active')) return;
      requestLine.remove();
      const errLine = document.createElement('div');
      errLine.style.color = '#f87171';
      errLine.textContent = `[Ping ${i}/5] Error: ${err.message}`;
      consoleOut.appendChild(errLine);
    }
    consoleOut.scrollTop = consoleOut.scrollHeight;

    // Delay 1 second between pings
    if (i < 5) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (!pingModal.classList.contains('active')) return;

  // Print final line
  const endLine = document.createElement('div');
  endLine.innerHTML = `<hr style="border: 0; border-top: 1px dashed rgba(255,255,255,0.15); margin: 6px 0;"><div>[DIAGNOSTIC COMPLETE] Test finished for ${device.ip_address}.</div>`;
  consoleOut.appendChild(endLine);
  consoleOut.scrollTop = consoleOut.scrollHeight;

  // Calculate stats
  const lossPct = ((5 - successfulPings) / 5) * 100;
  const avgLatency = successfulPings > 0 ? (totalLatency / successfulPings).toFixed(1) + 'ms' : 'N/A';
  const minLatency = successfulPings > 0 ? Math.min(...latencies).toFixed(0) + 'ms' : 'N/A';
  const maxLatency = successfulPings > 0 ? Math.max(...latencies).toFixed(0) + 'ms' : 'N/A';

  summaryOut.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1.2fr; gap: 8px;">
      <div><strong>Packets:</strong> Sent = 5, Recv = ${successfulPings}, Lost = ${5 - successfulPings} (${lossPct}% loss)</div>
      <div><strong>RTT Latency:</strong> Min = ${minLatency}, Max = ${maxLatency}, Avg = ${avgLatency}</div>
    </div>
  `;
  summaryOut.style.display = 'flex';
}

// Setup Admin Console Events
function setupAdminEvents() {
  const adminModal = document.getElementById('admin-modal');
  const openBtn = document.getElementById('open-admin-btn');
  const closeBtn = document.getElementById('close-admin-btn');
  const form = document.getElementById('device-form');
  const cancelEditBtn = document.getElementById('cancel-edit-btn');

  openBtn.addEventListener('click', () => {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user) {
      document.getElementById('login-modal').classList.add('active');
    } else {
      adminModal.classList.add('active');
      renderAdminDevices();
    }
  });

  closeBtn.addEventListener('click', () => {
    adminModal.classList.remove('active');
    resetAdminForm();
  });

  cancelEditBtn.addEventListener('click', () => {
    resetAdminForm();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('edit-device-id').value;
    const ip = document.getElementById('device-ip').value;
    const name = document.getElementById('device-name').value;
    const terminal = document.getElementById('device-terminal').value;
    const location = document.getElementById('device-location').value;
    const equipment_type = document.getElementById('device-equipment-type').value;

    const payload = { ip_address: ip, name, terminal, location, equipment_type };
    const user = JSON.parse(sessionStorage.getItem('currentUser')) || {};
    const headers = {
      'Content-Type': 'application/json',
      'X-User-Role': user.role || ''
    };

    try {
      let response;
      if (editId) {
        // Update
        response = await fetch(`/api/devices/${editId}`, {
          method: 'PUT',
          headers: headers,
          body: JSON.stringify(payload)
        });
      } else {
        // Create
        response = await fetch('/api/devices', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload)
        });
      }

      const result = await response.json();
      if (result.success) {
        resetAdminForm();
        renderAdminDevices();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (err) {
      console.error('CRUD request failed:', err);
    }
  });
}

// Admin Devices List Pagination & Filter State
let adminSearchQuery = '';
let adminTypeFilter = 'ALL';
let adminPageSize = 10;
let adminCurrentPage = 1;

function onAdminFilterChange() {
  adminSearchQuery = (document.getElementById('admin-search-input')?.value || '').trim().toLowerCase();
  adminTypeFilter = document.getElementById('admin-type-filter')?.value || 'ALL';
  adminCurrentPage = 1;
  renderAdminDevices();
}
window.onAdminFilterChange = onAdminFilterChange;

function onAdminPageSizeChange() {
  const val = document.getElementById('admin-page-size')?.value || '10';
  adminPageSize = val === 'ALL' ? 'ALL' : parseInt(val);
  adminCurrentPage = 1;
  renderAdminDevices();
}
window.onAdminPageSizeChange = onAdminPageSizeChange;

function changeAdminPage(page) {
  adminCurrentPage = page;
  renderAdminDevices();
}
window.changeAdminPage = changeAdminPage;

// Render device table list inside Admin Modal with Pagination & Search & Type Filtering
function renderAdminDevices() {
  const listBody = document.getElementById('admin-devices-list');
  if (!listBody) return;
  listBody.innerHTML = '';

  const user = JSON.parse(sessionStorage.getItem('currentUser')) || {};
  const isAdmin = user.role === 'admin';

  // Filter devices by search query (name or IP) and equipment type
  const filtered = devices.filter(d => {
    const matchSearch = !adminSearchQuery || 
      (d.name && d.name.toLowerCase().includes(adminSearchQuery)) || 
      (d.ip_address && d.ip_address.toLowerCase().includes(adminSearchQuery));
    
    const matchType = adminTypeFilter === 'ALL' || d.equipment_type === adminTypeFilter;
    return matchSearch && matchType;
  });

  const totalItems = filtered.length;
  const badge = document.getElementById('admin-device-count-badge');
  if (badge) badge.textContent = `Total: ${totalItems} devices`;

  // Calculate pagination bounds
  let pageSize = adminPageSize === 'ALL' ? totalItems : adminPageSize;
  if (pageSize <= 0) pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (adminCurrentPage > totalPages) adminCurrentPage = totalPages;

  const startIndex = (adminCurrentPage - 1) * pageSize;
  const endIndex = adminPageSize === 'ALL' ? totalItems : Math.min(startIndex + pageSize, totalItems);
  const pageItems = filtered.slice(startIndex, endIndex);

  if (pageItems.length === 0) {
    listBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding: 20px;">No devices matching criteria.</td></tr>`;
  } else {
    pageItems.forEach(device => {
      const row = document.createElement('tr');
      let actionsHtml = isAdmin ? `
        <button class="edit-item-btn" onclick="editDevice(${device.id})"><i class="fa-solid fa-pen-to-square"></i></button>
        <button class="delete-item-btn" onclick="deleteDevice(${device.id})"><i class="fa-solid fa-trash-can"></i></button>
      ` : `<span style="font-size:11px; color:var(--text-muted);">Read-Only</span>`;

      row.innerHTML = `
        <td><strong>${device.name}</strong></td>
        <td><span class="table-ip">${device.ip_address}</span></td>
        <td><span style="font-size:10px; color:#94a3b8;">${device.equipment_type || 'FIDS'}</span></td>
        <td><span class="table-tag" style="white-space:nowrap; font-size:10px;">${terminalLabel(device.terminal)}</span></td>
        <td style="text-align: right;">${actionsHtml}</td>
      `;
      listBody.appendChild(row);
    });
  }

  // Update Pagination Controls
  const infoEl = document.getElementById('admin-pagination-info');
  const btnsEl = document.getElementById('admin-pagination-buttons');

  if (infoEl) {
    infoEl.textContent = totalItems === 0 ? 'Showing 0 devices' : `Showing ${startIndex + 1}-${endIndex} of ${totalItems}`;
  }

  if (btnsEl) {
    btnsEl.innerHTML = '';
    if (adminPageSize !== 'ALL' && totalPages > 1) {
      const prevBtn = document.createElement('button');
      prevBtn.className = 'pagination-btn';
      prevBtn.disabled = adminCurrentPage === 1;
      prevBtn.style.padding = '4px 8px';
      prevBtn.style.fontSize = '11px';
      prevBtn.style.borderRadius = '4px';
      prevBtn.style.border = '1px solid rgba(255,255,255,0.1)';
      prevBtn.style.background = 'rgba(255,255,255,0.05)';
      prevBtn.style.color = 'var(--text-muted)';
      prevBtn.style.cursor = prevBtn.disabled ? 'not-allowed' : 'pointer';
      prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
      prevBtn.onclick = () => changeAdminPage(adminCurrentPage - 1);
      btnsEl.appendChild(prevBtn);

      for (let i = 1; i <= totalPages; i++) {
        const pBtn = document.createElement('button');
        pBtn.className = `pagination-btn ${i === adminCurrentPage ? 'active' : ''}`;
        pBtn.style.padding = '4px 9px';
        pBtn.style.fontSize = '11px';
        pBtn.style.borderRadius = '4px';
        pBtn.style.border = i === adminCurrentPage ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)';
        pBtn.style.background = i === adminCurrentPage ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.05)';
        pBtn.style.color = i === adminCurrentPage ? '#38bdf8' : 'var(--text-muted)';
        pBtn.style.fontWeight = i === adminCurrentPage ? 'bold' : 'normal';
        pBtn.style.cursor = 'pointer';
        pBtn.textContent = i;
        pBtn.onclick = () => changeAdminPage(i);
        btnsEl.appendChild(pBtn);
      }

      const nextBtn = document.createElement('button');
      nextBtn.className = 'pagination-btn';
      nextBtn.disabled = adminCurrentPage === totalPages;
      nextBtn.style.padding = '4px 8px';
      nextBtn.style.fontSize = '11px';
      nextBtn.style.borderRadius = '4px';
      nextBtn.style.border = '1px solid rgba(255,255,255,0.1)';
      nextBtn.style.background = 'rgba(255,255,255,0.05)';
      nextBtn.style.color = 'var(--text-muted)';
      nextBtn.style.cursor = nextBtn.disabled ? 'not-allowed' : 'pointer';
      nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
      nextBtn.onclick = () => changeAdminPage(adminCurrentPage + 1);
      btnsEl.appendChild(nextBtn);
    }
  }
}


// Populate Admin form for editing
function editDevice(id) {
  const device = devices.find(d => d.id === id);
  if (!device) return;

  document.getElementById('edit-device-id').value = device.id;
  document.getElementById('device-ip').value = device.ip_address;
  document.getElementById('device-name').value = device.name;
  document.getElementById('device-equipment-type').value = device.equipment_type || 'FIDS';
  document.getElementById('device-terminal').value = device.terminal;
  document.getElementById('device-location').value = device.location;

  document.getElementById('form-title').textContent = 'Modify Monitor';
  document.getElementById('submit-device-btn').textContent = 'Update Monitor';
  document.getElementById('cancel-edit-btn').classList.remove('hidden');
}

// Cancel edit and reset form inputs
function resetAdminForm() {
  document.getElementById('edit-device-id').value = '';
  document.getElementById('device-form').reset();
  document.getElementById('form-title').textContent = 'Register New Monitor';
  document.getElementById('submit-device-btn').textContent = 'Save Monitor';
  document.getElementById('cancel-edit-btn').classList.add('hidden');
}

// Send DELETE request
async function deleteDevice(id) {
  if (!confirm('Are you sure you want to remove this FIDS monitor?')) return;

  try {
    const user = JSON.parse(sessionStorage.getItem('currentUser')) || {};
    const response = await fetch(`/api/devices/${id}`, {
      method: 'DELETE',
      headers: {
        'X-User-Role': user.role || ''
      }
    });
    const result = await response.json();
    if (result.success) {
      renderAdminDevices();
    } else {
      alert(`Delete failed: ${result.error}`);
    }
  } catch (err) {
    console.error('Delete request failed:', err);
  }
}

// Expose admin actions globally for inline HTML click events
window.editDevice = editDevice;
window.deleteDevice = deleteDevice;
window.triggerDeviceAction = triggerDeviceAction;
window.showDeviceLogs = showDeviceLogs;

// Fetch and display logs for a specific device in a timeline modal
async function showDeviceLogs(deviceId) {
  const device = devices.find(d => d.id === deviceId);
  if (!device) return;

  const modal = document.getElementById('device-logs-modal');
  const output = document.getElementById('device-logs-output');

  // Populate modal header details
  document.getElementById('device-logs-name').textContent = device.name;
  document.getElementById('device-logs-ip').textContent = device.ip_address;
  document.getElementById('device-logs-terminal').textContent = terminalLabel(device.terminal);

  // Open Modal
  modal.classList.add('active');
  output.innerHTML = `<div style="text-align:center; padding: 20px; color:var(--text-muted);"><i class="fa-solid fa-circle-notch fa-spin"></i> Fetching history logs...</div>`;

  try {
    const response = await fetch(`/api/devices/${deviceId}/logs`);
    const deviceLogs = await response.json();

    output.innerHTML = '';
    if (deviceLogs.length === 0) {
      output.innerHTML = `<div style="text-align:center; padding: 20px; color:var(--text-muted);">No activity logs recorded for this device.</div>`;
      return;
    }

    deviceLogs.forEach(log => {
      const item = document.createElement('div');
      item.className = `log-item ${log.status.toLowerCase()}`;
      
      const formattedTime = new Date(log.timestamp).toLocaleString('id-ID', {
        dateStyle: 'short',
        timeStyle: 'medium'
      });

      item.innerHTML = `
        <div class="log-time" style="font-size: 10px; opacity: 0.8; margin-bottom: 2px;">${formattedTime}</div>
        <div class="log-body">
          <div class="log-tag ${log.status.toLowerCase()}" style="font-size: 9px;">${log.status}</div>
          <div class="log-desc" style="font-size: 11px; margin-top: 1px;">${log.message}</div>
        </div>
      `;
      output.appendChild(item);
    });
  } catch (err) {
    console.error('Failed to load device logs:', err);
    output.innerHTML = `<div style="text-align:center; padding: 20px; color:#f87171;">Failed to load logs: ${err.message}</div>`;
  }
}

// Apply Light or Dark theme styling
function applyTheme(theme) {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;
  const icon = btn.querySelector('i');
  
  if (theme === 'light-mode') {
    document.body.classList.remove('dark-mode');
    document.body.classList.add('light-mode');
    icon.className = 'fa-solid fa-sun';
    localStorage.setItem('theme', 'light-mode');
  } else {
    document.body.classList.remove('light-mode');
    document.body.classList.add('dark-mode');
    icon.className = 'fa-solid fa-moon';
    localStorage.setItem('theme', 'dark-mode');
  }
}

// Expose admin actions globally for inline HTML click events
window.editDevice = editDevice;
window.deleteDevice = deleteDevice;
window.triggerDeviceAction = triggerDeviceAction;
window.showDeviceLogs = showDeviceLogs;
window.applyTheme = applyTheme;
window.fetchAllLogs = fetchAllLogs;

// Fetch and display paginated activity logs for the All Logs modal
async function fetchAllLogs() {
  const tableBody = document.getElementById('all-logs-table-body');
  const pagEl = document.getElementById('all-logs-pagination');
  if (!tableBody || !pagEl) return;

  tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color:var(--text-muted);"><i class="fa-solid fa-circle-notch fa-spin"></i> Fetching activity history...</td></tr>`;
  pagEl.innerHTML = '';

  try {
    const response = await fetch(`/api/logs?page=${allLogsCurrentPage}&limit=${allLogsItemsPerPage}`);
    const data = await response.json();

    tableBody.innerHTML = '';
    if (!data.logs || data.logs.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color: var(--text-muted);">No activity logs recorded.</td></tr>`;
      return;
    }

    data.logs.forEach(log => {
      const row = document.createElement('tr');
      
      let statusBadge = `<span class="table-tag text-green"><i class="fa-solid fa-display"></i> ${log.status}</span>`;
      if (log.status === 'Offline') {
        statusBadge = `<span class="table-tag text-red"><i class="fa-solid fa-display"></i> ${log.status}</span>`;
      } else if (log.status === 'Anomaly') {
        statusBadge = `<span class="table-tag text-yellow"><i class="fa-solid fa-display"></i> ${log.status}</span>`;
      }

      const formattedTime = new Date(log.timestamp).toLocaleString('id-ID', {
        dateStyle: 'short',
        timeStyle: 'medium'
      });

      row.innerHTML = `
        <td style="font-family: monospace; font-size: 11px;">${formattedTime}</td>
        <td><strong>${log.name || 'Device'}</strong></td>
        <td>${statusBadge}</td>
        <td style="font-size: 12px; color: var(--text-primary); opacity: 0.95;">${log.message}</td>
      `;
      tableBody.appendChild(row);
    });

    // Render pagination
    const totalPages = data.totalPages || 1;
    pagEl.innerHTML = `
      <button id="all-logs-prev-btn" ${allLogsCurrentPage === 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i> Prev</button>
      <span class="page-num" style="color: var(--text-muted); font-size: 12px;">Page ${allLogsCurrentPage} of ${totalPages}</span>
      <button id="all-logs-next-btn" ${allLogsCurrentPage === totalPages ? 'disabled' : ''}>Next <i class="fa-solid fa-chevron-right"></i></button>
    `;

    document.getElementById('all-logs-prev-btn').addEventListener('click', () => {
      if (allLogsCurrentPage > 1) {
        allLogsCurrentPage--;
        fetchAllLogs();
      }
    });

    document.getElementById('all-logs-next-btn').addEventListener('click', () => {
      if (allLogsCurrentPage < totalPages) {
        allLogsCurrentPage++;
        fetchAllLogs();
      }
    });

  } catch (err) {
    console.error('Failed to fetch paginated logs:', err);
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color:#f87171;">Failed to load logs: ${err.message}</td></tr>`;
  }
}

// Open remote control window using noVNC
function openRemoteVnc(ip, name) {
  const width = 1024;
  const height = 768;
  const left = (screen.width - width) / 2;
  const top = (screen.height - height) / 2;
  window.open(
    `novnc.html?ip=${ip}&name=${encodeURIComponent(name)}`,
    `vnc_${ip.replace(/\./g, '_')}`,
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no,status=no`
  );
}
window.openRemoteVnc = openRemoteVnc;

// ─── CCTV Proxy Viewer ───────────────────────────────────────────────────────
let _cctvCurrentIp = null;
let _cctvCurrentName = null;
let _cctvCurrentType = null;
let _cctvMode = 'webui'; // 'webui' | 'mjpeg'

// MJPEG stream paths to try (common camera endpoints)
const MJPEG_PATHS = [
  '/videostream.cgi', '/mjpeg', '/video.mjpeg',
  '/cgi-bin/mjpeg', '/stream', '/video',
  '/live/0/mjpeg.jpg', '/axis-cgi/mjpg/video.cgi',
];

function closeCctvModal() {
  const modal = document.getElementById('cctv-view-modal');
  modal.classList.remove('active');
  // Stop any snapshot loop when closing
  stopSnapshotLoop();
  const mjpegImg = document.getElementById('cctv-mjpeg-img');
  if (mjpegImg) mjpegImg.src = '';
  _cctvCurrentIp = null;
}
window.closeCctvModal = closeCctvModal;

function setCctvMode(mode) {
  _cctvMode = mode;
  const webuiBtn  = document.getElementById('cctv-mode-webui');
  const mjpegBtn  = document.getElementById('cctv-mode-mjpeg');
  const iframe    = document.getElementById('cctv-view-iframe');
  const mjpegView = document.getElementById('cctv-mjpeg-view');

  if (mode === 'webui') {
    webuiBtn.style.background = 'rgba(56,189,248,0.2)'; webuiBtn.style.color = '#38bdf8'; webuiBtn.style.fontWeight = '600';
    mjpegBtn.style.background = 'transparent'; mjpegBtn.style.color = 'var(--text-muted)'; mjpegBtn.style.fontWeight = 'normal';
    iframe.style.display = 'block';
    mjpegView.style.display = 'none';
    if (_cctvCurrentIp && !iframe.src.includes('cctv-proxy')) {
      loadCctvProxy(_cctvCurrentIp);
    }
  } else {
    mjpegBtn.style.background = 'rgba(56,189,248,0.2)'; mjpegBtn.style.color = '#38bdf8'; mjpegBtn.style.fontWeight = '600';
    webuiBtn.style.background = 'transparent'; webuiBtn.style.color = 'var(--text-muted)'; webuiBtn.style.fontWeight = 'normal';
    iframe.style.display = 'none';
    mjpegView.style.display = 'flex';  // use flex (column layout)
    stopSnapshotLoop(); // clear any previous snapshot timer
  }
}
window.setCctvMode = setCctvMode;

// ─── Stream Manager ──────────────────────────────────────────────────────────
let _streamType       = 'mjpeg';    // 'mjpeg' | 'snapshot'
let _streamPath       = '';         // current selected path
let _snapshotTimer    = null;

function setStreamType(type) {
  _streamType = type;
  const mjpegBtn    = document.getElementById('stream-type-mjpeg');
  const snapBtn     = document.getElementById('stream-type-snapshot');
  const snapCtrl    = document.getElementById('snapshot-interval-ctrl');

  if (type === 'mjpeg') {
    mjpegBtn.style.background = 'rgba(56,189,248,0.2)'; mjpegBtn.style.color = '#38bdf8'; mjpegBtn.style.fontWeight = '600';
    snapBtn.style.background  = 'transparent';           snapBtn.style.color  = 'var(--text-muted)'; snapBtn.style.fontWeight = 'normal';
    snapCtrl.style.display = 'none';
    stopSnapshotLoop();
  } else {
    snapBtn.style.background  = 'rgba(56,189,248,0.2)'; snapBtn.style.color  = '#38bdf8'; snapBtn.style.fontWeight = '600';
    mjpegBtn.style.background = 'transparent';          mjpegBtn.style.color = 'var(--text-muted)'; mjpegBtn.style.fontWeight = 'normal';
    snapCtrl.style.display = 'flex';
  }
}
window.setStreamType = setStreamType;

function onStreamPathChange() {
  const sel = document.getElementById('stream-path-select').value;
  if (sel) document.getElementById('stream-path-manual').value = sel;
  _streamPath = sel;
}
window.onStreamPathChange = onStreamPathChange;

function onManualPathInput() {
  _streamPath = document.getElementById('stream-path-manual').value.trim();
}
window.onManualPathInput = onManualPathInput;

async function scanStreamPaths() {
  if (!_cctvCurrentIp) return;
  const btn = document.getElementById('stream-scan-btn');
  const panel = document.getElementById('stream-scan-panel');
  const results = document.getElementById('stream-scan-results');

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Scanning...';
  panel.style.display = 'block';
  results.innerHTML = '<span style="font-size:11px;color:var(--text-muted);">Scanning ' + _cctvCurrentIp + ' for stream paths...</span>';

  try {
    const r = await fetch('/api/cctv-proxy/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: _cctvCurrentIp }),
    });
    const data = await r.json();

    const sel = document.getElementById('stream-path-select');
    // Reset dropdown
    sel.innerHTML = '<option value="">-- Select stream path --</option>';

    if (data.found.length === 0) {
      results.innerHTML = '<span style="font-size:11px;color:#ef4444;">No accessible stream paths found. Try entering a path manually.</span>';
    } else {
      results.innerHTML = '';
      data.found.forEach(f => {
        // Add to dropdown
        const opt = document.createElement('option');
        opt.value = f.path;
        opt.textContent = `${f.label} (${f.path})`;
        sel.appendChild(opt);

        // Add as clickable chip
        const chip = document.createElement('button');
        chip.style.cssText = 'padding:4px 10px;font-size:11px;border-radius:20px;border:1px solid rgba(34,197,94,0.4);background:rgba(34,197,94,0.1);color:#22c55e;cursor:pointer;white-space:nowrap;';
        chip.innerHTML = `<i class="fa-solid fa-check"></i> ${f.label} <span style="opacity:0.6;font-size:10px;">${f.path}</span>`;
        chip.onclick = () => {
          document.getElementById('stream-path-manual').value = f.path;
          sel.value = f.path;
          _streamPath = f.path;
          applyStreamPath();
        };
        results.appendChild(chip);
      });

      // Auto-select and load first found path
      if (data.found.length > 0) {
        sel.value = data.found[0].path;
        document.getElementById('stream-path-manual').value = data.found[0].path;
        _streamPath = data.found[0].path;
      }
    }
  } catch (e) {
    results.innerHTML = `<span style="font-size:11px;color:#ef4444;">Scan error: ${e.message}</span>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Scan Paths';
  }
}
window.scanStreamPaths = scanStreamPaths;

function applyStreamPath() {
  const path = _streamPath || document.getElementById('stream-path-manual').value.trim();
  if (!path || !_cctvCurrentIp) return;
  _streamPath = path;

  stopSnapshotLoop();
  hideSstreamPlaceholder();

  if (_streamType === 'snapshot') {
    startSnapshotLoop();
  } else {
    loadMjpegLive();
  }
}
window.applyStreamPath = applyStreamPath;

function loadMjpegLive() {
  const mjpegImg    = document.getElementById('cctv-mjpeg-img');
  const snapImg     = document.getElementById('cctv-snapshot-img');
  const badge       = document.getElementById('stream-status-badge');

  snapImg.style.display  = 'none';
  snapImg.src = '';
  mjpegImg.style.display = 'block';

  // Use dedicated /cctv-stream/:ip/mjpeg proxy (no buffering, raw pipe)
  mjpegImg.src = `/cctv-stream/${_cctvCurrentIp}/mjpeg?path=${encodeURIComponent(_streamPath)}&_t=${Date.now()}`;

  badge.style.display = 'flex';
  document.getElementById('stream-status-dot').style.background = '#22c55e';
  document.getElementById('stream-status-text').textContent = 'MJPEG Live';
}

function startSnapshotLoop() {
  const interval = parseInt(document.getElementById('snapshot-interval-select').value) || 2000;
  fetchSnapshot(); // immediate first frame
  _snapshotTimer = setInterval(fetchSnapshot, interval);

  const badge = document.getElementById('stream-status-badge');
  badge.style.display = 'flex';
  document.getElementById('stream-status-dot').style.background = '#a855f7';
  document.getElementById('stream-status-text').textContent = `Snapshot (${interval/1000}s)`;
}

function fetchSnapshot() {
  const snapImg  = document.getElementById('cctv-snapshot-img');
  const mjpegImg = document.getElementById('cctv-mjpeg-img');
  mjpegImg.style.display = 'none';
  mjpegImg.src = '';
  snapImg.style.display = 'block';
  // Append timestamp to force fresh fetch
  snapImg.src = `/cctv-stream/${_cctvCurrentIp}/snapshot?path=${encodeURIComponent(_streamPath)}&_t=${Date.now()}`;
}

function stopSnapshotLoop() {
  if (_snapshotTimer) { clearInterval(_snapshotTimer); _snapshotTimer = null; }
  const snapImg = document.getElementById('cctv-snapshot-img');
  const mjpegImg = document.getElementById('cctv-mjpeg-img');
  if (snapImg) { snapImg.src = ''; snapImg.style.display = 'none'; }
  if (mjpegImg) { mjpegImg.src = ''; mjpegImg.style.display = 'none'; }
}

function hideSstreamPlaceholder() {
  document.getElementById('stream-placeholder').style.display = 'none';
}

function setSnapshotInterval() {
  if (_streamType !== 'snapshot' || !_streamPath) return;
  stopSnapshotLoop();
  startSnapshotLoop();
}
window.setSnapshotInterval = setSnapshotInterval;

function onMjpegImgError() {
  const badge = document.getElementById('stream-status-badge');
  badge.style.display = 'flex';
  document.getElementById('stream-status-dot').style.background = '#ef4444';
  document.getElementById('stream-status-text').textContent = 'Stream error';
}
window.onMjpegImgError = onMjpegImgError;

function onSnapshotImgError() {
  // Snapshot errors are non-fatal — retry on next interval tick
}
window.onSnapshotImgError = onSnapshotImgError;
// ─────────────────────────────────────────────────────────────────────────────

function loadCctvProxy(ip) {
  const iframe = document.getElementById('cctv-view-iframe');
  showCctvLoading('Loading camera interface...');
  iframe.src = `/cctv-proxy/${ip}/`;
}

function showCctvLoading(msg) {
  document.getElementById('cctv-loading-overlay').style.display = 'flex';
  document.getElementById('cctv-error-overlay').style.display = 'none';
  document.getElementById('cctv-loading-detail').textContent = msg || 'Please wait...';
  document.getElementById('cctv-status-dot').style.background = '#f59e0b';
  document.getElementById('cctv-status-dot').style.boxShadow = 'none';
}

function showCctvConnected(latency) {
  document.getElementById('cctv-loading-overlay').style.display = 'none';
  document.getElementById('cctv-error-overlay').style.display = 'none';
  const dot = document.getElementById('cctv-status-dot');
  dot.style.background = '#22c55e';
  dot.style.boxShadow = '0 0 8px #22c55e';
  document.getElementById('cctv-modal-subtitle').textContent = 'Connected · Routed via server proxy';
  if (latency) document.getElementById('cctv-latency-info').textContent = `Latency: ${latency}ms`;
}

function showCctvError(detail) {
  document.getElementById('cctv-loading-overlay').style.display = 'none';
  const errDiv = document.getElementById('cctv-error-overlay');
  errDiv.style.display = 'flex';
  document.getElementById('cctv-error-detail').textContent = detail || 'Unknown error';
  const dot = document.getElementById('cctv-status-dot');
  dot.style.background = '#ef4444';
  dot.style.boxShadow = 'none';
  document.getElementById('cctv-modal-subtitle').textContent = 'Connection failed';
}

function onCctvIframeLoad() {
  // iframe loaded — may be success or camera returned content
  showCctvConnected();
}
window.onCctvIframeLoad = onCctvIframeLoad;

function onCctvIframeError() {
  showCctvError('Failed to load camera interface through proxy.');
}
window.onCctvIframeError = onCctvIframeError;

function refreshCctvView() {
  if (!_cctvCurrentIp) return;
  const refreshBtn = document.getElementById('cctv-refresh-btn');
  refreshBtn.disabled = true;
  setTimeout(() => { refreshBtn.disabled = false; }, 2000);
  if (_cctvMode === 'mjpeg') {
    loadMjpegStream(_cctvCurrentIp);
  } else {
    openDeviceWebView(_cctvCurrentIp, _cctvCurrentName, _cctvCurrentType);
  }
}
window.refreshCctvView = refreshCctvView;

// Open CCTV camera viewer via server proxy
async function openDeviceWebView(ip, name, type) {
  _cctvCurrentIp   = ip;
  _cctvCurrentName = name;
  _cctvCurrentType = type;

  // Reset UI
  const modal      = document.getElementById('cctv-view-modal');
  const iframe     = document.getElementById('cctv-view-iframe');
  const mjpegView  = document.getElementById('cctv-mjpeg-view');
  const subtitle   = document.getElementById('cctv-modal-subtitle');

  document.getElementById('cctv-view-modal-title').textContent = name;
  document.getElementById('cctv-view-fallback-link').href = `http://${ip}`;
  document.getElementById('cctv-proxy-info').textContent = `Proxy: /cctv-proxy/${ip}/ → ${ip}:80`;
  document.getElementById('cctv-latency-info').textContent = '';

  // Icon based on type
  const icon = document.getElementById('cctv-view-modal-icon');
  if (type === 'CCTV') {
    icon.className = 'fa-solid fa-video'; icon.style.color = '#38bdf8';
  } else {
    icon.className = 'fa-solid fa-phone-volume'; icon.style.color = '#a855f7';
  }

  // Reset mode to webui
  iframe.style.display = 'block';
  mjpegView.style.display = 'none';
  iframe.src = '';
  _cctvMode = 'webui';
  setCctvMode('webui');

  // Wire up new-tab button to open raw IP address directly
  document.getElementById('cctv-view-new-tab-btn').onclick = () => {
    window.open(`http://${ip}`, '_blank');
  };


  // Show modal with loading state
  modal.classList.add('active');
  showCctvLoading('Checking camera reachability...');

  // Test reachability first via server
  try {
    const testRes = await fetch('/api/cctv-proxy/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip }),
    });
    const testData = await testRes.json();

    if (!testData.reachable) {
      showCctvError(
        `Server cannot reach the camera at ${ip}:80. ` +
        `Error: ${testData.error || 'Connection refused'}. ` +
        `Verify the device is online and accessible from the server.`
      );
      return;
    }

    // Camera reachable — load through proxy (using detected port if not 80)
    const proxyTarget = (testData.port && testData.port !== 80) ? `${ip}:${testData.port}` : ip;
    subtitle.textContent = `Reachable · ${testData.latency}ms · Connected via proxy (port ${testData.port || 80})`;
    document.getElementById('cctv-latency-info').textContent = `Port: ${testData.port || 80} | Latency: ${testData.latency}ms`;
    showCctvLoading(`Camera online (${testData.latency}ms) — loading interface...`);
    iframe.src = `/cctv-proxy/${proxyTarget}/`;

    // Safety timer: hide loading overlay after 1.5s max so client PC won't be stuck
    setTimeout(() => {
      showCctvConnected(testData.latency);
    }, 1500);


  } catch (err) {
    showCctvError(`Could not reach the camera test endpoint: ${err.message}`);
  }
}

window.openDeviceWebView = openDeviceWebView;
// ─────────────────────────────────────────────────────────────────────────────

// Download dynamically generated RDP config file (mstsc shortcut)
function downloadRdpConfig(ip, name) {
  const rdpContent = 
    `screen mode id:i:2\r\n` +
    `use multimon:i:0\r\n` +
    `desktopwidth:i:1024\r\n` +
    `desktopheight:i:768\r\n` +
    `session bpp:i:32\r\n` +
    `winposstr:s:0,3,0,0,800,600\r\n` +
    `full address:s:${ip}\r\n` +
    `prompt for credentials:i:1\r\n`;

  const blob = new Blob([rdpContent], { type: 'application/x-rdp' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/\s+/g, '_')}_remote.rdp`;
  document.body.appendChild(a);
  a.click();
  
  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
window.downloadRdpConfig = downloadRdpConfig;

// ─── AUTHENTICATION AND SESSION MANAGEMENT ─────────────────────────────────────
let currentUser = null;

function getCurrentUser() {
  try {
    if (currentUser) return currentUser;
    const stored = sessionStorage.getItem('currentUser');
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  return null;
}
window.getCurrentUser = getCurrentUser;

function handleLoginSubmit(event) {
  event.preventDefault();
  const usernameEl = document.getElementById('login-username');
  const passwordEl = document.getElementById('login-password');
  const errorEl = document.getElementById('login-error-msg');

  const username = usernameEl.value;
  const password = passwordEl.value;

  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  .then(res => {
    if (!res.ok) throw new Error('Authentication failed');
    return res.json();
  })
  .then(data => {
    currentUser = { username: data.username, role: data.role };
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Hide login modal, clear inputs
    document.getElementById('login-modal').classList.remove('active');
    usernameEl.value = '';
    passwordEl.value = '';
    errorEl.style.display = 'none';

    // Show admin modal
    document.getElementById('admin-modal').classList.add('active');
    renderAdminDevices();
    updateAuthUI();
  })
  .catch(err => {
    errorEl.style.display = 'block';
    errorEl.textContent = 'Invalid credentials. Please try again.';
  });
}
window.handleLoginSubmit = handleLoginSubmit;

function handleUserLogout() {
  currentUser = null;
  sessionStorage.removeItem('currentUser');
  document.getElementById('admin-modal').classList.remove('active');
  updateAuthUI();
}
window.handleUserLogout = handleUserLogout;

function updateAuthUI() {
  const user = JSON.parse(sessionStorage.getItem('currentUser'));
  const loginWrapper = document.getElementById('logged-user-indicator');
  const openAdminBtn = document.getElementById('open-admin-btn');
  const loggedUserEl = document.getElementById('logged-username');
  const loggedRoleEl = document.getElementById('logged-role');

  if (user) {
    loginWrapper.style.display = 'flex';
    loggedUserEl.textContent = user.username;
    loggedRoleEl.textContent = user.role.toUpperCase();
    
    // Customize admin panel button
    openAdminBtn.innerHTML = `<i class="fa-solid fa-user-gear"></i> Console`;
  } else {
    loginWrapper.style.display = 'none';
    openAdminBtn.innerHTML = `<i class="fa-solid fa-screwdriver-wrench"></i> Admin Panel`;
  }
}
window.updateAuthUI = updateAuthUI;


// ─── PRIORITY ACTION INCIDENTS OVERVIEW ───────────────────────────────────────
let priorityCurrentPage = 1;
const PRIORITY_PAGE_SIZE = 5;

function renderPriorityIncidents() {
  const container = document.getElementById('overview-priority-incidents');
  const listBody = document.getElementById('priority-incidents-list');
  const countPill = document.getElementById('priority-incident-count');
  const breakdownEl = document.getElementById('priority-category-breakdown');
  const paginationEl = document.getElementById('priority-incidents-pagination');

  if (!container || !listBody) return;

  // Filter devices to get all Offline and Anomalous ones
  const incidents = devices.filter(d => (d.status === 'Offline' || d.status === 'Anomaly') && !isDeviceSuspended(d) && d.health_status_detail !== 'Suspended (Manual)');
  
  if (incidents.length === 0) {
    container.style.display = 'none';
    return;
  }

  // Show container, set count
  container.style.display = 'block';
  countPill.textContent = `${incidents.length} Issue${incidents.length > 1 ? 's' : ''}`;

  // Calculate categorized breakdown
  const breakdowns = {};
  incidents.forEach(d => {
    const type = d.equipment_type;
    breakdowns[type] = (breakdowns[type] || 0) + 1;
  });
  breakdownEl.innerHTML = Object.entries(breakdowns)
    .map(([type, count]) => `<span style="background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;"><strong style="color:#ef4444;">${count}</strong> ${type}</span>`)
    .join(' ');

  // Pagination bounds
  const totalPages = Math.ceil(incidents.length / PRIORITY_PAGE_SIZE) || 1;
  if (priorityCurrentPage > totalPages) priorityCurrentPage = totalPages;
  const start = (priorityCurrentPage - 1) * PRIORITY_PAGE_SIZE;
  const sliced = incidents.slice(start, start + PRIORITY_PAGE_SIZE);

  // Render rows
  listBody.innerHTML = '';
  sliced.forEach(device => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
    
    let statusDesc = '';
    if (device.status === 'Offline') {
      statusDesc = `<span class="table-tag offline"><i class="fa-solid fa-circle-xmark"></i> Offline</span>`;
    } else {
      statusDesc = `<span class="table-tag anomaly" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.2);"><i class="fa-solid fa-triangle-exclamation"></i> Anomaly (${device.anomaly_type})</span>`;
    }

    // Direct Remote Operations Action Button depending on type
    let optBtn = '';
    if (device.equipment_type === 'FIDS' || device.equipment_type === 'Server FIDS') {
      optBtn = `<button onclick="openRemoteVnc('${device.ip_address}', '${device.name}')" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 4px 8px; font-size:10px; border-radius:4px; border:none; cursor:pointer;"><i class="fa-solid fa-desktop"></i> Remote</button>`;
    } else if (device.equipment_type === 'Server CCTV') {
      optBtn = `
        <div style="display:flex; gap:4px;">
          <button onclick="openRemoteVnc('${device.ip_address}', '${device.name}')" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 4px 6px; font-size:10px; border-radius:4px; border:none; cursor:pointer;">VNC</button>
          <button onclick="downloadRdpConfig('${device.ip_address}', '${device.name}')" style="background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 4px 6px; font-size:10px; border-radius:4px; border:none; cursor:pointer;">RDP</button>
        </div>
      `;
    } else if (device.equipment_type === 'CCTV' || device.equipment_type === 'IP PABX') {
      optBtn = `<button onclick="openDeviceWebView('${device.ip_address}', '${device.name}', '${device.equipment_type}')" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; padding: 4px 8px; font-size:10px; border-radius:4px; border:none; cursor:pointer;"><i class="fa-solid fa-eye"></i> View</button>`;
    } else {
      optBtn = `<button onclick="triggerDeviceAction(${device.id}, 'ping-test')" style="background: rgba(255,255,255,0.05); color:#fff; padding: 4px 8px; font-size:10px; border-radius:4px; border:none; cursor:pointer;"><i class="fa-solid fa-terminal"></i> Ping</button>`;
    }

    const operationsCellHtml = `
      <div style="display: flex; gap: 6px; justify-content: flex-end; align-items: center;">
        ${optBtn}
        <button onclick="manuallySuspendDevice(${device.id})" style="background: rgba(244, 63, 94, 0.15); color: #f43f5e; padding: 4px 8px; font-size: 10px; border-radius: 4px; border: 1px solid rgba(244, 63, 94, 0.25); cursor: pointer;"><i class="fa-solid fa-ban"></i> Suspend</button>
      </div>
    `;

    tr.innerHTML = `
      <td style="padding: 10px 8px;"><strong>${device.name}</strong></td>
      <td style="padding: 10px 8px; font-family: monospace; font-size: 11px;">${device.ip_address}</td>
      <td style="padding: 10px 8px; font-size: 11px; color: var(--text-muted);">${device.equipment_type}</td>
      <td style="padding: 10px 8px;"><span class="table-tag" style="font-size: 10px;">${terminalLabel(device.terminal)}</span></td>
      <td style="padding: 10px 8px; font-size: 11px;">${device.location}</td>
      <td style="padding: 10px 8px;">${statusDesc}</td>
      <td style="padding: 10px 8px; text-align: right;">${operationsCellHtml}</td>
    `;
    listBody.appendChild(tr);
  });

  // Render incident pagination
  paginationEl.innerHTML = '';
  if (totalPages > 1) {
    const prevBtn = document.createElement('button');
    prevBtn.className = 'icon-btn';
    prevBtn.disabled = priorityCurrentPage === 1;
    prevBtn.innerHTML = '<i class="fa-solid fa-angle-left"></i>';
    prevBtn.onclick = () => { priorityCurrentPage--; renderPriorityIncidents(); };
    
    const info = document.createElement('span');
    info.textContent = `Page ${priorityCurrentPage} of ${totalPages}`;
    
    const nextBtn = document.createElement('button');
    nextBtn.className = 'icon-btn';
    nextBtn.disabled = priorityCurrentPage === totalPages;
    nextBtn.innerHTML = '<i class="fa-solid fa-angle-right"></i>';
    nextBtn.onclick = () => { priorityCurrentPage++; renderPriorityIncidents(); };

    paginationEl.appendChild(prevBtn);
    paginationEl.appendChild(info);
    paginationEl.appendChild(nextBtn);
  }
}
window.renderPriorityIncidents = renderPriorityIncidents;


// ─── PING MANAGER AND SCHEDULER CONFIGS ────────────────────────────────────────

function fetchSchedulerConfig() {
  fetch('/api/config/scheduler')
  .then(res => res.json())
  .then(data => {
    document.getElementById('cfg-batch-size').value = data.batchSize;
    document.getElementById('cfg-ping-interval').value = data.pingInterval;
    document.getElementById('cfg-tg-enabled').checked = data.telegramEnabled;
    document.getElementById('cfg-tg-token').value = data.telegramToken;
    document.getElementById('cfg-tg-chatid').value = data.telegramChatId;
    document.getElementById('cfg-offline-alarm').checked = data.offlineAlarmEnabled;
  })
  .catch(err => console.error('Failed to load configurations:', err));
}
window.fetchSchedulerConfig = fetchSchedulerConfig;

function saveSchedulerConfig() {
  const batchSize = parseInt(document.getElementById('cfg-batch-size').value);
  const pingInterval = parseInt(document.getElementById('cfg-ping-interval').value);
  const telegramEnabled = document.getElementById('cfg-tg-enabled').checked;
  const telegramToken = document.getElementById('cfg-tg-token').value;
  const telegramChatId = document.getElementById('cfg-tg-chatid').value;
  const offlineAlarmEnabled = document.getElementById('cfg-offline-alarm').checked;

  fetch('/api/config/scheduler', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batchSize, pingInterval, telegramEnabled, telegramToken, telegramChatId, offlineAlarmEnabled })
  })
  .then(res => res.json())
  .then(data => {
    alert('Scheduler configurations saved successfully.');
    renderBatchesVisualizer(); // Re-render visualizer grid
  })
  .catch(err => alert(`Failed to save configurations: ${err.message}`));
}
window.saveSchedulerConfig = saveSchedulerConfig;

async function clearStatusLogs() {
  if (!confirm("Are you sure you want to clear all logs older than 3 days and delete temporary dump files?")) return;
  try {
    const res = await fetch('/api/admin/clear-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      alert("System maintenance completed: Logs older than 3 days cleared and dump files deleted.");
      if (typeof fetchAllLogs === 'function') {
        fetchAllLogs();
      }
    } else {
      alert("Maintenance failed: " + (data.error || "Unknown error"));
    }
  } catch (err) {
    alert("Network error: " + err.message);
  }
}
window.clearStatusLogs = clearStatusLogs;

function startPerformanceMonitorPolling() {
  if (perfPollInterval) clearInterval(perfPollInterval);

  const fetchStats = () => {
    fetch('/api/system-stats')
    .then(res => res.json())
    .then(data => {
      const cpuPct  = parseFloat(data.cpuUsage)  || 0;
      const ramPct  = parseFloat(data.ramUsage)  || 0;
      const usedGb  = data.usedMemGb  || '0.0';
      const totalGb = data.totalMemGb || '0.0';

      // CPU elements
      const cpuUsageEl = document.getElementById('srv-cpu-usage');
      const cpuBarEl   = document.getElementById('srv-cpu-bar');
      if (cpuUsageEl) cpuUsageEl.textContent = `${cpuPct.toFixed(1)}%`;
      if (cpuBarEl) {
        cpuBarEl.style.width = `${Math.min(cpuPct, 100)}%`;
        cpuBarEl.style.background = cpuPct >= 80 ? '#ef4444' : cpuPct >= 50 ? '#fbbf24' : '#10b981';
      }

      // RAM elements
      const ramUsageEl = document.getElementById('srv-ram-usage');
      const ramBarEl   = document.getElementById('srv-ram-bar');
      if (ramUsageEl) ramUsageEl.textContent = `${ramPct.toFixed(1)}% / ${usedGb} GB of ${totalGb} GB`;
      if (ramBarEl) {
        ramBarEl.style.width = `${Math.min(ramPct, 100)}%`;
        ramBarEl.style.background = ramPct >= 85 ? '#ef4444' : ramPct >= 60 ? '#fbbf24' : '#06b6d4';
      }
    })
    .catch(err => console.warn('Server stats fetch failed:', err));
  };

  fetchStats();
  perfPollInterval = setInterval(fetchStats, 5000);
}
window.startPerformanceMonitorPolling = startPerformanceMonitorPolling;


function stopPerformanceMonitorPolling() {
  if (perfPollInterval) {
    clearInterval(perfPollInterval);
    perfPollInterval = null;
  }
}
window.stopPerformanceMonitorPolling = stopPerformanceMonitorPolling;

function renderBatchesVisualizer() {
  const container = document.getElementById('batches-visualizer-container');
  if (!container) return;

  const batchSize = parseInt(document.getElementById('cfg-batch-size').value) || 30;
  container.innerHTML = '';

  const totalDevices = devices.length;
  if (totalDevices === 0) {
    container.innerHTML = `<div style="color:var(--text-muted); font-size:12px;">No devices loaded to visualize batches.</div>`;
    return;
  }

  // Slice devices list into batches
  let batchIndex = 1;
  for (let i = 0; i < totalDevices; i += batchSize) {
    const batchDevices = devices.slice(i, i + batchSize);
    
    const card = document.createElement('div');
    card.className = 'glass';
    card.style.padding = '12px 14px';
    card.style.borderRadius = '8px';
    card.style.border = '1px solid rgba(255,255,255,0.06)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '8px';
    
    // Group status
    const onlineCount = batchDevices.filter(d => d.status === 'Online').length;
    const offlineCount = batchDevices.filter(d => d.status === 'Offline').length;
    const anomalyCount = batchDevices.filter(d => d.status === 'Anomaly').length;

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom:6px;">
        <strong style="color:#c084fc; font-size:13px;">Group Batch #${batchIndex}</strong>
        <span style="font-size:10px; background:rgba(255,255,255,0.05); padding:1px 6px; border-radius:3px; color:var(--text-muted);">${batchDevices.length} Devs</span>
      </div>
      <div style="font-size:11px; display:flex; flex-direction:column; gap:3px;">
        <div style="display:flex; justify-content:space-between;"><span>🟢 Online:</span> <span>${onlineCount}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>🔴 Offline:</span> <span style="color:${offlineCount > 0 ? '#f87171' : 'inherit'};">${offlineCount}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>⚠️ Anomaly:</span> <span style="color:${anomalyCount > 0 ? '#fbbf24' : 'inherit'};">${anomalyCount}</span></div>
      </div>
    `;
    container.appendChild(card);
    batchIndex++;
  }
}
window.renderBatchesVisualizer = renderBatchesVisualizer;

function testTelegramAlert() {
  const telegramToken = document.getElementById('cfg-tg-token').value;
  const telegramChatId = document.getElementById('cfg-tg-chatid').value;

  if (!telegramToken || !telegramChatId) {
    alert('Please enter Bot Token API and Group Chat ID before testing.');
    return;
  }

  // Change button state to loading
  const testBtn = document.querySelector('.test-tg-btn');
  const oldText = testBtn.innerHTML;
  testBtn.disabled = true;
  testBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending...`;

  fetch('/api/config/test-telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegramToken, telegramChatId })
  })
  .then(res => res.json())
  .then(data => {
    testBtn.disabled = false;
    testBtn.innerHTML = oldText;
    if (data.success) {
      alert(`✅ Success: ${data.message}`);
    } else {
      alert(`❌ Failed: ${data.error}`);
    }
  })
  .catch(err => {
    testBtn.disabled = false;
    testBtn.innerHTML = oldText;
    alert(`❌ Connection Error: ${err.message}`);
  });
}
window.testTelegramAlert = testTelegramAlert;

// 📈 Uptime & Reliability Analytics Tab Handlers
let analyticsChartInstance = null;

async function initializeAnalyticsTab() {
  const selectEl = document.getElementById('analytics-device-select');
  if (!selectEl) return;
  
  try {
    const res = await fetch('/api/devices');
    const devices = await res.json();
    
    selectEl.innerHTML = `
      <optgroup label="System-wide Analysis">
        <option value="overall" selected>🌐 All Systems Overall</option>
      </optgroup>
      <optgroup label="Equipment Category Analysis">
        <option value="category:FIDS">📺 FIDS Monitors</option>
        <option value="category:Server FIDS">🖥️ FIDS Servers</option>
        <option value="category:CCTV">📹 CCTV Cameras</option>
        <option value="category:Server CCTV">🖥️ CCTV Servers</option>
        <option value="category:IP PABX">📞 IP PABX System</option>
        <option value="category:Fire Alarm System">🚨 Fire Alarm System</option>
        <option value="category:Server Fire Alarm System">🖥️ Fire Alarm Servers</option>
      </optgroup>
      <optgroup label="Individual Device Analysis" id="analytics-individual-devices">
      </optgroup>
    `;

    const individualGroup = document.getElementById('analytics-individual-devices');
    devices.forEach(d => {
      const opt = document.createElement('option');
      opt.value = `device:${d.id}`;
      opt.textContent = `${d.name} (${d.ip_address})`;
      individualGroup.appendChild(opt);
    });

    // Default to overall system analytics
    selectEl.value = 'overall';
    loadDeviceAnalytics();
  } catch (err) {
    console.error('Failed to populate analytics devices:', err);
  }
}

async function loadDeviceAnalytics() {
  const selectEl = document.getElementById('analytics-device-select');
  if (!selectEl || !selectEl.value) return;

  const dateInput = document.getElementById('analytics-date-filter');
  const dateVal = dateInput ? dateInput.value : '';
  const dateQuery = dateVal ? `?date=${encodeURIComponent(dateVal)}` : '';

  const selectVal = selectEl.value;
  let metricsUrl = '';
  let historyUrl = '';

  if (selectVal === 'overall') {
    metricsUrl = '/api/analytics/overall' + dateQuery;
    historyUrl = '/api/analytics/overall/history' + dateQuery;
  } else if (selectVal.startsWith('category:')) {
    const cat = selectVal.split(':')[1];
    metricsUrl = `/api/analytics/category/${encodeURIComponent(cat)}` + dateQuery;
    historyUrl = `/api/analytics/category/${encodeURIComponent(cat)}/history` + dateQuery;
  } else {
    const deviceId = selectVal.startsWith('device:') ? selectVal.split(':')[1] : selectVal;
    metricsUrl = `/api/devices/${deviceId}/analytics` + dateQuery;
    historyUrl = `/api/devices/${deviceId}/uptime-history` + dateQuery;
  }

  try {
    const analyticRes = await fetch(metricsUrl);
    const metrics = await analyticRes.json();

    const availVal = document.getElementById('analytics-avail-val');
    availVal.textContent = `${metrics.availability.toFixed(4)}%`;
    if (metrics.availability >= 99.9) {
      availVal.style.color = '#10b981';
    } else if (metrics.availability >= 99.0) {
      availVal.style.color = '#38bdf8';
    } else if (metrics.availability >= 95.0) {
      availVal.style.color = '#f59e0b';
    } else {
      availVal.style.color = '#ef4444';
    }

    const mttrVal = document.getElementById('analytics-mttr-val');
    mttrVal.textContent = formatDurationSecs(metrics.mttr);

    const mtbfVal = document.getElementById('analytics-mtbf-val');
    mtbfVal.textContent = formatDurationSecs(metrics.mtbf);

    const gradeEl = document.getElementById('analytics-health-grade');
    const badgeEl = document.getElementById('analytics-health-badge');
    gradeEl.textContent = metrics.category.toUpperCase();

    if (metrics.category === 'Excellent') {
      gradeEl.style.color = '#10b981';
      badgeEl.textContent = 'Excellent (Sangat Sehat)';
      badgeEl.style.background = 'rgba(16, 185, 129, 0.15)';
      badgeEl.style.color = '#10b981';
      badgeEl.style.borderColor = 'rgba(16, 185, 129, 0.25)';
    } else if (metrics.category === 'Good') {
      gradeEl.style.color = '#38bdf8';
      badgeEl.textContent = 'Good / Normal';
      badgeEl.style.background = 'rgba(56, 189, 248, 0.15)';
      badgeEl.style.color = '#38bdf8';
      badgeEl.style.borderColor = 'rgba(56, 189, 248, 0.25)';
    } else if (metrics.category === 'Fair') {
      gradeEl.style.color = '#f59e0b';
      badgeEl.textContent = 'Fair (Butuh Perhatian)';
      badgeEl.style.background = 'rgba(245, 158, 11, 0.15)';
      badgeEl.style.color = '#f59e0b';
      badgeEl.style.borderColor = 'rgba(245, 158, 11, 0.25)';
    } else {
      gradeEl.style.color = '#ef4444';
      badgeEl.textContent = 'Poor (Kritis)';
      badgeEl.style.background = 'rgba(239, 68, 68, 0.15)';
      badgeEl.style.color = '#ef4444';
      badgeEl.style.borderColor = 'rgba(239, 68, 68, 0.25)';
    }

    const historyRes = await fetch(historyUrl);
    const history = await historyRes.json();

    const historyList = document.getElementById('analytics-history-list');
    historyList.innerHTML = '';
    
    if (history.length === 0) {
      historyList.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding-top:20px;">No historical uptime logs recorded.</div>';
    } else {
      const sortedHistory = [...history].sort((a,b) => new Date(b.date) - new Date(a.date));
      sortedHistory.forEach(r => {
        const item = document.createElement('div');
        item.style.background = 'rgba(255,255,255,0.02)';
        item.style.border = '1px solid rgba(255,255,255,0.05)';
        item.style.padding = '10px';
        item.style.borderRadius = '8px';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';

        // Handle both plain date string (YYYY-MM-DD) and ISO timestamp
        const rawDate = r.date;
        const dateObj = typeof rawDate === 'string' && rawDate.length === 10
          ? new Date(rawDate + 'T00:00:00+07:00')
          : new Date(rawDate);
        const dateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

        const uptimePct = parseFloat(r.uptime_pct);
        const availColor = uptimePct >= 99.9 ? '#10b981' : uptimePct >= 99.0 ? '#38bdf8' : uptimePct >= 95.0 ? '#f59e0b' : '#ef4444';

        item.innerHTML = `
          <div>
            <strong style="display:block;font-size:13px;">${dateStr}</strong>
            <span style="font-size:10px;color:var(--text-muted);">Incidents: ${r.incident_count || 0} | Downtime: ${r.downtime_seconds || 0}s</span>
          </div>
          <span style="font-weight:700;color:${availColor};font-size:14px;">${uptimePct.toFixed(4)}%</span>
        `;
        historyList.appendChild(item);
      });
    }

    renderAnalyticsTrendChart(history);

  } catch (err) {
    console.error('Failed to load device analytics:', err);
  }
}

function formatDurationSecs(totalSeconds) {
  if (totalSeconds === 0) return '0s';
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m ${Math.floor(totalSeconds % 60)}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${Math.floor(minutes % 60)}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${Math.floor(hours % 24)}h`;
}

function renderAnalyticsTrendChart(historyData) {
  const ctx = document.getElementById('analyticsChart');
  if (!ctx) return;

  if (analyticsChartInstance) {
    analyticsChartInstance.destroy();
  }

  // Generate continuous 7-day timeline (past 6 days + today)
  const days = [];
  const dayLabels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    days.push(dateKey);
    dayLabels.push(d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
  }

  // Map history data into 7-day timeline
  const chartData = days.map(dateKey => {
    const record = (historyData || []).find(r => {
      const rDate = typeof r.date === 'string' ? r.date.split('T')[0] : '';
      return rDate === dateKey;
    });
    return record ? parseFloat(record.uptime_pct) : 100.00;
  });

  const minVal = Math.min(...chartData);
  const yMin = minVal < 98 ? Math.max(0, Math.floor(minVal - 2)) : 98;

  analyticsChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dayLabels,
      datasets: [{
        label: 'Operational Uptime (%)',
        data: chartData,
        borderColor: '#ec4899',
        backgroundColor: 'rgba(236, 72, 153, 0.12)',
        borderWidth: 3,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#ec4899',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `Uptime: ${context.parsed.y.toFixed(2)}%`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: 'rgba(255,255,255,0.7)', font: { size: 11 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { 
            color: 'rgba(255,255,255,0.7)', 
            font: { size: 11 },
            callback: (val) => `${val}%`
          },
          min: yMin,
          max: 100.1
        }
      }
    }
  });
}

window.initializeAnalyticsTab = initializeAnalyticsTab;
window.loadDeviceAnalytics = loadDeviceAnalytics;

let currentLatencySort = 'DEFAULT';

function onLatencySortChange() {
  const filterEl = document.getElementById('latency-sort-filter');
  currentLatencySort = filterEl ? filterEl.value : 'DEFAULT';
  renderDashboard();
}
window.onLatencySortChange = onLatencySortChange;

function clearAnalyticsDateFilter() {
  const dateInput = document.getElementById('analytics-date-filter');
  if (dateInput) dateInput.value = '';
  loadDeviceAnalytics();
}
window.clearAnalyticsDateFilter = clearAnalyticsDateFilter;

function openPdfExportModal() {
  const modal = document.getElementById('pdf-export-modal');
  if (modal) modal.classList.add('active');
}
window.openPdfExportModal = openPdfExportModal;

function closePdfExportModal() {
  const modal = document.getElementById('pdf-export-modal');
  if (modal) modal.classList.remove('active');
}
window.closePdfExportModal = closePdfExportModal;

function togglePdfPeriodInputs() {
  const radio = document.querySelector('input[name="pdf-period-type"]:checked');
  const periodType = radio ? radio.value : 'today';
  const dateContainer = document.getElementById('pdf-date-input-container');
  const monthContainer = document.getElementById('pdf-month-input-container');

  if (dateContainer) dateContainer.style.display = periodType === 'select-date' ? 'flex' : 'none';
  if (monthContainer) monthContainer.style.display = periodType === 'monthly' ? 'flex' : 'none';
}
window.togglePdfPeriodInputs = togglePdfPeriodInputs;

async function generateAnalyticsPdfReport() {
  const radio = document.querySelector('input[name="pdf-period-type"]:checked');
  const periodType = radio ? radio.value : 'today';
  const scopeVal = document.getElementById('pdf-scope-select').value;
  
  let periodLabel = 'Today';
  let dateQueryStr = '';
  const todayStr = new Date().toISOString().split('T')[0];

  if (periodType === 'today') {
    periodLabel = `Hari Ini (${todayStr})`;
    dateQueryStr = `?date=${todayStr}`;
  } else if (periodType === 'select-date') {
    const selDate = document.getElementById('pdf-select-date').value;
    if (!selDate) {
      alert('Silakan pilih tanggal laporan terlebih dahulu');
      return;
    }
    periodLabel = `Tanggal: ${selDate}`;
    dateQueryStr = `?date=${selDate}`;
  } else if (periodType === 'monthly') {
    const selMonth = document.getElementById('pdf-select-month').value;
    if (!selMonth) {
      alert('Silakan pilih bulan & tahun laporan terlebih dahulu');
      return;
    }
    periodLabel = `Bulan: ${selMonth}`;
    dateQueryStr = `?month=${selMonth}`;
  }

  closePdfExportModal();

  let metricsUrl = '/api/analytics/overall' + dateQueryStr;
  let historyUrl = '/api/analytics/overall/history' + dateQueryStr;
  let scopeTitle = 'Semua Fasilitas & Sistem (Overall)';

  if (scopeVal.startsWith('cat-')) {
    const cat = scopeVal.split('-')[1];
    scopeTitle = `Kategori: ${cat}`;
    metricsUrl = `/api/analytics/category/${encodeURIComponent(cat)}` + dateQueryStr;
    historyUrl = `/api/analytics/category/${encodeURIComponent(cat)}/history` + dateQueryStr;
  }

  try {
    const [metricsRes, historyRes] = await Promise.all([
      fetch(metricsUrl),
      fetch(historyUrl)
    ]);
    const metrics = await metricsRes.json();
    const history = await historyRes.json();

    const reportWindow = window.open('', '_blank', 'width=920,height=850');
    if (!reportWindow) {
      alert('Popup blocker menghalangi pembukaan laporan. Izinkan popup di browser Anda untuk mengunduh laporan PDF.');
      return;
    }

    const filteredDevices = scopeVal.startsWith('cat-') 
      ? devices.filter(d => d.equipment_type === scopeVal.split('-')[1])
      : devices;

    const reportHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>NOC Performance & Availability Report - ${periodLabel}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 30px; margin: 0; background: #fff; line-height: 1.4; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; }
          .header h1 { margin: 0; font-size: 20px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
          .header p { margin: 4px 0 0 0; font-size: 12px; color: #64748b; }
          .badge-noc { background: #0284c7; color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; }
          
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 25px; }
          .kpi-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; background: #f8fafc; }
          .kpi-title { font-size: 10px; color: #64748b; text-transform: uppercase; margin-bottom: 6px; font-weight: 700; letter-spacing: 0.5px; }
          .kpi-value { font-size: 20px; font-weight: bold; color: #0f172a; }
          
          .section-title { font-size: 14px; font-weight: bold; margin: 24px 0 10px 0; color: #0f172a; border-left: 4px solid #ec4899; padding-left: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
          th, td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; }
          th { background: #f1f5f9; color: #334155; font-size: 10px; text-transform: uppercase; font-weight: bold; }
          tr:nth-child(even) { background: #f8fafc; }

          .status-tag { font-weight: bold; padding: 2px 6px; border-radius: 3px; font-size: 10px; display: inline-block; }
          .status-online { background: #dcfce7; color: #166534; }
          .status-offline { background: #fee2e2; color: #991b1b; }
          .status-anomaly { background: #fef3c7; color: #92400e; }
          .status-suspended { background: #f1f5f9; color: #475569; }

          .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }

          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 15px; text-align: right;">
          <button onclick="window.print()" style="padding: 8px 18px; background: #0284c7; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px;">🖨️ Cetak / Simpan ke PDF</button>
        </div>

        <div class="header">
          <div>
            <h1>Airport NOC Performance & Availability Report</h1>
            <p>Ruang Lingkup: <strong>${scopeTitle}</strong> | Periode: <strong>${periodLabel}</strong></p>
          </div>
          <div style="text-align: right;">
            <span class="badge-noc">FIDS MONITORING SYSTEM</span>
            <p style="font-size: 10px; margin-top: 4px; color: #64748b;">Tanggal Cetak: ${new Date().toLocaleString('id-ID')}</p>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-title">Operational Availability</div>
            <div class="kpi-value" style="color: ${metrics.availability >= 99.9 ? '#166534' : '#d97706'};">${metrics.availability ? metrics.availability.toFixed(4) : '100.0000'}%</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">MTBF (Mean Time Between Failure)</div>
            <div class="kpi-value" style="font-size: 16px;">${formatDurationSecs(metrics.mtbf || 86400)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">MTTR (Mean Time To Repair)</div>
            <div class="kpi-value" style="font-size: 16px;">${formatDurationSecs(metrics.mttr || 0)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Facility Health Category</div>
            <div class="kpi-value" style="font-size: 16px; color: ${metrics.category === 'Excellent' ? '#166534' : '#d97706'};">${metrics.category ? metrics.category.toUpperCase() : 'EXCELLENT'}</div>
          </div>
        </div>

        <div class="section-title">Histori Ketersediaan & Downtime Log (${history.length} Catatan)</div>
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Jumlah Insiden</th>
              <th>Total Downtime (Detik)</th>
              <th>SLA Availability %</th>
            </tr>
          </thead>
          <tbody>
            ${history.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:#64748b;">Tidak ada data log histori untuk periode ini.</td></tr>' : history.map(r => `
              <tr>
                <td><strong>${r.date}</strong></td>
                <td>${r.incident_count || 0} Insiden</td>
                <td>${r.downtime_seconds || 0} Detik</td>
                <td style="font-weight: bold; color: ${r.uptime_pct >= 99.9 ? '#166534' : '#d97706'};">${parseFloat(r.uptime_pct).toFixed(4)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="section-title">Daftar Perangkat & Latensi Jarak Jauh (${filteredDevices.length} Devices)</div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nama Perangkat</th>
              <th>Alamat IP</th>
              <th>Terminal</th>
              <th>Tipe Peralatan</th>
              <th>Status Operasional</th>
              <th>Latency Ping</th>
            </tr>
          </thead>
          <tbody>
            ${filteredDevices.map(d => {
              let stClass = 'status-online';
              let stText = d.status;
              if (d.status === 'Offline') stClass = 'status-offline';
              else if (d.status === 'Anomaly') stClass = 'status-anomaly';
              if (d.health_status_detail && d.health_status_detail.startsWith('Suspended')) {
                stClass = 'status-suspended';
                stText = `Offline (${d.health_status_detail})`;
              }
              return `
                <tr>
                  <td>#${d.id}</td>
                  <td><strong>${d.name}</strong></td>
                  <td><code>${d.ip_address}</code></td>
                  <td>${d.terminal}</td>
                  <td>${d.equipment_type}</td>
                  <td><span class="status-tag ${stClass}">${stText}</span></td>
                  <td>${d.latency_ms !== null ? d.latency_ms + ' ms' : '-'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          <span>Airport Network Operations Center (NOC) — FIDS Infrastructure System</span>
          <span>Halaman Laporan Resmi — Rahasia / Dokumen Internal</span>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 600);
          };
        </script>
      </body>
      </html>
    `;

    reportWindow.document.open();
    reportWindow.document.write(reportHtml);
    reportWindow.document.close();

  } catch (err) {
    alert(`Gagal generate laporan PDF: ${err.message}`);
  }
}
window.generateAnalyticsPdfReport = generateAnalyticsPdfReport;

function onDeviceIpInput(val) {
  const hintEl = document.getElementById('ip-cluster-hint');
  const typeSelect = document.getElementById('device-equipment-type');
  if (!hintEl) return;

  if (!val || val.trim().length < 7) {
    hintEl.innerHTML = '';
    return;
  }

  const matched = findMatchingIpCluster(val.trim());
  if (matched) {
    hintEl.innerHTML = `<span style="color: #34d399; font-weight: 600;"><i class="fa-solid fa-circle-check"></i> Matched Cluster: ${matched.name} (${matched.equipment_type})</span>`;
    if (typeSelect) {
      for (let i = 0; i < typeSelect.options.length; i++) {
        if (typeSelect.options[i].value === matched.equipment_type) {
          typeSelect.selectedIndex = i;
          break;
        }
      }
    }
  } else {
    hintEl.innerHTML = `<span style="color: #fbbf24;"><i class="fa-solid fa-triangle-exclamation"></i> IP di luar cluster terdaftar (Restriksi ping dapat diatur di Ping Manager)</span>`;
  }
}
window.onDeviceIpInput = onDeviceIpInput;

function renderIpClustersTable() {
  const tbody = document.getElementById('ip-clusters-table-body');
  if (!tbody) return;

  if (!ipClusters || ipClusters.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color: var(--text-muted);">Belum ada Cluster IP yang terdaftar. Klik "+ Add New IP Cluster" untuk menambahkan.</td></tr>`;
    return;
  }

  tbody.innerHTML = ipClusters.map(cl => {
    const isActive = cl.is_active === 1 || cl.is_active === '1' || cl.is_active === true;
    const statusTag = isActive
      ? `<span class="table-tag text-green"><i class="fa-solid fa-circle-check"></i> Aktif (Allowed)</span>`
      : `<span class="table-tag text-red"><i class="fa-solid fa-ban"></i> Nonaktif (Restricted)</span>`;

    return `
      <tr>
        <td>#${cl.id}</td>
        <td><strong>${cl.name}</strong></td>
        <td><span class="table-tag text-purple">${cl.equipment_type}</span></td>
        <td><code style="color:#38bdf8;">${cl.ip_start} – ${cl.ip_end}</code></td>
        <td>${statusTag}</td>
        <td style="color: var(--text-muted);">${cl.description || '-'}</td>
        <td style="text-align: center;">
          <button onclick="editIpCluster(${cl.id})" style="padding: 4px 8px; font-size: 11px; border-radius: 4px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.25); cursor: pointer; margin-right: 4px;"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
          <button onclick="deleteIpCluster(${cl.id})" style="padding: 4px 8px; font-size: 11px; border-radius: 4px; background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.25); cursor: pointer;"><i class="fa-solid fa-trash"></i> Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}
window.renderIpClustersTable = renderIpClustersTable;

function openIpClusterModal(cluster = null) {
  const modal = document.getElementById('ip-cluster-modal');
  const title = document.getElementById('ip-cluster-modal-title');
  const form = document.getElementById('ip-cluster-form');
  if (!modal || !form) return;

  form.reset();

  if (cluster) {
    title.textContent = `Edit IP Cluster #${cluster.id}`;
    document.getElementById('cluster-id').value = cluster.id;
    document.getElementById('cluster-name').value = cluster.name;
    document.getElementById('cluster-equipment-type').value = cluster.equipment_type;
    document.getElementById('cluster-ip-start').value = cluster.ip_start;
    document.getElementById('cluster-ip-end').value = cluster.ip_end;
    document.getElementById('cluster-description').value = cluster.description || '';
    document.getElementById('cluster-is-active').checked = cluster.is_active === 1 || cluster.is_active === '1' || cluster.is_active === true;
  } else {
    title.textContent = 'Add New IP Cluster';
    document.getElementById('cluster-id').value = '';
    document.getElementById('cluster-is-active').checked = true;
  }

  modal.classList.add('active');
}
window.openIpClusterModal = openIpClusterModal;

function closeIpClusterModal() {
  const modal = document.getElementById('ip-cluster-modal');
  if (modal) modal.classList.remove('active');
}
window.closeIpClusterModal = closeIpClusterModal;

async function submitIpClusterForm(e) {
  e.preventDefault();

  const id = document.getElementById('cluster-id').value;
  const name = document.getElementById('cluster-name').value;
  const equipmentType = document.getElementById('cluster-equipment-type').value;
  const ipStart = document.getElementById('cluster-ip-start').value;
  const ipEnd = document.getElementById('cluster-ip-end').value;
  const description = document.getElementById('cluster-description').value;
  const isActive = document.getElementById('cluster-is-active').checked;

  if (!name || !equipmentType || !ipStart || !ipEnd) {
    alert('Nama Cluster, Kategori Peralatan, IP Awal, dan IP Akhir wajib diisi!');
    return;
  }

  const user = getCurrentUser();
  const userRole = (user && user.role) ? user.role : 'admin';

  const payload = { name, equipmentType, ipStart, ipEnd, description, isActive };
  const method = id ? 'PUT' : 'POST';
  const url = id ? `/api/ip-clusters/${id}` : '/api/ip-clusters';

  const headers = {
    'Content-Type': 'application/json',
    'X-User-Role': userRole
  };

  try {
    const res = await fetch(url, {
      method,
      headers: headers,
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (parseErr) {
      alert(`Server Response Error (${res.status}): ${text.substring(0, 150)}`);
      return;
    }

    if (!res.ok || result.error) {
      alert(`Gagal menyimpan Cluster IP: ${result.error || result.message || 'Error HTTP ' + res.status}`);
      return;
    }

    closeIpClusterModal();
    
    // Refresh clusters list
    const clustersRes = await fetch('/api/ip-clusters');
    if (clustersRes.ok) {
      ipClusters = await clustersRes.json();
      updateEquipmentGroupsFromClusters();
      renderIpClustersTable();
    }

  } catch (err) {
    alert(`Network Error: ${err.message}`);
  }
}
window.submitIpClusterForm = submitIpClusterForm;

function editIpCluster(id) {
  const cluster = ipClusters.find(c => c.id === id);
  if (cluster) openIpClusterModal(cluster);
}
window.editIpCluster = editIpCluster;

async function deleteIpCluster(id) {
  const cluster = ipClusters.find(c => c.id === id);
  const name = cluster ? cluster.name : `#${id}`;

  if (!confirm(`Apakah Anda yakin ingin menghapus IP Cluster "${name}"?`)) return;

  const user = getCurrentUser();
  const userRole = (user && user.role) ? user.role : 'admin';

  const headers = {
    'Content-Type': 'application/json',
    'X-User-Role': userRole
  };

  try {
    const res = await fetch(`/api/ip-clusters/${id}`, { method: 'DELETE', headers });
    const text = await res.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (parseErr) {
      alert(`Server Response Error (${res.status}): ${text.substring(0, 150)}`);
      return;
    }

    if (!res.ok || result.error) {
      alert(`Gagal menghapus Cluster IP: ${result.error || 'Error HTTP ' + res.status}`);
      return;
    }

    const clustersRes = await fetch('/api/ip-clusters');
    if (clustersRes.ok) {
      ipClusters = await clustersRes.json();
      updateEquipmentGroupsFromClusters();
      renderIpClustersTable();
    }
  } catch (err) {
    alert(`Network Error: ${err.message}`);
  }
}
window.deleteIpCluster = deleteIpCluster;

// VNC Remote Control Viewer State
let currentVncDevice = null;

function openVncRemoteModal(deviceId) {
  const device = devices.find(d => d.id === deviceId);
  if (!device) return;

  currentVncDevice = device;
  const modal = document.getElementById('vnc-remote-modal');
  const title = document.getElementById('vnc-remote-title');
  const statusOverlay = document.getElementById('vnc-status-overlay');
  
  if (title) title.textContent = `${device.name} (${device.ip_address}:5900)`;
  if (statusOverlay) statusOverlay.innerHTML = `<i class="fa-solid fa-signal" style="color:#10b981;"></i> VNC Connected: ${device.ip_address}`;

  if (modal) modal.classList.add('active');

  // Draw simulated/active remote screen frame
  const canvas = document.getElementById('vnc-remote-canvas');
  if (canvas) {
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, 1280, 720);

    // Draw simulated FIDS screen or login screen
    if (device.health_status_detail && device.health_status_detail.includes('Sign In')) {
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, 0, 1280, 720);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(440, 200, 400, 320);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('FIDS APPS', 640, 260);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Sign In required', 640, 300);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(480, 330, 320, 40);
      ctx.fillRect(480, 390, 320, 40);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(480, 450, 320, 44);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('Sign In', 640, 477);
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 1280, 720);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(`FLIGHT INFORMATION DISPLAY - ${device.name}`, 60, 60);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(60, 100, 1160, 560);
    }
  }
}
window.openVncRemoteModal = openVncRemoteModal;

function closeVncRemoteModal() {
  const modal = document.getElementById('vnc-remote-modal');
  if (modal) modal.classList.remove('active');
  currentVncDevice = null;
}
window.closeVncRemoteModal = closeVncRemoteModal;

function autoFillFidsCredentials() {
  if (!currentVncDevice) {
    alert('Buka Remote Control VNC pada perangkat FIDS terlebih dahulu!');
    return;
  }
  
  // Show active feedback toast
  const overlay = document.getElementById('vnc-status-overlay');
  if (overlay) {
    overlay.innerHTML = `<i class="fa-solid fa-key" style="color:#fbbf24;"></i> Sending Credentials: elektro / tlp808rgn443...`;
    setTimeout(() => {
      overlay.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#10b981;"></i> Auto-Fill Success! Logging in to ${currentVncDevice.ip_address}...`;
    }, 1200);
  }
}
window.autoFillFidsCredentials = autoFillFidsCredentials;

function openFidsWebSignInUrl() {
  const ip = currentVncDevice ? currentVncDevice.ip_address : '172.23.1.41';
  const targetUrl = `http://${ip}:90/fids/`;
  window.open(targetUrl, '_blank');
}
window.openFidsWebSignInUrl = openFidsWebSignInUrl;

function toggleVirtualKeyboard() {
  const panel = document.getElementById('vnc-virtual-keyboard-panel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' || !panel.style.display ? 'flex' : 'none';
}
window.toggleVirtualKeyboard = toggleVirtualKeyboard;

function toggleTouchMousepad() {
  const panel = document.getElementById('vnc-touch-mousepad-panel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' || !panel.style.display ? 'flex' : 'none';
}
window.toggleTouchMousepad = toggleTouchMousepad;

function sendVncKey(key) {
  const overlay = document.getElementById('vnc-status-overlay');
  if (overlay) {
    overlay.innerHTML = `<i class="fa-solid fa-keyboard" style="color:#c084fc;"></i> Key Sent: [ ${key} ]`;
  }
}
window.sendVncKey = sendVncKey;

function sendVncClick(button) {
  const overlay = document.getElementById('vnc-status-overlay');
  if (overlay) {
    overlay.innerHTML = `<i class="fa-solid fa-computer-mouse" style="color:#fbbf24;"></i> Mouse Click Sent: [ ${button.toUpperCase()} CLICK ]`;
  }
}
window.sendVncClick = sendVncClick;



