// lab-server.js
const express = require('express');
const app = express();
app.use(express.json());
// Add this with your other global variables
const requestWindows = new Map(); // Track request windows for race condition

// Simple CORS for lab (dangerous for production — OK for local lab)
const cors = require('cors');
app.use(cors());

const PORT = process.env.PORT || 3000;

// Simulated internal data
const internalCoupons = {
  '3atwa': { discount: 40, uses: -1, description: 'Unlimited uses - $40 off per use' },
  'SAVE50': { discount: 50, uses: 1, description: 'Single use - 50% off' },
  'WELCOME20': { discount: 20, uses: 1, description: 'Single use - 20% off' }
};

// Coupon uses state (in-memory)
let couponUses = { '3atwa': 999999, 'SAVE50': 1, 'WELCOME20': 1 };

// Track request batches for true concurrency
const requestBatches = new Map();

// GET /api/availability - returns availability info (NOT coupons)
app.get('/api/availability', (req, res) => {
  res.json({
    status: 'ok',
    server: 'course-platform',
    time: new Date().toISOString(),
    available: true,
    maintenance: false,
    message: 'All courses are available for enrollment',
    systemStatus: 'operational',
    uptime: '99.9%',
    lastChecked: new Date().toISOString(),
    supportedEnrollment: ['individual', 'team', 'enterprise'],
    features: [
      'Live instructor support',
      'Certificate of completion', 
      'Lifetime access',
      'Mobile app access',
      'Community forum'
    ]
  });
});

// Add a hidden coupons endpoint for SSRF discovery
app.get('/api/internal/coupons', (req, res) => {
  res.json({
    status: 'internal',
    coupons: internalCoupons,
    note: 'Internal coupon database - do not expose publicly',
    warning: 'This endpoint should not be publicly accessible'
  });
});

// Add a health check endpoint that might be discovered
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'course-platform-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    dependencies: {
      database: 'connected',
      cache: 'active',
      storage: 'ok'
    }
  });
});

// REAL RACE CONDITION VULNERABILITY - Requires true concurrency
app.post('/api/apply-coupon-vuln', async (req, res) => {
  const { code } = req.body;
  const clientIP = req.ip || req.connection.remoteAddress;
  
  if (!code || !couponUses.hasOwnProperty(code)) {
    return res.status(404).json({ error: 'Coupon not found' });
  }

  // Allow race condition exploitation through rapid sequential requests
  // Group requests by IP and coupon code within a short time window
  const windowKey = `${clientIP}-${code}`;
  
  // Initialize or update the request window
  if (!requestWindows.has(windowKey)) {
    requestWindows.set(windowKey, {
      requestCount: 0,
      startTime: Date.now(),
      maxWindow: 2000 // 2 second window for exploitation
    });
  }
  
  const window = requestWindows.get(windowKey);
  const currentTime = Date.now();
  const windowAge = currentTime - window.startTime;
  
  // Reset window if it's too old
  if (windowAge > window.maxWindow) {
    window.requestCount = 0;
    window.startTime = currentTime;
  }
  
  // Increment request count
  window.requestCount++;
  const currentRequestCount = window.requestCount;
  
  // Allow the request to proceed (create race condition window)
  console.log(`🎯 Request ${currentRequestCount} for ${code} from ${clientIP}`);
  
  // PHASE 1: Initial validation - all requests pass if coupon exists
  await new Promise(r => setTimeout(r, 100 + Math.random() * 50));
  
  const initialRemaining = couponUses[code];
  
  // Check if coupon is exhausted (but vulnerable to race condition)
  if (initialRemaining === 0) {
    return res.status(400).json({ error: 'This coupon has no uses left' });
  }
  
  // PHASE 2: Processing delay - this is the race window
  await new Promise(r => setTimeout(r, 200 + Math.random() * 100));
  
  // VULNERABLE RACE CONDITION: Multiple requests read the same initial value
  let finalRemaining = initialRemaining;
  let appliedDiscount = 0;
  
  if (initialRemaining > 0) {
    // Race condition: All requests see initialRemaining, but only decrement by 1
    // Instead of decrementing by the number of concurrent requests
    await new Promise(r => setTimeout(r, 50 + Math.random() * 50));
    
    // This creates the vulnerability - multiple requests can use the same "remaining" count
    finalRemaining = initialRemaining - 1;
    couponUses[code] = finalRemaining;
    appliedDiscount = internalCoupons[code].discount;
    
    console.log(`💥 Race exploited: ${currentRequestCount} requests, ${initialRemaining} -> ${finalRemaining}`);
  } else if (initialRemaining === -1) {
    // Unlimited coupon - no race condition needed
    appliedDiscount = internalCoupons[code].discount;
    finalRemaining = -1;
  }
  
  return res.json({
    success: true,
    discount: appliedDiscount,
    remaining: finalRemaining,
    requestNumber: currentRequestCount,
    initialRemaining: initialRemaining,
    message: `Coupon applied! $${appliedDiscount} off`,
    raceCondition: initialRemaining > 0 && currentRequestCount > 1,
    explanation: currentRequestCount > 1 ? 
      `Race condition exploited: ${currentRequestCount} rapid requests processed with initial count ${initialRemaining}` : 
      'Single request processed normally'
  });
});

// Safe endpoint that works normally (for comparison)
app.post('/api/apply-coupon-safe', (req, res) => {
  const { code } = req.body;
  if (!code || !couponUses.hasOwnProperty(code)) {
    return res.status(404).json({ error: 'Coupon not found' });
  }

  // ATOMIC operation - no race condition
  if (couponUses[code] === 0) {
    return res.status(400).json({ error: 'This coupon has no uses left' });
  }

  if (couponUses[code] > 0) {
    couponUses[code] = couponUses[code] - 1;
  }

  const discount = internalCoupons[code] ? internalCoupons[code].discount : 0;
  
  return res.json({
    success: true,
    discount: discount,
    remaining: couponUses[code],
    message: `Coupon applied successfully! $${discount} off`,
    safe: true
  });
});

// Reset endpoint for testing
app.post('/api/reset-coupons', (req, res) => {
  couponUses = { '3atwa': 999999, 'SAVE50': 1, 'WELCOME20': 1 };
  requestBatches.clear();
  res.json({ success: true, message: 'Coupons reset to initial state' });
});

// Clean up old batches periodically
setInterval(() => {
  const now = Date.now();
  const maxBatchAge = 5000; // 5 seconds
  for (const [key, batch] of requestBatches.entries()) {
    if (now - batch.startTime > maxBatchAge) {
      requestBatches.delete(key);
    }
  }
}, 30000);

app.listen(PORT, () => console.log(`Lab server listening on http://localhost:${PORT}`));
