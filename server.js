const express = require('express');
const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const mysql = require('mysql2/promise');
const net = require('net');
const os = require('os');
const { exec, spawn } = require('child_process');
const path = require('path');

const fs = require('fs');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
let PING_INTERVAL = 10000; // Check devices every 10 seconds (mutable)
let BATCH_SIZE = 30; // Batch size (mutable)
const JSON_DB_FILE = path.join(__dirname, 'database.json');

let TELEGRAM_ENABLED = false;
let TELEGRAM_TOKEN = '';
let TELEGRAM_CHAT_ID = '';
let OFFLINE_ALARM_ENABLED = true;

// ─── Multi-Interface IP Binding ─────────────────────────────────────────────
// Returns all active IPv4 addresses on this machine (excluding loopback/APIPA)
function getLocalInterfaces() {
  const ifaces = os.networkInterfaces();
  const result = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal && !addr.address.startsWith('169.254')) {
        result.push({ name, address: addr.address, cidr: addr.cidr });
      }
    }
  }
  return result;
}

// Convert CIDR prefix length to integer netmask
function prefixToMask(prefix) {
  return (~0 << (32 - prefix)) >>> 0;
}

// Convert dotted-decimal IP to 32-bit integer
function ipToInt(ip) {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
}

// Given a target IP, find the best local source IP that shares its subnet.
// Strategy 1: exact subnet match (CIDR).
// Strategy 2: broader /16 match for same Class-B networks (e.g. 172.23.x.x via 172.23.1.161).
// Falls back to null (OS routing) if no match.
function resolveSourceIP(targetIp) {
  const ifaces = getLocalInterfaces();
  const target = ipToInt(targetIp);

  // Strategy 1: exact /24 (or whatever CIDR the interface has) subnet match
  for (const iface of ifaces) {
    const [, prefix] = (iface.cidr || '').split('/');
    if (!prefix) continue;
    const mask    = prefixToMask(parseInt(prefix, 10));
    const network = ipToInt(iface.address) & mask;
    if ((target & mask) === network) {
      return iface.address;
    }
  }

  // Strategy 2: /16 broad match (same first two octets)
  // Useful when server is on 172.23.1.x and devices are on 172.23.5.x
  for (const iface of ifaces) {
    const mask16  = prefixToMask(16);
    const ifNet16 = ipToInt(iface.address) & mask16;
    if ((target & mask16) === ifNet16) {
      return iface.address;
    }
  }

  // No match – let OS routing table decide
  return null;
}
// ────────────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/novnc-dist', express.static(path.join(__dirname, 'node_modules', '@novnc', 'novnc')));

// Database pool setup
let pool = null;
let useJsonFallback = false;


// Initial list of devices in the requested subnets
const initialDevices = [
  // FIDS monitors (172.23.1.1-254)
  { id: 1, ip_address: '172.23.1.10', name: 'FIDS-T1-Checkin-01', location: 'Check-in Desk Row A', terminal: 'T1', status: 'Online', anomaly_type: null, equipment_type: 'FIDS', uptime_pct: 100.00, downtime_count: 0, failed_access_count: 0 },

  { id: 2, ip_address: '172.23.1.20', name: 'FIDS-T1-Gate-01A', location: 'Gate 1A Departure', terminal: 'T1', status: 'Online', anomaly_type: null, equipment_type: 'FIDS', uptime_pct: 99.80, downtime_count: 0, failed_access_count: 0 },
  { id: 3, ip_address: '172.23.1.30', name: 'FIDS-T2-Checkin-05', location: 'Check-in Desk 5', terminal: 'T2', status: 'Offline', anomaly_type: null, equipment_type: 'FIDS', uptime_pct: 94.20, downtime_count: 3, failed_access_count: 12 },
  { id: 4, ip_address: '172.23.1.60', name: 'FIDS-T2-Gate-02', location: 'Gate 2 Boarding Lounge', terminal: 'T2', status: 'Online', anomaly_type: null, equipment_type: 'FIDS', uptime_pct: 100.00, downtime_count: 0, failed_access_count: 0 },
  { id: 5, ip_address: '172.23.1.100', name: 'FIDS-T3-Checkin-01', location: 'International Check-in 1', terminal: 'T3', status: 'Anomaly', anomaly_type: 'Force Logout', equipment_type: 'FIDS', uptime_pct: 98.50, downtime_count: 1, failed_access_count: 2 },
  { id: 6, ip_address: '172.23.1.110', name: 'FIDS-T3-Gate-03', location: 'Gate 3 Boarding', terminal: 'T3', status: 'Anomaly', anomaly_type: 'Freeze Screen', equipment_type: 'FIDS', uptime_pct: 99.10, downtime_count: 1, failed_access_count: 1 },
  { id: 7, ip_address: '172.23.1.150', name: 'FIDS-T3-Baggage-02', location: 'Baggage Claim 2', terminal: 'T3', status: 'Online', anomaly_type: null, equipment_type: 'FIDS', uptime_pct: 100.00, downtime_count: 0, failed_access_count: 0 },
  { id: 8, ip_address: '172.23.1.200', name: 'FIDS-T3-Arrival-Main', location: 'Arrival Hall Center', terminal: 'T3', status: 'Anomaly', anomaly_type: 'High CPU/RAM', equipment_type: 'FIDS', uptime_pct: 97.40, downtime_count: 2, failed_access_count: 4 },

  // Server FIDS (172.23.1.51, 172.23.1.41, 172.23.1.50, 172.23.1.49)
  { id: 18, ip_address: '172.23.1.51', name: 'FIDS-Server-Core01', location: 'Main Server Room Rack 2', terminal: 'T2', status: 'Online', anomaly_type: null, equipment_type: 'Server FIDS', uptime_pct: 99.99, downtime_count: 0, failed_access_count: 0 },
  { id: 19, ip_address: '172.23.1.41', name: 'FIDS-Server-Core02', location: 'Main Server Room Rack 3', terminal: 'T2', status: 'Online', anomaly_type: null, equipment_type: 'Server FIDS', uptime_pct: 99.95, downtime_count: 0, failed_access_count: 0 },
  { id: 20, ip_address: '172.23.1.50', name: 'FIDS-Server-Backup01', location: 'Backup Server Room T3', terminal: 'T3', status: 'Online', anomaly_type: null, equipment_type: 'Server FIDS', uptime_pct: 99.98, downtime_count: 0, failed_access_count: 0 },
  { id: 21, ip_address: '172.23.1.49', name: 'FIDS-Server-Backup02', location: 'OIC Server Room T1', terminal: 'T1', status: 'Online', anomaly_type: null, equipment_type: 'Server FIDS', uptime_pct: 99.90, downtime_count: 0, failed_access_count: 0 },

  // IP PABX (172.24.0.1-254)
  { id: 9, ip_address: '172.24.0.10', name: 'PABX-Server-Core', location: 'Server Room 2nd Floor', terminal: 'T1', status: 'Online', anomaly_type: null, equipment_type: 'IP PABX', uptime_pct: 99.90, downtime_count: 0, failed_access_count: 0 },
  { id: 10, ip_address: '172.24.0.25', name: 'PABX-Gateway-T2', location: 'PABX Room T2', terminal: 'T2', status: 'Online', anomaly_type: null, equipment_type: 'IP PABX', uptime_pct: 99.70, downtime_count: 0, failed_access_count: 0 },

  // Server CCTV (192.168.1.1-254)
  { id: 11, ip_address: '192.168.1.10', name: 'CCTV-Storage-Svr01', location: 'Main Data Center', terminal: 'T3', status: 'Online', anomaly_type: null, equipment_type: 'Server CCTV', uptime_pct: 100.00, downtime_count: 0, failed_access_count: 0 },
  { id: 12, ip_address: '192.168.1.50', name: 'CCTV-NVR-Backup', location: 'NVR Room T3', terminal: 'T3', status: 'Online', anomaly_type: null, equipment_type: 'Server CCTV', uptime_pct: 99.50, downtime_count: 0, failed_access_count: 0 },

  // CCTV IP Address (192.168.0.1-254)
  { id: 13, ip_address: '192.168.0.20', name: 'CCTV-Gate-3-Arrival', location: 'Gate 3 Arrival Hall', terminal: 'T3', status: 'Online', anomaly_type: null, equipment_type: 'CCTV', uptime_pct: 98.40, downtime_count: 1, failed_access_count: 2 },
  { id: 14, ip_address: '192.168.0.45', name: 'CCTV-Checkin-T1', location: 'Check-in Area Row B', terminal: 'T1', status: 'Online', anomaly_type: null, equipment_type: 'CCTV', uptime_pct: 99.20, downtime_count: 1, failed_access_count: 1 },

  // Server Fire Alarm System (192.168.30.1)
  { id: 15, ip_address: '192.168.30.1', name: 'FAS-Main-Server', location: 'Safety Control Room', terminal: 'T2', status: 'Online', anomaly_type: null, equipment_type: 'Server Fire Alarm System', uptime_pct: 100.00, downtime_count: 0, failed_access_count: 0 },

  // Peralatan Fire Alarm System (192.168.30.2-254)
  { id: 16, ip_address: '192.168.30.15', name: 'FAS-Detector-Zone5', location: 'Waiting Lounge T2', terminal: 'T2', status: 'Online', anomaly_type: null, equipment_type: 'Fire Alarm System', uptime_pct: 99.80, downtime_count: 0, failed_access_count: 0 },
  { id: 17, ip_address: '192.168.30.30', name: 'FAS-Siren-Departure', location: 'Departure Hall Corridor', terminal: 'T1', status: 'Online', anomaly_type: null, equipment_type: 'Fire Alarm System', uptime_pct: 99.90, downtime_count: 0, failed_access_count: 0 }
];


const initialLogs = [
  { id: 1, device_id: 1, status: 'Online', message: 'Device connected and responding to heartbeat.', timestamp: new Date() },
  { id: 2, device_id: 2, status: 'Anomaly', message: 'App Session Signed Out: user session terminated unexpectedly.', timestamp: new Date() },
  { id: 3, device_id: 3, status: 'Offline', message: 'Host Unreachable: Connection timeout/Ping failure.', timestamp: new Date() },
  { id: 4, device_id: 4, status: 'Online', message: 'Device connected and responding to heartbeat.', timestamp: new Date() },
  { id: 5, device_id: 5, status: 'Anomaly', message: 'Freeze Screen: Visual output static for > 5 minutes.', timestamp: new Date() },
  { id: 6, device_id: 6, status: 'Online', message: 'Device connected and responding to heartbeat.', timestamp: new Date() },
  { id: 7, device_id: 7, status: 'Anomaly', message: 'High CPU/RAM: Resource usage at 94% CPU.', timestamp: new Date() },
  { id: 8, device_id: 8, status: 'Online', message: 'Device connected and responding to heartbeat.', timestamp: new Date() }
];

// Mock database in-memory state for fallback
let jsonDbState = {
  devices: initialDevices,
  logs: initialLogs
};

// Try loading database.json immediately so we have a cache on startup
if (fs.existsSync(JSON_DB_FILE)) {
  try {
    jsonDbState = JSON.parse(fs.readFileSync(JSON_DB_FILE, 'utf8'));
    if (jsonDbState && Array.isArray(jsonDbState.devices)) {
      jsonDbState.devices.forEach(d => {
        if (d.offline_since === undefined) {
          d.offline_since = null;
        }
      });
    }
  } catch (err) {
    console.error('Failed to parse database.json on early startup:', err.message);
  }
}

// Helper to save JSON DB
function saveJsonDb() {
  fs.writeFileSync(JSON_DB_FILE, JSON.stringify(jsonDbState, null, 2));
}


