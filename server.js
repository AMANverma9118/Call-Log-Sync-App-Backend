require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- IMPORTANT CHANGE ---
// Increase the payload size limit for JSON and URL-encoded bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
// --------------------

app.use(cors());

// --- Database Connection ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Successfully connected to MongoDB.'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Mongoose Schema and Model ---
const callLogSchema = new mongoose.Schema({
    dateTime: { type: String, required: true },
    duration: { type: Number, required: true },
    name: { type: String, default: 'Unknown' },
    phoneNumber: { type: String, required: true },
    type: { type: String, required: true }
});

const CallLog = mongoose.model('CallLog', callLogSchema);

// --- API Routes ---

// GET: Fetch all saved call logs
app.get('/api/logs', async (req, res) => {
    try {
        const logs = await CallLog.find().sort({ dateTime: -1 });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching logs', error: error.message });
    }
});

// POST: Receive new call logs from the mobile app
app.post('/api/logs', async (req, res) => {
    const logs = req.body;
    if (!Array.isArray(logs)) {
        return res.status(400).json({ message: 'Invalid data format. Expected an array of logs.' });
    }

    try {
        // Use a set to prevent duplicate entries based on phone number and date/time
        const existingLogs = await CallLog.find({
            $or: logs.map(log => ({ phoneNumber: log.phoneNumber, dateTime: log.dateTime }))
        });

        const existingLogSet = new Set(existingLogs.map(log => `${log.phoneNumber}|${log.dateTime}`));
        
        const newLogs = logs.filter(log => !existingLogSet.has(`${log.phoneNumber}|${log.dateTime}`));

        if (newLogs.length > 0) {
            await CallLog.insertMany(newLogs);
            console.log(`Received ${logs.length} logs. Inserted ${newLogs.length} new logs.`);
            res.status(201).json({ message: `${newLogs.length} new logs saved successfully.` });
        } else {
            console.log(`Received ${logs.length} logs. No new logs to insert.`);
            res.status(200).json({ message: 'No new logs to save.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error saving logs', error: error.message });
    }
});

// Serve the frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

