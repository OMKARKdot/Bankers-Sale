// Example: How to use freemobile-sms package
// Note: Free Mobile is a French mobile operator - this may not work for Indian numbers

const freemobile = require('freemobile-sms');

// Configuration
const config = {
    user: process.env.FREEMOBILE_USER,      // Your Free Mobile user ID
    pass: process.env.FREEMOBILE_PASS,      // Your Free Mobile password
    phone: process.env.FREEMOBILE_PHONE      // Your Free Mobile phone number
};

async function sendSMS(message) {
    if (!config.user || !config.pass || !config.phone) {
        console.log('Free Mobile credentials not configured in .env');
        console.log('Please add to .env file:');
        console.log('FREEMOBILE_USER=your_user_id');
        console.log('FREEMOBILE_PASS=your_password');
        console.log('FREEMOBILE_PHONE=your_phone_number');
        return;
    }

    try {
        const result = await freemobile.send({
            user: config.user,
            pass: config.pass,
            phone: config.phone,
            message: message
        });
        console.log('SMS sent successfully:', result);
    } catch (error) {
        console.error('Failed to send SMS:', error.message);
    }
}

// Example usage
// sendSMS('Hello from Bankers Sale!');

// Export for use in server.js
module.exports = { sendSMS };