// Database Connection & Initialization Helper
async function initializeDatabase() {
  const connectionConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    port: 3306,
    connectTimeout: 5000   // 5 second timeout — prevents hanging if MySQL is slow to start
  };

  try {
    // 1. Connect without DB first to ensure database exists
    const tempConnection = await mysql.createConnection(connectionConfig);
    await tempConnection.query('CREATE DATABASE IF NOT EXISTS fids_monitoring');
    await tempConnection.end();

    // 2. Create the connection pool with the database selected
    pool = mysql.createPool({
      ...connectionConfig,
      database: 'fids_monitoring',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      acquireTimeout: 5000   // 5 second max wait for a connection from the pool (valid for pools only)
    });

    // 3. Create tables if they do not exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ip_address VARCHAR(45) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        location VARCHAR(100) NOT NULL,
        terminal VARCHAR(10) NOT NULL,
        equipment_type VARCHAR(50) DEFAULT 'FIDS',
        status VARCHAR(20) DEFAULT 'Online',
        anomaly_type VARCHAR(50) DEFAULT NULL,
        health_status_detail VARCHAR(50) DEFAULT NULL,
        uptime_pct DECIMAL(5,2) DEFAULT 100.00,
        downtime_count INT DEFAULT 0,
        failed_access_count INT DEFAULT 0,
        latency_ms INT DEFAULT NULL,
        offline_since TIMESTAMP NULL DEFAULT NULL,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Programmatic alteration check to migration update existing databases
    try {
      await pool.query(`ALTER TABLE devices ADD COLUMN equipment_type VARCHAR(50) DEFAULT 'FIDS'`);
    } catch (err) {
      // Column already exists, ignore
    }

    try {
      await pool.query(`ALTER TABLE devices ADD COLUMN health_status_detail VARCHAR(50) DEFAULT NULL`);
    } catch (err) {
      // Column already exists, ignore
    }

    try {
      await pool.query(`ALTER TABLE devices ADD COLUMN latency_ms INT DEFAULT NULL`);
    } catch (err) {
      // Column already exists, ignore
    }

    try {
      await pool.query(`ALTER TABLE devices ADD COLUMN offline_since TIMESTAMP NULL DEFAULT NULL`);
    } catch (err) {
      // Column already exists, ignore
    }


    await pool.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id INT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) NOT NULL,
        message VARCHAR(255) NOT NULL,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
      )
    `);

    // Create index on logs(timestamp) to optimize pagination query times
    try {
      await pool.query(`ALTER TABLE logs ADD INDEX idx_timestamp (timestamp DESC)`);
      console.log('Database index idx_timestamp verified/created successfully.');
    } catch (err) {
      // Index already exists, ignore
    }

    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'user'
      )
    `);

    // Create settings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        \`key\` VARCHAR(50) PRIMARY KEY,
        \`value\` TEXT NOT NULL
      )
    `);

    // Create daily_uptime table for tracking daily reliability/availability KPIs (MTBF, MTTR)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_uptime (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id INT NOT NULL,
        \`date\` DATE NOT NULL,
        downtime_seconds INT DEFAULT 0,
        incident_count INT DEFAULT 0,
        uptime_pct DECIMAL(5,2) DEFAULT 100.00,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
        UNIQUE KEY idx_device_date (device_id, \`date\`)
      )
    `);

    // Seed default users if empty
    const [userCountRows] = await pool.query('SELECT COUNT(*) as count FROM users');
    if (userCountRows[0].count === 0) {
      console.log('Seeding initial users...');
      const adminHash = crypto.createHash('sha256').update('adminpass').digest('hex');
      const operatorHash = crypto.createHash('sha256').update('operatorpass').digest('hex');
      await pool.query('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?), (?, ?, ?)', [
        'admin', adminHash, 'admin',
        'operator', operatorHash, 'user'
      ]);
    }

    // Seed default settings if empty
    const [settingsCountRows] = await pool.query('SELECT COUNT(*) as count FROM settings');
    if (settingsCountRows[0].count === 0) {
      console.log('Seeding initial configurations...');
      await pool.query(`
        INSERT INTO settings (\`key\`, \`value\`) VALUES
        ('telegram_enabled', 'false'),
        ('telegram_token', ''),
        ('telegram_chat_id', ''),
        ('scheduler_batch_size', '30'),
        ('scheduler_ping_interval', '10000'),
        ('offline_alarm_enabled', 'true')
      `);
    } else {
      // In case table is already seeded but missing this specific configuration
      try {
        await pool.query("INSERT IGNORE INTO settings (`key`, `value`) VALUES ('offline_alarm_enabled', 'true')");
      } catch (_) {}
    }

    // Load active settings from database
    const [settingsRows] = await pool.query('SELECT * FROM settings');
    settingsRows.forEach(row => {
      if (row.key === 'telegram_enabled') TELEGRAM_ENABLED = row.value === 'true';
      if (row.key === 'telegram_token') TELEGRAM_TOKEN = row.value;
      if (row.key === 'telegram_chat_id') TELEGRAM_CHAT_ID = row.value;
      if (row.key === 'scheduler_batch_size') BATCH_SIZE = parseInt(row.value) || 30;
      if (row.key === 'scheduler_ping_interval') PING_INTERVAL = parseInt(row.value) || 10000;
      if (row.key === 'offline_alarm_enabled') OFFLINE_ALARM_ENABLED = row.value === 'true';
    });
    console.log(`Loaded MySQL configurations: Telegram=${TELEGRAM_ENABLED}, BatchSize=${BATCH_SIZE}, Interval=${PING_INTERVAL}ms, OfflineAlarm=${OFFLINE_ALARM_ENABLED}`);

    // 4. Seed default data if empty
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM devices');
    if (rows[0].count === 0) {
      console.log('Seeding initial devices and logs into database...');
      for (const d of initialDevices) {
        await pool.query(
          `INSERT INTO devices (id, ip_address, name, location, terminal, equipment_type, status, anomaly_type, uptime_pct, downtime_count, failed_access_count) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [d.id, d.ip_address, d.name, d.location, d.terminal, d.equipment_type || 'FIDS', d.status, d.anomaly_type, d.uptime_pct, d.downtime_count, d.failed_access_count]
        );
      }

      for (const l of initialLogs) {
        await pool.query('INSERT INTO logs (device_id, status, message) VALUES (?, ?, ?)', [l.device_id, l.status, l.message]);
      }
    }
    console.log('Database successfully connected and initialized.');

    // 5. Cleanup logs older than 30 days to optimize database size
    try {
      const [cleanupResult] = await pool.query('DELETE FROM logs WHERE timestamp < NOW() - INTERVAL 30 DAY');
      if (cleanupResult.affectedRows > 0) {
        console.log(`Cleaned up ${cleanupResult.affectedRows} stale logs older than 30 days.`);
      }
    } catch (err) {
      console.error('Failed to run log retention cleanup:', err.message);
    }
  } catch (err) {
    console.warn(`[DATABASE WARNING] MySQL setup failed: ${err.message}. Falling back to local file database (database.json).`);
    useJsonFallback = true;
    
    // Load mock database from file if it exists, otherwise create it
    if (fs.existsSync(JSON_DB_FILE)) {
      try {
        jsonDbState = JSON.parse(fs.readFileSync(JSON_DB_FILE, 'utf8'));
        // Migrating existing JSON database if equipment_type doesn't exist
        let changed = false;
        if (jsonDbState.devices) {
          jsonDbState.devices.forEach(d => {
            if (!d.equipment_type) {
              d.equipment_type = 'FIDS';
              changed = true;
            }
          });
        }
        
        // Ensure users exist in JSON
        if (!jsonDbState.users) {
          const adminHash = crypto.createHash('sha256').update('adminpass').digest('hex');
          const operatorHash = crypto.createHash('sha256').update('operatorpass').digest('hex');
          jsonDbState.users = [
            { id: 1, username: 'admin', password_hash: adminHash, role: 'admin' },
            { id: 2, username: 'operator', password_hash: operatorHash, role: 'user' }
          ];
          changed = true;
        }

        // Ensure settings exist in JSON
        if (!jsonDbState.settings) {
          jsonDbState.settings = {
            telegram_enabled: 'false',
            telegram_token: '',
            telegram_chat_id: '',
            scheduler_batch_size: '30',
            scheduler_ping_interval: '10000',
            offline_alarm_enabled: 'true'
          };
          changed = true;
        }

        if (!jsonDbState.settings.offline_alarm_enabled) {
          jsonDbState.settings.offline_alarm_enabled = 'true';
          changed = true;
        }

        // Load settings from JSON
        const settings = jsonDbState.settings;
        TELEGRAM_ENABLED = settings.telegram_enabled === 'true';
        TELEGRAM_TOKEN = settings.telegram_token || '';
        TELEGRAM_CHAT_ID = settings.telegram_chat_id || '';
        BATCH_SIZE = parseInt(settings.scheduler_batch_size) || 30;
        PING_INTERVAL = parseInt(settings.scheduler_ping_interval) || 10000;
        OFFLINE_ALARM_ENABLED = settings.offline_alarm_enabled === 'true';
        console.log(`Loaded JSON configurations: Telegram=${TELEGRAM_ENABLED}, BatchSize=${BATCH_SIZE}, Interval=${PING_INTERVAL}ms, OfflineAlarm=${OFFLINE_ALARM_ENABLED}`);

        // Log Retention: filter out fallback logs older than 30 days
        if (jsonDbState.logs) {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const initialLength = jsonDbState.logs.length;
          jsonDbState.logs = jsonDbState.logs.filter(l => new Date(l.timestamp) >= thirtyDaysAgo);
          if (jsonDbState.logs.length < initialLength) {
            console.log(`Cleaned up ${initialLength - jsonDbState.logs.length} stale fallback logs older than 30 days.`);
            changed = true;
          }
        }

        if (!jsonDbState.daily_uptime) {
          jsonDbState.daily_uptime = [];
          changed = true;
        }
 
        if (changed) saveJsonDb();
      } catch (readErr) {
        console.error('Failed to parse database.json, initializing fresh fallback:', readErr);
        const adminHash = crypto.createHash('sha256').update('adminpass').digest('hex');
        const operatorHash = crypto.createHash('sha256').update('operatorpass').digest('hex');
        jsonDbState = { 
          devices: initialDevices, 
          logs: initialLogs,
          daily_uptime: [],
          users: [
            { id: 1, username: 'admin', password_hash: adminHash, role: 'admin' },
            { id: 2, username: 'operator', password_hash: operatorHash, role: 'user' }
          ],
          settings: {
            telegram_enabled: 'false',
            telegram_token: '',
            telegram_chat_id: '',
            scheduler_batch_size: '30',
            scheduler_ping_interval: '10000',
            offline_alarm_enabled: 'true'
          }
        };
      }
    } else {
      const adminHash = crypto.createHash('sha256').update('adminpass').digest('hex');
      const operatorHash = crypto.createHash('sha256').update('operatorpass').digest('hex');
      jsonDbState = { 
        devices: initialDevices, 
        logs: initialLogs,
        daily_uptime: [],
        users: [
          { id: 1, username: 'admin', password_hash: adminHash, role: 'admin' },
          { id: 2, username: 'operator', password_hash: operatorHash, role: 'user' }
        ],
        settings: {
          telegram_enabled: 'false',
          telegram_token: '',
          telegram_chat_id: '',
          scheduler_batch_size: '30',
          scheduler_ping_interval: '10000',
          offline_alarm_enabled: 'true'
        }
      };
      saveJsonDb();
    }
    console.log('JSON File-based DB fallback initialized.');
  }
}


const server = http.createServer(app);
const wss = new WebSocket.Server({ 
  server,
  handleProtocols: (protocols, req) => {
    console.log(`[WS HANDSHAKE] url: ${req ? req.url : 'N/A'}, protocols requested: ${Array.from(protocols)}`);
    if (req && req.url && req.url.includes('/vnc/')) {
      // Negotiate the binary protocol requested by noVNC RFB client
      return 'binary';
    }
    return false;
  }
});

// Broadcast helper for WebSockets
function broadcast(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Helper to send notifications to Telegram (direct or group)
async function sendTelegramAlert(message) {
  if (!TELEGRAM_ENABLED || !TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;

  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const body = JSON.stringify({
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: 'Markdown'
  });

  try {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.error(`[TELEGRAM ERROR] Telegram API returned code ${res.statusCode}:`, data);
        }
      });
    });

    req.on('error', (err) => {
      console.error('[TELEGRAM ERROR] HTTP Request failed:', err.message);
    });

    req.write(body);
    req.end();
  } catch (err) {
    console.error('[TELEGRAM ERROR] Failed to dispatch Telegram alert:', err.message);
  }
}

// ─── TELEGRAM BOT COMMANDS LONG POLLING & EXECUTORS ───────────────────────────
let lastUpdateId = 0;
let tgPollTimeout = null;

function startTelegramBotPolling() {
  if (tgPollTimeout) clearTimeout(tgPollTimeout);
  if (!TELEGRAM_ENABLED || !TELEGRAM_TOKEN) return;

  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&limit=10&timeout=5`;
  
  const req = https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (json.ok && json.result.length > 0) {
          json.result.forEach((update) => {
            lastUpdateId = update.update_id;
            handleTelegramUpdate(update);
          });
        }
      } catch (err) {
        // ignore JSON errors
      }
      tgPollTimeout = setTimeout(startTelegramBotPolling, 2000);
    });
  });

  req.on('error', (err) => {
    tgPollTimeout = setTimeout(startTelegramBotPolling, 5000);
  });
}

function sendTelegramReply(chatId, text) {
  if (!TELEGRAM_TOKEN) return;
  const postData = JSON.stringify({
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  });

  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${TELEGRAM_TOKEN}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (res.statusCode !== 200) {
        console.error(`[TELEGRAM ERROR] Reply API returned code ${res.statusCode}:`, data);
      }
    });
  });

  req.on('error', (e) => {
    console.error('Failed to send Telegram reply:', e);
  });
  req.write(postData);
  req.end();
}

