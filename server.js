
import express from 'express';
import mariadb from 'mariadb';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;
async function startServer() {
    app.use(cors());
    app.use(express.json({ limit: '50mb' }));

    // API routes FIRST
    // ... (all app.get/post/delete routes)

// Increased connection timeout and added basic error listener
const pool = mariadb.createPool({
     host: process.env.DB_HOST || '127.0.0.1', 
     user: process.env.DB_USER || 'root', 
     password: process.env.DB_PASSWORD || '',
     database: process.env.DB_NAME || 'gourmetta_haccp',
     connectionLimit: 10,
     acquireTimeout: 20000, // Increased to 20s
     connectTimeout: 10000
});

async function query(sql, params) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(sql, params);
        if (!rows) return [];
        return Array.isArray(rows) ? rows.map(row => {
            const processed = { ...row };
            for (let key in processed) {
                if (typeof processed[key] === 'bigint') processed[key] = processed[key].toString();
                if (processed[key] !== null && typeof processed[key] === 'string') {
                    const trimmed = processed[key].trim();
                    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
                        try { processed[key] = JSON.parse(trimmed); } catch (e) { }
                    }
                }
            }
            return processed;
        }) : rows;
    } catch (err) {
        if (err.code === 'ER_GET_CONNECTION_TIMEOUT') {
            console.error("❌ DATABASE CONNECTION TIMEOUT: Could not reach MariaDB server. Is it running?");
        } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error("❌ DATABASE ACCESS DENIED: Check your DB_USER and DB_PASSWORD in .env");
        } else {
            console.error("❌ Database Error:", err.message);
        }
        // Don't re-throw during initialization to prevent process crash
        return null;
    } finally {
        if (conn) conn.release();
    }
}

async function sendEmail(to, subject, text, html) {
  try {
      const smtpSettings = await query('SELECT * FROM settings_smtp WHERE id = "GLOBAL"');
      if (!smtpSettings || smtpSettings.length === 0 || !smtpSettings[0].host || !smtpSettings[0].user || !smtpSettings[0].pass) {
          console.warn('SMTP settings not configured. Skipping email notification.');
          return;
      }
      const { host, port, user, pass, from, secure } = smtpSettings[0];
      const transporter = nodemailer.createTransport({ host, port: parseInt(port), secure: !!secure, auth: { user, pass } });
      await transporter.sendMail({ from: from || user, to, subject, text, html });
      console.log('Email sent successfully to', to);
  } catch (error) {
      console.error('Failed to send email:', error);
  }
}

async function sendTelegramMessage(message) {
  try {
      const telegramSettings = await query('SELECT * FROM settings_telegram WHERE id = "GLOBAL"');
      if (!telegramSettings || telegramSettings.length === 0 || !telegramSettings[0].token || !telegramSettings[0].chatId) {
          console.warn('Telegram settings not configured. Skipping Telegram notification.');
          return;
      }
      const { token, chatId } = telegramSettings[0];
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }) });
      const data = await response.json();
      if (!data.ok) console.error('Failed to send Telegram message:', data.description);
      else console.log('Telegram message sent successfully to', chatId);
  } catch (error) {
      console.error('Failed to send Telegram message:', error);
  }
}

// Format for DATETIME columns: YYYY-MM-DD HH:mm:ss
const formatSqlDateTime = (isoString) => {
    if (!isoString) return null;
    return isoString.includes('T') ? isoString.slice(0, 19).replace('T', ' ') : isoString;
};

// Format for DATE columns: YYYY-MM-DD
const stripToDate = (isoString) => {
    if (!isoString) return null;
    return isoString.includes('T') ? isoString.split('T')[0] : isoString;
};

// --- ALARM DISPATCHERS ---

