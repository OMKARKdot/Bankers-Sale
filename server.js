require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Vonage } = require('@vonage/server-sdk');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Vonage setup
const vonageConfigured = process.env.VONAGE_API_KEY
    && process.env.VONAGE_API_SECRET
    && process.env.VONAGE_API_KEY !== 'your_api_key';

let vonage = null;
if (vonageConfigured) {
    vonage = new Vonage({
        apiKey: process.env.VONAGE_API_KEY,
        apiSecret: process.env.VONAGE_API_SECRET
    });
}

// In-memory store for Vonage request IDs
const verifyStore = {};
// Fallback OTP store (when Vonage is unavailable)
const otpStore = {};

// ========== SEND OTP (Vonage Verify API) ==========
app.post('/api/send-otp', async (req, res) => {
    try {
        const { identifier } = req.body;
        if (!identifier) {
            return res.status(400).json({ success: false, message: 'Phone number or email is required.' });
        }

        // Clean phone number for Vonage: needs format like 919876543210
        let phoneNumber = identifier.replace(/[\s\-\(\)\+]/g, '');
        if (phoneNumber.length === 10) phoneNumber = '91' + phoneNumber;

        if (vonageConfigured && vonage) {
            console.log(`[VONAGE] Attempting to send OTP to ${phoneNumber}`);
            try {
                // Use Vonage Verify API — handles DLT, sender ID, retries automatically
                const result = await vonage.verify.start({
                    number: phoneNumber,
                    brand: 'Bankers Sale',
                    code_length: 6,
                    pin_expiry: 300,
                    next_event_wait: 60
                });

                console.log(`[VONAGE] Response:`, JSON.stringify(result));

                if (result.status === '0') {
                    verifyStore[identifier] = result.request_id;
                    console.log(`[VONAGE] ✅ OTP sent successfully to ${phoneNumber} | RequestID: ${result.request_id}`);
                    res.json({ success: true, message: 'OTP sent to your mobile number!' });
                } else {
                    console.error(`[VONAGE ERROR] Status ${result.status}: ${result.error_text || 'Unknown error'}`);
                    // Fallback to console OTP
                    const otp = String(Math.floor(100000 + Math.random() * 900000));
                    otpStore[identifier] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 };
                    console.log(`[FALLBACK] OTP for ${identifier}: ${otp}`);
                    res.json({ success: true, message: 'OTP generated. Check server console.', fallback: true });
                }
            } catch (vonageError) {
                console.error(`[VONAGE EXCEPTION] Error sending OTP:`, vonageError.message || vonageError);
                // Fallback to console OTP
                const otp = String(Math.floor(100000 + Math.random() * 900000));
                otpStore[identifier] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 };
                console.log(`[FALLBACK] OTP for ${identifier}: ${otp}`);
                res.json({ success: true, message: 'OTP generated. Check server console.', fallback: true });
            }
        } else {
            // No Vonage — fallback
            const otp = String(Math.floor(100000 + Math.random() * 900000));
            otpStore[identifier] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 };
            console.log(`[FALLBACK] OTP for ${identifier}: ${otp}`);
            res.json({ success: true, message: 'OTP generated. Check server console.', fallback: true });
        }

    } catch (error) {
        console.error('[ERROR]', error.message || error);
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        otpStore[req.body.identifier] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 };
        console.log(`[FALLBACK] OTP for ${req.body.identifier}: ${otp}`);
        res.json({ success: true, message: 'OTP generated. Check server console.', fallback: true });
    }
});

// ========== VERIFY OTP ==========
app.post('/api/verify-otp', async (req, res) => {
    try {
        const { identifier, otp } = req.body;
        if (!identifier || !otp) {
            return res.status(400).json({ success: false, message: 'Identifier and OTP required.' });
        }

        // Check if we have a Vonage Verify request for this user
        const requestId = verifyStore[identifier];
        if (requestId && vonageConfigured && vonage) {
            const result = await vonage.verify.check(requestId, otp);

            if (result.status === '0') {
                delete verifyStore[identifier];
                console.log(`[OK] Vonage OTP verified for ${identifier}`);
                return res.json({ success: true, message: 'Verified!' });
            } else {
                console.log(`[FAIL] Vonage verify failed: ${result.error_text}`);
                return res.json({ success: false, message: result.error_text || 'Invalid OTP. Try again.' });
            }
        }

        // Fallback: check local OTP store
        const stored = otpStore[identifier];
        if (!stored) {
            return res.json({ success: false, message: 'No OTP found. Request a new one.' });
        }
        if (Date.now() > stored.expiresAt) {
            delete otpStore[identifier];
            return res.json({ success: false, message: 'OTP expired. Request a new one.' });
        }
        if (stored.otp !== otp) {
            return res.json({ success: false, message: 'Invalid OTP. Try again.' });
        }

        delete otpStore[identifier];
        console.log(`[OK] Fallback OTP verified for ${identifier}`);
        res.json({ success: true, message: 'Verified!' });

    } catch (error) {
        console.error('[ERROR]', error.message || error);
        res.status(500).json({ success: false, message: 'Verification failed. Try again.' });
    }
});

// ========== SERVE SITE ==========
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ========== START ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('');
    console.log('========================================');
    console.log('  🏦 BANKERS SALE - Server Running');
    console.log(`  🌐 http://localhost:${PORT}`);
    console.log('----------------------------------------');
    console.log(`  📱 Vonage Verify: ${vonageConfigured ? '✅ Configured' : '❌ Not configured'}`);
    if (!vonageConfigured) {
        console.log('  ⚠️  Edit .env with your Vonage credentials');
        console.log('  ℹ️  OTP will show in this console as fallback');
    }
    console.log('========================================');
    console.log('');
});
