import React, { useState } from 'react';
import {
  ShoppingCart,
  BookOpen,
  AlertCircle,
  CheckCircle,
  Trophy,
  ArrowLeft,
  Clock,
  Users,
  Star,
  ExternalLink
} from 'lucide-react';
/**
 * VulnerableCoursePlatform_improved.jsx
 *
 * - Palette: #5479f7 (primary), #99b9ff (secondary), white
 * - SSRF widget: fetches given URL; returns built-in coupons if URL contains localhost/127.0.0.1/internal
 * - Race Condition: Only works when rapidly clicking - server-side race condition
 * - Attempt log shows timestamps and messages for each attempt
 *
 * Save as: frontend/src/VulnerableCoursePlatform_improved.jsx
 */

const flag = 'VITE_FLAG'
const PALETTE = {
  primary: '#5479f7',
  secondary: '#99b9ff',
  white: '#ffffff'
};

const VulnerableCoursePlatform = () => {
  const [currentView, setCurrentView] = useState('courses'); // 'courses', 'course-detail', 'cart'
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [cart, setCart] = useState([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscounts, setAppliedDiscounts] = useState([]);
  const [ssrfUrl, setSsrfUrl] = useState('');
  const [ssrfResponse, setSsrfResponse] = useState('');
  const [message, setMessage] = useState('');
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [creditCard, setCreditCard] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);

  // helpers
  const [attemptLog, setAttemptLog] = useState([]);
  const [isApplying, setIsApplying] = useState(false);
  const [concurrentRequests, setConcurrentRequests] = useState(0);

  // Simulated internal server data (LAB environment)
  const internalCoupons = {
    '3atwa': { discount: 40, uses: -1, description: 'Unlimited uses - $40 off per use' },
    'SAVE50': { discount: 50, uses: 1, description: 'Single use - 50% off' },
    'WELCOME20': { discount: 20, uses: 1, description: 'Single use - 20% off' }
  };

  const courses = [
    {
      id: 1,
      name: 'Web Security Fundamentals',
      price: 150,
      instructor: 'Dr. Sarah Chen',
      duration: '8 weeks',
      students: 15420,
      rating: 4.8,
      description:
        'Master the fundamentals of web application security, including OWASP Top 10, secure coding practices, and vulnerability assessment.',
      topics: ['OWASP Top 10', 'SQL Injection', 'XSS Prevention', 'CSRF Protection', 'Security Testing']
    },
    {
      id: 2,
      name: 'Advanced Penetration Testing',
      price: 299,
      instructor: 'John Smith',
      duration: '12 weeks',
      students: 8930,
      rating: 4.9,
      description:
        'Deep dive into advanced penetration testing techniques, including network exploitation, privilege escalation, and red team operations.',
      topics: ['Network Exploitation', 'Active Directory Attacks', 'Post-Exploitation', 'Red Team Tactics', 'Report Writing']
    },
    {
      id: 3,
      name: 'Secure Coding Practices',
      price: 249,
      instructor: 'Emily Johnson',
      duration: '10 weeks',
      students: 12340,
      rating: 4.7,
      description:
        'Learn to write secure code from the ground up. Covers secure development lifecycle, code review, and defensive programming.',
      topics: ['Secure SDLC', 'Input Validation', 'Authentication', 'Cryptography', 'Code Review']
    },
    {
      id: 4,
      name: 'Cloud Security Architecture',
      price: 349,
      instructor: 'Michael Brown',
      duration: '10 weeks',
      students: 9870,
      rating: 4.9,
      description: 'Design and implement secure cloud infrastructure. Focus on AWS, Azure, and GCP security best practices.',
      topics: ['Cloud Architecture', 'IAM', 'Network Security', 'Compliance', 'DevSecOps']
    },
    {
      id: 5,
      name: 'Mobile App Security',
      price: 279,
      instructor: 'Lisa Wang',
      duration: '9 weeks',
      students: 7650,
      rating: 4.6,
      description: 'Comprehensive mobile security for iOS and Android. Learn to identify and fix mobile app vulnerabilities.',
      topics: ['Mobile OWASP', 'iOS Security', 'Android Security', 'Reverse Engineering', 'API Security']
    },
    {
      id: 6,
      name: 'Network Security Essentials',
      price: 229,
      instructor: 'David Martinez',
      duration: '8 weeks',
      students: 11230,
      rating: 4.7,
      description:
        'Build a strong foundation in network security, including firewalls, IDS/IPS, VPNs, and network monitoring.',
      topics: ['Network Protocols', 'Firewalls', 'IDS/IPS', 'VPN', 'Network Monitoring']
    }
  ];

  const showMessage = (msg, type = 'info') => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(''), 4000);
  };

  const addToCart = (course) => {
    if (!cart.find((c) => c.id === course.id)) {
      setCart([...cart, course]);
      showMessage('Course added to cart!', 'success');
    } else {
      showMessage('Course already in cart!', 'info');
    }
  };

  const removeFromCart = (courseId) => {
    setCart(cart.filter((c) => c.id !== courseId));
    setAppliedDiscounts([]);
    showMessage('Course removed from cart', 'info');
  };

  const viewCourseDetail = (course) => {
    setSelectedCourse(course);
    setCurrentView('course-detail');
    setSsrfResponse('');
    setSsrfUrl('');
  };

  // attempt log helper
  const logAttempt = (msg) => {
    setAttemptLog((prev) => [{ ts: new Date().toISOString(), msg }, ...prev].slice(0, 80));
  };

  // SSRF / availability handler
  const handleSsrfRequest = async () => {
    if (!ssrfUrl) {
      showMessage('Please enter a URL', 'error');
      return;
    }

    // Lab-only shortcut: return internal coupons for local/internal URLs
    if (ssrfUrl.includes('localhost') || ssrfUrl.includes('127.0.0.1') || ssrfUrl.includes('internal') || ssrfUrl.includes('::1') || ssrfUrl.includes('[::1]') || ssrfUrl.includes('127...1')) {
      if (ssrfUrl.includes('/api/coupons')) {
        const response = JSON.stringify({
          status: 'internal',
          coupons: internalCoupons,
          note: 'Internal coupon database'
        }, null, 2);
        setSsrfResponse(`INTERNAL API RESPONSE:\n\n${response}`);
        showMessage('Discovered internal coupon API!', 'success');
      } else if (ssrfUrl.includes('/api/availability')) {
        const response = JSON.stringify({
          status: 'ok',
          server: 'lab-server',
          time: new Date().toISOString(),
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
        }, null, 2);
        setSsrfResponse(`AVAILABILITY API:\n\n${response}`);
        showMessage('Retrieved server availability data', 'success');
      } else if (ssrfUrl.includes('/api/health')) {
        const response = JSON.stringify({
          status: 'healthy',
          service: 'course-platform-api',
          version: '1.0.0'
        }, null, 2);
        setSsrfResponse(`HEALTH CHECK:\n\n${response}`);
        showMessage('Server health check successful', 'success');
      } else {
        setSsrfResponse('ERROR: Endpoint not found on internal server. Try /api/internal/coupons or /api/availability');
        showMessage('Internal endpoint not found. Explore available endpoints.', 'error');
      }
      return;
    }

    // Otherwise try to fetch the remote URL
    try {
      const res = await fetch(ssrfUrl, { method: 'GET' });
      const text = await res.text();
      setSsrfResponse(`REMOTE ${res.status} ${res.statusText}\n\n${text}`);
      showMessage('Fetched remote URL (lab).', 'success');
    } catch (err) {
      setSsrfResponse(`ERROR: Could not fetch URL - ${err.message}`);
      showMessage('Failed to fetch the URL. Make sure /api/availability is running on the lab server.', 'error');
    }
  };

  // Replace the existing applyCoupon and handleApplyCoupon functions with these:

  // APPLY COUPON: Vulnerable to race condition when rapidly clicking
  const applyCoupon = async () => {
    if (!couponCode.trim()) {
      showMessage('Please enter a coupon code', 'error');
      return;
    }

    if (cart.length === 0) {
      showMessage('Your cart is empty!', 'error');
      return;
    }

    // Track concurrent requests
    setConcurrentRequests(prev => prev + 1);
    logAttempt(`📤 Request sent: ${couponCode} (concurrent: ${concurrentRequests + 1})`);

    try {
      // REAL SERVER COMMUNICATION - Use the vulnerable endpoint
      const response = await fetch('/api/apply-coupon-vuln', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: couponCode }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const newDiscount = {
          id: Math.random().toString(36).slice(2, 9),
          code: couponCode,
          amount: result.discount,
          timestamp: Date.now()
        };

        setAppliedDiscounts((prev) => {
          const updated = [...prev, newDiscount];
          logAttempt(`✅ Coupon applied: ${couponCode} - $${result.discount} off (Remaining: ${result.remaining})`);
          showMessage(`Coupon applied! $${result.discount} off added`, 'success');
          return updated;
        });

        // Mark that coupon has been successfully applied at least once
        setCouponApplied(true);
      } else {
        logAttempt(`❌ Failed: ${result.error || 'Unknown error'}`);
        showMessage(result.error || 'Failed to apply coupon', 'error');
      }
    } catch (error) {
      logAttempt(`❌ Network error: ${error.message}`);
      showMessage('Network error - make sure server is running', 'error');
    } finally {
      setConcurrentRequests(prev => prev - 1);
    }
  };

  // Wrapper function that creates the race condition vulnerability
  const handleApplyCoupon = () => {
    // Allow multiple submissions only during active application process
    if (!couponApplied) {
      setIsApplying(true);
      applyCoupon();

      // Add artificial delay to create vulnerability window
      setTimeout(() => {
        setIsApplying(false);
      }, 800);
    } else {
      // Prevent resubmission after successful application
      showMessage('Coupon already applied! Cannot apply again.', 'error');
    }
  };

  const getTotalDiscount = () => {
    return appliedDiscounts.reduce((sum, d) => sum + (d.amount || 0), 0);
  };

  const calculateTotal = () => {
    const subtotal = cart.reduce((sum, course) => sum + course.price, 0);
    const discount = getTotalDiscount();
    return Math.max(0, subtotal - discount);
  };

  const completePurchase = () => {
    if (cart.length === 0) {
      showMessage('Your cart is empty!', 'error');
      return;
    }

    const total = calculateTotal();
    if (total > 0) {
      setShowPaymentModal(true);
      return;
    }

    // Check if they exploited both vulnerabilities
    const used3atwa = appliedDiscounts.some((d) => d.code === '3atwa');
    const multipleApplications = appliedDiscounts.length > 1;

    if (used3atwa && multipleApplications && total === 0) {
      setPurchaseComplete(true);
    } else {
      showMessage('Something went wrong with the purchase.', 'error');
    }
  };

  const processPayment = () => {
    if (!creditCard || creditCard.length < 16) {
      showMessage('Please enter a valid credit card number', 'error');
      return;
    }

    const total = calculateTotal();
    showMessage(`Payment processed! Total charged: $${total.toFixed(2)}`, 'success');

    setTimeout(() => {
      setShowPaymentModal(false);
      setCart([]);
      setAppliedDiscounts([]);
      setCreditCard('');
      showMessage("Purchase complete! But you didn't exploit both vulnerabilities correctly.", 'info');
    }, 800);
  };

  // Success Screen
  if (purchaseComplete) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: PALETTE.secondary, padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ backgroundColor: PALETTE.white, borderRadius: 18, padding: 36, maxWidth: 800, textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>
          <Trophy style={{ width: 96, height: 96, color: '#f6c85f', margin: '0 auto 16px' }} />
          <h1 style={{ fontSize: 40, fontWeight: 800, color: '#222' }}>🎉 Congratulations! 🎉</h1>
          <p style={{ fontSize: 18, color: '#444', marginTop: 12 }}> {flag}</p>

          <div style={{ marginTop: 20, backgroundColor: '#f7fbff', borderRadius: 12, padding: 18, textAlign: 'left' }}>
            <p style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <CheckCircle style={{ width: 20, height: 20, color: '#16a34a' }} />
              <strong>SSRF Exploitation:</strong>&nbsp;Used Server-Side Request Forgery to access internal API at localhost/127.0.0.1 and retrieve coupon codes from /api/coupons
            </p>
            <p style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 8 }}>
              <CheckCircle style={{ width: 20, height: 20, color: '#16a34a' }} />
              <strong>Race Condition Exploitation:</strong>&nbsp;Exploited timing vulnerability by rapidly clicking Apply button to stack the $40 coupon multiple times, reaching $0 total
            </p>
          </div>

          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 22,
              backgroundColor: PALETTE.primary,
              color: PALETTE.white,
              padding: '12px 28px',
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 700,
              border: 'none'
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Payment Modal
  if (showPaymentModal) {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ backgroundColor: PALETTE.white, borderRadius: 18, padding: 28, maxWidth: 520, width: '100%', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#222' }}>Payment Required</h2>
          <p style={{ color: '#555', marginTop: 8 }}>
            Your total is <strong style={{ color: PALETTE.primary, fontSize: 20 }}>${calculateTotal().toFixed(2)}</strong>. Please enter your credit card to complete the purchase.
          </p>

          <div style={{ marginTop: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#333', marginBottom: 6 }}>Credit Card Number</label>
            <input
              type="text"
              value={creditCard}
              onChange={(e) => setCreditCard(e.target.value.replace(/\D/g, '').slice(0, 16))}
              placeholder="1234 5678 9012 3456"
              maxLength="16"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #dbeafe', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={() => { setShowPaymentModal(false); setCreditCard(''); }} style={{ flex: 1, backgroundColor: '#f3f4f6', color: '#333', padding: '10px', borderRadius: 10, border: 'none' }}>Cancel</button>
            <button onClick={processPayment} style={{ flex: 1, backgroundColor: PALETTE.primary, color: PALETTE.white, padding: '10px', borderRadius: 10, border: 'none', fontWeight: 700 }}>Pay Now</button>
          </div>

          <p style={{ color: '#b45309', marginTop: 12, textAlign: 'center', fontWeight: 600 }}>💡 Hint: The goal is to get the total to $0 without needing to pay!</p>
        </div>
      </div>
    );
  }

  // Main UI
  return (
    <div style={{ minHeight: '100vh', backgroundColor: PALETTE.white }}>
      {/* Header */}
      <header style={{ backgroundColor: PALETTE.primary, color: PALETTE.white, boxShadow: '0 4px 12px rgba(84,121,247,0.18)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <BookOpen style={{ width: 40, height: 40 }} />
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>SecureCourses Academy</h1>
              <p style={{ margin: 0, fontSize: 12, color: '#e6efff' }}>Learn Security, Build Your Future</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button onClick={() => setCurrentView('cart')} style={{ position: 'relative', backgroundColor: PALETTE.white, color: PALETTE.primary, padding: '8px 14px', borderRadius: 12, border: 'none', fontWeight: 700 }}>
              <ShoppingCart style={{ width: 16, height: 16, verticalAlign: 'middle' }} />
              <span style={{ marginLeft: 8 }}>Cart</span>
              {cart.length > 0 && (
                <span style={{ position: 'absolute', top: -8, right: -8, backgroundColor: '#ef4444', color: PALETTE.white, width: 20, height: 20, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>



      {/* Views */}
      {currentView === 'course-detail' && selectedCourse && (
        <div style={{ maxWidth: 1200, margin: '20px auto', padding: 16 }}>
          <button onClick={() => setCurrentView('courses')} style={{ marginBottom: 12, background: 'none', border: 'none', color: PALETTE.primary, fontWeight: 800, cursor: 'pointer' }}>
            <ArrowLeft style={{ verticalAlign: 'middle' }} /> Back to Courses
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
            <div>
              <div style={{ backgroundColor: PALETTE.white, borderRadius: 12, padding: 18, boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, color: '#222' }}>{selectedCourse.name}</h1>
                    <p style={{ margin: '8px 0 0', color: '#555' }}>Instructor: {selectedCourse.instructor}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: PALETTE.primary }}>${selectedCourse.price}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 14, marginTop: 14, color: '#666' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Clock style={{ width: 16, height: 16 }} /><span>{selectedCourse.duration}</span></div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Users style={{ width: 16, height: 16 }} /><span>{selectedCourse.students.toLocaleString()} students</span></div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Star style={{ width: 16, height: 16 }} /><span style={{ fontWeight: 800 }}>{selectedCourse.rating}</span></div>
                </div>

                <div style={{ borderTop: '1px solid #eef2ff', marginTop: 16, paddingTop: 14 }}>
                  <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800 }}>About This Course</h2>
                  <p style={{ color: '#444', lineHeight: 1.5 }}>{selectedCourse.description}</p>
                </div>

                <div style={{ borderTop: '1px solid #eef2ff', marginTop: 16, paddingTop: 14 }}>
                  <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 800 }}>What You'll Learn</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {selectedCourse.topics.map((topic, index) => (
                      <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#444' }}>
                        <CheckCircle style={{ width: 16, height: 16, color: '#10b981' }} />
                        <span>{topic}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={() => addToCart(selectedCourse)} style={{ marginTop: 16, width: '100%', backgroundColor: PALETTE.primary, color: PALETTE.white, padding: 12, borderRadius: 10, border: 'none', fontWeight: 800 }}>
                  Add to Cart - ${selectedCourse.price}
                </button>
              </div>
            </div>

            {/* SSRF tool */}
            <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ backgroundColor: PALETTE.white, padding: 16, borderRadius: 12, boxShadow: '0 6px 18px rgba(0,0,0,0.04)' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <ExternalLink style={{ width: 18, height: 18, color: PALETTE.primary }} /> Check Course Availability
                </h3>
                <p style={{ color: '#555', marginTop: 8, fontSize: 13 }}>Enter a URL to verify course availability in our system (lab only)</p>
                <input
                  type="text"
                  value={ssrfUrl}
                  onChange={(e) => setSsrfUrl(e.target.value)}
                  placeholder={`http://localhost:5000/api/availability`}
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e6f0ff', marginTop: 10 }}
                />
                <button onClick={handleSsrfRequest} style={{ marginTop: 10, width: '100%', backgroundColor: PALETTE.primary, color: PALETTE.white, padding: 10, borderRadius: 8, border: 'none', fontWeight: 800 }}>
                  Check Availability
                </button>
                {ssrfResponse && (
                  <pre style={{ marginTop: 10, backgroundColor: '#0b1220', color: '#b7ffcd', borderRadius: 8, padding: 10, fontSize: 12, maxHeight: 220, overflow: 'auto' }}>
                    {ssrfResponse}
                  </pre>
                )}
              </div>

            </aside>
          </div>
        </div>
      )}

      {currentView === 'cart' && (
        <div style={{ maxWidth: 1200, margin: '20px auto', padding: 16 }}>
          <button onClick={() => setCurrentView('courses')} style={{ marginBottom: 12, background: 'none', border: 'none', color: PALETTE.primary, fontWeight: 800, cursor: 'pointer' }}>
            <ArrowLeft /> Continue Shopping
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
            <div>
              <div style={{ backgroundColor: PALETTE.white, padding: 18, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#111' }}>
                  <ShoppingCart style={{ width: 18, height: 18 }} /> Shopping Cart ({cart.length})
                </h2>

                {cart.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <ShoppingCart style={{ width: 64, height: 64, color: '#c7d2fe' }} />
                    <p style={{ color: '#64748b', fontSize: 16 }}>Your cart is empty</p>
                    <button onClick={() => setCurrentView('courses')} style={{ marginTop: 8, backgroundColor: PALETTE.primary, color: PALETTE.white, padding: '10px 16px', borderRadius: 8, border: 'none' }}>
                      Browse Courses
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {cart.map((course) => (
                      <div key={course.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, border: '1px solid #eef2ff' }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{course.name}</h3>
                          <p style={{ margin: 0, color: '#56616a' }}>by {course.instructor}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: PALETTE.primary }}>${course.price}</p>
                          <button onClick={() => removeFromCart(course.id)} style={{ marginTop: 6, background: 'none', border: 'none', color: '#ef4444', fontWeight: 700, cursor: 'pointer' }}>
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {cart.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ backgroundColor: PALETTE.white, padding: 16, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#111' }}>Order Summary</h3>

                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                      <span>Subtotal:</span>
                      <span style={{ fontWeight: 800 }}>${cart.reduce((sum, c) => sum + c.price, 0)}</span>
                    </div>

                    {appliedDiscounts.length > 0 && (
                      <div style={{ marginTop: 10, borderTop: '1px dashed #e6f0ff', paddingTop: 10 }}>
                        <p style={{ color: '#059669', fontWeight: 800 }}>Applied Discounts:</p>
                        {appliedDiscounts.map((discount, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#047857', fontSize: 13 }}>
                            <span>{discount.code}</span>
                            <span>- ${discount.amount}</span>
                          </div>
                        ))}

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, borderTop: '1px solid #e6f0ff', paddingTop: 8, fontWeight: 900 }}>
                          <span>Total Discount:</span>
                          <span>- ${getTotalDiscount()}</span>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 20, fontWeight: 900 }}>
                      <span>Total:</span>
                      <span style={{ color: PALETTE.primary }}>${calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, borderTop: '1px solid #eef6ff', paddingTop: 12 }}>
                    <label style={{ display: 'block', fontWeight: 800, marginBottom: 6 }}>Have a coupon code?</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        placeholder="Enter coupon code"
                        style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #e6f6ff' }}
                      />

                      <button
                        onClick={handleApplyCoupon}
                        style={{
                          backgroundColor: isApplying ? '#a5b4fc' : '#059669',
                          color: '#fff',
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: 'none',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        {isApplying ? 'Applying...' : 'Apply Coupon'}
                      </button>
                    </div>
                  </div>

                  <button onClick={completePurchase} style={{ marginTop: 12, width: '100%', backgroundColor: PALETTE.primary, color: PALETTE.white, padding: 12, borderRadius: 10, border: 'none', fontWeight: 900 }}>
                    Complete Purchase
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {currentView === 'courses' && (
        <div style={{ maxWidth: 1200, margin: '20px auto', padding: 16 }}>
          <h2 style={{ fontSize: 32, fontWeight: 900, color: '#111' }}>Available Courses</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginTop: 16 }}>
            {courses.map((course) => (
              <div key={course.id} style={{ backgroundColor: PALETTE.white, borderRadius: 12, boxShadow: '0 8px 20px rgba(0,0,0,0.04)', overflow: 'hidden', border: '1px solid #eef6ff' }}>
                <div style={{ height: 84, backgroundColor: PALETTE.secondary }}></div>
                <div style={{ padding: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0b1220' }}>{course.name}</h3>
                  <p style={{ color: '#55616b' }}>by {course.instructor}</p>

                  <div style={{ display: 'flex', gap: 10, marginTop: 8, color: '#6b7280', fontSize: 13 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Star style={{ width: 14, height: 14 }} /><span style={{ fontWeight: 900 }}>{course.rating}</span></div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Users style={{ width: 14, height: 14 }} /><span>{(course.students / 1000).toFixed(1)}k</span></div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Clock style={{ width: 14, height: 14 }} /><span>{course.duration}</span></div>
                  </div>

                  <div style={{ fontSize: 22, fontWeight: 900, color: PALETTE.primary, marginTop: 12 }}>${course.price}</div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={() => viewCourseDetail(course)} style={{ flex: 1, backgroundColor: PALETTE.primary, color: PALETTE.white, padding: 10, borderRadius: 8, border: 'none', fontWeight: 800 }}>
                      View Details
                    </button>
                    <button onClick={() => addToCart(course)} style={{ backgroundColor: '#10b981', color: '#fff', padding: '10px', borderRadius: 8, border: 'none' }}>
                      <ShoppingCart style={{ width: 16, height: 16 }} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VulnerableCoursePlatform;