async function sendAlarmTelegram(reading) {
    try {
        const telRows = await query('SELECT * FROM settings_telegram WHERE id = "GLOBAL"');
        if (!telRows || telRows.length === 0 || !telRows[0].token || !telRows[0].chatId) return;
        const { token, chatId } = telRows[0];
        
        const usersToNotify = await query('SELECT telegramAlerts, facilityId, managedFacilityIds, allFacilitiesAlerts FROM users WHERE telegramAlerts = 1 OR telegramAlerts = true');
        if (!usersToNotify) return;

        const hasEligibleUser = usersToNotify.some(u => {
            if (u.allFacilitiesAlerts === 1 || u.allFacilitiesAlerts === true) return true;
            if (u.facilityId === reading.facilityId) return true;
            const managed = Array.isArray(u.managedFacilityIds) ? u.managedFacilityIds : [];
            return managed.includes(reading.facilityId);
        });

        const facilityRows = await query('SELECT name FROM facilities WHERE id = ?', [reading.facilityId]);
        const facilityName = facilityRows?.[0]?.name || 'Unbekannt';
        
        const message = `🚨 *HACCP ALARM*\n\n📍 *Standort:* ${facilityName}\n🧊 *Objekt:* ${reading.targetType === 'refrigerator' ? 'Kühlschrank' : 'Menü'}\n🌡️ *Messwert:* ${reading.value}°C\n📝 *Prüfpunkt:* ${reading.checkpointName}\n⚠️ *Grund:* ${reading.reason || 'Keine Angabe'}`;
        
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' })
        });
    } catch (err) {
        console.error("❌ Telegram Alarm Exception:", err.message);
    }
}

async function sendAlarmEmail(reading) {
    try {
        const smtpRows = await query('SELECT * FROM settings_smtp WHERE id = "GLOBAL"');
        if (!smtpRows || smtpRows.length === 0 || !smtpRows[0].host) return;
        
        const config = smtpRows[0];
        if (!config.user || !config.pass) return;

        const allUsers = await query('SELECT email, facilityId, managedFacilityIds, allFacilitiesAlerts FROM users WHERE (emailAlerts = 1 OR emailAlerts = true) AND email IS NOT NULL AND email != ""');
        if (!allUsers) return;

        const eligibleUsers = allUsers.filter(u => {
            const isGlobal = (u.allFacilitiesAlerts === 1 || u.allFacilitiesAlerts === true);
            const isHome = (u.facilityId === reading.facilityId);
            const managed = Array.isArray(u.managedFacilityIds) ? u.managedFacilityIds : [];
            const isManaged = managed.includes(reading.facilityId);
            return isGlobal || isHome || isManaged;
        });
        
        if (eligibleUsers.length === 0) return;

        const facilityRows = await query('SELECT name FROM facilities WHERE id = ?', [reading.facilityId]);
        const facilityName = facilityRows?.[0]?.name || 'Unbekannt';
        
        const transporter = nodemailer.createTransport({
            host: config.host,
            port: parseInt(config.port),
            secure: parseInt(config.port) === 465,
            auth: { user: config.user, pass: config.pass }
        });

        for (const user of eligibleUsers) {
            await transporter.sendMail({
                from: config.from_email || config.user,
                to: user.email,
                subject: `⚠️ HACCP ALARM: ${facilityName}`,
                html: `<div style="font-family: sans-serif; padding: 30px; border: 2px solid #e11d48; border-radius: 20px; max-width: 600px;"><h2 style="color: #e11d48; margin-top: 0;">Abweichung gemeldet</h2><p>Am Standort <strong>${facilityName}</strong> wurde eine kritische Temperatur gemessen.</p><div style="background: #fef2f2; padding: 20px; border-radius: 10px; margin: 20px 0;"><p style="margin: 5px 0;"><strong>Gegenstand:</strong> ${reading.targetType === 'refrigerator' ? 'Kühlgerät' : 'Menü'}</p><p style="margin: 5px 0;"><strong>Prüfpunkt:</strong> ${reading.checkpointName}</p><p style="margin: 15px 0; font-size: 28px; font-weight: bold; color: #e11d48;">Messwert: ${reading.value}°C</p><p style="margin: 5px 0;"><strong>Begründung:</strong> ${reading.reason || 'Keine Angabe'}</p></div></div>`
            });
        }
    } catch (err) {
        console.error("❌ Email Alarm Error:", err.message);
    }
}

// --- API ENDPOINTS ---