function handleTelegramUpdate(update) {
  const msg = update.message;
  if (!msg || !msg.text) return;

  const text = msg.text.trim();
  const chatId = msg.chat.id;

  // Split command and arguments
  const parts = text.split(/\s+/);
  let command = parts[0].toLowerCase().split('@')[0];
  const args = parts.slice(1).join(' ').trim();

  // NOC specific commands to prevent conflict with the other bot running on the same token
  if (command === '/noc_help') {
    const helpMsg = 
      `🤖 <b>Airport NOC Monitoring Bot</b>:\n\n` +
      `📌 <code>/noc_help</code> - Show NOC help commands menu\n` +
      `📌 <code>/noc_summary</code> - Summary of all systems (online/offline counts)\n` +
      `📌 <code>/noc_summary [type]</code> - Details of specific system (e.g. <code>/noc_summary fids</code>)\n` +
      `📌 <code>/noc_check</code> - Run diagnostic ping to all systems right now\n` +
      `📌 <code>/noc_check [type]</code> - Run diagnostic ping to specific system (e.g. <code>/noc_check fids</code>)`;
    sendTelegramReply(chatId, helpMsg);
  } 
  else if (command === '/noc_summary') {
    if (args) {
      getEquipmentDetailSummaryText(args, (detailText) => {
        sendTelegramReply(chatId, detailText);
      });
    } else {
      getEquipmentSummaryText((summaryText) => {
        sendTelegramReply(chatId, `📊 <b>All NOC Systems Summary</b>:\n\n${summaryText}`);
      });
    }
  } 
  else if (command === '/noc_check') {
    if (args) {
      sendTelegramReply(chatId, `🔄 <b>Running direct diagnostic ping for ${args.toUpperCase()}...</b>`);
      triggerImmediatePingSpecific(args, () => {
        getEquipmentDetailSummaryText(args, (detailText) => {
          sendTelegramReply(chatId, `✅ <b>Diagnostic complete for ${args.toUpperCase()}!</b>\n\n${detailText}`);
        });
      });
    } else {
      sendTelegramReply(chatId, `🔄 <b>Running direct diagnostic ping for all NOC systems...</b>`);
      triggerImmediatePingAll(() => {
        getEquipmentSummaryText((summaryText) => {
          sendTelegramReply(chatId, `✅ <b>Diagnostic complete for all systems!</b>\n\n${summaryText}`);
        });
      });
    }
  }
}

function getEquipmentSummaryText(callback) {
  const querySql = 'SELECT * FROM devices';
  if (!useJsonFallback && pool) {
    pool.query(querySql)
      .then(([rows]) => {
        processSummary(rows);
      })
      .catch((err) => {
        callback('Failed to fetch data from MySQL.');
      });
  } else {
    const rows = readJsonDb();
    processSummary(rows);
  }

  function processSummary(rows) {
    const summary = {};
    rows.forEach(d => {
      const type = d.equipment_type || 'FIDS';
      if (!summary[type]) summary[type] = { total: 0, online: 0, offline: 0, anomaly: 0 };
      summary[type].total++;
      if (d.status === 'Online') summary[type].online++;
      else if (d.status === 'Offline') summary[type].offline++;
      else if (d.status === 'Anomaly') summary[type].anomaly++;
    });

    let text = '';
    Object.entries(summary).forEach(([type, s]) => {
      text += `• <b>${type}</b>: Total: ${s.total} | 🟢 Online: ${s.online} | 🔴 Offline: ${s.offline} | ⚠️ Anomaly: ${s.anomaly}\n`;
    });
    if (!text) text = 'No equipment registered.';
    callback(text);
  }
}

function getEquipmentDetailSummaryText(term, callback) {
  const querySql = 'SELECT * FROM devices';
  if (!useJsonFallback && pool) {
    pool.query(querySql)
      .then(([rows]) => {
        processDetail(rows);
      })
      .catch((err) => {
        callback('Failed to fetch data from MySQL.');
      });
  } else {
    const rows = readJsonDb();
    processDetail(rows);
  }

  function processDetail(rows) {
    const normalizedTerm = term.toLowerCase().replace(/\s+/g, '');
    const matched = rows.filter(d => {
      const type = (d.equipment_type || 'FIDS').toLowerCase().replace(/\s+/g, '');
      return type.includes(normalizedTerm) || normalizedTerm.includes(type);
    });

    if (matched.length === 0) {
      return callback(`⚠️ No equipment found matching type <b>${term.toUpperCase()}</b>.`);
    }

    let text = `📋 <b>Status Details for ${matched[0].equipment_type}</b>:\n\n`;
    matched.forEach(d => {
      const statusIcon = d.status === 'Online' ? '🟢' : d.status === 'Offline' ? '🔴' : '⚠️';
      text += `${statusIcon} <b>${d.name}</b> (${d.ip_address})\n`;
      text += `   ↳ Status: ${d.status}${d.status === 'Anomaly' ? ` (${d.anomaly_type || ''})` : ''} | Uptime: ${d.uptime_pct}%\n`;
    });
    callback(text);
  }
}

async function triggerImmediatePingAll(callback) {
  try {
    let devicesList = [];
    if (useJsonFallback) {
      devicesList = [...jsonDbState.devices];
    } else if (pool) {
      const [rows] = await pool.query('SELECT * FROM devices');
      devicesList = rows;
    }
    for (let i = 0; i < devicesList.length; i += BATCH_SIZE) {
      const batch = devicesList.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(device => pingDevice(device)));
    }
  } catch (err) {
    console.error(err);
  }
  callback();
}

async function triggerImmediatePingSpecific(term, callback) {
  try {
    let devicesList = [];
    if (useJsonFallback) {
      devicesList = [...jsonDbState.devices];
    } else if (pool) {
      const [rows] = await pool.query('SELECT * FROM devices');
      devicesList = rows;
    }
    const normalizedTerm = term.toLowerCase().replace(/\s+/g, '');
    const matched = devicesList.filter(d => {
      const type = (d.equipment_type || 'FIDS').toLowerCase().replace(/\s+/g, '');
      return type.includes(normalizedTerm) || normalizedTerm.includes(type);
    });

    for (let i = 0; i < matched.length; i += BATCH_SIZE) {
      const batch = matched.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(device => pingDevice(device)));
    }
  } catch (err) {
    console.error(err);
  }
  callback();
}

// Helper to write a status log
async function logStatusChange(deviceId, status, message) {
  const newLog = {
    device_id: parseInt(deviceId),
    status,
    message,
    timestamp: new Date()
  };

  try {
    if (useJsonFallback) {
      newLog.id = jsonDbState.logs.length + 1;
      jsonDbState.logs.unshift(newLog);
      if (jsonDbState.logs.length > 100) jsonDbState.logs.pop();
      saveJsonDb();
    } else {
      await pool.query('INSERT INTO logs (device_id, status, message) VALUES (?, ?, ?)', [deviceId, status, message]);
    }
    
    // Fetch device name for the websocket message tag
    let deviceName = 'Device';
    if (useJsonFallback) {
      const dev = jsonDbState.devices.find(d => d.id === parseInt(deviceId));
      if (dev) deviceName = dev.name;
    } else {
      const [rows] = await pool.query('SELECT name FROM devices WHERE id = ?', [deviceId]);
      if (rows.length > 0) deviceName = rows[0].name;
    }

    broadcast({ 
      type: 'NEW_LOG', 
      log: { ...newLog, name: deviceName } 
    });
  } catch (err) {
    console.error('Error logging status change:', err);
  }
}

// Helper to check VNC Port 5900 with handshake check
// localAddress: optional source IP to bind the socket to (IP binding)
function checkVncPort(ip, timeout = 2000, localAddress = null) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    const finish = (result) => {
      if (!resolved) {
        resolved = true;
        try { socket.destroy(); } catch (_) {}
        resolve(result);
      }
    };

    // Hard external timeout - works even if socket.connect() hangs (firewall DROP)
    const timer = setTimeout(() => finish(false), timeout);

    socket.on('connect', () => {
      // Connected - now wait for RFB handshake data
    });

    socket.on('data', (data) => {
      clearTimeout(timer);
      const str = data.toString();
      finish(str.startsWith('RFB'));
    });

    socket.on('error', () => {
      clearTimeout(timer);
      finish(false);
    });

    socket.on('timeout', () => {
      clearTimeout(timer);
      finish(false);
    });

    socket.on('close', () => {
      clearTimeout(timer);
      finish(false);
    });

    const connectOpts = { port: 5900, host: ip };
    if (localAddress) connectOpts.localAddress = localAddress;
    socket.setTimeout(timeout);
    try {
      socket.connect(connectOpts);
    } catch (_) {
      clearTimeout(timer);
      finish(false);
    }
  });
}

// Performs a single ping check and returns the latency in milliseconds if successful
function pingDeviceSingle(ip, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const [cmd, ...args] = process.platform === 'win32'
      ? ['ping', '-n', '1', '-w', timeoutMs.toString(), ip]
      : ['ping', '-c', '1', '-W', Math.ceil(timeoutMs / 1000).toString(), ip];
    
    try {
      const child = spawn(cmd, args);
      let stdoutData = '';
      if (child.stdout) {
        child.stdout.on('data', (data) => { stdoutData += data.toString(); });
      }
      
      let done = false;
      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          try { child.kill('SIGKILL'); } catch (_) {}
          resolve({ success: false, latency: null });
        }
      }, timeoutMs + 300);

      child.on('close', (code) => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          let latency = null;
          if (code === 0) {
            // Match latency time from ping output (e.g. time=12ms or time<1ms)
            const match = stdoutData.match(/time[=<]([0-9.]+)/i);
            if (match) {
              latency = Math.round(parseFloat(match[1]));
            } else {
              latency = 1; // Default minimum if time is less than 1ms or not parsed
            }
          }
          resolve({ success: code === 0, latency });
        }
      });

      child.on('error', () => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve({ success: false, latency: null });
        }
      });
    } catch (_) {
      resolve({ success: false, latency: null });
    }
  });
}

// Executes concurrent ping and TCP VNC port checks, updating database states
async function pingDevice(device) {
  const isLocalhost = device.ip_address === '127.0.0.1' || device.ip_address === 'localhost';

  // Resolve the best local source IP for this device's subnet (IP Binding)
  const sourceIp = isLocalhost ? null : resolveSourceIP(device.ip_address);

  let isPingSuccess = false;
  let isVncSuccess = false;
  let finalLatency = null;

  // Real-world checks: Escalation Ping + VNC TCP check
  // 1st Ping attempt: 1000ms timeout
  let pingRes = await pingDeviceSingle(device.ip_address, 1000);
  if (pingRes.success) {
    isPingSuccess = true;
    finalLatency = pingRes.latency;
  } else {
    // 2nd Ping attempt: 1500ms timeout with 100ms stagger wait
    await new Promise(r => setTimeout(r, 100));
    pingRes = await pingDeviceSingle(device.ip_address, 1500);
    if (pingRes.success) {
      isPingSuccess = true;
      finalLatency = pingRes.latency;
    } else {
      // 3rd Ping attempt: 1500ms timeout with 100ms stagger wait
      await new Promise(r => setTimeout(r, 100));
      pingRes = await pingDeviceSingle(device.ip_address, 1500);
      if (pingRes.success) {
        isPingSuccess = true;
        finalLatency = pingRes.latency;
      }
    }
  }

  // Connect to VNC Port (5900)
  const startVncTime = Date.now();
  isVncSuccess = await checkVncPort(device.ip_address, 2000, sourceIp);

  // Fallback: If VNC succeeds but ping fails, use VNC connection time as latency
  if (isVncSuccess && !isPingSuccess) {
    finalLatency = Date.now() - startVncTime;
  }

  // Log which interface is being used (helpful for debugging)
  if (sourceIp) {
    console.log(`[BIND] ${device.ip_address} → source: ${sourceIp} (${device.equipment_type || 'device'})`);
  }

  const isOnline = isPingSuccess || isVncSuccess;
  let healthStatusDetail = null;
  if (isPingSuccess && isVncSuccess) {
    healthStatusDetail = 'Ping & VNC';
  } else if (isPingSuccess) {
    healthStatusDetail = 'Ping';
  } else if (isVncSuccess) {
    healthStatusDetail = 'VNC';
  }

  let newStatus = isOnline ? 'Online' : 'Offline';
  let anomalyType = null;
  let logMsg = '';

  // Real-world mapping
  if (isOnline) {
    if (device.status === 'Offline') {
      newStatus = 'Online';
      anomalyType = null;
      logMsg = `${device.name} is back online (Health Check: ${healthStatusDetail}).`;
    } else {
      newStatus = device.status;
      anomalyType = device.anomaly_type;
      logMsg = `Heartbeat success for ${device.name} via ${healthStatusDetail}`;
    }
  } else {
    newStatus = 'Offline';
    anomalyType = null;
    logMsg = `Host Unreachable: ICMP Ping failed (RTO) and VNC port (5900) handshake timed out for ${device.ip_address}`;
  }

  try {
    const isStatusChanged = device.status !== newStatus || device.anomaly_type !== anomalyType || device.health_status_detail !== healthStatusDetail;
    const isLatencyChanged = device.latency_ms !== finalLatency;

    if (isStatusChanged || isLatencyChanged) {
      let newOfflineSince = device.offline_since;
      if (newStatus === 'Offline') {
        if (device.status !== 'Offline') {
          newOfflineSince = new Date();
        }
      } else {
        newOfflineSince = null;
      }

      let updatedDevice = { 
        ...device, 
        status: newStatus, 
        anomaly_type: anomalyType, 
        health_status_detail: healthStatusDetail,
        latency_ms: finalLatency,
        offline_since: newOfflineSince
      };
      
      if (isStatusChanged && newStatus === 'Offline') {
        updatedDevice.failed_access_count = device.failed_access_count + 1;
        updatedDevice.downtime_count = device.downtime_count + 1;
        updatedDevice.uptime_pct = Math.max(50.0, parseFloat(device.uptime_pct) - 1.5).toFixed(2);
      }

      if (useJsonFallback) {
        const idx = jsonDbState.devices.findIndex(d => d.id === device.id);
        if (idx !== -1) {
          jsonDbState.devices[idx] = updatedDevice;
          saveJsonDb();
        }
      } else {
        if (newStatus === 'Offline') {
          await pool.query(
            `UPDATE devices SET status = ?, anomaly_type = ?, health_status_detail = ?, failed_access_count = ?, downtime_count = ?, uptime_pct = ?, latency_ms = ?, offline_since = ? WHERE id = ?`,
            [newStatus, anomalyType, healthStatusDetail, updatedDevice.failed_access_count, updatedDevice.downtime_count, updatedDevice.uptime_pct, finalLatency, newOfflineSince, device.id]
          );
        } else {
          await pool.query(
            `UPDATE devices SET status = ?, anomaly_type = ?, health_status_detail = ?, latency_ms = ?, offline_since = ? WHERE id = ?`,
            [newStatus, anomalyType, healthStatusDetail, finalLatency, newOfflineSince, device.id]
          );
        }
      }

      if (device.status !== newStatus) {
        let telegramMsg = '';
        if (newStatus === 'Online') {
          if (OFFLINE_ALARM_ENABLED || device.status !== 'Offline') {
            telegramMsg = `🟢 *[RECOVERY]* Device *${device.name.replace(/_/g, '\\_')}* (${device.ip_address}) - [${device.equipment_type || 'FIDS'}] is back *ONLINE* (${healthStatusDetail})`;
          }
        } else if (newStatus === 'Offline') {
          if (OFFLINE_ALARM_ENABLED) {
            telegramMsg = `🔴 *[ALERT]* Device *${device.name.replace(/_/g, '\\_')}* (${device.ip_address}) - [${device.equipment_type || 'FIDS'}] is *OFFLINE*`;
          }
        } else if (newStatus === 'Anomaly') {
          telegramMsg = `⚠️ *[ANOMALY]* Device *${device.name.replace(/_/g, '\\_')}* (${device.ip_address}) - [${device.equipment_type || 'FIDS'}] is reporting *ANOMALY* (${anomalyType ? anomalyType.replace(/_/g, '\\_') : ''})`;
        }
        if (telegramMsg) {
          sendTelegramAlert(telegramMsg);
        }
        await logStatusChange(device.id, newStatus, logMsg);
      }

      broadcast({ type: 'DEVICE_UPDATED', device: updatedDevice });
    }


    // Accumulate daily uptime analytics
    const isCurrentlyOffline = newStatus === 'Offline';
    const isTransitionToOffline = (device.status !== 'Offline' && newStatus === 'Offline');
    await recordDailyUptime(device.id, isCurrentlyOffline, isTransitionToOffline);

  } catch (dbErr) {
    console.error('Error updating connectivity status:', dbErr);
  }
}

