
CREATE DATABASE IF NOT EXISTS gourmetta_haccp;
USE gourmetta_haccp;

-- Table for user management
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    role ENUM('Admin', 'User', 'Manager', 'SuperAdmin') DEFAULT 'User',
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    facilityId VARCHAR(50),
    managedFacilityIds JSON,
    emailAlerts BOOLEAN DEFAULT FALSE,
    telegramAlerts BOOLEAN DEFAULT FALSE,
    allFacilitiesAlerts BOOLEAN DEFAULT FALSE
);

-- Table for personnel management
CREATE TABLE IF NOT EXISTS personnel (
    id VARCHAR(50) PRIMARY KEY,
    firstName VARCHAR(100) NOT NULL,
    lastName VARCHAR(100) NOT NULL,
    facilityIds JSON,
    requiredDocs JSON,
    status ENUM('Active', 'Inactive') DEFAULT 'Active'
);

-- Table for personnel compliance documents
CREATE TABLE IF NOT EXISTS personnel_documents (
    id VARCHAR(50) PRIMARY KEY,
    personnelId VARCHAR(50) NOT NULL,
    type VARCHAR(100) NOT NULL,
    content LONGTEXT NOT NULL,
    mimeType VARCHAR(100) NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    visibleToUser BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (personnelId) REFERENCES personnel(id) ON DELETE CASCADE
);

-- Table for documents (PDFs)
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) DEFAULT 'safety',
    content LONGTEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table for facilities
CREATE TABLE IF NOT EXISTS facilities (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    refrigeratorCount INT DEFAULT 0,
    typeId VARCHAR(50),
    cookingMethodId VARCHAR(50),
    supervisorId VARCHAR(50),
    FOREIGN KEY (supervisorId) REFERENCES users(id) ON DELETE SET NULL
);

-- Table for refrigerators
CREATE TABLE IF NOT EXISTS refrigerators (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    facilityId VARCHAR(50) NOT NULL,
    currentTemp DECIMAL(5,2) DEFAULT 4.0,
    status VARCHAR(50) DEFAULT 'Optimal',
    typeName VARCHAR(100),
    FOREIGN KEY (facilityId) REFERENCES facilities(id) ON DELETE CASCADE
);

-- Table for menus
CREATE TABLE IF NOT EXISTS menus (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- Table for assignments
CREATE TABLE IF NOT EXISTS assignments (
    id VARCHAR(50) PRIMARY KEY,
    targetType VARCHAR(50) NOT NULL,
    targetId VARCHAR(50) NOT NULL,
    resourceType VARCHAR(50) NOT NULL,
    resourceId VARCHAR(50) NOT NULL,
    frequency VARCHAR(50) NOT NULL,
    frequencyDay INT,
    startDate DATE NOT NULL,
    endDate DATE NOT NULL,
    skipWeekend BOOLEAN DEFAULT TRUE,
    skipHolidays BOOLEAN DEFAULT TRUE
);

-- Table for form templates
CREATE TABLE IF NOT EXISTS form_templates (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    questions JSON,
    requiresSignature BOOLEAN DEFAULT TRUE,
    createdAt DATE
);

-- Table for readings
CREATE TABLE IF NOT EXISTS readings (
    id VARCHAR(50) PRIMARY KEY,
    targetId VARCHAR(50) NOT NULL,
    targetType VARCHAR(50) NOT NULL,
    checkpointName VARCHAR(100) NOT NULL,
    value DECIMAL(5,2) NOT NULL,
    timestamp DATETIME NOT NULL,
    userId VARCHAR(50),
    facilityId VARCHAR(50),
    reason TEXT,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (facilityId) REFERENCES facilities(id) ON DELETE CASCADE
);

-- Table for form responses
CREATE TABLE IF NOT EXISTS form_responses (
    id VARCHAR(50) PRIMARY KEY,
    formId VARCHAR(50) NOT NULL,
    facilityId VARCHAR(50),
    userId VARCHAR(50),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    answers JSON,
    signature LONGTEXT,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (facilityId) REFERENCES facilities(id) ON DELETE CASCADE
);

-- Table for persistent Go Green statistics
CREATE TABLE IF NOT EXISTS environmental_impact (
    id VARCHAR(50) PRIMARY KEY,
    pagesSaved INT DEFAULT 0,
    tonerSaved DECIMAL(10,5) DEFAULT 0.0,
    lastUpdate DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table for reminders
CREATE TABLE IF NOT EXISTS reminders (
    id VARCHAR(50) PRIMARY KEY,
    time VARCHAR(10) NOT NULL,
    label VARCHAR(255) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    days JSON,
    targetRoles JSON
);

-- Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
    id VARCHAR(50) PRIMARY KEY,
    facilityId VARCHAR(50),
    facilityName VARCHAR(255),
    targetName VARCHAR(255),
    checkpointName VARCHAR(255),
    value DECIMAL(5,2),
    min DECIMAL(5,2),
    max DECIMAL(5,2),
    timestamp DATETIME,
    userId VARCHAR(50),
    userName VARCHAR(100),
    resolved BOOLEAN DEFAULT FALSE
);

-- Site Exceptions
CREATE TABLE IF NOT EXISTS facility_exceptions (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255),
    facilityIds JSON,
    reason TEXT,
    startDate DATE,
    endDate DATE
);

-- Settings tables
CREATE TABLE IF NOT EXISTS settings_smtp (
    id VARCHAR(10) PRIMARY KEY DEFAULT 'GLOBAL',
    host VARCHAR(255),
    port INT,
    user VARCHAR(255),
    pass VARCHAR(255),
    from_email VARCHAR(255),
    secure BOOLEAN
);

CREATE TABLE IF NOT EXISTS settings_telegram (
    id VARCHAR(10) PRIMARY KEY DEFAULT 'GLOBAL',
    token VARCHAR(255),
    chatId VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS settings_legal (
    id VARCHAR(10) PRIMARY KEY DEFAULT 'GLOBAL',
    imprint LONGTEXT,
    privacy LONGTEXT
);

CREATE TABLE IF NOT EXISTS settings_holidays (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    startDate DATE NOT NULL,
    endDate DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS settings_fridge_types (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    checkpoints JSON
);

CREATE TABLE IF NOT EXISTS settings_cooking_methods (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    checkpoints JSON
);

CREATE TABLE IF NOT EXISTS settings_facility_types (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- Table for audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    userId VARCHAR(50),
    userName VARCHAR(100),
    action VARCHAR(50),
    entity VARCHAR(50),
    details TEXT
);

-- Initial SuperAdmin
INSERT IGNORE INTO users (id, name, username, password, role, status, email, emailAlerts, allFacilitiesAlerts) 
VALUES ('U-SUPER', 'System SuperAdmin', 'super', 'super', 'SuperAdmin', 'Active', 'alarm@gourmetta.de', 1, 1);

-- Initialize Global Settings
INSERT IGNORE INTO environmental_impact (id, pagesSaved, tonerSaved) VALUES ('GLOBAL', 0, 0.0);
INSERT IGNORE INTO settings_smtp (id, host, port, user, pass, secure) VALUES ('GLOBAL', 'smtp.strato.de', 465, '', '', 1);
INSERT IGNORE INTO settings_telegram (id, token, chatId) VALUES ('GLOBAL', '', '');
INSERT IGNORE INTO settings_legal (id, imprint, privacy) VALUES ('GLOBAL', 'Gourmetta GmbH', 'Datenschutzrichtlinie');