app.get('/api/documents', (req, res) => query('SELECT * FROM documents ORDER BY createdAt DESC').then(r => res.json(r || [])));
app.post('/api/documents', async (req, res) => {
    const { id, title, category, content } = req.body;
    try {
        await pool.query('INSERT INTO documents (id, title, category, content, createdAt) VALUES (?, ?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE title=VALUES(title), category=VALUES(category), content=VALUES(content)', [id, title, category || 'safety', content]);
        res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/documents/:id', (req, res) => query('DELETE FROM documents WHERE id = ?', [req.params.id]).then(() => res.sendStatus(200)));

app.get('/api/personnel', (req, res) => query('SELECT * FROM personnel').then(r => res.json(r || [])));
app.post('/api/personnel', async (req, res) => {
    const { id, firstName, lastName, facilityIds, requiredDocs, status, vaultPin, isSpringer, pinResetRequested } = req.body;
    try {
        await pool.query('INSERT INTO personnel (id, firstName, lastName, facilityIds, requiredDocs, status, vaultPin, isSpringer, pinResetRequested) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE firstName=VALUES(firstName), lastName=VALUES(lastName), facilityIds=VALUES(facilityIds), requiredDocs=VALUES(requiredDocs), status=VALUES(status), vaultPin=IFNULL(VALUES(vaultPin), vaultPin), isSpringer=VALUES(isSpringer), pinResetRequested=VALUES(pinResetRequested)', [id, firstName, lastName, JSON.stringify(facilityIds), JSON.stringify(requiredDocs), status || 'Active', vaultPin || null, !!isSpringer, !!pinResetRequested]);
        res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/personnel/:id/request-reset', async (req, res) => {
    try {
        await pool.query('UPDATE personnel SET pinResetRequested = TRUE WHERE id = ?', [req.params.id]);

        const personnel = (await query('SELECT firstName, lastName, facilityIds FROM personnel WHERE id = ?', [req.params.id]))[0];
        const facility = (await query('SELECT name FROM facilities WHERE id = ?', [personnel.facilityIds[0]]))[0];

        const subject = `Gourmetta: PIN Reset Anfrage von ${personnel.firstName} ${personnel.lastName} (${facility.name})`;
        const emailText = `Der Mitarbeiter ${personnel.firstName} ${personnel.lastName} von ${facility.name} hat einen PIN-Reset für den Dokumenten-Tresor angefordert. Bitte im Admin-Dashboard zurücksetzen.`;
        const telegramMessage = `🚨 *PIN Reset Anfrage*

*Mitarbeiter:* ${personnel.firstName} ${personnel.lastName}
*Standort:* ${facility.name}

Benötigt Unterstützung beim Zugriff auf den Dokumenten-Tresor. Bitte im Admin-Dashboard zurücksetzen.`;

        // In a real application, you would fetch admin/manager emails/chat IDs here
        // For now, we'll log and assume a global notification target.
        sendEmail('admin@gourmetta.de', subject, emailText); // Replace with actual admin email
        sendTelegramMessage(telegramMessage); // Replace with actual admin chat ID

        res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/personnel/:id/reset-pin', async (req, res) => {
    try {
        await pool.query('UPDATE personnel SET vaultPin = NULL, pinResetRequested = FALSE WHERE id = ?', [req.params.id]);
        res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/personnel/:id', (req, res) => query('DELETE FROM personnel WHERE id = ?', [req.params.id]).then(() => res.sendStatus(200)));

app.get('/api/personnel-docs', (req, res) => query('SELECT * FROM personnel_documents ORDER BY createdAt DESC').then(r => res.json(r || [])));
app.post('/api/personnel-docs', async (req, res) => {
    const { id, personnelId, type, content, mimeType, createdAt, visibleToUser } = req.body;
    try {
        await pool.query('INSERT INTO personnel_documents (id, personnelId, type, content, mimeType, createdAt, visibleToUser) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE visibleToUser=VALUES(visibleToUser), type=VALUES(type)', [id, personnelId, type, content, mimeType, formatSqlDateTime(createdAt), visibleToUser === undefined ? true : !!visibleToUser]);
        res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/personnel-docs/:id', (req, res) => query('DELETE FROM personnel_documents WHERE id = ?', [req.params.id]).then(() => res.sendStatus(200)));

app.get('/api/alerts', (req, res) => query('SELECT * FROM alerts WHERE resolved = 0').then(r => res.json(r || [])));
app.post('/api/alerts', async (req, res) => {
    const { id, facilityId, facilityName, targetName, checkpointName, value, min, max, timestamp, userId, userName, resolved } = req.body;
    try {
        await pool.query('INSERT INTO alerts (id, facilityId, facilityName, targetName, checkpointName, value, min, max, timestamp, userId, userName, resolved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE resolved=VALUES(resolved)', [id, facilityId, facilityName, targetName, checkpointName, value, min, max, formatSqlDateTime(timestamp), userId, userName, !!resolved]);
        res.sendStatus(200);
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.get('/api/settings/smtp', (req, res) => query('SELECT * FROM settings_smtp WHERE id = "GLOBAL"').then(r => res.json(r?.[0] || {})));
app.post('/api/settings/smtp', async (req, res) => {
    const { host, port, user, pass, from, secure } = req.body;
    try {
        await pool.query(`INSERT INTO settings_smtp (id, host, port, user, pass, from_email, secure) 
                         VALUES ('GLOBAL', ?, ?, ?, ?, ?, ?) 
                         ON DUPLICATE KEY UPDATE host=VALUES(host), port=VALUES(port), user=VALUES(user), pass=VALUES(pass), from_email=VALUES(from_email), secure=VALUES(secure)`,
        [host, parseInt(port), user, pass, from, !!secure]);
        res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/settings/telegram', (req, res) => query('SELECT * FROM settings_telegram WHERE id = "GLOBAL"').then(r => res.json(r?.[0] || {})));
app.post('/api/settings/telegram', async (req, res) => {
    const { token, chatId } = req.body;
    try {
        await pool.query(`INSERT INTO settings_telegram (id, token, chatId) VALUES ('GLOBAL', ?, ?) ON DUPLICATE KEY UPDATE token=VALUES(token), chatId=VALUES(chatId)`, [token, chatId]);
        res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/settings/legal', (req, res) => query('SELECT * FROM settings_legal WHERE id = "GLOBAL"').then(r => res.json(r?.[0] || {})));
app.post('/api/settings/legal', async (req, res) => {
    const { imprint, privacy } = req.body;
    try {
        await pool.query('INSERT INTO settings_legal (id, imprint, privacy) VALUES ("GLOBAL", ?, ?) ON DUPLICATE KEY UPDATE imprint=VALUES(imprint), privacy=VALUES(privacy)', [imprint, privacy]);
        res.sendStatus(200);
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.get('/api/settings/exceptions', (req, res) => query('SELECT * FROM facility_exceptions').then(r => res.json(r || [])));
app.post('/api/settings/exceptions', async (req, res) => {
    const { id, name, facilityIds, reason, startDate, endDate } = req.body;
    try {
        await pool.query('INSERT INTO facility_exceptions (id, name, facilityIds, reason, startDate, endDate) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), facilityIds=VALUES(facilityIds), reason=VALUES(reason), startDate=VALUES(startDate), endDate=VALUES(endDate)', [id, name, JSON.stringify(facilityIds), reason, stripToDate(startDate), stripToDate(endDate)]);
        res.sendStatus(200);
    } catch (e) { res.status(500).json({error: e.message}); }
});
app.delete('/api/settings/exceptions/:id', (req, res) => query('DELETE FROM facility_exceptions WHERE id = ?', [req.params.id]).then(() => res.sendStatus(200)));

app.post('/api/settings/holidays', async (req, res) => {
    const { id, name, startDate, endDate } = req.body;
    try {
        await pool.query('INSERT INTO settings_holidays (id, name, startDate, endDate) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), startDate=VALUES(startDate), endDate=VALUES(endDate)', [id, name, stripToDate(startDate), stripToDate(endDate)]);
        res.sendStatus(200);
    } catch (e) { res.status(500).json({error: e.message}); }
});
app.delete('/api/settings/holidays/:id', (req, res) => query('DELETE FROM settings_holidays WHERE id = ?', [req.params.id]).then(() => res.sendStatus(200)));

app.post('/api/settings/fridge-types', async (req, res) => {
    const { id, name, checkpoints } = req.body;
    try {
        await pool.query('INSERT INTO settings_fridge_types (id, name, checkpoints) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), checkpoints=VALUES(checkpoints)', [id, name, JSON.stringify(checkpoints)]);
        res.sendStatus(200);
    } catch (e) { res.status(500).json({error: e.message}); }
});
app.delete('/api/settings/fridge-types/:id', (req, res) => query('DELETE FROM settings_fridge_types WHERE id = ?', [req.params.id]).then(() => res.sendStatus(200)));

app.post('/api/settings/cooking-methods', async (req, res) => {
    const { id, name, checkpoints } = req.body;
    try {
        await pool.query('INSERT INTO settings_cooking_methods (id, name, checkpoints) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), checkpoints=VALUES(checkpoints)', [id, name, JSON.stringify(checkpoints)]);
        res.sendStatus(200);
    } catch (e) { res.status(500).json({error: e.message}); }
});
app.delete('/api/settings/cooking-methods/:id', (req, res) => query('DELETE FROM settings_cooking_methods WHERE id = ?', [req.params.id]).then(() => res.sendStatus(200)));

app.post('/api/settings/facility-types', async (req, res) => {
    const { id, name } = req.body;
    try {
        await pool.query('INSERT INTO settings_facility_types (id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)', [id, name]);
        res.sendStatus(200);
    } catch (e) { res.status(500).json({error: e.message}); }
});
app.delete('/api/settings/facility-types/:id', (req, res) => query('DELETE FROM settings_facility_types WHERE id = ?', [req.params.id]).then(() => res.sendStatus(200)));

app.get('/api/users', (req, res) => query('SELECT * FROM users').then(r => res.json(r || [])));
app.post('/api/users', async (req, res) => {
    const { id, name, username, password, email, role, status, facilityId, managedFacilityIds, emailAlerts, telegramAlerts, allFacilitiesAlerts } = req.body;
    try {
        await pool.query(`INSERT INTO users (id, name, username, password, email, role, status, facilityId, managedFacilityIds, emailAlerts, telegramAlerts, allFacilitiesAlerts) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                     ON DUPLICATE KEY UPDATE name=VALUES(name), password=VALUES(password), email=VALUES(email), status=VALUES(status), facilityId=VALUES(facilityId), 
                     managedFacilityIds=VALUES(managedFacilityIds), emailAlerts=VALUES(emailAlerts), telegramAlerts=VALUES(telegramAlerts), allFacilitiesAlerts=VALUES(allFacilitiesAlerts)`, 
        [id, name, username, password, email, role, status, facilityId, JSON.stringify(managedFacilityIds || []), !!emailAlerts, !!telegramAlerts, !!allFacilitiesAlerts]);
        res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/facilities', (req, res) => query('SELECT * FROM facilities').then(r => res.json(r || [])));
app.post('/api/facilities', async (req, res) => {
    const { id, name, typeId, cookingMethodId, supervisorId } = req.body;
    try {
        await pool.query('INSERT INTO facilities (id, name, typeId, cookingMethodId, supervisorId) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), typeId=VALUES(typeId), cookingMethodId=VALUES(cookingMethodId), supervisorId=VALUES(supervisorId)', [id, name, typeId, cookingMethodId, supervisorId]);
        res.sendStatus(200);
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.get('/api/refrigerators', (req, res) => query('SELECT * FROM refrigerators').then(r => res.json(r || [])));
app.post('/api/refrigerators', async (req, res) => {
    const { id, name, facilityId, typeName, currentTemp, status } = req.body;
    try {
        await pool.query('INSERT INTO refrigerators (id, name, facilityId, typeName, currentTemp, status) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), typeName=VALUES(typeName), facilityId=VALUES(facilityId)', [id, name, facilityId, typeName, currentTemp || 4.0, status || 'Optimal']);
        res.sendStatus(200);
    } catch (e) { res.status(500).json({error: e.message}); }
});
app.delete('/api/refrigerators/:id', (req, res) => query('DELETE FROM refrigerators WHERE id = ?', [req.params.id]).then(() => res.sendStatus(200)));

app.get('/api/menus', (req, res) => query('SELECT * FROM menus').then(r => res.json(r || [])));
app.post('/api/menus', async (req, res) => {
    const { id, name } = req.body;
    try {
        await pool.query('INSERT INTO menus (id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)', [id, name]);
        res.sendStatus(200);
    } catch (e) { res.status(500).json({error: e.message}); }
});
app.delete('/api/menus/:id', (req, res) => query('DELETE FROM menus WHERE id = ?', [req.params.id]).then(() => res.sendStatus(200)));

app.get('/api/readings', (req, res) => query('SELECT * FROM readings ORDER BY timestamp DESC LIMIT 2000').then(r => res.json(r || [])));
app.post('/api/readings', async (req, res) => {
    const reading = req.body;
    const { id, targetId, targetType, checkpointName, value, timestamp, userId, facilityId, reason } = reading;
    try {
        await pool.query('INSERT INTO readings (id, targetId, targetType, checkpointName, value, timestamp, userId, facilityId, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE value=VALUES(value), reason=VALUES(reason)', 
        [id, targetId, targetType, checkpointName, value, formatSqlDateTime(timestamp), userId, facilityId, reason]);
        
        if (reason && reason.trim().length > 0) {
            sendAlarmEmail(reading).catch(e => console.error("Email dispatcher error:", e));
            sendAlarmTelegram(reading).catch(e => console.error("Telegram dispatcher error:", e));
        }
        res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/form-responses', (req, res) => query('SELECT * FROM form_responses ORDER BY timestamp DESC').then(r => res.json(r || [])));
app.post('/api/form-responses', async (req, res) => {
    const { id, formId, facilityId, userId, timestamp, answers, signature } = req.body;
    try {
        await pool.query('INSERT INTO form_responses (id, formId, facilityId, userId, timestamp, answers, signature) VALUES (?, ?, ?, ?, ?, ?, ?)', 
        [id, formId, facilityId, userId, formatSqlDateTime(timestamp), JSON.stringify(answers), signature]);
        
        // Global stats
        await pool.query('UPDATE environmental_impact SET pagesSaved = pagesSaved + 1, tonerSaved = tonerSaved + 0.005 WHERE id = "GLOBAL"');
        
        // Facility specific stats
        if (facilityId) {
            await pool.query('INSERT INTO environmental_impact (id, pagesSaved, tonerSaved) VALUES (?, 1, 0.005) ON DUPLICATE KEY UPDATE pagesSaved = pagesSaved + 1, tonerSaved = tonerSaved + 0.005', [facilityId]);
        }
        
        res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/form-templates', (req, res) => query('SELECT * FROM form_templates').then(r => res.json(r || [])));
app.post('/api/form-templates', async (req, res) => {
    const { id, title, description, questions, requiresSignature, createdAt } = req.body;
    try {
        await pool.query('INSERT INTO form_templates (id, title, description, questions, requiresSignature, createdAt) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title), questions=VALUES(questions), requiresSignature=VALUES(requiresSignature)', [id, title, description, JSON.stringify(questions), !!requiresSignature, stripToDate(createdAt)]);
        res.sendStatus(200);
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.get('/api/assignments', (req, res) => query('SELECT * FROM assignments').then(r => res.json(r || [])));
app.post('/api/assignments', async (req, res) => {
    const { id, targetType, targetId, resourceType, resourceId, frequency, frequencyDay, startDate, endDate, skipWeekend, skipHolidays } = req.body;
    try {
        await pool.query('INSERT INTO assignments (id, targetType, targetId, resourceType, resourceId, frequency, frequencyDay, startDate, endDate, skipWeekend, skipHolidays) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE frequency=VALUES(frequency), frequencyDay=VALUES(frequencyDay), endDate=VALUES(endDate)', [id, targetType, targetId, resourceType, resourceId, frequency, frequencyDay, stripToDate(startDate), stripToDate(endDate), !!skipWeekend, !!skipHolidays]);
        res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reminders', (req, res) => query('SELECT * FROM reminders').then(r => res.json(r || [])));
app.post('/api/reminders', async (req, res) => {
    const { id, time, label, active, days, targetRoles } = req.body;
    try {
        await pool.query('INSERT INTO reminders (id, time, label, active, days, targetRoles) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE time=VALUES(time), label=VALUES(label), active=VALUES(active), days=VALUES(days), targetRoles=VALUES(targetRoles)', [id, time, label, !!active, JSON.stringify(days), JSON.stringify(targetRoles)]);
        res.sendStatus(200);
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.get('/api/audit-logs', (req, res) => query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 1000').then(r => res.json(r || [])));
app.post('/api/audit-logs', async (req, res) => {
    const { id, userId, userName, action, entity, details } = req.body;
    try {
        const safeId = id || `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        await pool.query('INSERT IGNORE INTO audit_logs (id, userId, userName, action, entity, details) VALUES (?, ?, ?, ?, ?, ?)', [safeId, userId, userName, action, entity, details]);
        res.sendStatus(200);
    } catch (err) {
        console.error("Audit log error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/settings/holidays', (req, res) => query('SELECT * FROM settings_holidays').then(r => res.json(r || [])));
app.get('/api/settings/fridge-types', (req, res) => query('SELECT * FROM settings_fridge_types').then(r => res.json(r || [])));
app.get('/api/settings/cooking-methods', (req, res) => query('SELECT * FROM settings_cooking_methods').then(r => res.json(r || [])));
app.get('/api/settings/facility-types', (req, res) => query('SELECT * FROM settings_facility_types').then(r => res.json(r || [])));
app.get('/api/impact-stats/:facilityId', (req, res) => {
    const { facilityId } = req.params;
    query('SELECT * FROM environmental_impact WHERE id = ?', [facilityId])
        .then(r => res.json(r?.[0] || { pagesSaved: 0, tonerSaved: 0 }))
        .catch(err => res.status(500).json({ error: err.message }));
});

app.get('/api/impact-stats', (req, res) => query('SELECT * FROM environmental_impact WHERE id = "GLOBAL"').then(r => res.json(r?.[0] || {pagesSaved:0, tonerSaved:0})));

app.post('/api/test-email', async (req, res) => {
    const { host, port, user, pass, from, secure, testRecipient } = req.body;
    try {
        const isSecure = secure !== undefined ? !!secure : parseInt(port) === 465;
        const transporter = nodemailer.createTransport({ 
            host, 
            port: parseInt(port), 
            secure: isSecure, 
            auth: { user, pass } 
        });
        await transporter.sendMail({ 
            from: from || user, 
            to: testRecipient || user, 
            subject: 'Gourmetta System-Test', 
            text: 'Die SMTP-Konfiguration ist korrekt.' 
        });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/test-telegram', async (req, res) => {
    const { token, chatId } = req.body;
    try {
        const message = "🧪 *Gourmetta System-Test*\nTelegram Verbindung OK.";
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }) });
        const data = await response.json();
        res.json({ success: data.ok, error: data.description });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

    // Vite middleware for development
    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        app.use(express.static('dist'));
        app.get('*', (req, res) => res.sendFile('dist/index.html', { root: '.' }));
    }

    app.listen(PORT, async () => {
        console.log(`🚀 HACCP Server fully operational on port ${PORT}`);
        console.log(`📡 Connecting to MariaDB at ${process.env.DB_HOST || '127.0.0.1'}...`);
        try {
            // Run sanity check on DB connection during startup
            const testConn = await pool.getConnection();
            console.log("✅ MariaDB Connection Verified!");
            
            await testConn.query(`INSERT IGNORE INTO settings_smtp (id, host, port, secure) VALUES ('GLOBAL', 'smtp.strato.de', 465, 1)`);
            await testConn.query(`INSERT IGNORE INTO settings_telegram (id, token, chatId) VALUES ('GLOBAL', '', '')`);
            
            // Detailed German GDPR Policy for internal enterprise use
            const privacyText = `DATENSCHUTZERKLÄRUNG (DSGVO)\n\n1. Verantwortlicher\nVerantwortlich für die Datenverarbeitung in dieser Anwendung ist die Gourmetta GmbH (Anschrift siehe Impressum).\n\n2. Zweck und Rechtsgrundlage der Verarbeitung\na) Erfüllung gesetzlicher Dokumentationspflichten (HACCP): Wir verarbeiten Ihre Messdaten zur Einhaltung lebensmittelrechtlicher Vorschriften gemäß Art. 6 Abs. 1 lit. c DSGVO.\nb) Personalverwaltung: Die Verarbeitung von Personaldaten erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Arbeitsverhältnis).\nc) Gesundheitsdaten: Die Verarbeitung von Gesundheitszeugnissen erfolgt gemäß Art. 9 Abs. 2 lit. b DSGVO i.V.m. dem Infektionsschutzgesetz.\n\n3. Speicherdauer\nDaten werden gemäß den gesetzlichen Aufbewahrungsfristen (i.d.R. 2 Jahre für HACCP-Logs) gespeichert.`;
            const imprintText = `Gourmetta GmbH\nHauptstraße 1\n01234 Beispielstadt\n\nGeschäftsführung: Max Mustermann`;

            await testConn.query(`INSERT IGNORE INTO settings_legal (id, imprint, privacy) VALUES ("GLOBAL", ?, ?) ON DUPLICATE KEY UPDATE privacy=VALUES(privacy)`, [imprintText, privacyText]);
            
            await testConn.query(`INSERT IGNORE INTO environmental_impact (id, pagesSaved, tonerSaved) VALUES ('GLOBAL', 0, 0.0)`);
            testConn.release();
        } catch (e) { 
            console.error("⚠️ SYSTEM WARNING: Database initialization failed.");
            console.error("Please verify MariaDB is running and .env credentials are correct.");
            console.error("Technical detail:", e.message);
        }
    });
}

startServer();