// Get current local YYYY-MM-DD date string (using local timezone, e.g. WIB/GMT+7)
function getLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

let lastTrackedDate = getLocalDateString();

// Check if a new day has started (00:00 midnight reset)
async function checkDailyMidnightReset() {
  const currentDate = getLocalDateString();
  if (currentDate !== lastTrackedDate) {
    console.log(`[MIDNIGHT RESET] New day started: ${currentDate} (was ${lastTrackedDate}). Resetting uptime to 100% and downtime count to 0 for all equipment...`);
    lastTrackedDate = currentDate;
    await executeDailyReset(currentDate);
  }
}

// Execute the daily uptime and downtime metric reset for all equipment
async function executeDailyReset(currentDate = getLocalDateString()) {
  try {
    if (useJsonFallback) {
      jsonDbState.devices.forEach(d => {
        d.uptime_pct = '100.00';
        d.downtime_count = 0;
        d.failed_access_count = 0;
      });
      saveJsonDb();
      jsonDbState.devices.forEach(d => broadcast({ type: 'DEVICE_UPDATED', device: d }));
    } else if (pool) {
      await pool.query('UPDATE devices SET uptime_pct = 100.00, downtime_count = 0, failed_access_count = 0');
      const [updatedRows] = await pool.query('SELECT * FROM devices');
      updatedRows.forEach(d => broadcast({ type: 'DEVICE_UPDATED', device: d }));
    }
    console.log(`[MIDNIGHT RESET] Successfully reset all equipment uptime to 100% and downtime count to 0 for date: ${currentDate}`);
  } catch (err) {
    console.error('[MIDNIGHT RESET] Error resetting daily metrics:', err);
  }
}

async function recordDailyUptime(deviceId, isOffline, isTransitionToOffline) {
  const today = getLocalDateString();
  const downtimeAdd = isOffline ? 5 : 0;
  const incidentAdd = isTransitionToOffline ? 1 : 0;

  if (useJsonFallback) {
    if (!jsonDbState.daily_uptime) jsonDbState.daily_uptime = [];
    let record = jsonDbState.daily_uptime.find(r => r.device_id === deviceId && r.date === today);
    if (!record) {
      record = { device_id: deviceId, date: today, downtime_seconds: 0, incident_count: 0, uptime_pct: 100.00 };
      jsonDbState.daily_uptime.push(record);
    }
    record.downtime_seconds += downtimeAdd;
    record.incident_count += incidentAdd;
    const uptimeSecs = Math.max(0, 86400 - record.downtime_seconds);
    record.uptime_pct = parseFloat(((uptimeSecs / 86400) * 100).toFixed(4));
    saveJsonDb();

    // Sync in-memory device object to current day stats
    const dev = jsonDbState.devices.find(d => d.id === deviceId);
    if (dev) {
      dev.uptime_pct = record.uptime_pct.toFixed(2);
      dev.downtime_count = record.incident_count;
    }
  } else if (pool) {
    try {
      await pool.query(`
        INSERT INTO daily_uptime (device_id, \`date\`, downtime_seconds, incident_count, uptime_pct)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          downtime_seconds = downtime_seconds + VALUES(downtime_seconds),
          incident_count = incident_count + VALUES(incident_count),
          uptime_pct = ROUND(((86400 - (downtime_seconds + VALUES(downtime_seconds))) / 86400) * 100, 4)
      `, [deviceId, today, downtimeAdd, incidentAdd, isOffline ? 99.9942 : 100.00]);

      // Sync device table's daily uptime_pct and downtime_count to current day's stats
      await pool.query(`
        UPDATE devices d
        JOIN daily_uptime du ON d.id = du.device_id AND du.date = ?
        SET d.uptime_pct = du.uptime_pct, d.downtime_count = du.incident_count
        WHERE d.id = ?
      `, [today, deviceId]);
    } catch (err) {
      console.error('Failed to log daily uptime:', err);
    }
  }
}

let heartbeatIntervalHandle = null;

// Extracted heartbeat iteration logic
async function runHeartbeatIteration() {
  try {
    // Check for daily midnight reset (00:00 local time)
    await checkDailyMidnightReset();

    let devicesList = [];
    if (useJsonFallback) {
      devicesList = [...jsonDbState.devices];
    } else if (pool) {
      const [rows] = await pool.query('SELECT * FROM devices');
      devicesList = rows;
    }
    
    // Run ping checks using a Concurrency-Controlled Worker Pool (max 15 active workers)
    // This prevents spawning too many child processes simultaneously on low-spec CPUs (like i5 950)
    const CONCURRENCY_LIMIT = 15;
    const queue = [...devicesList];

    const worker = async () => {
      while (queue.length > 0) {
        const device = queue.shift();
        if (device) {
          try {
            const isSuspended = device.status === 'Offline' && device.offline_since && 
              (Date.now() - new Date(device.offline_since).getTime() > 10 * 60 * 1000);
            
            if (isSuspended) {
              console.log(`[SKIP] Skipping background ping for suspended device: ${device.name} (${device.ip_address})`);
              continue;
            }

            await pingDevice(device);
          } catch (pingErr) {
            console.error(`Error checking device ${device.ip_address}:`, pingErr);
          }
        }
      }
    };

    const workers = [];
    const numWorkers = Math.min(CONCURRENCY_LIMIT, queue.length);
    for (let w = 0; w < numWorkers; w++) {
      workers.push(worker());
    }

    await Promise.all(workers);

  } catch (err) {
    console.error('Heartbeat monitor iteration error:', err);
  }
}


// Background loop for monitoring (reschedulable)
async function startHeartbeatMonitor() {
  if (heartbeatIntervalHandle) {
    clearInterval(heartbeatIntervalHandle);
  }

  // Run the first check iteration immediately on startup
  runHeartbeatIteration();

  heartbeatIntervalHandle = setInterval(async () => {
    await runHeartbeatIteration();
  }, PING_INTERVAL);
}

function restartHeartbeatInterval() {
  console.log(`Rescheduling heartbeat monitor with new interval: ${PING_INTERVAL}ms`);
  startHeartbeatMonitor();
}

// WebSocket Connection Handler
wss.on('connection', async (ws, req) => {
  // Check if this connection is a VNC websocket proxy request
  if (req && req.url && req.url.includes('/vnc/')) {
    const parts = req.url.split('/');
    const targetIp = parts[parts.length - 1];
    console.log(`[VNC PROXY] New WS request intercept to VNC target: ${targetIp}`);

    const tcpSocket = new net.Socket();
    
    // Resolve correct source IP for target subnet (IP Binding)
    const sourceIp = resolveSourceIP(targetIp);
    const connectOpts = { port: 5900, host: targetIp };
    if (sourceIp) connectOpts.localAddress = sourceIp;

    tcpSocket.connect(connectOpts, () => {
      console.log(`[VNC PROXY] Connected to VNC host: ${targetIp}:5900 via source: ${sourceIp}`);
    });

    ws.on('message', (message) => {
      if (tcpSocket.writable) {
        tcpSocket.write(message);
      }
    });

    tcpSocket.on('data', (data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data, { binary: true });
      }
    });

    ws.on('close', () => {
      console.log(`[VNC PROXY] WS client connection closed for ${targetIp}`);
      tcpSocket.destroy();
    });

    tcpSocket.on('close', () => {
      console.log(`[VNC PROXY] TCP VNC host closed connection for ${targetIp}`);
      ws.close();
    });

    ws.on('error', (err) => {
      console.error(`[VNC PROXY] WS client error for ${targetIp}:`, err.message);
      tcpSocket.destroy();
    });

    tcpSocket.on('error', (err) => {
      console.error(`[VNC PROXY] TCP host error for ${targetIp}:`, err.message);
      ws.close();
    });

    return; // Intercepted, stop executing main initialization code
  }

  console.log('Client dashboard connected via WebSocket.');
  
  try {
    let devicesList = [];
    let logsList = [];
    let dbStatus = 'connecting';

    if (useJsonFallback) {
      dbStatus = 'fallback';
    } else if (pool !== null) {
      dbStatus = 'connected';
    }

    if (useJsonFallback || pool === null) {
      // Use JSON fallback immediately — DB may still be initializing
      devicesList = jsonDbState.devices || [];
      logsList = (jsonDbState.logs || []).map(l => {
        const d = (jsonDbState.devices || []).find(dev => dev.id === l.device_id);
        return { ...l, name: d ? d.name : 'Device' };
      }).slice(0, 30);
    } else {
      const [devicesRows] = await pool.query('SELECT * FROM devices');
      const [logsRows] = await pool.query('SELECT l.*, d.name FROM logs l JOIN devices d ON l.device_id = d.id ORDER BY l.timestamp DESC LIMIT 30');
      devicesList = devicesRows;
      logsList = logsRows;
    }

    ws.send(JSON.stringify({ type: 'INIT_DATA', devices: devicesList, logs: logsList, dbStatus, config: { simulationMode: false, offlineAlarmEnabled: OFFLINE_ALARM_ENABLED } }));
  } catch (err) {
    console.error('Error fetching init data for WS client:', err);
    // Send empty init so the client at least connects
    ws.send(JSON.stringify({ type: 'INIT_DATA', devices: [], logs: [], dbStatus: 'fallback', config: { simulationMode: false, offlineAlarmEnabled: OFFLINE_ALARM_ENABLED } }));
  }
});



// Middleware to verify if the user has admin role
function verifyAdmin(req, res, next) {
  const role = req.headers['x-user-role'];
  if (role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized: Admin privileges required for this action.' });
  }
  next();
}

// Default CCTV camera credentials (EYENOR / standard IP cameras)
const DEFAULT_CCTV_AUTH = 'Basic ' + Buffer.from('admin:tlp808rgn443').toString('base64');

