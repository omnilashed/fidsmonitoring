-- Create Database
CREATE DATABASE IF NOT EXISTS fids_monitoring;
USE fids_monitoring;

DROP TABLE IF EXISTS logs;
DROP TABLE IF EXISTS devices;

-- Create Devices Table
CREATE TABLE IF NOT EXISTS devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(100) NOT NULL,
    terminal VARCHAR(10) NOT NULL, -- T1, T2, T3
    equipment_type VARCHAR(50) DEFAULT 'FIDS',
    status VARCHAR(20) DEFAULT 'Online', -- Online, Offline, Anomaly
    anomaly_type VARCHAR(50) DEFAULT NULL, -- 'Force Logout', 'Freeze Screen', 'High CPU/RAM'
    health_status_detail VARCHAR(50) DEFAULT NULL,
    uptime_pct DECIMAL(5,2) DEFAULT 100.00,
    downtime_count INT DEFAULT 0,
    failed_access_count INT DEFAULT 0,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create Logs Table
CREATE TABLE IF NOT EXISTS logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id INT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL,
    message VARCHAR(255) NOT NULL,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- Insert Mock FIDS and Other Infrastructure Devices
INSERT INTO devices (id, ip_address, name, location, terminal, equipment_type, status, anomaly_type, uptime_pct, downtime_count, failed_access_count)
VALUES
(1, '172.23.1.10', 'FIDS-T1-Checkin-01', 'Check-in Desk Row A', 'T1', 'FIDS', 'Online', NULL, 100.00, 0, 0),
(2, '172.23.1.20', 'FIDS-T1-Gate-01A', 'Gate 1A Departure', 'T1', 'FIDS', 'Online', NULL, 99.80, 0, 0),
(3, '172.23.1.30', 'FIDS-T2-Checkin-05', 'Check-in Desk 5', 'T2', 'FIDS', 'Offline', NULL, 94.20, 3, 12),
(4, '172.23.1.60', 'FIDS-T2-Gate-02', 'Gate 2 Boarding Lounge', 'T2', 'FIDS', 'Online', NULL, 100.00, 0, 0),
(5, '172.23.1.100', 'FIDS-T3-Checkin-01', 'International Check-in 1', 'T3', 'FIDS', 'Anomaly', 'Force Logout', 98.50, 1, 2),
(6, '172.23.1.110', 'FIDS-T3-Gate-03', 'Gate 3 Boarding', 'T3', 'FIDS', 'Anomaly', 'Freeze Screen', 99.10, 1, 1),
(7, '172.23.1.150', 'FIDS-T3-Baggage-02', 'Baggage Claim 2', 'T3', 'FIDS', 'Online', NULL, 100.00, 0, 0),
(8, '172.23.1.200', 'FIDS-T3-Arrival-Main', 'Arrival Hall Center', 'T3', 'FIDS', 'Anomaly', 'High CPU/RAM', 97.40, 2, 4),
(18, '172.23.1.51', 'FIDS-Server-Core01', 'Main Server Room Rack 2', 'T2', 'Server FIDS', 'Online', NULL, 99.99, 0, 0),
(19, '172.23.1.41', 'FIDS-Server-Core02', 'Main Server Room Rack 3', 'T2', 'Server FIDS', 'Online', NULL, 99.95, 0, 0),
(20, '172.23.1.50', 'FIDS-Server-Backup01', 'Backup Server Room T3', 'T3', 'Server FIDS', 'Online', NULL, 99.98, 0, 0),
(21, '172.23.1.49', 'FIDS-Server-Backup02', 'OIC Server Room T1', 'T1', 'Server FIDS', 'Online', NULL, 99.90, 0, 0),
(9, '172.24.0.10', 'PABX-Server-Core', 'Server Room 2nd Floor', 'T1', 'IP PABX', 'Online', NULL, 99.90, 0, 0),
(10, '172.24.0.25', 'PABX-Gateway-T2', 'PABX Room T2', 'T2', 'IP PABX', 'Online', NULL, 99.70, 0, 0),
(11, '192.168.1.10', 'CCTV-Storage-Svr01', 'Main Data Center', 'T3', 'Server CCTV', 'Online', NULL, 100.00, 0, 0),
(12, '192.168.1.50', 'CCTV-NVR-Backup', 'NVR Room T3', 'T3', 'Server CCTV', 'Online', NULL, 99.50, 0, 0),
(13, '192.168.0.20', 'CCTV-Gate-3-Arrival', 'Gate 3 Arrival Hall', 'T3', 'CCTV', 'Online', NULL, 98.40, 1, 2),
(14, '192.168.0.45', 'CCTV-Checkin-T1', 'Check-in Area Row B', 'T1', 'CCTV', 'Online', NULL, 99.20, 1, 1),
(15, '192.168.30.1', 'FAS-Main-Server', 'Safety Control Room', 'T2', 'Server Fire Alarm System', 'Online', NULL, 100.00, 0, 0),
(16, '192.168.30.15', 'FAS-Detector-Zone5', 'Waiting Lounge T2', 'T2', 'Fire Alarm System', 'Online', NULL, 99.80, 0, 0),
(17, '192.168.30.30', 'FAS-Siren-Departure', 'Departure Hall Corridor', 'T1', 'Fire Alarm System', 'Online', NULL, 99.90, 0, 0)
ON DUPLICATE KEY UPDATE ip_address=ip_address;

-- Pre-populate some logs
INSERT INTO logs (device_id, status, message)
VALUES
(1, 'Online', 'Device connected and responding to heartbeat.'),
(2, 'Online', 'Device connected and responding to heartbeat.'),
(3, 'Offline', 'Host Unreachable: Connection timeout/Ping failure.'),
(4, 'Online', 'Device connected and responding to heartbeat.'),
(5, 'Anomaly', 'App Session Signed Out: user session terminated unexpectedly.'),
(6, 'Anomaly', 'Freeze Screen: Visual output static for > 5 minutes.'),
(7, 'Online', 'Device connected and responding to heartbeat.'),
(8, 'Anomaly', 'High CPU/RAM: Resource usage at 94% CPU.');


-- Create Users Table for Authentication
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user' -- admin (CRUD) or user (Create Only)
);

-- Seed Default Accounts (Passwords: adminpass, operatorpass)
INSERT INTO users (id, username, password_hash, role)
VALUES
(1, 'admin', SHA2('adminpass', 256), 'admin'),
(2, 'operator', SHA2('operatorpass', 256), 'user')
ON DUPLICATE KEY UPDATE username=username;

-- Create Settings Table for System Configurations
CREATE TABLE IF NOT EXISTS settings (
    `key` VARCHAR(50) PRIMARY KEY,
    `value` TEXT NOT NULL
);

-- Seed Default Settings
INSERT INTO settings (`key`, `value`)
VALUES
('telegram_enabled', 'false'),
('telegram_token', ''),
('telegram_chat_id', ''),
('scheduler_batch_size', '30'),
('scheduler_ping_interval', '10000')
ON DUPLICATE KEY UPDATE `key`=`key`;


-- Create Daily Uptime Table for Analytics (Availability, MTBF, MTTR)
CREATE TABLE IF NOT EXISTS daily_uptime (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id INT NOT NULL,
    `date` DATE NOT NULL,
    downtime_seconds INT DEFAULT 0,
    incident_count INT DEFAULT 0,
    uptime_pct DECIMAL(5,2) DEFAULT 100.00,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    UNIQUE KEY idx_device_date (device_id, `date`)
);


