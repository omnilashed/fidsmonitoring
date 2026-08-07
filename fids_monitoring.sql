-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Aug 07, 2026 at 05:41 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `fids_monitoring`
--

-- --------------------------------------------------------

--
-- Table structure for table `daily_uptime`
--

CREATE TABLE `daily_uptime` (
  `id` int(11) NOT NULL,
  `device_id` int(11) NOT NULL,
  `date` date NOT NULL,
  `downtime_seconds` int(11) DEFAULT 0,
  `incident_count` int(11) DEFAULT 0,
  `uptime_pct` decimal(5,2) DEFAULT 100.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `daily_uptime`
--

INSERT INTO `daily_uptime` (`id`, `device_id`, `date`, `downtime_seconds`, `incident_count`, `uptime_pct`) VALUES
(1, 24, '2026-08-02', 20, 3, 99.98),
(2, 34, '2026-08-02', 40, 7, 99.95),
(3, 31, '2026-08-02', 265, 25, 99.69),
(4, 22, '2026-08-02', 50, 8, 99.94),
(5, 27, '2026-08-02', 45, 3, 99.95),
(6, 28, '2026-08-02', 175, 29, 99.80),
(7, 29, '2026-08-02', 25, 2, 99.97),
(8, 30, '2026-08-02', 20, 3, 99.98),
(9, 33, '2026-08-02', 25, 5, 99.97),
(10, 23, '2026-08-02', 1935, 130, 97.76),
(11, 25, '2026-08-02', 1515, 10, 98.25),
(17642, 35, '2026-08-02', 5, 1, 99.99),
(17775, 36, '2026-08-02', 5, 1, 99.99),
(17815, 37, '2026-08-02', 5, 1, 99.99),
(17971, 38, '2026-08-02', 5, 1, 99.99),
(18331, 39, '2026-08-02', 5, 1, 99.99),
(18364, 40, '2026-08-02', 5, 1, 99.99),
(18637, 41, '2026-08-02', 5, 1, 99.99),
(18675, 42, '2026-08-02', 5, 1, 99.99),
(18818, 43, '2026-08-02', 15, 2, 99.98),
(18879, 44, '2026-08-02', 15, 3, 99.98),
(18922, 45, '2026-08-02', 10, 1, 99.99),
(19297, 46, '2026-08-02', 535, 92, 99.38),
(19344, 47, '2026-08-02', 5, 1, 99.99),
(19609, 49, '2026-08-02', 25, 4, 99.97),
(20210, 50, '2026-08-02', 5, 1, 99.99),
(20341, 51, '2026-08-02', 10, 2, 99.99),
(20585, 52, '2026-08-02', 10, 1, 99.99),
(20754, 53, '2026-08-02', 5, 1, 99.99),
(20929, 54, '2026-08-02', 5, 1, 99.99),
(21080, 55, '2026-08-02', 10, 1, 99.99),
(21236, 56, '2026-08-02', 10, 2, 99.99),
(31080, 57, '2026-08-02', 5, 1, 99.99),
(31312, 58, '2026-08-02', 5, 1, 99.99),
(31585, 59, '2026-08-02', 5, 1, 99.99),
(31691, 60, '2026-08-02', 10, 1, 99.99),
(31836, 61, '2026-08-02', 5, 1, 99.99),
(32059, 62, '2026-08-02', 5, 1, 99.99),
(32250, 63, '2026-08-02', 10, 1, 99.99),
(32407, 64, '2026-08-02', 5, 1, 99.99),
(32608, 65, '2026-08-02', 5, 1, 99.99),
(33142, 66, '2026-08-02', 10, 1, 99.99),
(33437, 67, '2026-08-02', 10, 1, 99.99),
(33610, 68, '2026-08-02', 5, 1, 99.99),
(33875, 69, '2026-08-02', 10, 1, 99.99),
(34056, 70, '2026-08-02', 10, 1, 99.99),
(34241, 71, '2026-08-02', 10, 1, 99.99),
(34799, 72, '2026-08-02', 10, 2, 99.99),
(35040, 73, '2026-08-02', 15, 2, 99.98),
(35629, 74, '2026-08-02', 5, 1, 99.99),
(35980, 75, '2026-08-02', 10, 2, 99.99),
(36134, 76, '2026-08-02', 10, 1, 99.99),
(36447, 77, '2026-08-02', 15, 2, 99.98),
(37084, 78, '2026-08-02', 5, 1, 99.99),
(37355, 79, '2026-08-02', 20, 3, 99.98),
(37521, 80, '2026-08-02', 10, 1, 99.99),
(37746, 81, '2026-08-02', 5, 1, 99.99),
(38431, 82, '2026-08-02', 5, 1, 99.99),
(38664, 83, '2026-08-02', 15, 2, 99.98),
(39491, 84, '2026-08-02', 10, 1, 99.99),
(40182, 86, '2026-08-02', 10, 1, 99.99),
(40793, 87, '2026-08-02', 10, 1, 99.99),
(41042, 88, '2026-08-02', 295, 2, 99.65),
(41358, 89, '2026-08-02', 10, 1, 99.99),
(44905, 35, '2026-08-03', 5, 1, 99.99),
(44906, 25, '2026-08-03', 95, 19, 99.89),
(44907, 42, '2026-08-03', 5, 1, 99.99),
(44908, 24, '2026-08-03', 15, 3, 99.98),
(44909, 36, '2026-08-03', 5, 1, 99.99),
(44910, 37, '2026-08-03', 5, 1, 99.99),
(44911, 38, '2026-08-03', 5, 1, 99.99),
(44912, 39, '2026-08-03', 5, 1, 99.99),
(44913, 40, '2026-08-03', 5, 1, 99.99),
(44914, 41, '2026-08-03', 5, 1, 99.99),
(44915, 34, '2026-08-03', 5, 1, 99.99),
(44916, 23, '2026-08-03', 5035, 286, 94.17),
(44917, 33, '2026-08-03', 20, 4, 99.98),
(44918, 31, '2026-08-03', 130, 13, 99.85),
(44919, 22, '2026-08-03', 40, 8, 99.95),
(44920, 27, '2026-08-03', 25, 4, 99.97),
(44921, 28, '2026-08-03', 25, 4, 99.97),
(44922, 29, '2026-08-03', 20, 4, 99.98),
(44923, 30, '2026-08-03', 25, 5, 99.97),
(44924, 43, '2026-08-03', 35, 7, 99.96),
(44925, 44, '2026-08-03', 15, 3, 99.98),
(44926, 45, '2026-08-03', 15, 3, 99.98),
(44927, 46, '2026-08-03', 2040, 357, 97.64),
(44928, 47, '2026-08-03', 20, 4, 99.98),
(44929, 49, '2026-08-03', 20, 4, 99.98),
(44930, 50, '2026-08-03', 25, 5, 99.97),
(44931, 51, '2026-08-03', 40, 8, 99.95),
(44932, 52, '2026-08-03', 20, 4, 99.98),
(44933, 53, '2026-08-03', 40, 7, 99.95),
(44934, 54, '2026-08-03', 20, 4, 99.98),
(44935, 55, '2026-08-03', 20, 4, 99.98),
(44936, 56, '2026-08-03', 5, 1, 99.99),
(44937, 57, '2026-08-03', 10, 2, 99.99),
(44938, 58, '2026-08-03', 20, 4, 99.98),
(44939, 59, '2026-08-03', 15, 3, 99.98),
(44940, 60, '2026-08-03', 35, 7, 99.96),
(44941, 61, '2026-08-03', 30, 6, 99.97),
(44942, 62, '2026-08-03', 40, 8, 99.95),
(44943, 63, '2026-08-03', 40, 8, 99.95),
(44944, 64, '2026-08-03', 10, 2, 99.99),
(44945, 65, '2026-08-03', 5, 1, 99.99),
(44946, 66, '2026-08-03', 35, 6, 99.96),
(44947, 67, '2026-08-03', 30, 6, 99.97),
(44948, 68, '2026-08-03', 30, 6, 99.97),
(44949, 69, '2026-08-03', 55, 9, 99.94),
(44950, 70, '2026-08-03', 25, 5, 99.97),
(44951, 71, '2026-08-03', 20, 4, 99.98),
(44952, 72, '2026-08-03', 35, 7, 99.96),
(44953, 73, '2026-08-03', 25, 5, 99.97),
(44954, 74, '2026-08-03', 20, 4, 99.98),
(44955, 75, '2026-08-03', 10, 2, 99.99),
(44956, 76, '2026-08-03', 30, 6, 99.97),
(44957, 77, '2026-08-03', 10, 2, 99.99),
(44958, 78, '2026-08-03', 35, 7, 99.96),
(44959, 79, '2026-08-03', 15, 3, 99.98),
(44960, 80, '2026-08-03', 15, 3, 99.98),
(44961, 81, '2026-08-03', 15, 3, 99.98),
(44962, 82, '2026-08-03', 5, 1, 99.99),
(44963, 83, '2026-08-03', 15, 3, 99.98),
(44964, 84, '2026-08-03', 35, 7, 99.96),
(44965, 86, '2026-08-03', 75, 14, 99.91),
(44966, 87, '2026-08-03', 70, 13, 99.92),
(44967, 88, '2026-08-03', 510, 10, 99.41),
(44968, 89, '2026-08-03', 35, 7, 99.96),
(95721, 90, '2026-08-03', 15, 3, 99.98),
(95982, 91, '2026-08-03', 20, 4, 99.98),
(96313, 92, '2026-08-03', 60, 7, 99.93),
(96649, 93, '2026-08-03', 90, 13, 99.90),
(96990, 94, '2026-08-03', 70, 9, 99.92),
(99061, 95, '2026-08-03', 50, 8, 99.94),
(99412, 96, '2026-08-03', 40, 4, 99.95),
(99555, 97, '2026-08-03', 5, 1, 99.99),
(99700, 98, '2026-08-03', 5, 1, 99.99),
(99774, 99, '2026-08-03', 20, 4, 99.98),
(101181, 100, '2026-08-03', 30, 6, 99.97),
(101557, 101, '2026-08-03', 20, 4, 99.98),
(101938, 103, '2026-08-03', 0, 0, 100.00),
(101939, 104, '2026-08-03', 55, 10, 99.94),
(102174, 105, '2026-08-03', 10, 2, 99.99),
(102175, 106, '2026-08-03', 15, 3, 99.98),
(102576, 107, '2026-08-03', 15, 3, 99.98),
(102820, 108, '2026-08-03', 10, 2, 99.99),
(102985, 109, '2026-08-03', 0, 0, 100.00),
(103152, 110, '2026-08-03', 50, 8, 99.94),
(103237, 111, '2026-08-03', 25, 5, 99.97),
(103493, 112, '2026-08-03', 40, 6, 99.95),
(103580, 113, '2026-08-03', 30, 6, 99.97),
(104190, 114, '2026-08-03', 15, 3, 99.98),
(105775, 115, '2026-08-03', 30, 6, 99.97),
(105865, 116, '2026-08-03', 40, 8, 99.95),
(109489, 118, '2026-08-03', 5, 1, 99.99),
(109944, 119, '2026-08-03', 5, 1, 99.99),
(110487, 120, '2026-08-03', 25, 5, 99.97),
(110879, 121, '2026-08-03', 0, 0, 100.00),
(111172, 122, '2026-08-03', 0, 0, 100.00),
(116683, 123, '2026-08-03', 0, 0, 100.00),
(117730, 124, '2026-08-03', 0, 0, 100.00),
(118701, 125, '2026-08-03', 0, 0, 100.00),
(119094, 126, '2026-08-03', 0, 0, 100.00),
(119502, 127, '2026-08-03', 0, 0, 100.00),
(120504, 128, '2026-08-03', 15, 3, 99.98),
(121311, 129, '2026-08-03', 20, 4, 99.98),
(124985, 130, '2026-08-03', 25, 5, 99.97),
(125913, 131, '2026-08-03', 0, 0, 100.00),
(126121, 132, '2026-08-03', 15, 3, 99.98),
(126438, 133, '2026-08-03', 10, 2, 99.99),
(126864, 134, '2026-08-03', 10, 2, 99.99),
(126865, 135, '2026-08-03', 15, 3, 99.98),
(127295, 136, '2026-08-03', 10, 2, 99.99),
(127405, 137, '2026-08-03', 10, 2, 99.99),
(127627, 138, '2026-08-03', 5, 1, 99.99),
(127962, 139, '2026-08-03', 20, 4, 99.98),
(128298, 140, '2026-08-03', 0, 0, 100.00),
(129316, 141, '2026-08-03', 10, 2, 99.99),
(129659, 142, '2026-08-03', 10, 2, 99.99),
(129889, 143, '2026-08-03', 10, 2, 99.99),
(131054, 144, '2026-08-03', 25, 5, 99.97),
(131523, 145, '2026-08-03', 5, 1, 99.99),
(134707, 148, '2026-08-03', 25, 5, 99.97),
(136496, 149, '2026-08-03', 20, 4, 99.98),
(136874, 150, '2026-08-03', 5, 1, 99.99),
(137480, 151, '2026-08-03', 0, 0, 100.00),
(137603, 152, '2026-08-03', 0, 0, 100.00),
(137727, 153, '2026-08-03', 10, 2, 99.99),
(138596, 154, '2026-08-03', 5, 1, 99.99),
(165451, 159, '2026-08-03', 0, 0, 100.00),
(166334, 160, '2026-08-03', 5, 1, 99.99),
(173574, 162, '2026-08-03', 5, 1, 99.99),
(174471, 163, '2026-08-03', 15, 3, 99.98),
(174988, 164, '2026-08-03', 5, 1, 99.99),
(179019, 165, '2026-08-03', 10, 2, 99.99),
(179282, 166, '2026-08-03', 5, 1, 99.99),
(180603, 167, '2026-08-03', 15, 3, 99.98),
(183397, 168, '2026-08-03', 10, 2, 99.99),
(184201, 169, '2026-08-03', 10, 2, 99.99),
(185013, 170, '2026-08-03', 0, 0, 100.00),
(185150, 171, '2026-08-03', 15, 3, 99.98),
(185562, 172, '2026-08-03', 5, 1, 99.99),
(187633, 173, '2026-08-03', 0, 0, 100.00),
(189719, 174, '2026-08-03', 5, 1, 99.99),
(190420, 175, '2026-08-03', 15, 3, 99.98),
(190985, 176, '2026-08-03', 10, 2, 99.99),
(191412, 177, '2026-08-03', 10, 2, 99.99),
(193558, 178, '2026-08-03', 5, 1, 99.99),
(193703, 179, '2026-08-03', 10, 2, 99.99),
(194284, 180, '2026-08-03', 10, 2, 99.99),
(194430, 181, '2026-08-03', 0, 0, 100.00),
(194873, 182, '2026-08-03', 5, 1, 99.99),
(195466, 183, '2026-08-03', 10, 2, 99.99),
(196063, 184, '2026-08-03', 5, 1, 99.99),
(196680, 185, '2026-08-03', 5, 1, 99.99),
(198040, 186, '2026-08-03', 0, 0, 100.00),
(200473, 187, '2026-08-03', 10, 2, 99.99),
(202157, 190, '2026-08-03', 5, 1, 99.99),
(202620, 191, '2026-08-03', 0, 0, 100.00),
(202931, 192, '2026-08-03', 0, 0, 100.00),
(203244, 193, '2026-08-03', 5, 1, 99.99),
(203402, 194, '2026-08-03', 0, 0, 100.00),
(204351, 195, '2026-08-03', 5, 1, 99.99),
(205147, 196, '2026-08-03', 0, 0, 100.00),
(205628, 197, '2026-08-03', 5, 1, 99.99),
(206595, 198, '2026-08-03', 5, 1, 99.99),
(207244, 199, '2026-08-03', 0, 0, 100.00),
(207571, 200, '2026-08-03', 10, 2, 99.99),
(208392, 201, '2026-08-03', 5, 1, 99.99),
(208558, 202, '2026-08-03', 0, 0, 100.00),
(208725, 203, '2026-08-03', 5, 1, 99.99),
(208893, 204, '2026-08-03', 0, 0, 100.00),
(209398, 205, '2026-08-03', 0, 0, 100.00),
(210075, 206, '2026-08-03', 1695, 2, 98.04),
(210586, 207, '2026-08-03', 5, 1, 99.99),
(210587, 208, '2026-08-03', 15, 3, 99.98),
(211792, 210, '2026-08-03', 10, 2, 99.99),
(212831, 211, '2026-08-03', 5, 1, 99.99),
(213354, 212, '2026-08-03', 10, 2, 99.99),
(214930, 213, '2026-08-03', 10, 2, 99.99),
(215283, 214, '2026-08-03', 0, 0, 100.00),
(216169, 215, '2026-08-03', 5, 1, 99.99),
(218128, 216, '2026-08-03', 10, 2, 99.99),
(219024, 217, '2026-08-03', 5, 1, 99.99),
(254695, 218, '2026-08-03', 0, 0, 100.00),
(346070, 226, '2026-08-03', 0, 0, 100.00);

-- --------------------------------------------------------

--
-- Table structure for table `devices`
--

CREATE TABLE `devices` (
  `id` int(11) NOT NULL,
  `ip_address` varchar(45) NOT NULL,
  `name` varchar(100) NOT NULL,
  `location` varchar(100) NOT NULL,
  `terminal` varchar(10) NOT NULL,
  `equipment_type` varchar(50) DEFAULT 'FIDS',
  `status` varchar(20) DEFAULT 'Online',
  `anomaly_type` varchar(50) DEFAULT NULL,
  `health_status_detail` varchar(50) DEFAULT NULL,
  `uptime_pct` decimal(5,2) DEFAULT 100.00,
  `downtime_count` int(11) DEFAULT 0,
  `failed_access_count` int(11) DEFAULT 0,
  `last_seen` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `devices`
--

INSERT INTO `devices` (`id`, `ip_address`, `name`, `location`, `terminal`, `equipment_type`, `status`, `anomaly_type`, `health_status_detail`, `uptime_pct`, `downtime_count`, `failed_access_count`, `last_seen`) VALUES
(1, '172.23.1.10', 'FIDS-T1-Checkin-01', 'Check-in Desk Row A', 'T1', 'FIDS', 'Online', NULL, NULL, 100.00, 0, 0, '2026-08-07 02:57:16'),
(2, '172.23.1.20', 'FIDS-T1-Gate-01A', 'Gate 1A Departure', 'T1', 'FIDS', 'Online', NULL, NULL, 99.80, 0, 0, '2026-08-07 02:57:16'),
(3, '172.23.1.30', 'FIDS-T2-Checkin-05', 'Check-in Desk 5', 'T2', 'FIDS', 'Offline', NULL, NULL, 94.20, 3, 12, '2026-08-07 02:57:16'),
(4, '172.23.1.60', 'FIDS-T2-Gate-02', 'Gate 2 Boarding Lounge', 'T2', 'FIDS', 'Online', NULL, NULL, 100.00, 0, 0, '2026-08-07 02:57:16'),
(5, '172.23.1.100', 'FIDS-T3-Checkin-01', 'International Check-in 1', 'T3', 'FIDS', 'Anomaly', 'Force Logout', NULL, 98.50, 1, 2, '2026-08-07 02:57:16'),
(6, '172.23.1.110', 'FIDS-T3-Gate-03', 'Gate 3 Boarding', 'T3', 'FIDS', 'Anomaly', 'Freeze Screen', NULL, 99.10, 1, 1, '2026-08-07 02:57:16'),
(7, '172.23.1.150', 'FIDS-T3-Baggage-02', 'Baggage Claim 2', 'T3', 'FIDS', 'Online', NULL, NULL, 100.00, 0, 0, '2026-08-07 02:57:16'),
(8, '172.23.1.200', 'FIDS-T3-Arrival-Main', 'Arrival Hall Center', 'T3', 'FIDS', 'Anomaly', 'High CPU/RAM', NULL, 97.40, 2, 4, '2026-08-07 02:57:16'),
(9, '172.24.0.10', 'PABX-Server-Core', 'Server Room 2nd Floor', 'T1', 'IP PABX', 'Online', NULL, NULL, 99.90, 0, 0, '2026-08-07 02:57:16'),
(10, '172.24.0.25', 'PABX-Gateway-T2', 'PABX Room T2', 'T2', 'IP PABX', 'Online', NULL, NULL, 99.70, 0, 0, '2026-08-07 02:57:16'),
(11, '192.168.1.10', 'CCTV-Storage-Svr01', 'Main Data Center', 'T3', 'Server CCTV', 'Online', NULL, NULL, 100.00, 0, 0, '2026-08-07 02:57:16'),
(12, '192.168.1.50', 'CCTV-NVR-Backup', 'NVR Room T3', 'T3', 'Server CCTV', 'Online', NULL, NULL, 99.50, 0, 0, '2026-08-07 02:57:16'),
(16, '192.168.30.15', 'FAS-Detector-Zone5', 'Waiting Lounge T2', 'T2', 'Fire Alarm System', 'Online', NULL, NULL, 99.80, 0, 0, '2026-08-07 02:57:16'),
(17, '192.168.30.30', 'FAS-Siren-Departure', 'Departure Hall Corridor', 'T1', 'Fire Alarm System', 'Online', NULL, NULL, 99.90, 0, 0, '2026-08-07 02:57:16'),
(18, '172.23.1.51', 'FIDS-Server-Core01', 'Main Server Room Rack 2', 'T2', 'Server FIDS', 'Online', NULL, NULL, 99.99, 0, 0, '2026-08-07 02:57:16'),
(19, '172.23.1.41', 'FIDS-Server-Core02', 'Main Server Room Rack 3', 'T2', 'Server FIDS', 'Online', NULL, NULL, 99.95, 0, 0, '2026-08-07 02:57:16'),
(20, '172.23.1.50', 'FIDS-Server-Backup01', 'Backup Server Room T3', 'T3', 'Server FIDS', 'Online', NULL, NULL, 99.98, 0, 0, '2026-08-07 02:57:16'),
(22, '192.168.0.124', 'CCTV-CHECKIN-01', 'Checkin Counter', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.95, 8, 9, '2026-08-03 13:10:14'),
(23, '172.23.1.67', 'INFO-DALAM-FIDS-01', 'Ruang Infromasi', 'T1', 'FIDS', 'Online', NULL, 'VNC', 94.17, 286, 289, '2026-08-03 13:10:12'),
(24, '172.23.1.70', 'INFO-DALAM-FIDS-02', 'Ruang Infromasi', 'T1', 'FIDS', 'Online', NULL, 'Ping & VNC', 99.98, 3, 3, '2026-08-03 13:10:12'),
(25, '172.23.1.62', 'Baggage Claim-01', 'Baggage Claim', 'T1', 'FIDS', 'Online', NULL, 'Ping', 99.89, 19, 19, '2026-08-03 13:10:12'),
(27, '172.24.0.92', 'IPPABX-REKONSILIASI', 'IPPABX', 'T1', 'IP PABX', 'Online', NULL, 'Ping', 99.97, 4, 4, '2026-08-03 09:55:23'),
(28, '172.24.0.90', 'IPPABX-BATIK', 'IPPABX', 'T1', 'IP PABX', 'Online', NULL, 'Ping', 99.97, 4, 4, '2026-08-03 09:55:23'),
(29, '192.168.30.1', 'SERVER-FIREALARM', 'RUANG 300', 'T1', 'Server Fire Alarm System', 'Online', NULL, 'Ping', 99.98, 4, 5, '2026-08-03 05:04:49'),
(30, '192.168.0.181', 'CCTV-LORONG-KEDATANGAN', 'CCTV Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.97, 5, 6, '2026-08-03 09:31:32'),
(31, '172.23.1.65', 'FIDS-ARRIVAL-LOBBY', 'Arrival depan roti O', 'T1', 'FIDS', 'Online', NULL, 'Ping & VNC', 99.85, 13, 13, '2026-08-03 12:29:48'),
(33, '172.23.1.63', 'FIDS-BC-02', 'Baggage Claim 02', 'T1', 'FIDS', 'Online', NULL, 'VNC', 99.98, 4, 4, '2026-08-03 11:45:17'),
(34, '172.23.1.64', 'Baggage Claim-03', 'Baggage Claim 03', 'T1', 'FIDS', 'Online', NULL, 'Ping & VNC', 99.99, 1, 1, '2026-08-03 04:20:25'),
(35, '192.168.1.212', 'RSM SUPERMICRO 2', 'RUANG 300', 'T1', 'Server CCTV', 'Online', NULL, 'Ping & VNC', 99.99, 1, 2, '2026-08-03 11:01:34'),
(36, '192.168.1.214', 'RSM SERVER DELL 1', 'RUANG 300', 'T1', 'Server CCTV', 'Online', NULL, 'Ping & VNC', 99.99, 1, 2, '2026-08-03 11:38:26'),
(37, '192.168.1.213', 'RSM SERVER DELL 2', 'RUANG 300', 'T1', 'Server CCTV', 'Online', NULL, 'Ping & VNC', 99.99, 1, 2, '2026-08-03 12:30:38'),
(38, '192.168.1.211', 'RSM SUPERMICRO 1', 'RUANG 300', 'T1', 'Server CCTV', 'Online', NULL, 'Ping & VNC', 99.99, 1, 2, '2026-08-03 12:36:59'),
(39, '192.168.1.219', 'RSM SUPERMICRO 3', 'RUANG 300', 'T1', 'Server CCTV', 'Online', NULL, 'Ping & VNC', 99.99, 1, 2, '2026-08-03 12:30:38'),
(40, '192.168.1.216', 'RSM SUPERMICRO 4', 'RUANG 300', 'T1', 'Server CCTV', 'Online', NULL, 'Ping & VNC', 99.99, 1, 2, '2026-08-03 12:36:59'),
(41, '192.168.1.217', 'THINKSERVER 01', 'RUANG 300', 'T1', 'Server CCTV', 'Online', NULL, 'Ping & VNC', 99.99, 1, 2, '2026-08-03 12:18:58'),
(42, '192.168.1.218', 'THINKSERVER 02', 'RUANG 300', 'T1', 'Server CCTV', 'Online', NULL, 'Ping & VNC', 99.99, 1, 2, '2026-08-03 11:02:14'),
(43, '192.168.0.6', 'Bea Cukai 01 (EYENOR)', 'Pertigaan Bea Cukai', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.96, 7, 9, '2026-08-03 08:02:00'),
(44, '192.168.0.7', 'Bea Cukai 02 (EYENOR)', 'Pertigaan Bea Cukai', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.98, 3, 4, '2026-08-03 12:31:10'),
(45, '192.168.0.8', 'Bea Cukai 03 (EYENOR)', 'Pertigaan Bea Cukai', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.98, 3, 4, '2026-08-03 04:58:29'),
(46, '192.168.0.47', 'Main Gate 01 (EYENOR)', 'Area Main Gate Mobil', 'T3', 'CCTV', 'Online', NULL, 'Ping', 97.64, 357, 381, '2026-08-03 12:37:01'),
(47, '192.168.0.48', 'Main Gate 02 (EYENOR)', 'Area Main Gate Mobil', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.98, 4, 5, '2026-08-03 07:10:27'),
(49, '192.168.0.49', 'Main Gate 03 (EYENOR)', 'Area Main Gate Mobil', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.98, 4, 6, '2026-08-03 12:27:50'),
(50, '192.168.0.20', 'Tangga Adkom (SONY)', 'Area Tangga Adkom', 'T2', 'CCTV', 'Online', NULL, 'Ping', 99.97, 5, 6, '2026-08-03 10:34:35'),
(51, '192.168.0.19', 'Tangga HTC (SONY)', 'Area Tangga HTC', 'T2', 'CCTV', 'Online', NULL, 'Ping', 99.95, 8, 9, '2026-08-03 11:29:38'),
(52, '192.168.0.150', 'Keberangkatan 01 (EYENOR)', 'Area Keberangkatan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.98, 4, 5, '2026-08-03 05:26:25'),
(53, '192.168.0.151', 'Keberangkatan 02 (EYENOR)', 'Area Keberangkatan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.95, 7, 8, '2026-08-03 12:06:19'),
(54, '192.168.0.152', 'Keberangkatan 03 (EYENOR)', 'Area Keberangkatan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.98, 4, 5, '2026-08-03 07:37:48'),
(55, '192.168.0.153', 'Informasi 01 (EYENOR)', 'Area Informasi', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.98, 4, 5, '2026-08-03 10:54:48'),
(56, '192.168.0.173', 'Informasi 02 (EYENOR)', 'Area Informasi ', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 2, '2026-08-03 04:20:29'),
(57, '192.168.0.154', 'Informasi 03 (EYENOR) ', 'Area Informasi', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 3, '2026-08-03 07:10:39'),
(58, '192.168.0.158', 'Kedatangan 01 (EYENOR)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.98, 4, 5, '2026-08-03 10:01:26'),
(59, '192.168.0.156', 'Kedatangan 02 (EYENOR)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.98, 3, 4, '2026-08-03 06:52:28'),
(60, '192.168.0.174', 'Kedatangan 03 (EYENOR)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.96, 7, 8, '2026-08-03 10:59:08'),
(61, '192.168.0.13', 'Masjid (SONY)', 'Area Masjid', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.97, 6, 7, '2026-08-03 11:11:49'),
(62, '192.168.0.14', 'Bedeng (SONY)', 'Area Bedeng', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.95, 8, 9, '2026-08-03 07:42:41'),
(63, '192.168.0.15', 'Parkir Motor (SONY)', 'Area Parkir ', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.95, 8, 9, '2026-08-03 11:04:29'),
(64, '192.168.0.16', 'Air Mancur (SONY)', 'Area Luar', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 3, '2026-08-03 05:09:53'),
(65, '192.168.0.17', 'Depan Teknik (HIKVISION)', 'Area Luar', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 2, '2026-08-03 04:20:30'),
(66, '192.168.0.58', 'Alfa 1 (SONY)', 'Area Apron', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.96, 6, 7, '2026-08-03 11:04:39'),
(67, '192.168.0.57', 'Alfa 2 (SONY)', 'Area Apron', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.97, 6, 7, '2026-08-03 11:46:20'),
(68, '192.168.0.55', 'Alfa 1 Sec.01 (NORDEN)', 'Area Apron', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.97, 6, 7, '2026-08-03 05:12:17'),
(69, '192.168.0.56', 'Alfa 2 Sec.01 (NORDEN)', 'Area Apron', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.94, 9, 10, '2026-08-03 11:38:40'),
(70, '192.168.0.27', 'Bravo 1 (SONY)', 'Area Apron', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.97, 5, 6, '2026-08-03 06:52:19'),
(71, '192.168.0.25', 'Bravo 4 (SONY)', 'Area Apron', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.98, 4, 5, '2026-08-03 06:52:19'),
(72, '192.168.0.157', 'SMP (SONY)', 'Area Apron', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.96, 7, 9, '2026-08-03 07:54:32'),
(73, '192.168.0.62', 'Bravo PK 7 (HIKVISION)', 'Area Apron ', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.97, 5, 7, '2026-08-03 08:07:52'),
(74, '192.168.0.4', 'Airside B7 01 (EYENOR)', 'Area Apron', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.98, 4, 5, '2026-08-03 12:16:22'),
(75, '192.168.0.66', 'Airside B7 02 (EYENOR)', 'Area Apron', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 4, '2026-08-03 07:35:00'),
(76, '192.168.0.2', 'Bravo 10 1 (EYENOR)', 'Area Apron', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.97, 6, 7, '2026-08-03 08:04:12'),
(77, '192.168.0.3', 'Bravo 10 2 (EYENOR)', 'Area Apron', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 4, '2026-08-03 05:54:19'),
(78, '192.168.0.63', 'Charlie 1 PTZ (HIKVISON)', 'Area Apron', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.96, 7, 8, '2026-08-03 06:51:18'),
(79, '192.168.0.64', 'Charlie 1 Sec 01 (EYENOR)', 'Area Apron', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.98, 3, 6, '2026-08-03 06:51:18'),
(80, '192.168.0.65', 'Charli 2 Sec 01 (EYENOR)', 'Area Apron', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.98, 3, 4, '2026-08-03 11:15:39'),
(81, '192.168.0.61', 'Alfa 0 (SONY)', 'Area Apron', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.98, 3, 4, '2026-08-03 09:56:26'),
(82, '192.168.0.170', 'Pertigaan Listrik Sec 01 (EYENOR)', 'Area Apron', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 2, '2026-08-03 05:40:49'),
(83, '192.168.0.171', 'Pertigaan ListrikSec 02 (EYENOR)', 'Area Apron', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.98, 3, 5, '2026-08-03 05:39:49'),
(84, '192.168.0.167', 'Isolated Area 01 (EYENOR)', 'Area Runway ', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.96, 7, 8, '2026-08-03 11:07:09'),
(86, '192.168.0.168', 'Isolated Area 02 (EYENOR)', 'Area Runway ', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.91, 14, 15, '2026-08-03 12:30:25'),
(87, '192.168.0.169', 'Runway 06 (EYENOR)', 'Area Runway ', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.92, 13, 14, '2026-08-03 10:52:00'),
(88, '192.168.0.176', 'Runway 24 (EYENOR)', 'Area Runway ', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.41, 10, 12, '2026-08-03 10:57:11'),
(89, '192.168.0.101', 'Perimeter 7 Sec 01 (NORDEN)', 'Area Runway ', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.96, 7, 8, '2026-08-03 05:11:19'),
(90, '192.168.0.5', 'Taxiway Alfa (NORDEN)', 'Area Runway', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.98, 3, 3, '2026-08-03 05:39:41'),
(91, '192.168.0.30', 'Parimeter 3 Sec.1 (NORDEN)', 'Area Runway', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.98, 4, 4, '2026-08-03 10:13:29'),
(92, '192.168.0.188', 'Runway 24 Sec.01 (UNIARCH)', 'Area Runway', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.93, 7, 7, '2026-08-03 07:53:54'),
(93, '192.168.0.189', 'Runway 24 Sec.2 (UNIARCH)', 'Area Runway ', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.90, 13, 13, '2026-08-03 10:59:11'),
(94, '192.168.0.190', 'Runway 24 Sec.3 (UNIARCH)', 'Area Runway', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.92, 9, 9, '2026-08-03 10:20:19'),
(95, '192.168.0.118', 'Parimeter 10 Sec.01 (UNIARCH)', 'Area Runway', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.94, 8, 8, '2026-08-03 11:38:22'),
(96, '192.168.0.117', 'Parimeter 10 Sec.02 (UNIARCH)', 'Area Runway', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.95, 4, 4, '2026-08-03 10:11:09'),
(97, '192.168.0.74', 'Conveyor kanan BHS (SONY)', 'Area BHS', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 07:28:02'),
(98, '192.168.0.71', 'Conveyor kiri BHS (SONY)', 'Area BHS', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 05:39:41'),
(99, '192.168.0.32', 'Parimeter2 (SONY)', 'Area Runway', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.98, 4, 4, '2026-08-03 11:36:12'),
(100, '192.168.0.33', 'Perimeter3 (SONY)', 'Area Perimeter', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.97, 6, 6, '2026-08-03 12:29:45'),
(101, '192.168.0.34', 'Perimeter4 (SONY)', 'Area Perimeter', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.98, 4, 4, '2026-08-03 12:01:43'),
(103, '192.168.0.73', 'In BHS kanan (SONY)', 'Area BHS', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 04:57:35'),
(104, '192.168.0.119', 'Perimeter5 (SONY)', 'Area Perimeter', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.94, 10, 10, '2026-08-03 10:00:28'),
(105, '192.168.0.36', 'Perimeter6 (SONY)', 'AreaPerimeter', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 2, '2026-08-03 07:27:32'),
(106, '192.168.0.77', 'Make up kanan  keberangkatan (SONY)', 'Area make up', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.98, 3, 3, '2026-08-03 07:38:43'),
(107, '192.168.0.68', 'make up kiri keberangkatan (SONY)', 'Area Apron', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.98, 3, 3, '2026-08-03 10:36:40'),
(108, '192.168.0.37', 'Perimeter7 (SONY)', 'Area Perimeter', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 2, '2026-08-03 12:16:54'),
(109, '192.168.0.75', 'Out BHS kanan (SONY)', 'Area BHS', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 05:00:12'),
(110, '192.168.0.39', 'Perimeter9 (SONY)', 'Area Perimeter', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.94, 8, 8, '2026-08-03 11:29:42'),
(111, '192.168.0.72', 'Out BHS kiri (SONY)', 'Area BHS', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.97, 5, 5, '2026-08-03 09:39:17'),
(112, '192.168.0.120', 'Perimeter10 (SONY)', 'Area Perimeter', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.95, 6, 6, '2026-08-03 07:53:24'),
(113, '192.168.0.26', 'cam make up tengah (SONY)', 'area make up', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.97, 6, 6, '2026-08-03 12:24:35'),
(114, '192.168.0.163', 'Lorong Makeup Sec.01 (EYENOR)', 'Area Apron', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.98, 3, 3, '2026-08-03 10:30:40'),
(115, '192.168.0.136', 'Kedatangan 1 (SONY)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.97, 6, 6, '2026-08-03 11:28:02'),
(116, '192.168.0.164', 'Lorong Makeup Sec.02 (EYENOR)', 'Area Apron', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.95, 8, 8, '2026-08-03 12:10:04'),
(118, '192.168.0.137', 'ATM Keberangkatan (SONY)', 'Area Keberangkatan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 10:56:33'),
(119, '192.168.0.128', 'Ruang Tunggu Citilink Gate 6 (SONY)', 'Area Launch Citilink', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 10:56:33'),
(120, '192.168.0.186', 'Gate 4 Citilink (SONY)', 'Area Launch Citilink', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.97, 5, 5, '2026-08-03 11:39:05'),
(121, '192.168.0.50', 'BL Citilink 01 (HIKVISION)', 'Area Launch Citilink', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 07:01:02'),
(122, '192.168.0.51', 'BL Citilink 02 (HIKVISION)', 'Area Launch Citilink', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 07:01:42'),
(123, '192.168.0.148', 'Kedatangan 2 (SONY)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 10:57:00'),
(124, '192.168.0.41', 'BL Citilink 03 (HIKVISION)', 'Area Launch Citilink', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 07:01:50'),
(125, '192.168.0.53', 'BL Citilink 04 (HIKVISION)', 'Area Launch Citilink', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 07:02:08'),
(126, '192.168.0.35', 'BL Citilink 05 (HIKVISION)', 'Area Launch Citilink', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 07:00:52'),
(127, '192.168.0.45', 'Batik Lorong (SONY)', 'Area Launch Batik', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 07:02:22'),
(128, '192.168.0.44', 'Batik Tengah 2 (SONY)', 'Area Launch Batik', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.98, 3, 3, '2026-08-03 07:40:15'),
(129, '192.168.0.144', 'Kedatangan 3 (SONY)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.98, 4, 4, '2026-08-03 11:16:14'),
(130, '192.168.0.90', 'Batik Mushola (SONY)', 'Area Launch Batik', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.97, 5, 5, '2026-08-03 12:22:17'),
(131, '192.168.0.91', 'Batik Pojok (SONY)', 'Area Launch Batik', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 07:03:05'),
(132, '192.168.0.135', 'Kedatangan 4 (SONY)', 'Area Kedatangan ', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.98, 3, 3, '2026-08-03 12:22:47'),
(133, '192.168.0.92', 'Batik Tengah (SONY)', 'Area Launch Batik', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 2, '2026-08-03 09:57:30'),
(134, '192.168.0.146', 'Kedatangan 5 (SONY)', 'Area Kedatangan ', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 2, '2026-08-03 10:10:01'),
(135, '192.168.0.42', 'Eskalator Naik In (SONY)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.98, 3, 3, '2026-08-03 12:23:57'),
(136, '192.168.0.132', 'Kedatangan 6 (EYENOR)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 2, '2026-08-03 07:29:35'),
(137, '192.168.0.43', 'Eskalator Naik On (EYENOR)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 2, '2026-08-03 12:33:37'),
(138, '192.168.0.133', 'Kedatangan 7  (SONY)', 'Area Kedatangan ', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 09:31:19'),
(139, '192.168.0.134', 'Kedatangan 8 (SONY)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.98, 4, 4, '2026-08-03 10:56:43'),
(140, '192.168.0.131', 'Kedatangan 9 (SONY)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 05:44:14'),
(141, '192.168.0.130', 'Kedatangan 10 (SONY)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 2, '2026-08-03 10:21:01'),
(142, '192.168.0.145', 'Kedatangan 11 (SONY)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 2, '2026-08-03 12:15:06'),
(143, '192.168.0.147', 'Kedatangan 12 (SONY)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 2, '2026-08-03 12:15:06'),
(144, '192.168.0.97', 'Eskalator Turun In (EYENOR)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.97, 5, 5, '2026-08-03 07:55:26'),
(145, '192.168.0.98', 'Eskalator Turun Out (EYENOR)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 12:15:06'),
(148, '192.168.0.143', 'Ruang Kedatangan (SONY)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.97, 5, 5, '2026-08-03 10:03:01'),
(149, '192.168.0.183', 'Baggage Claim Conveyor 1 (SONY)', 'Area Baggage Claim', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.98, 4, 4, '2026-08-03 11:48:45'),
(150, '192.168.0.182', 'Baggage Claim Conveyor 2 (SONY)', 'Area Baggage Claim', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 11:50:47'),
(151, '192.168.0.95', 'Ruangan Pintu LaUd (SONY)', 'Area LanUd', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 07:09:09'),
(152, '192.168.0.46', 'Batik Pojok 2 (HIKVISION)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 06:48:17'),
(153, '192.168.0.96', 'Ruagan EOC (HIKVISION)', 'Area Breakdown', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 2, '2026-08-03 12:14:49'),
(154, '192.168.0.172', 'Lorong VIP (EYENOR)', 'Area VIP', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 07:24:37'),
(159, '192.168.0.100', 'Pintu Laud sec 2 (HIKVISION)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 06:35:24'),
(160, '192.168.0.102', 'Perimeter 7 Sec.02 (HIKVISON)', 'Area Parimeter', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 06:53:10'),
(162, '192.168.0.40', 'Isolated Area Sec.03 (NORDEN)', 'Area Luar ', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 09:44:12'),
(163, '192.168.0.69', 'Koridor SCP2 (HIKVISON)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.98, 3, 3, '2026-08-03 11:54:38'),
(164, '192.168.0.18', 'Perimeter 2 Sec.01  (HIKVISON)', 'Area Parimeter', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 07:26:07'),
(165, '192.168.0.31', 'Perimeter 4 Sec.01  (HIKVISON)', 'Area Perimeter', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 2, '2026-08-03 10:59:55'),
(166, '192.168.0.161', 'Enggang Sec 01 (EYENOR)', 'Area Breakdown', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 07:32:57'),
(167, '192.168.0.165', 'Kanopi Kedatangan (EYENOR)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.98, 3, 3, '2026-08-03 10:57:25'),
(168, '192.168.0.103', 'Parkir 2 Sec.01 (HIKVISION)', 'Area Parkir', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 2, '2026-08-03 11:02:55'),
(169, '192.168.0.11', 'Parkir 2 Sec.02 (HIKVISION)', 'Area Parkir', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 2, '2026-08-03 11:02:55'),
(170, '192.168.0.166', 'Kedatangan Luar (EYENOR)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 07:07:35'),
(171, '192.168.0.104', 'Parkir 2 Sec.03 (HIKVISION)', 'Area Parkir', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.98, 3, 3, '2026-08-03 11:02:55'),
(172, '192.168.0.60', 'Enggang (SONY)', 'Area Breakdown', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 11:22:16'),
(173, '192.168.0.59', 'EOC (SONY)', 'Area Airside', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 07:03:46'),
(174, '192.168.0.29', 'Parkir 2 Sec.04 (HIKVISION)', 'Area Parkir', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 11:02:56'),
(175, '192.168.0.21', 'Parkir 3 Sec.01 (HIKVISION)', 'Area Parkir', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.98, 3, 3, '2026-08-03 12:21:49'),
(176, '192.168.0.22', 'Parkir 3 Sec.02 (HIKVISION)', 'Area Parkir', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 2, '2026-08-03 11:02:56'),
(177, '192.168.0.23', 'Parkir 4 Sec.01 (HIKVISION)', 'Area Parkir', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 2, '2026-08-03 11:05:16'),
(178, '192.168.0.38', 'Perimeter 4 Sec.02 (HIKVISION)', 'Area Perimeter', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 10:11:23'),
(179, '192.168.0.24', 'Parkir 4 Sec.02 (HIKVISION)', 'Area Parkir', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 2, '2026-08-03 11:02:56'),
(180, '192.168.0.28', 'Parkir 4 Sec.03 (HIKVISION)', 'Area Parkir', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 2, '2026-08-03 11:02:56'),
(181, '192.168.0.159', 'Eemergency Batik (HIKVISION)', 'Area Launch Batik', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 07:11:46'),
(182, '192.168.0.105', 'Parkir 4 Sec.04', 'Area Parkir', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 11:02:56'),
(183, '192.168.0.52', 'Cardig Sec.02 (HIKVISION)', 'Area Cardig', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 2, '2026-08-03 10:16:24'),
(184, '192.168.0.175', 'Cardig Sec.02 (HIKVISION)', 'Area Cardig', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 11:48:38'),
(185, '192.168.0.177', 'Cardig Sec.03 (HIKVISION)', 'Area Cardig', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 08:00:01'),
(186, '192.168.0.93', 'Pintu Laud Sec 01 (SONY)', 'Area LanUd', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 07:15:49'),
(187, '192.168.0.180', 'Conveyor Luar Kedatangan  kanan (SONY)', 'Area Terminal', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 2, '2026-08-03 11:42:39'),
(190, '192.168.0.81', 'Conveyor Luar Kedatangan  kiri (HIKVISION)', 'Area Terminal', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 11:19:38'),
(191, '192.168.0.140', 'Lobby Pintu Kedatangan 2 (SONY)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 07:20:49'),
(192, '192.168.0.82', 'SCP 1 in kiri (SONY)', 'aREA scp', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 07:21:09'),
(193, '192.168.0.141', 'Lobby Pintu Kedatangan 1 (SONY)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 09:32:44'),
(194, '192.168.0.83', 'SCP 1 in kanan (SONY)', 'Area SCP', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 07:21:39'),
(195, '192.168.0.121', 'Lobby Pintu Keberangkatan (SONY)', 'Area Keberangkatan', 'T3', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 11:07:38'),
(196, '192.168.0.139', 'Lobby Informasi (SONY)', 'Area Terminal', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 07:23:29'),
(197, '192.168.0.84', 'Bording cek SCP 2 (SONY)', 'Area SCP', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 07:45:50'),
(198, '192.168.0.138', 'Lobby Peduli Lindungi (SONY)', 'Area Terminal', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 10:32:26'),
(199, '192.168.0.142', 'ATM Kedatangan (SONY)', 'Area Kedatangan', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 07:25:39'),
(200, '192.168.0.85', 'SCP 1 Out Kanan (SONY)', 'Area SCO', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 2, '2026-08-03 10:56:07'),
(201, '192.168.0.99', 'SCP 2 Line E Out (HIKVISION)', 'Area SCP', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 11:09:48'),
(202, '192.168.0.123', 'SCP 1 Kanan (SONY)', 'Area ', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 07:26:59'),
(203, '192.168.0.122', 'SCP 1 Kiri(SONY)', 'Area SCP', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 12:16:11'),
(204, '192.168.0.89', 'SCP 2 Line E In (HIKVISION)', 'Area SCP', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 07:27:19'),
(205, '192.168.0.127', 'SCP 2 (SONY)', 'Area SCP', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 07:27:49'),
(206, '192.168.0.94', 'SCP 2 Out Kanan (SONY)', 'Area SCP', 'T1', 'CCTV', 'Online', NULL, 'Ping', 98.04, 2, 1, '2026-08-03 09:45:44'),
(207, '192.168.0.184', 'Terminal Check In (SONY)', 'Area Check In', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 09:31:14'),
(208, '192.168.0.88', 'SCP 2 Out Kiri (SONY)', 'Area SCP', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.98, 3, 3, '2026-08-03 12:29:22'),
(210, '192.168.0.125', 'Check In Citilink (SONY)', 'Area Citilink', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 2, '2026-08-03 10:39:57'),
(211, '192.168.0.79', 'Check In Counter batik 2 (HIKVISION)', 'Area Batik', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 09:40:44'),
(212, '192.168.0.126', 'PSC (SONY)', 'Area PSC', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 2, '2026-08-03 12:20:11'),
(213, '192.168.0.78', 'Pintu Karyawan (SONY)', 'Area Terminal', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 2, '2026-08-03 11:21:29'),
(214, '192.168.0.76', 'Ruang Rekonsilisasi (HIKVISION)', 'Area rekon', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 07:35:08'),
(215, '192.168.0.54', 'XRAY BEACUKAI (HIKVISION)', 'Area Beacukai', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 09:48:05'),
(216, '192.168.0.86', 'SCP 2 in Kanan (SONY)', 'Area SCP', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 2, 2, '2026-08-03 11:16:38'),
(217, '192.168.0.87', 'SCP 2 in kiri (SONY)', 'Area SCP', 'T1', 'CCTV', 'Online', NULL, 'Ping', 99.99, 1, 1, '2026-08-03 11:51:40'),
(218, '192.168.0.185', 'BHS 1', 'Ruang rekonsiliasi', 'T1', 'CCTV', 'Online', NULL, 'Ping', 100.00, 0, 0, '2026-08-03 09:30:46'),
(226, '172.23.1.49', 'Mini AAS', 'Ruang 300', 'T1', 'Server FIDS', 'Online', NULL, 'Ping & VNC', 100.00, 0, 0, '2026-08-03 10:54:58');

-- --------------------------------------------------------

--
-- Table structure for table `logs`
--

CREATE TABLE `logs` (
  `id` int(11) NOT NULL,
  `device_id` int(11) NOT NULL,
  `timestamp` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` varchar(20) NOT NULL,
  `message` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `logs`
--

INSERT INTO `logs` (`id`, `device_id`, `timestamp`, `status`, `message`) VALUES
(1, 1, '2026-08-07 02:57:16', 'Online', 'Device connected and responding to heartbeat.'),
(2, 2, '2026-08-07 02:57:16', 'Online', 'Device connected and responding to heartbeat.'),
(3, 3, '2026-08-07 02:57:16', 'Offline', 'Host Unreachable: Connection timeout/Ping failure.'),
(4, 4, '2026-08-07 02:57:16', 'Online', 'Device connected and responding to heartbeat.'),
(5, 5, '2026-08-07 02:57:16', 'Anomaly', 'App Session Signed Out: user session terminated unexpectedly.'),
(6, 6, '2026-08-07 02:57:16', 'Anomaly', 'Freeze Screen: Visual output static for > 5 minutes.'),
(7, 7, '2026-08-07 02:57:16', 'Online', 'Device connected and responding to heartbeat.'),
(8, 8, '2026-08-07 02:57:16', 'Anomaly', 'High CPU/RAM: Resource usage at 94% CPU.');

-- --------------------------------------------------------

--
-- Table structure for table `settings`
--

CREATE TABLE `settings` (
  `key` varchar(50) NOT NULL,
  `value` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `settings`
--

INSERT INTO `settings` (`key`, `value`) VALUES
('scheduler_batch_size', '30'),
('scheduler_ping_interval', '10000'),
('telegram_chat_id', '-1004424078230'),
('telegram_enabled', 'true'),
('telegram_token', '8907889508:AAG8mgD7H8Vj7pCbHbz7lVylAHcEWVT871k');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'user'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `password_hash`, `role`) VALUES
(1, 'admin', '713bfda78870bf9d1b261f565286f85e97ee614efe5f0faf7c34e7ca4f65baca', 'admin'),
(2, 'operator', '2dcfab3e99cd848aa80656c908063bb0c187e8663b23bbb8fdf94782e691e592', 'user');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `daily_uptime`
--
ALTER TABLE `daily_uptime`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_device_date` (`device_id`,`date`);

--
-- Indexes for table `devices`
--
ALTER TABLE `devices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ip_address` (`ip_address`);

--
-- Indexes for table `logs`
--
ALTER TABLE `logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `device_id` (`device_id`);

--
-- Indexes for table `settings`
--
ALTER TABLE `settings`
  ADD PRIMARY KEY (`key`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `daily_uptime`
--
ALTER TABLE `daily_uptime`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=457728;

--
-- AUTO_INCREMENT for table `devices`
--
ALTER TABLE `devices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=227;

--
-- AUTO_INCREMENT for table `logs`
--
ALTER TABLE `logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `daily_uptime`
--
ALTER TABLE `daily_uptime`
  ADD CONSTRAINT `daily_uptime_ibfk_1` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `logs`
--
ALTER TABLE `logs`
  ADD CONSTRAINT `logs_ibfk_1` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
