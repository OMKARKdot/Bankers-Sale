# TODO: Remove Server Offline Fallback Option

## Task
Remove the server offline fallback option from the login system so users MUST have a working server to login.

## Changes Required

### 1. Remove fallback in `sendOTP()` function
- Remove the `.catch()` block that generates OTP client-side when server is unreachable
- Currently shows "Server offline. Your OTP is: " + generatedOTP

### 2. Remove fallback in `verifyOTP()` function  
- Remove the `.catch()` block that verifies OTP client-side when server is unreachable

### 3. Remove fallback in `resendOTP()` function
- Remove the `.catch()` block that generates new OTP client-side when server is unreachable

## Status
- [ ] Edit index.html to remove all three fallbacks
- [ ] Test the changes