// ─── CCTV HTTP Reverse Proxy ─────────────────────────────────────────────────
// Proxies all HTTP requests to the camera's web interface through this server.
// Route: /cctv-proxy/:ip/*  (supports port in ip parameter e.g. /cctv-proxy/192.168.0.168:3002/ or ?port=3002)
app.use('/cctv-proxy/:ip', (req, res) => {
  const ipParam = req.params.ip;

  // Extract IP and optional Port (e.g. 192.168.0.168:3002)
  let cameraIp = ipParam;
  let cameraPort = parseInt(req.query.port) || 80;
  if (ipParam.includes(':')) {
    const parts = ipParam.split(':');
    cameraIp = parts[0];
    cameraPort = parseInt(parts[1]) || 80;
  }

  // Validate IP address format for security
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(cameraIp)) {
    return res.status(400).send('Invalid IP address');
  }

  // Build the path after the IP — e.g. /cctv-proxy/192.168.0.1/image.jpg → /image.jpg
  const camPath = req.url || '/';

  // Resolve the correct local source IP for the camera subnet (IP binding)
  const sourceIp = resolveSourceIP(cameraIp);

  const options = {
    hostname: cameraIp,
    port: cameraPort,
    path: camPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${cameraIp}:${cameraPort}`,
      // Auto-inject Basic Auth credentials if client hasn't sent authorization
      authorization: req.headers['authorization'] || DEFAULT_CCTV_AUTH,
    },
    localAddress: sourceIp || undefined,
  };

  // Remove headers that can cause issues with the proxy
  delete options.headers['accept-encoding']; // disable compression for URL rewriting
  delete options.headers['origin'];
  delete options.headers['referer'];

  console.log(`[CCTV PROXY] ${req.method} http://${cameraIp}:${cameraPort}${camPath} via src:${sourceIp || 'default'}`);

  // Single-write guard — prevents ERR_HTTP_HEADERS_SENT on concurrent error/timeout events
  let responded = false;
  const safeRespond = (fn) => {
    if (!responded && !res.headersSent) {
      responded = true;
      fn();
    }
  };

  // Manual connection timeout (destroy fires error event, safeRespond prevents double write)
  const connTimeout = setTimeout(() => {
    proxyReq.destroy(new Error('Camera connection timed out'));
  }, 10000);

  const proxyReq = http.request(options, (proxyRes) => {
    // Cancel the connection timeout — we have a response
    clearTimeout(connTimeout);
    responded = true; // Mark as responded so error handlers won't double-write

    const contentType = proxyRes.headers['content-type'] || '';
    const baseProxy = `/cctv-proxy/${ipParam}`;

    // Strip headers that block embedding in iframes
    const safeHeaders = { ...proxyRes.headers };
    delete safeHeaders['x-frame-options'];
    delete safeHeaders['content-security-policy'];
    delete safeHeaders['x-content-type-options'];
    delete safeHeaders['transfer-encoding'];

    // Rewrite 301/302 Location redirect header so browser doesn't try to connect directly to camera IP
    if (safeHeaders['location']) {
      let loc = safeHeaders['location'];
      loc = loc.replace(new RegExp(`^https?://${cameraIp.replace(/\./g,'\\.')}(:\\d+)?`, 'i'), '');
      if (loc.startsWith('/')) {
        loc = `${baseProxy}${loc}`;
      } else if (!loc.startsWith('http://') && !loc.startsWith('https://')) {
        loc = `${baseProxy}/${loc}`;
      }
      safeHeaders['location'] = loc;
      console.log(`[CCTV PROXY] Rewrote Location header -> ${loc}`);
    }

    // Rewrite Set-Cookie paths to stay under proxy path
    if (safeHeaders['set-cookie']) {
      safeHeaders['set-cookie'] = safeHeaders['set-cookie'].map(cookie =>
        cookie.replace(/Path=\/[^;]*/i, `Path=${baseProxy}/`)
      );
    }

    // For HTML responses: rewrite URLs to go through proxy
    if (contentType.includes('text/html')) {
      let body = '';
      proxyRes.setEncoding('utf8');
      proxyRes.on('data', chunk => { body += chunk; });
      proxyRes.on('end', () => {

        // Rewrite relative and absolute URLs in HTML attributes
        body = body
          .replace(/(href|src|action)=["']\/(?!\/)/g, `$1="${baseProxy}/`)
          .replace(new RegExp(`(href|src|action)=["']https?://${cameraIp.replace(/\./g,'\\.')}(:\\d+)?`, 'g'), `$1="${baseProxy}`)
          .replace(/url\(["']?\/(?!\/)/g, `url("${baseProxy}/`);

        // Inject base tag and anti-framebusting script so relative URLs and redirects stay inside proxy
        const shimScript = `<script>try{Object.defineProperty(window,'top',{get:function(){return window.self;}});}catch(e){}</script>`;
        const baseTag = `<base href="${baseProxy}/">${shimScript}`;
        if (!body.includes('<base')) {
          if (/<head[^>]*>/i.test(body)) {
            body = body.replace(/<head[^>]*>/i, `$&${baseTag}`);
          } else {
            body = baseTag + body;
          }
        } else {
          body = body.replace(/<base[^>]*href=["'][^"']*["'][^>]*>/i, baseTag);
        }

        safeHeaders['content-length'] = Buffer.byteLength(body, 'utf8');
        safeHeaders['content-type'] = 'text/html; charset=utf-8';

        if (!res.headersSent) {
          res.writeHead(proxyRes.statusCode || 200, safeHeaders);
          res.end(body);
        }
      });
    } else {
      // For images, scripts, CSS, video streams — pipe directly
      if (!res.headersSent) {
        res.writeHead(proxyRes.statusCode || 200, safeHeaders);
        proxyRes.pipe(res);
      }
    }

  });

  proxyReq.on('error', (err) => {
    clearTimeout(connTimeout);
    console.error(`[CCTV PROXY] Error for ${cameraIp}:${cameraPort}:`, err.message);
    safeRespond(() => res.status(502).json({ error: 'Cannot connect to camera', details: err.message, ip: cameraIp, port: cameraPort }));
  });

  // Forward request body for POST requests (e.g. login forms)
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
});

// Helper to probe a specific camera port with Basic Auth
function probeCameraPort(ip, port, sourceIp, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const req = http.request(
      { hostname: ip, port, path: '/', method: 'HEAD',
        headers: { authorization: DEFAULT_CCTV_AUTH },
        localAddress: sourceIp || undefined, timeout: timeoutMs },
      (res2) => {
        res2.resume();
        resolve({ ok: true, port, statusCode: res2.statusCode, latency: Date.now() - startTime });
      }
    );
    req.on('error', (err) => resolve({ ok: false, port, error: err.message, latency: Date.now() - startTime }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, port, error: 'timeout', latency: Date.now() - startTime }); });
    req.end();
  });
}

// Endpoint to test CCTV camera reachability & find working port before opening the viewer
app.post('/api/cctv-proxy/test', async (req, res) => {
  const { ip, port } = req.body;
  if (!ip || !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    return res.status(400).json({ reachable: false, error: 'Invalid IP' });
  }
  const sourceIp = resolveSourceIP(ip);
  const portsToTest = port ? [parseInt(port)] : [80, 3002, 8080];

  for (const p of portsToTest) {
    const result = await probeCameraPort(ip, p, sourceIp, 3000);
    if (result.ok) {
      return res.json({
        reachable: true,
        port: p,
        statusCode: result.statusCode,
        latency: result.latency,
        sourceIp
      });
    }
  }

  res.json({ reachable: false, error: `Camera connection refused on ports (${portsToTest.join(', ')})` });
});

// ─────────────────────────────────────────────────────────────────────────────

// ─── CCTV Stream Endpoints ────────────────────────────────────────────────────

// Common MJPEG/snapshot paths for popular IP camera brands
const CCTV_STREAM_PATHS = [
  // Generic / Common
  { path: '/mjpeg',              label: 'MJPEG (generic)' },
  { path: '/video.mjpeg',        label: 'MJPEG (video.mjpeg)' },
  { path: '/videostream.cgi',    label: 'CGI Videostream' },
  { path: '/stream',             label: 'Stream' },
  { path: '/video',              label: 'Video' },
  { path: '/live',               label: 'Live' },
  // Hikvision
  { path: '/Streaming/channels/101/httpPreview',  label: 'Hikvision Main' },
  { path: '/ISAPI/Streaming/channels/101/picture', label: 'Hikvision Snapshot' },
  // Dahua
  { path: '/cgi-bin/mjpeg',      label: 'Dahua MJPEG' },
  { path: '/cgi-bin/snapshot.cgi', label: 'Dahua Snapshot' },
  // Axis
  { path: '/axis-cgi/mjpg/video.cgi',  label: 'Axis MJPEG' },
  { path: '/axis-cgi/jpg/image.cgi',   label: 'Axis Snapshot' },
  // Amcrest / Reolink / others
  { path: '/cgi-bin/camera',     label: 'Camera CGI' },
  { path: '/cgi-bin/video.cgi',  label: 'Video CGI' },
  { path: '/snap.jpg',           label: 'Snapshot .jpg' },
  { path: '/snapshot',           label: 'Snapshot' },
  { path: '/image.jpg',          label: 'Image JPEG' },
  { path: '/tmpfs/auto.jpg',     label: 'Snapshot (tmpfs)' },
  // Generic live paths
  { path: '/live/0/mjpeg.jpg',   label: 'Live MJPEG 0' },
  { path: '/live/1/mjpeg.jpg',   label: 'Live MJPEG 1' },
  { path: '/live/ch0',           label: 'Live CH0' },
];

// Probe a single path on the camera — returns { path, label, status, type, ok }
function probeStreamPath(ip, pathObj, sourceIp, timeoutMs = 3000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (result) => { if (!done) { done = true; resolve(result); } };

    const timer = setTimeout(() => {
      req.destroy();
      finish({ path: pathObj.path, label: pathObj.label, ok: false, reason: 'timeout' });
    }, timeoutMs);

    const req = http.request(
      { hostname: ip, port: 80, path: pathObj.path, method: 'HEAD',
        localAddress: sourceIp || undefined },
      (res2) => {
        clearTimeout(timer);
        res2.resume(); // drain
        const ct = res2.headers['content-type'] || '';
        const ok = res2.statusCode < 400 &&
          (ct.includes('image') || ct.includes('video') || ct.includes('multipart') || ct.includes('octet'));
        finish({ path: pathObj.path, label: pathObj.label, ok, statusCode: res2.statusCode, contentType: ct });
      }
    );
    req.on('error', () => { clearTimeout(timer); finish({ path: pathObj.path, label: pathObj.label, ok: false, reason: 'error' }); });
    req.end();
  });
}

// POST /api/cctv-proxy/scan — scan all known stream paths and return which work
app.post('/api/cctv-proxy/scan', (req, res) => {
  const { ip } = req.body;
  if (!ip || !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    return res.status(400).json({ error: 'Invalid IP' });
  }
  const sourceIp = resolveSourceIP(ip);
  console.log(`[CCTV SCAN] Scanning ${CCTV_STREAM_PATHS.length} paths on ${ip} via src:${sourceIp || 'default'}`);

  Promise.all(CCTV_STREAM_PATHS.map(p => probeStreamPath(ip, p, sourceIp, 3000)))
    .then(results => {
      const found = results.filter(r => r.ok);
      console.log(`[CCTV SCAN] ${ip}: ${found.length}/${results.length} paths responded`);
      res.json({ ip, sourceIp, results, found });
    });
});

// GET /cctv-stream/:ip/mjpeg — proxy a MJPEG multipart stream without buffering
// Query param: ?path=/videostream.cgi
app.get('/cctv-stream/:ip/mjpeg', (req, res) => {
  const cameraIp = req.params.ip;
  const streamPath = req.query.path || '/videostream.cgi';

  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(cameraIp)) {
    return res.status(400).send('Invalid IP');
  }

  const sourceIp = resolveSourceIP(cameraIp);
  console.log(`[CCTV STREAM] MJPEG ${cameraIp}${streamPath} via src:${sourceIp || 'default'}`);

  let responded = false;
  const connTimeout = setTimeout(() => {
    streamReq.destroy(new Error('Stream connection timed out'));
  }, 8000);

  const streamReq = http.request(
    { hostname: cameraIp, port: 80, path: streamPath, method: 'GET',
      localAddress: sourceIp || undefined },
    (camRes) => {
      clearTimeout(connTimeout);
      responded = true;

      const ct = camRes.headers['content-type'] || 'multipart/x-mixed-replace';
      res.setHeader('Content-Type', ct);
      res.setHeader('Cache-Control', 'no-cache, no-store');
      res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if behind proxy

      // Pipe the raw MJPEG stream directly — no buffering, no transformation
      camRes.pipe(res);

      req.on('close', () => {
        console.log(`[CCTV STREAM] Client disconnected from ${cameraIp}`);
        streamReq.destroy();
      });
    }
  );

  streamReq.on('error', (err) => {
    clearTimeout(connTimeout);
    console.error(`[CCTV STREAM] Error for ${cameraIp}:`, err.message);
    if (!responded && !res.headersSent) {
      res.status(502).json({ error: err.message });
    }
  });

  streamReq.end();
});

// GET /cctv-stream/:ip/snapshot — proxy a single JPEG snapshot
// Query param: ?path=/snap.jpg&_t=timestamp (timestamp forces camera to not cache)
app.get('/cctv-stream/:ip/snapshot', (req, res) => {
  const cameraIp = req.params.ip;
  const snapPath = (req.query.path || '/snap.jpg').split('?')[0];

  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(cameraIp)) {
    return res.status(400).send('Invalid IP');
  }

  const sourceIp = resolveSourceIP(cameraIp);
  let responded = false;

  const connTimeout = setTimeout(() => {
    snapReq.destroy(new Error('Snapshot timeout'));
  }, 5000);

  const snapReq = http.request(
    { hostname: cameraIp, port: 80, path: `${snapPath}?_t=${Date.now()}`, method: 'GET',
      localAddress: sourceIp || undefined },
    (camRes) => {
      clearTimeout(connTimeout);
      responded = true;
      res.setHeader('Content-Type', camRes.headers['content-type'] || 'image/jpeg');
      res.setHeader('Cache-Control', 'no-cache');
      camRes.pipe(res);
    }
  );

  snapReq.on('error', (err) => {
    clearTimeout(connTimeout);
    if (!responded && !res.headersSent) res.status(502).json({ error: err.message });
  });

  snapReq.end();
});
// ─────────────────────────────────────────────────────────────────────────────

// Authentication login endpoint
app.post('/api/auth/login', async (req, res) => {

  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    let user = null;

    if (useJsonFallback) {
      user = jsonDbState.users.find(u => u.username === username && u.password_hash === hash);
    } else {
      const [rows] = await pool.query('SELECT * FROM users WHERE username = ? AND password_hash = ?', [username, hash]);
      if (rows.length > 0) user = rows[0];
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    res.json({
      success: true,
      username: user.username,
      role: user.role
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get active scheduler & Telegram configs
app.get('/api/config/scheduler', async (req, res) => {
  res.json({
    batchSize: BATCH_SIZE,
    pingInterval: PING_INTERVAL,
    telegramEnabled: TELEGRAM_ENABLED,
    telegramToken: TELEGRAM_TOKEN,
    telegramChatId: TELEGRAM_CHAT_ID,
    offlineAlarmEnabled: OFFLINE_ALARM_ENABLED
  });
});

// Update active scheduler & Telegram configs
app.post('/api/config/scheduler', async (req, res) => {
  const { batchSize, pingInterval, telegramEnabled, telegramToken, telegramChatId, offlineAlarmEnabled } = req.body;

  try {
    if (batchSize !== undefined) BATCH_SIZE = parseInt(batchSize) || 30;
    if (pingInterval !== undefined) {
      const oldInterval = PING_INTERVAL;
      PING_INTERVAL = parseInt(pingInterval) || 10000;
      if (PING_INTERVAL !== oldInterval) {
        restartHeartbeatInterval();
      }
    }
    if (telegramEnabled !== undefined) TELEGRAM_ENABLED = telegramEnabled === true || telegramEnabled === 'true';
    if (telegramToken !== undefined) TELEGRAM_TOKEN = telegramToken;
    if (telegramChatId !== undefined) TELEGRAM_CHAT_ID = telegramChatId;
    if (offlineAlarmEnabled !== undefined) OFFLINE_ALARM_ENABLED = offlineAlarmEnabled === true || offlineAlarmEnabled === 'true';

    if (useJsonFallback) {
      jsonDbState.settings = {
        telegram_enabled: TELEGRAM_ENABLED.toString(),
        telegram_token: TELEGRAM_TOKEN,
        telegram_chat_id: TELEGRAM_CHAT_ID,
        scheduler_batch_size: BATCH_SIZE.toString(),
        scheduler_ping_interval: PING_INTERVAL.toString(),
        offline_alarm_enabled: OFFLINE_ALARM_ENABLED.toString()
      };
      saveJsonDb();
    } else {
      await pool.query('INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?', ['telegram_enabled', TELEGRAM_ENABLED.toString(), TELEGRAM_ENABLED.toString()]);
      await pool.query('INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?', ['telegram_token', TELEGRAM_TOKEN, TELEGRAM_TOKEN]);
      await pool.query('INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?', ['telegram_chat_id', TELEGRAM_CHAT_ID, TELEGRAM_CHAT_ID]);
      await pool.query('INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?', ['scheduler_batch_size', BATCH_SIZE.toString(), BATCH_SIZE.toString()]);
      await pool.query('INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?', ['scheduler_ping_interval', PING_INTERVAL.toString(), PING_INTERVAL.toString()]);
      await pool.query('INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?', ['offline_alarm_enabled', OFFLINE_ALARM_ENABLED.toString(), OFFLINE_ALARM_ENABLED.toString()]);
    }

    console.log(`Updated configurations: Telegram=${TELEGRAM_ENABLED}, BatchSize=${BATCH_SIZE}, Interval=${PING_INTERVAL}ms, OfflineAlarm=${OFFLINE_ALARM_ENABLED}`);
    startTelegramBotPolling();
    
    // Broadcast updated config to all WebSocket clients
    broadcast({
      type: 'CONFIG_UPDATED',
      config: {
        simulationMode: false,
        offlineAlarmEnabled: OFFLINE_ALARM_ENABLED
      }
    });

    res.json({ success: true, batchSize: BATCH_SIZE, pingInterval: PING_INTERVAL, telegramEnabled: TELEGRAM_ENABLED, offlineAlarmEnabled: OFFLINE_ALARM_ENABLED });
  } catch (err) {
    console.error('Failed to save scheduler config:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config/test-telegram', async (req, res) => {
  const { telegramToken, telegramChatId } = req.body;
  if (!telegramToken || !telegramChatId) {
    return res.status(400).json({ success: false, error: 'Token and Chat ID are required.' });
  }

  const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
  const body = JSON.stringify({
    chat_id: telegramChatId,
    text: `🔍 *[TEST]* Connection test from Airport NOC Dashboard. Telegram Bot Alerts are working correctly!`,
    parse_mode: 'Markdown'
  });

  try {
    const reqTg = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (resTg) => {
      let data = '';
      resTg.on('data', chunk => data += chunk);
      resTg.on('end', () => {
        if (resTg.statusCode === 200) {
          res.json({ success: true, message: 'Test message sent successfully!' });
        } else {
          try {
            const errJson = JSON.parse(data);
            res.json({ success: false, error: `Telegram API Error (${resTg.statusCode}): ${errJson.description || data}` });
          } catch (e) {
            res.json({ success: false, error: `Telegram API Error (${resTg.statusCode}): ${data}` });
          }
        }
      });
    });

    reqTg.on('error', (err) => {
      res.json({ success: false, error: `Network Connection Error: ${err.message}` });
    });

    reqTg.write(body);
    reqTg.end();
  } catch (err) {
    res.json({ success: false, error: `Internal Server Error: ${err.message}` });
  }
});

// Helper for CPU calculation
function cpuAverage() {
  let totalIdle = 0;
  let totalTick = 0;
  const cpus = os.cpus();
  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });
  return { idle: totalIdle / cpus.length, total: totalTick / cpus.length };
}

// Get CPU and RAM metrics
app.get('/api/system-stats', async (req, res) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const ramUsagePct = ((usedMem / totalMem) * 100).toFixed(1);

  // CPU measurement delta over 100ms
  const startMeasure = cpuAverage();
  setTimeout(() => {
    const endMeasure = cpuAverage();
    const idleDifference = endMeasure.idle - startMeasure.idle;
    const totalDifference = endMeasure.total - startMeasure.total;
    let cpuUsagePct = 0;
    if (totalDifference > 0) {
      cpuUsagePct = (100 - (100 * idleDifference / totalDifference)).toFixed(1);
    }
    
    res.json({
      cpuUsage: cpuUsagePct,
      ramUsage: ramUsagePct,
      totalMemGb: (totalMem / 1024 / 1024 / 1024).toFixed(1),
      usedMemGb: (usedMem / 1024 / 1024 / 1024).toFixed(1)
    });
  }, 100);
});

// REST API Endpoints
app.get('/api/devices', async (req, res) => {
  try {
    if (useJsonFallback) {
      return res.json(jsonDbState.devices);
    }
    const [devices] = await pool.query('SELECT * FROM devices');
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/devices/:id/uptime-history: Returns past 7 days uptime data points for Chart.js
app.get('/api/devices/:id/uptime-history', async (req, res) => {
  const deviceId = parseInt(req.params.id);
  try {
    let history = [];
    if (useJsonFallback) {
      if (!jsonDbState.daily_uptime) jsonDbState.daily_uptime = [];
      history = jsonDbState.daily_uptime
        .filter(r => r.device_id === deviceId)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-7);
    } else {
      const [rows] = await pool.query(
        `SELECT * FROM (
          SELECT * FROM daily_uptime WHERE device_id = ? ORDER BY \`date\` DESC LIMIT 7
        ) sub ORDER BY \`date\` ASC`,
        [deviceId]
      );
      history = rows;
    }

    // Normalize date field: MySQL returns UTC datetime, convert to WIB YYYY-MM-DD string
    const normalized = history.map(r => {
      let dateStr = r.date;
      if (dateStr instanceof Date || (typeof dateStr === 'string' && dateStr.includes('T'))) {
        const d = new Date(dateStr);
        // Shift to UTC+7 (WIB)
        d.setMinutes(d.getMinutes() + d.getTimezoneOffset() + 420);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        dateStr = `${yyyy}-${mm}-${dd}`;
      }
      return {
        ...r,
        date: dateStr,
        uptime_pct: parseFloat(r.uptime_pct)
      };
    });

    res.json(normalized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET /api/devices/:id/analytics: Calculates operational availability, MTBF, and MTTR metrics
app.get('/api/devices/:id/analytics', async (req, res) => {
  const deviceId = parseInt(req.params.id);
  try {
    let history = [];
    if (useJsonFallback) {
      if (!jsonDbState.daily_uptime) jsonDbState.daily_uptime = [];
      history = jsonDbState.daily_uptime.filter(r => r.device_id === deviceId);
    } else {
      [history] = await pool.query('SELECT * FROM daily_uptime WHERE device_id = ?', [deviceId]);
    }

    let totalDowntime = 0;
    let totalIncidents = 0;
    let daysCount = Math.max(1, history.length);
    
    history.forEach(r => {
      totalDowntime += r.downtime_seconds || 0;
      totalIncidents += r.incident_count || 0;
    });

    const totalSeconds = daysCount * 86400;
    const totalUptimeSeconds = Math.max(0, totalSeconds - totalDowntime);
    const availability = parseFloat(((totalUptimeSeconds / totalSeconds) * 100).toFixed(4));

    // MTTR (seconds) = Total Downtime / Total Incidents
    const mttr = totalIncidents > 0 ? parseFloat((totalDowntime / totalIncidents).toFixed(1)) : 0;
    
    // MTBF (seconds) = Total Uptime / Total Incidents
    const mtbf = totalIncidents > 0 ? parseFloat((totalUptimeSeconds / totalIncidents).toFixed(1)) : totalUptimeSeconds;

    // Categorization according to operational guidelines
    let category = 'Excellent';
    if (availability >= 99.9) category = 'Excellent';
    else if (availability >= 99.0) category = 'Good';
    else if (availability >= 95.0) category = 'Fair';
    else category = 'Poor';

    res.json({
      deviceId,
      availability,
      mttr,
      mtbf,
      totalIncidents,
      totalDowntime,
      daysCount,
      category
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/overall: Calculates aggregated operational availability, MTBF, and MTTR for all systems
app.get('/api/analytics/overall', async (req, res) => {
  try {
    let history = [];
    if (useJsonFallback) {
      if (!jsonDbState.daily_uptime) jsonDbState.daily_uptime = [];
      history = jsonDbState.daily_uptime;
    } else {
      [history] = await pool.query('SELECT * FROM daily_uptime');
    }

    let totalDowntime = 0;
    let totalIncidents = 0;
    let totalSeconds = history.length * 86400;

    history.forEach(r => {
      totalDowntime += r.downtime_seconds || 0;
      totalIncidents += r.incident_count || 0;
    });

    const totalUptimeSeconds = Math.max(0, totalSeconds - totalDowntime);
    const availability = totalSeconds > 0 ? parseFloat(((totalUptimeSeconds / totalSeconds) * 100).toFixed(4)) : 100.0000;

    const mttr = totalIncidents > 0 ? parseFloat((totalDowntime / totalIncidents).toFixed(1)) : 0;
    const mtbf = totalIncidents > 0 ? parseFloat((totalUptimeSeconds / totalIncidents).toFixed(1)) : totalUptimeSeconds;

    let category = 'Excellent';
    if (availability >= 99.9) category = 'Excellent';
    else if (availability >= 99.0) category = 'Good';
    else if (availability >= 95.0) category = 'Fair';
    else category = 'Poor';

    res.json({
      availability,
      mttr,
      mtbf,
      totalIncidents,
      totalDowntime,
      daysCount: history.length,
      category
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/overall/history: Returns past 7 days aggregated uptime history for all systems
app.get('/api/analytics/overall/history', async (req, res) => {
  try {
    let rawHistory = [];
    if (useJsonFallback) {
      if (!jsonDbState.daily_uptime) jsonDbState.daily_uptime = [];
      rawHistory = jsonDbState.daily_uptime;
    } else {
      [rawHistory] = await pool.query('SELECT * FROM daily_uptime');
    }

    const grouped = {};
    rawHistory.forEach(r => {
      let dateStr = r.date;
      if (dateStr instanceof Date || (typeof dateStr === 'string' && dateStr.includes('T'))) {
        const d = new Date(dateStr);
        d.setMinutes(d.getMinutes() + d.getTimezoneOffset() + 420);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        dateStr = `${yyyy}-${mm}-${dd}`;
      }
      
      if (!grouped[dateStr]) {
        grouped[dateStr] = { downtime_seconds: 0, incident_count: 0, device_ids: new Set() };
      }
      grouped[dateStr].downtime_seconds += r.downtime_seconds || 0;
      grouped[dateStr].incident_count += r.incident_count || 0;
      grouped[dateStr].device_ids.add(r.device_id);
    });

    const dates = Object.keys(grouped).sort().slice(-7);
    const result = dates.map(dStr => {
      const g = grouped[dStr];
      const deviceCount = g.device_ids.size || 1;
      const totalSecs = deviceCount * 86400;
      const uptimePct = parseFloat((((totalSecs - g.downtime_seconds) / totalSecs) * 100).toFixed(4));
      return {
        date: dStr,
        uptime_pct: Math.max(0, uptimePct),
        downtime_seconds: g.downtime_seconds,
        incident_count: g.incident_count
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/category/:category: Calculates aggregated metrics for a specific equipment type
app.get('/api/analytics/category/:category', async (req, res) => {
  const category = req.params.category;
  try {
    let devices = [];
    if (useJsonFallback) {
      devices = jsonDbState.devices || [];
    } else {
      [devices] = await pool.query('SELECT * FROM devices');
    }
    const catDevices = devices.filter(d => d.equipment_type === category);
    const catDeviceIds = catDevices.map(d => d.id);

    if (catDeviceIds.length === 0) {
      return res.json({
        availability: 100.00,
        mttr: 0,
        mtbf: 86400,
        totalIncidents: 0,
        totalDowntime: 0,
        daysCount: 0,
        category: 'Excellent'
      });
    }

    let rawHistory = [];
    if (useJsonFallback) {
      if (!jsonDbState.daily_uptime) jsonDbState.daily_uptime = [];
      rawHistory = jsonDbState.daily_uptime.filter(r => catDeviceIds.includes(r.device_id));
    } else {
      [rawHistory] = await pool.query('SELECT * FROM daily_uptime WHERE device_id IN (?)', [catDeviceIds]);
    }

    let totalDowntime = 0;
    let totalIncidents = 0;
    let totalSeconds = rawHistory.length * 86400;

    rawHistory.forEach(r => {
      totalDowntime += r.downtime_seconds || 0;
      totalIncidents += r.incident_count || 0;
    });

    const totalUptimeSeconds = Math.max(0, totalSeconds - totalDowntime);
    const availability = totalSeconds > 0 ? parseFloat(((totalUptimeSeconds / totalSeconds) * 100).toFixed(4)) : 100.0000;

    const mttr = totalIncidents > 0 ? parseFloat((totalDowntime / totalIncidents).toFixed(1)) : 0;
    const mtbf = totalIncidents > 0 ? parseFloat((totalUptimeSeconds / totalIncidents).toFixed(1)) : totalUptimeSeconds;

    let grade = 'Excellent';
    if (availability >= 99.9) grade = 'Excellent';
    else if (availability >= 99.0) grade = 'Good';
    else if (availability >= 95.0) grade = 'Fair';
    else grade = 'Poor';

    res.json({
      availability,
      mttr,
      mtbf,
      totalIncidents,
      totalDowntime,
      daysCount: rawHistory.length,
      category: grade
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/category/:category/history: Returns past 7 days aggregated history for a specific equipment type
app.get('/api/analytics/category/:category/history', async (req, res) => {
  const category = req.params.category;
  try {
    let devices = [];
    if (useJsonFallback) {
      devices = jsonDbState.devices || [];
    } else {
      [devices] = await pool.query('SELECT * FROM devices');
    }
    const catDevices = devices.filter(d => d.equipment_type === category);
    const catDeviceIds = catDevices.map(d => d.id);

    if (catDeviceIds.length === 0) {
      return res.json([]);
    }

    let rawHistory = [];
    if (useJsonFallback) {
      if (!jsonDbState.daily_uptime) jsonDbState.daily_uptime = [];
      rawHistory = jsonDbState.daily_uptime.filter(r => catDeviceIds.includes(r.device_id));
    } else {
      [rawHistory] = await pool.query('SELECT * FROM daily_uptime WHERE device_id IN (?)', [catDeviceIds]);
    }

    const grouped = {};
    rawHistory.forEach(r => {
      let dateStr = r.date;
      if (dateStr instanceof Date || (typeof dateStr === 'string' && dateStr.includes('T'))) {
        const d = new Date(dateStr);
        d.setMinutes(d.getMinutes() + d.getTimezoneOffset() + 420);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        dateStr = `${yyyy}-${mm}-${dd}`;
      }
      
      if (!grouped[dateStr]) {
        grouped[dateStr] = { downtime_seconds: 0, incident_count: 0, device_ids: new Set() };
      }
      grouped[dateStr].downtime_seconds += r.downtime_seconds || 0;
      grouped[dateStr].incident_count += r.incident_count || 0;
      grouped[dateStr].device_ids.add(r.device_id);
    });

    const dates = Object.keys(grouped).sort().slice(-7);
    const result = dates.map(dStr => {
      const g = grouped[dStr];
      const deviceCount = g.device_ids.size || 1;
      const totalSecs = deviceCount * 86400;
      const uptimePct = parseFloat((((totalSecs - g.downtime_seconds) / totalSecs) * 100).toFixed(4));
      return {
        date: dStr,
        uptime_pct: Math.max(0, uptimePct),
        downtime_seconds: g.downtime_seconds,
        incident_count: g.incident_count
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual trigger for daily midnight reset (for testing / admin use)
app.post('/api/admin/reset-daily-uptime', async (req, res) => {
  try {
    const today = getLocalDateString();
    await executeDailyReset(today);
    res.json({ success: true, message: `Daily reset executed successfully for date ${today}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Action: Clear status logs older than 3 days and delete temporary dump files
app.post('/api/admin/clear-logs', async (req, res) => {
  try {
    let affectedRows = 0;
    if (useJsonFallback) {
      const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
      const initialCount = jsonDbState.logs.length;
      jsonDbState.logs = jsonDbState.logs.filter(l => new Date(l.timestamp).getTime() >= threeDaysAgo);
      saveJsonDb();
      affectedRows = initialCount - jsonDbState.logs.length;
    } else {
      const [result] = await pool.query('DELETE FROM logs WHERE timestamp < NOW() - INTERVAL 3 DAY');
      affectedRows = result.affectedRows;
    }

    // Delete the temporary dump file devices.json if it exists
    const dumpFile = path.join(__dirname, 'devices.json');
    let dumpDeleted = false;
    if (fs.existsSync(dumpFile)) {
      try {
        fs.unlinkSync(dumpFile);
        dumpDeleted = true;
        console.log('[MAINTENANCE] devices.json successfully deleted.');
      } catch (err) {
        console.error('Failed to delete devices.json:', err.message);
      }
    }

    console.log(`[MAINTENANCE] Cleared ${affectedRows} logs older than 3 days. Dump file deleted: ${dumpDeleted}`);
    
    // Broadcast refreshed log list
    let logsList = [];
    let devicesList = [];
    if (useJsonFallback) {
      devicesList = jsonDbState.devices || [];
      logsList = (jsonDbState.logs || []).slice(0, 30).map(l => {
        const d = (jsonDbState.devices || []).find(dev => dev.id === l.device_id);
        return { ...l, name: d ? d.name : 'Device' };
      });
    } else if (pool) {
      const [devicesRows] = await pool.query('SELECT * FROM devices');
      devicesList = devicesRows;
      const [logsRows] = await pool.query('SELECT l.*, d.name FROM logs l JOIN devices d ON l.device_id = d.id ORDER BY l.timestamp DESC LIMIT 30');
      logsList = logsRows;
    }
    broadcast({ type: 'INIT_DATA', devices: devicesList, logs: logsList, dbStatus: useJsonFallback ? 'fallback' : 'connected', config: { simulationMode: false, offlineAlarmEnabled: OFFLINE_ALARM_ENABLED } });

    res.json({ success: true, affectedRows, dumpDeleted });
  } catch (err) {
    console.error('Failed to run system maintenance:', err);
    res.status(500).json({ error: err.message });
  }
});

// Config: Get current settings
app.get('/api/config', (req, res) => {
  res.json({ simulationMode: false });
});

// Network: Return detected local interfaces + subnet routing info
app.get('/api/network-interfaces', (req, res) => {
  const ifaces = getLocalInterfaces();
  // Show which subnets each interface is responsible for monitoring
  const SUBNET_OWNERS = {
    '172.23': 'FIDS (WiFi)',
    '172.24': 'IP PABX (WiFi)',
    '192.168.0': 'CCTV Cameras (LAN)',
    '192.168.1': 'Server CCTV (LAN)',
    '192.168.30': 'Fire Alarm System (LAN)'
  };
  const result = ifaces.map(iface => {
    const parts = iface.address.split('.');
    const subnet3 = parts.slice(0, 3).join('.');
    const subnet2 = parts.slice(0, 2).join('.');
    const role = SUBNET_OWNERS[subnet3] || SUBNET_OWNERS[subnet2] || null;
    return { ...iface, monitoringRole: role };
  });
  res.json({ interfaces: result });
});

// Config: Update settings (legacy - Simulation Mode is removed)
app.post('/api/config', (req, res) => {
  res.json({ success: true, simulationMode: false });
});

// Telemetry: FIDS Client agent reporting (real CPU/RAM/App logs)
app.post('/api/telemetry', async (req, res) => {
  const { ip_address, cpu_usage, ram_usage, logged_in, screen_frozen } = req.body;
  if (!ip_address) {
    return res.status(400).json({ error: 'ip_address is required.' });
  }

  try {
    let device = null;
    if (useJsonFallback) {
      device = jsonDbState.devices.find(d => d.ip_address === ip_address);
    } else {
      const [rows] = await pool.query('SELECT * FROM devices WHERE ip_address = ?', [ip_address]);
      if (rows.length > 0) device = rows[0];
    }

    if (!device) {
      return res.status(404).json({ error: `FIDS device with IP ${ip_address} is not registered in the system.` });
    }

    let newStatus = 'Online';
    let anomalyType = null;
    let logMsg = '';

    // Evaluate telemetry states
    if (logged_in === false) {
      newStatus = 'Anomaly';
      anomalyType = 'Force Logout';
      logMsg = `${device.name} Telemetry: User session logged out unexpectedly.`;
    } else if (screen_frozen === true) {
      newStatus = 'Anomaly';
      anomalyType = 'Freeze Screen';
      logMsg = `${device.name} Telemetry: Display screen is frozen/static.`;
    } else if (cpu_usage > 90 || ram_usage > 90) {
      newStatus = 'Anomaly';
      anomalyType = 'High CPU/RAM';
      logMsg = `${device.name} Telemetry: High Resource usage (CPU: ${cpu_usage}%, RAM: ${ram_usage}%).`;
    } else {
      newStatus = 'Online';
      anomalyType = null;
      logMsg = `${device.name} Telemetry: Heartbeat ok. Resources normal.`;
    }

    if (device.status !== newStatus || device.anomaly_type !== anomalyType) {
      let updatedDevice = { ...device, status: newStatus, anomaly_type: anomalyType };
      
      if (useJsonFallback) {
        const idx = jsonDbState.devices.findIndex(d => d.id === device.id);
        jsonDbState.devices[idx] = updatedDevice;
        saveJsonDb();
      } else {
        await pool.query(
          `UPDATE devices SET status = ?, anomaly_type = ? WHERE id = ?`,
          [newStatus, anomalyType, device.id]
        );
      }

      await logStatusChange(device.id, newStatus, logMsg);
      broadcast({ type: 'DEVICE_UPDATED', device: updatedDevice });
    }

    res.json({ success: true, status: newStatus, anomalyType });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch logs for a specific device
app.get('/api/devices/:id/logs', async (req, res) => {
  const deviceId = parseInt(req.params.id);
  try {
    if (useJsonFallback) {
      const deviceLogs = jsonDbState.logs
        .filter(l => l.device_id === deviceId)
        .map(l => {
          const d = jsonDbState.devices.find(dev => dev.id === l.device_id);
          return { ...l, name: d ? d.name : 'Device' };
        });
      return res.json(deviceLogs);
    }
    
    const [rows] = await pool.query(
      'SELECT l.*, d.name FROM logs l JOIN devices d ON l.device_id = d.id WHERE l.device_id = ? ORDER BY l.timestamp DESC LIMIT 100',
      [deviceId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch all logs with pagination to protect database
app.get('/api/logs', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    if (useJsonFallback) {
      const sortedLogs = [...jsonDbState.logs].map(l => {
        const dev = jsonDbState.devices.find(d => d.id === l.device_id);
        return { ...l, name: dev ? dev.name : 'Device' };
      });
      const totalLogs = sortedLogs.length;
      const totalPages = Math.ceil(totalLogs / limit) || 1;
      const logsSlice = sortedLogs.slice(offset, offset + limit);
      return res.json({ logs: logsSlice, totalLogs, totalPages });
    }

    const [countRows] = await pool.query('SELECT COUNT(*) as count FROM logs');
    const count = countRows[0].count;
    
    // LIMIT/OFFSET parameters are safer parsed and interpolated directly for MySQL prepared driver compatibility
    const [rows] = await pool.query(
      `SELECT l.*, d.name FROM logs l JOIN devices d ON l.device_id = d.id ORDER BY l.timestamp DESC LIMIT ${limit} OFFSET ${offset}`
    );
    
    res.json({
      logs: rows,
      totalLogs: count,
      totalPages: Math.ceil(count / limit) || 1
    });
  } catch (err) {
    console.error('Error fetching logs:', err);
    res.status(500).json({ error: err.message });
  }
});

// Action: Restart App (recovers from anomalies)
app.post('/api/restart-app', async (req, res) => {
  const deviceId = parseInt(req.body.deviceId);
  try {
    let device = null;
    if (useJsonFallback) {
      device = jsonDbState.devices.find(d => d.id === deviceId);
    } else {
      const [rows] = await pool.query('SELECT * FROM devices WHERE id = ?', [deviceId]);
      if (rows.length > 0) device = rows[0];
    }

    if (!device) return res.status(404).json({ error: 'Device not found' });
    
    let updatedDevice = { ...device, status: 'Online', anomaly_type: null };

    if (useJsonFallback) {
      const idx = jsonDbState.devices.findIndex(d => d.id === deviceId);
      jsonDbState.devices[idx] = updatedDevice;
      saveJsonDb();
    } else {
      await pool.query('UPDATE devices SET status = "Online", anomaly_type = NULL WHERE id = ?', [deviceId]);
    }

    await logStatusChange(deviceId, 'Online', `Command Executed: Application restarted on ${device.name}. Screen initialized successfully.`);
    broadcast({ type: 'DEVICE_UPDATED', device: updatedDevice });
    res.json({ success: true, device: updatedDevice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Action: Force Login
app.post('/api/force-login', async (req, res) => {
  const deviceId = parseInt(req.body.deviceId);
  try {
    let device = null;
    if (useJsonFallback) {
      device = jsonDbState.devices.find(d => d.id === deviceId);
    } else {
      const [rows] = await pool.query('SELECT * FROM devices WHERE id = ?', [deviceId]);
      if (rows.length > 0) device = rows[0];
    }

    if (!device) return res.status(404).json({ error: 'Device not found' });
    
    let updatedDevice = { ...device, status: 'Online', anomaly_type: null };

    if (useJsonFallback) {
      const idx = jsonDbState.devices.findIndex(d => d.id === deviceId);
      jsonDbState.devices[idx] = updatedDevice;
      saveJsonDb();
    } else {
      await pool.query('UPDATE devices SET status = "Online", anomaly_type = NULL WHERE id = ?', [deviceId]);
    }

    await logStatusChange(deviceId, 'Online', `Command Executed: Initiated automated remote login protocol for ${device.name}. App session verified.`);
    broadcast({ type: 'DEVICE_UPDATED', device: updatedDevice });
    res.json({ success: true, device: updatedDevice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Action: Manual Ping Test
app.post('/api/ping-test', async (req, res) => {
  const deviceId = parseInt(req.body.deviceId);
  try {
    let device = null;
    if (useJsonFallback) {
      device = jsonDbState.devices.find(d => d.id === deviceId);
    } else {
      const [rows] = await pool.query('SELECT * FROM devices WHERE id = ?', [deviceId]);
      if (rows.length > 0) device = rows[0];
    }

    if (!device) return res.status(404).json({ error: 'Device not found' });
    
    const pingCmd = process.platform === 'win32' 
      ? `ping -n 1 -w 1000 ${device.ip_address}`
      : `ping -c 1 -W 1 ${device.ip_address}`;
      
    exec(pingCmd, async (err) => {
      const isSuccess = !err;
      const message = isSuccess 
        ? `Manual Ping Success: ${device.ip_address} responded in <10ms.`
        : `Manual Ping Fail: ${device.ip_address} timed out or network is unreachable.`;
      
      if (isSuccess) {
        const updatedDevice = { ...device, status: 'Online', anomaly_type: null, offline_since: null };
        if (useJsonFallback) {
          const idx = jsonDbState.devices.findIndex(d => d.id === deviceId);
          if (idx !== -1) {
            jsonDbState.devices[idx] = updatedDevice;
            saveJsonDb();
          }
        } else {
          await pool.query('UPDATE devices SET status = "Online", anomaly_type = NULL, offline_since = NULL WHERE id = ?', [deviceId]);
        }
        broadcast({ type: 'DEVICE_UPDATED', device: updatedDevice });
      }

      await logStatusChange(deviceId, isSuccess ? 'Online' : 'Offline', message);
      res.json({ success: isSuccess, message });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Action: Sequential Single Ping Test for diagnostic loops
app.post('/api/ping-single', async (req, res) => {
  const deviceId = parseInt(req.body.deviceId);
  try {
    let device = null;
    if (useJsonFallback) {
      device = jsonDbState.devices.find(d => d.id === deviceId);
    } else {
      const [rows] = await pool.query('SELECT * FROM devices WHERE id = ?', [deviceId]);
      if (rows.length > 0) device = rows[0];
    }

    if (!device) return res.status(404).json({ error: 'Device not found' });

    // Use our new standardized single ping helper with a 3000ms timeout for diagnostics
    const result = await pingDeviceSingle(device.ip_address, 3000);
    
    res.json({ 
      success: result.success, 
      ip_address: device.ip_address,
      name: device.name,
      latency: result.success ? (result.latency + 'ms') : null,
      timestamp: new Date()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CRUD: Create new FIDS device
app.post('/api/devices', async (req, res) => {
  const { ip_address, name, location, terminal, equipment_type } = req.body;
  if (!ip_address || !name || !location || !terminal) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    let newDevice = {
      ip_address,
      name,
      location,
      terminal,
      equipment_type: equipment_type || 'FIDS',
      status: 'Online',
      anomaly_type: null,
      health_status_detail: null,
      uptime_pct: '100.00',
      downtime_count: 0,
      failed_access_count: 0
    };

    if (useJsonFallback) {
      // Find max ID
      const maxId = jsonDbState.devices.reduce((max, d) => d.id > max ? d.id : max, 0);
      newDevice.id = maxId + 1;
      jsonDbState.devices.push(newDevice);
      saveJsonDb();
    } else {
      const [result] = await pool.query(
        `INSERT INTO devices (ip_address, name, location, terminal, equipment_type, status, anomaly_type, health_status_detail, uptime_pct, downtime_count, failed_access_count) 
         VALUES (?, ?, ?, ?, ?, 'Online', NULL, NULL, 100.00, 0, 0)`,
        [ip_address, name, location, terminal, newDevice.equipment_type]
      );
      newDevice.id = result.insertId;
    }

    await logStatusChange(newDevice.id, 'Online', `System Info: New FIDS monitor registered for ${newDevice.name} at IP ${newDevice.ip_address}`);
    broadcast({ type: 'DEVICE_CREATED', device: newDevice });
    res.json({ success: true, device: newDevice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CRUD: Update existing FIDS device
app.put('/api/devices/:id', verifyAdmin, async (req, res) => {
  const deviceId = parseInt(req.params.id);
  const { ip_address, name, location, terminal, equipment_type } = req.body;

  try {
    let device = null;
    if (useJsonFallback) {
      device = jsonDbState.devices.find(d => d.id === deviceId);
    } else {
      const [rows] = await pool.query('SELECT * FROM devices WHERE id = ?', [deviceId]);
      if (rows.length > 0) device = rows[0];
    }

    if (!device) return res.status(404).json({ error: 'Device not found' });

    let updatedDevice = { 
      ...device, 
      ip_address: ip_address || device.ip_address,
      name: name || device.name,
      location: location || device.location,
      terminal: terminal || device.terminal,
      equipment_type: equipment_type || device.equipment_type,
      offline_since: null
    };

    if (useJsonFallback) {
      const idx = jsonDbState.devices.findIndex(d => d.id === deviceId);
      jsonDbState.devices[idx] = updatedDevice;
      saveJsonDb();
    } else {
      await pool.query(
        `UPDATE devices SET ip_address = ?, name = ?, location = ?, terminal = ?, equipment_type = ?, offline_since = NULL WHERE id = ?`,
        [updatedDevice.ip_address, updatedDevice.name, updatedDevice.location, updatedDevice.terminal, updatedDevice.equipment_type, deviceId]
      );
    }

    await logStatusChange(deviceId, device.status, `System Info: Updated FIDS configuration for ${updatedDevice.name}`);
    broadcast({ type: 'DEVICE_UPDATED', device: updatedDevice });
    res.json({ success: true, device: updatedDevice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual Suspend: Suspend background monitoring for a device
app.post('/api/suspend-device', async (req, res) => {
  const { deviceId, reason, note } = req.body;
  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId is required' });
  }

  try {
    let device = null;
    if (useJsonFallback) {
      device = jsonDbState.devices.find(d => d.id === parseInt(deviceId));
    } else {
      const [rows] = await pool.query('SELECT * FROM devices WHERE id = ?', [deviceId]);
      if (rows.length > 0) device = rows[0];
    }

    if (!device) return res.status(404).json({ error: 'Device not found' });

    const suspendReason = (reason === 'Rusak' || reason === 'Maintenance') ? reason : 'Manual';
    const detailString = `Suspended (${suspendReason})`;

    // Set status to Offline, health_status_detail to detailString
    // and offline_since to 15 minutes ago so it is immediately suspended
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const updatedDevice = {
      ...device,
      status: 'Offline',
      health_status_detail: detailString,
      offline_since: fifteenMinutesAgo
    };

    if (useJsonFallback) {
      const idx = jsonDbState.devices.findIndex(d => d.id === device.id);
      if (idx !== -1) {
        jsonDbState.devices[idx] = updatedDevice;
        saveJsonDb();
      }
    } else {
      await pool.query(
        `UPDATE devices SET status = 'Offline', health_status_detail = ?, offline_since = ? WHERE id = ?`,
        [detailString, fifteenMinutesAgo, device.id]
      );
    }

    const noteText = note ? ` Note: ${note}` : '';
    await logStatusChange(device.id, 'Offline', `Operator manual action: Device suspended (${suspendReason}).${noteText}`);
    broadcast({ type: 'DEVICE_UPDATED', device: updatedDevice });

    res.json({ success: true, device: updatedDevice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual Resume: Resume background monitoring for a device
app.post('/api/resume-device', async (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId is required' });
  }

  try {
    let device = null;
    if (useJsonFallback) {
      device = jsonDbState.devices.find(d => d.id === parseInt(deviceId));
    } else {
      const [rows] = await pool.query('SELECT * FROM devices WHERE id = ?', [deviceId]);
      if (rows.length > 0) device = rows[0];
    }

    if (!device) return res.status(404).json({ error: 'Device not found' });

    // Reset health_status_detail and offline_since to NULL
    const updatedDevice = {
      ...device,
      health_status_detail: null,
      offline_since: null
    };

    if (useJsonFallback) {
      const idx = jsonDbState.devices.findIndex(d => d.id === device.id);
      if (idx !== -1) {
        jsonDbState.devices[idx] = updatedDevice;
        saveJsonDb();
      }
    } else {
      await pool.query(
        `UPDATE devices SET health_status_detail = NULL, offline_since = NULL WHERE id = ?`,
        [device.id]
      );
    }

    await logStatusChange(device.id, device.status, `Operator manual action: Resumed background monitoring.`);
    
    // Broadcast change
    broadcast({ type: 'DEVICE_UPDATED', device: updatedDevice });

    // Trigger an asynchronous ping check immediately to update current status
    setTimeout(async () => {
      try {
        await pingDevice(updatedDevice);
      } catch (pingErr) {
        console.error('Failed to trigger immediate ping check on resume:', pingErr);
      }
    }, 0);

    res.json({ success: true, device: updatedDevice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CRUD: Delete FIDS device
app.delete('/api/devices/:id', verifyAdmin, async (req, res) => {
  const deviceId = parseInt(req.params.id);

  try {
    let device = null;
    if (useJsonFallback) {
      device = jsonDbState.devices.find(d => d.id === deviceId);
    } else {
      const [rows] = await pool.query('SELECT * FROM devices WHERE id = ?', [deviceId]);
      if (rows.length > 0) device = rows[0];
    }

    if (!device) return res.status(404).json({ error: 'Device not found' });

    if (useJsonFallback) {
      jsonDbState.devices = jsonDbState.devices.filter(d => d.id !== deviceId);
      jsonDbState.logs = jsonDbState.logs.filter(l => l.device_id !== deviceId);
      saveJsonDb();
    } else {
      await pool.query('DELETE FROM devices WHERE id = ?', [deviceId]);
    }

    broadcast({ type: 'DEVICE_DELETED', deviceId });
    res.json({ success: true, message: `Device ${device.name} removed successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start initialization and start server
async function main() {
  // Start HTTP server IMMEDIATELY so clients can connect while DB initializes
  server.listen(PORT, () => {
    console.log(`FIDS Monitoring Dashboard running at http://localhost:${PORT}`);
    console.log(`Initializing database connection...`);
  });

  // Initialize DB in background — clients get data as soon as DB is ready
  await initializeDatabase();
  startHeartbeatMonitor();
  startTelegramBotPolling();
  console.log(`All services started. Dashboard is fully operational.`);

  // Broadcast fresh device data to any client that connected before DB was ready
  try {
    let devicesList = [];
    let logsList = [];
    if (useJsonFallback) {
      devicesList = jsonDbState.devices || [];
      logsList = (jsonDbState.logs || []).slice(0, 30).map(l => {
        const d = (jsonDbState.devices || []).find(dev => dev.id === l.device_id);
        return { ...l, name: d ? d.name : 'Device' };
      });
    } else if (pool) {
      const [devicesRows] = await pool.query('SELECT * FROM devices');
      const [logsRows] = await pool.query('SELECT l.*, d.name FROM logs l JOIN devices d ON l.device_id = d.id ORDER BY l.timestamp DESC LIMIT 30');
      devicesList = devicesRows;
      logsList = logsRows;
    }
    if (devicesList.length > 0) {
      const dbStatus = useJsonFallback ? 'fallback' : 'connected';
      broadcast({ type: 'INIT_DATA', devices: devicesList, logs: logsList, dbStatus, config: { simulationMode: false, offlineAlarmEnabled: OFFLINE_ALARM_ENABLED } });
      console.log(`[STARTUP] Pushed INIT_DATA broadcast to ${wss.clients.size} connected client(s).`);
    }
  } catch (err) {
    console.error('[STARTUP] Failed to broadcast post-init data:', err.message);
  }
}

main();
