require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const bodyParser = require('body-parser');
const path       = require('path');
const crypto     = require('crypto');
const session    = require('express-session');
const db         = require('./database');
const nodemailer = require('nodemailer');

const app  = express();
const PORT = process.env.PORT || 3000;

// ══════════════════════════════════════
// ══ ADMIN SYSTEM INIT ══
// ══════════════════════════════════════
// Pehli baar server start ho toh default owner admin create karo
function initDefaultAdmin() {
  const admins = db.get('admins').value();
  if (admins.length === 0) {
    const defaultAdmin = {
      id: 'ADM001',
      username: process.env.ADMIN_USERNAME || 'admin',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      name: 'Owner',
      email: process.env.GMAIL_USER || '',
      role: 'owner',   // owner = full access, staff = limited
      active: true,
      createdAt: new Date().toISOString()
    };
    db.get('admins').push(defaultAdmin).write();
    console.log(`✅ Default admin created — Username: ${defaultAdmin.username}`);
  }
}

// ── HELPER: Find admin by username ──
function findAdmin(username) {
  return db.get('admins').find({ username, active: true }).value();
}

// ── HELPER: Check if owner ──
function isOwner(req) {
  return req.session && req.session.adminRole === 'owner';
}

// ── NODEMAILER ──
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
});

// ── ORDER EMAIL ──
async function sendOrderEmail(order) {
  if (!process.env.GMAIL_USER || !order.email) return;
  const isOneTime = order.type === 'one_time';
  const subject = isOneTime
    ? `🌸 Order Confirmed — Riddhi Siddhi Florals | #${order.id}`
    : `🌸 Subscription Confirmed — Riddhi Siddhi Florals | #${order.id}`;
  const bodyOneTime = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#6A0DAD,#C0392B);padding:28px;text-align:center;">
        <h1 style="color:white;font-size:1.6rem;margin:0;">🌸 Riddhi Siddhi Florals</h1>
        <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;">Divine Morning Rituals</p>
      </div>
      <div style="padding:28px;background:#FFF8E7;">
        <p style="font-size:1rem;color:#333;">Namaste <strong>${order.name}</strong> ji! 🙏</p>
        <p style="color:#555;">Aapka order confirm ho gaya hai.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr style="background:#f3e5ff;"><td style="padding:10px 14px;color:#555;">📋 Order ID</td><td style="padding:10px 14px;font-weight:bold;color:#333;">${order.id}</td></tr>
          <tr><td style="padding:10px 14px;color:#555;">🛍️ Item</td><td style="padding:10px 14px;color:#333;">${order.item}</td></tr>
          <tr style="background:#f3e5ff;"><td style="padding:10px 14px;color:#555;">💰 Amount</td><td style="padding:10px 14px;font-weight:bold;color:#C0392B;">₹${order.amount}</td></tr>
          <tr><td style="padding:10px 14px;color:#555;">📅 Booking Date</td><td style="padding:10px 14px;color:#333;">${order.bookingDate || order.startDate}</td></tr>
          <tr style="background:#f3e5ff;"><td style="padding:10px 14px;color:#555;">🚚 Delivery Date</td><td style="padding:10px 14px;font-weight:bold;color:#1B8A3C;">${order.deliveryDate || order.startDate}</td></tr>
        </table>
        <p style="color:#777;font-size:0.85rem;">Call: <strong>📞 8923471161</strong></p>
        <p style="color:#9B59B6;font-weight:bold;margin-top:24px;">🙏 Jai Siya Ram!<br>Riddhi Siddhi Florals Team</p>
      </div>
    </div>`;
  const bodySubscription = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#6A0DAD,#C0392B);padding:28px;text-align:center;">
        <h1 style="color:white;font-size:1.6rem;margin:0;">🌸 Riddhi Siddhi Florals</h1>
        <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;">Divine Morning Rituals</p>
      </div>
      <div style="padding:28px;background:#FFF8E7;">
        <p style="font-size:1rem;color:#333;">Namaste <strong>${order.name}</strong> ji! 🙏</p>
        <p style="color:#555;">Aapki subscription confirm ho gayi hai.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr style="background:#f3e5ff;"><td style="padding:10px 14px;color:#555;">📋 Order ID</td><td style="padding:10px 14px;font-weight:bold;color:#333;">${order.id}</td></tr>
          <tr><td style="padding:10px 14px;color:#555;">🌼 Plan</td><td style="padding:10px 14px;color:#333;">${order.item}</td></tr>
          <tr style="background:#f3e5ff;"><td style="padding:10px 14px;color:#555;">💰 Amount</td><td style="padding:10px 14px;font-weight:bold;color:#C0392B;">₹${order.amount}</td></tr>
          <tr><td style="padding:10px 14px;color:#555;">📅 Start</td><td style="padding:10px 14px;color:#333;">${order.startDate}</td></tr>
          <tr style="background:#f3e5ff;"><td style="padding:10px 14px;color:#555;">🏁 Valid Till</td><td style="padding:10px 14px;font-weight:bold;color:#1B8A3C;">${order.endDate}</td></tr>
        </table>
        <p style="color:#777;font-size:0.85rem;">Call: <strong>📞 8923471161</strong></p>
        <p style="color:#9B59B6;font-weight:bold;margin-top:24px;">🙏 Jai Siya Ram!<br>Riddhi Siddhi Florals Team</p>
      </div>
    </div>`;
  try {
    await transporter.sendMail({
      from: `"Riddhi Siddhi Florals 🌸" <${process.env.GMAIL_USER}>`,
      to: order.email, subject,
      html: isOneTime ? bodyOneTime : bodySubscription
    });
    console.log(`📧 Email sent to ${order.email}`);
  } catch(e) { console.error('❌ Email failed:', e.message); }
}

// ── RAZORPAY ──
let razorpay = null;
const RZP_KEY_ID     = process.env.RAZORPAY_KEY_ID     || '';
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
if (RZP_KEY_ID && RZP_KEY_SECRET && !RZP_KEY_SECRET.includes('secret_key_yahan')) {
  try {
    const Razorpay = require('razorpay');
    razorpay = new Razorpay({ key_id: RZP_KEY_ID, key_secret: RZP_KEY_SECRET });
    console.log('✅ Razorpay connected!');
  } catch(e) { console.log('⚠️  Razorpay load failed — Mock mode'); }
} else { console.log('⚠️  Razorpay Mock mode'); }

// ── MIDDLEWARE ──
app.use(cors());
// Webhook ke liye raw body chahiye (signature verify karne ke liye)
app.use('/api/razorpay-webhook', express.raw({ type: 'application/json' }));
app.use(bodyParser.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'riddhi-siddhi-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

// ── OTP STORE ──
const otpStore = {};

// ── AUTH MIDDLEWARE ──
function requireAuth(req, res, next) {
  if (req.session && req.session.adminLoggedIn) return next();
  res.redirect('/login');
}
function requireApiAuth(req, res, next) {
  if (req.session && req.session.adminLoggedIn) return next();
  res.status(401).json({ success: false, error: 'Unauthorized. Please login.' });
}
function requireOwner(req, res, next) {
  if (req.session && req.session.adminLoggedIn && req.session.adminRole === 'owner') return next();
  res.status(403).json({ success: false, error: 'Owner access required.' });
}

const todayStr = () => new Date().toISOString().split('T')[0];
function calcEndDate(start, days) { const d = new Date(start); d.setDate(d.getDate() + parseInt(days)); return d.toISOString().split('T')[0]; }
function isActive(o) { const t = todayStr(); return o.type === 'one_time' ? (o.deliveryDate || o.startDate) >= t : o.endDate >= t; }

// ── SERVICE AREA POLYGON ──
const SERVICE_POLYGON = [
  [77.0228304,28.6206467],[77.0242252,28.6201947],[77.0261135,28.6195354],
  [77.0285596,28.6193471],[77.0305981,28.6192152],[77.0321216,28.6193282],
  [77.0342674,28.6197049],[77.0367565,28.6200817],[77.0388164,28.62027],
  [77.0407261,28.6204772],[77.0423569,28.6204019],[77.043816,28.6202888],
  [77.045597,28.620496],[77.0492877,28.6209669],[77.0534505,28.6215132],
  [77.0570125,28.6221913],[77.0601024,28.6230012],[77.0630636,28.6241501],
  [77.0668187,28.6255439],[77.0701446,28.6268812],[77.0746507,28.6285198],
  [77.0762171,28.629292],[77.0776333,28.6299135],[77.0784916,28.6302714],
  [77.0791568,28.6305539],[77.0815386,28.6314956],[77.0804443,28.6340004],
  [77.0802726,28.6347914],[77.0804228,28.6363358],[77.081088,28.6381814],
  [77.0817747,28.6398951],[77.0823755,28.6414017],[77.083105,28.6434355],
  [77.0841135,28.6461096],[77.0823755,28.6469193],[77.0814099,28.6468628],
  [77.0793499,28.6469758],[77.0784273,28.6472771],[77.0736637,28.6498193],
  [77.0722045,28.6485765],[77.0687498,28.645507],[77.0653166,28.6425504],
  [77.0627417,28.6404413],[77.0606174,28.6389912],[77.0598449,28.6383885],
  [77.0589222,28.6378424],[77.0583429,28.6378235],[77.0576348,28.6379554],
  [77.0570554,28.6383885],[77.0562615,28.6391418],[77.0558752,28.6400458],
  [77.055768,28.6407991],[77.0560898,28.6430212],[77.0561971,28.6440946],
  [77.0560898,28.6446784],[77.0557036,28.6456765],[77.0552315,28.6461473],
  [77.0539011,28.6475031],[77.0529355,28.6483693],[77.0519056,28.6492732],
  [77.0511331,28.6495368],[77.0488586,28.6502147],[77.0466699,28.6502524],
  [77.0436873,28.6501206],[77.0413699,28.6499888],[77.0377006,28.6488966],
  [77.0350613,28.6473148],[77.0314564,28.644283],[77.0269718,28.6411945],
  [77.0259418,28.6402718],[77.0256843,28.6389723],[77.0251908,28.6365617],
  [77.0252981,28.6353564],[77.0257916,28.6336614],[77.0257916,28.6330964],
  [77.0252551,28.6316462],[77.0237317,28.6294803],[77.0229592,28.6282561],
  [77.0232167,28.6280301],[77.0232167,28.6270695],[77.0231738,28.6232837],
  [77.0228304,28.6224926]
];

function pointInPolygon(point, polygon) {
  const { lat, lng } = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yj === yi) continue;
    const intersect = ((yi > lat) !== (yj > lat)) && (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

async function detectArea(addr) {
  if (!addr) return null;
  try {
    const axios = require('axios');
    async function geocodeAndCheck(query) {
      const encoded = encodeURIComponent(query);
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
      const { data } = await axios.get(url);
      if (data.status !== 'OK' || !data.results.length) return null;
      const { lat, lng } = data.results[0].geometry.location;
      const inside = pointInPolygon({ lat, lng }, SERVICE_POLYGON);
      return inside ? { lat, lng } : null;
    }
    let result = await geocodeAndCheck(addr);
    if (result) return 'Service Area';
    const pincodeMatch = addr.match(/\b1\d{5}\b/);
    if (pincodeMatch) { result = await geocodeAndCheck(pincodeMatch[0] + ', Delhi, India'); if (result) return 'Service Area'; }
    const parts = addr.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) { result = await geocodeAndCheck(parts.slice(-2).join(', ') + ', Delhi, India'); if (result) return 'Service Area'; }
    return null;
  } catch(e) { console.error('❌ Geocoding error:', e.message); return null; }
}

// ════════════════════════════════════════
// ══ AUTH ROUTES ══
// ════════════════════════════════════════

app.get('/login', (req, res) => {
  if (req.session && req.session.adminLoggedIn) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ── LOGIN — db.json se check karo ──
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ success: false, error: 'Username and password are required' });

  // db.json mein check karo
  const admin = db.get('admins').find({ username }).value();

  if (!admin)
    return res.status(401).json({ success: false, error: 'Invalid username or password' });

  if (!admin.active)
    return res.status(401).json({ success: false, error: 'This account has been deactivated. Contact owner.' });

  if (admin.password !== password)
    return res.status(401).json({ success: false, error: 'Invalid username or password' });

  req.session.adminLoggedIn  = true;
  req.session.adminUsername  = admin.username;
  req.session.adminRole      = admin.role;
  req.session.adminId        = admin.id;
  req.session.adminName      = admin.name;

  // Last login update karo
  db.get('admins').find({ id: admin.id }).assign({ lastLogin: new Date().toISOString() }).write();

  return res.json({ success: true, role: admin.role, name: admin.name });
});

// ── LOGOUT ──
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ── AUTH CHECK ──
app.get('/api/auth/check', (req, res) => {
  res.json({
    loggedIn: !!(req.session && req.session.adminLoggedIn),
    role: req.session?.adminRole || null,
    name: req.session?.adminName || null
  });
});

// ── FORGOT PASSWORD — OTP bhejo ──
app.post('/api/auth/forgot-password', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ success: false, error: 'Username is required' });

  const admin = db.get('admins').find({ username }).value();
  if (!admin) return res.status(404).json({ success: false, error: 'Username not found' });

  // Email kahan bhejein
  const toEmail = admin.email || process.env.GMAIL_USER;
  if (!toEmail) return res.status(500).json({ success: false, error: 'No email configured for this admin' });

  const otp    = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = Date.now() + 10 * 60 * 1000;
  otpStore[username] = { otp, expiry };

  try {
    await transporter.sendMail({
      from: `"Riddhi Siddhi Florals 🌸" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject: '🔐 Admin Password Reset OTP — Riddhi Siddhi Florals',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#4338CA,#EA580C);padding:28px;text-align:center;">
            <h1 style="color:white;font-size:1.4rem;margin:0;">🔐 Password Reset</h1>
            <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;">Riddhi Siddhi Florals Admin</p>
          </div>
          <div style="padding:28px;background:#f9fafb;">
            <p style="color:#374151;">Hi <strong>${admin.name}</strong>, your OTP is:</p>
            <div style="text-align:center;margin:24px 0;">
              <span style="font-size:2.5rem;font-weight:bold;letter-spacing:10px;color:#4338CA;background:#EEF2FF;padding:16px 28px;border-radius:12px;">${otp}</span>
            </div>
            <p style="color:#6B7280;font-size:0.85rem;">Valid for <strong>10 minutes</strong>. Do not share with anyone.</p>
          </div>
        </div>`
    });
    console.log(`🔐 OTP sent to ${toEmail} for ${username}`);
    res.json({ success: true, message: 'OTP sent to registered email' });
  } catch(e) {
    console.error('❌ OTP email failed:', e.message);
    res.status(500).json({ success: false, error: 'Failed to send OTP. Check Gmail config.' });
  }
});

// ── RESET PASSWORD — db.json mein permanently save ──
app.post('/api/auth/reset-password', (req, res) => {
  const { username, otp, newPassword } = req.body;
  if (!username || !otp || !newPassword)
    return res.status(400).json({ success: false, error: 'Username, OTP and new password required' });

  const stored = otpStore[username];
  if (!stored) return res.status(400).json({ success: false, error: 'No OTP found. Please request a new one.' });
  if (Date.now() > stored.expiry) {
    delete otpStore[username];
    return res.status(400).json({ success: false, error: 'OTP expired. Please request a new one.' });
  }
  if (stored.otp !== otp.toString())
    return res.status(400).json({ success: false, error: 'Invalid OTP' });

  // ✅ db.json mein permanently save karo
  db.get('admins').find({ username }).assign({ password: newPassword, updatedAt: new Date().toISOString() }).write();
  delete otpStore[username];

  console.log(`✅ Password reset for: ${username}`);
  res.json({ success: true, message: 'Password reset successfully! Please login.' });
});

// ── CHANGE OWN PASSWORD (logged in admin) ──
app.post('/api/auth/change-password', requireApiAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const adminId = req.session.adminId;

  const admin = db.get('admins').find({ id: adminId }).value();
  if (!admin) return res.status(404).json({ success: false, error: 'Admin not found' });
  if (admin.password !== currentPassword)
    return res.status(400).json({ success: false, error: 'Current password is incorrect' });
  if (newPassword.length < 6)
    return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });

  // ✅ db.json mein save karo
  db.get('admins').find({ id: adminId }).assign({ password: newPassword, updatedAt: new Date().toISOString() }).write();
  res.json({ success: true, message: 'Password changed successfully!' });
});

// ════════════════════════════════════════
// ══ ADMIN MANAGEMENT (Owner only) ══
// ════════════════════════════════════════

// Get all admins
app.get('/api/admins', requireOwner, (req, res) => {
  const admins = db.get('admins').value().map(a => ({
    id: a.id, username: a.username, name: a.name,
    email: a.email || '', role: a.role, active: a.active,
    createdAt: a.createdAt, lastLogin: a.lastLogin || null
  }));
  res.json({ success: true, admins });
});

// Create new admin
app.post('/api/admins', requireOwner, (req, res) => {
  const { username, password, name, email, role } = req.body;
  if (!username || !password || !name)
    return res.status(400).json({ success: false, error: 'Username, password and name are required' });
  if (password.length < 6)
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });

  // Check duplicate username
  const existing = db.get('admins').find({ username }).value();
  if (existing) return res.status(400).json({ success: false, error: 'Username already exists' });

  const newAdmin = {
    id: 'ADM' + Date.now(),
    username: username.trim(),
    password,
    name: name.trim(),
    email: email?.trim() || '',
    role: role === 'owner' ? 'owner' : 'staff',
    active: true,
    createdAt: new Date().toISOString()
  };
  db.get('admins').push(newAdmin).write();
  console.log(`✅ New admin created: ${username} (${role})`);
  res.json({ success: true, admin: { id: newAdmin.id, username: newAdmin.username, name: newAdmin.name, role: newAdmin.role } });
});

// Update admin (name, email, role)
app.patch('/api/admins/:id', requireOwner, (req, res) => {
  const { id } = req.params;
  const admin = db.get('admins').find({ id }).value();
  if (!admin) return res.status(404).json({ success: false, error: 'Admin not found' });

  // Owner khud apna role change na kar sake
  if (admin.role === 'owner' && req.session.adminId === id && req.body.role === 'staff')
    return res.status(400).json({ success: false, error: 'You cannot change your own role' });

  const allowed = ['name', 'email', 'role', 'active'];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
  updates.updatedAt = new Date().toISOString();

  db.get('admins').find({ id }).assign(updates).write();
  res.json({ success: true });
});

// Reset admin password (by owner)
app.post('/api/admins/:id/reset-password', requireOwner, (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });

  const admin = db.get('admins').find({ id }).value();
  if (!admin) return res.status(404).json({ success: false, error: 'Admin not found' });

  // ✅ db.json mein permanently save karo
  db.get('admins').find({ id }).assign({ password: newPassword, updatedAt: new Date().toISOString() }).write();
  console.log(`✅ Password reset by owner for: ${admin.username}`);
  res.json({ success: true, message: `Password reset for ${admin.name}` });
});

// Delete admin
app.delete('/api/admins/:id', requireOwner, (req, res) => {
  const { id } = req.params;
  if (id === req.session.adminId)
    return res.status(400).json({ success: false, error: 'You cannot delete your own account' });
  db.get('admins').remove({ id }).write();
  res.json({ success: true });
});

// ════════════════════════════════════════
// ══ PUBLIC ROUTES ══
// ════════════════════════════════════════

app.post('/api/create-payment', async (req, res) => {
  const { name, phone, email, address, item, amount, type, startDate, deliveryDate } = req.body;
  if (!name || !phone || !address || !item || !amount || !type || !startDate)
    return res.status(400).json({ success: false, error: 'Saari details zaroori hain' });
  const area = await detectArea(address);
  if (!area) return res.status(400).json({ success: false, error: 'Sorry! Hum abhi apke area mein deliver nahi karte.' });
  const orderId = 'RSF' + Date.now().toString().slice(-6);
  const endDate = calcEndDate(startDate, type === 'one_time' ? 1 : 30);
  if (razorpay) {
    try {
      const rzpOrder = await razorpay.orders.create({ amount: parseInt(amount) * 100, currency: 'INR', receipt: orderId, notes: { name, phone, item } });
      db.get('orders').unshift({ id: orderId, name: name.trim(), phone: phone.trim(), email: email?.trim()||'', address: address.trim(), area, item, amount: parseInt(amount), type, agent: '', startDate, endDate, deliveryDate: deliveryDate||null, bookingDate: todayStr(), razorpay_order_id: rzpOrder.id, payment_status: 'pending', created: new Date().toISOString() }).write();
      return res.json({ success: true, razorpay_order_id: rzpOrder.id, razorpay_key: RZP_KEY_ID, order_id: orderId, amount: parseInt(amount) });
    } catch(e) { return res.status(500).json({ success: false, error: 'Payment gateway error: ' + e.message }); }
  }
  const mockOrder = { id: orderId, name: name.trim(), phone: phone.trim(), email: email?.trim()||'', address: address.trim(), area, item, amount: parseInt(amount), type, agent: '', startDate, endDate, deliveryDate: deliveryDate||null, bookingDate: todayStr(), payment_status: 'confirmed', created: new Date().toISOString() };
  db.get('orders').unshift(mockOrder).write();
  sendOrderEmail(mockOrder);
  res.json({ success: true, mock_mode: true, order_id: orderId, amount: parseInt(amount) });
});

app.post('/api/verify-payment', (req, res) => {
  const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, status } = req.body;

  // ✅ FIX: Frontend se cancel / failed aaya toh DB update karo
  if (status === 'cancelled' || status === 'failed') {
    db.get('orders').find({ id: order_id }).assign({
      payment_status: status,
      updatedAt: new Date().toISOString()
    }).write();
    console.log(`⚠️  Order ${order_id} marked as ${status}`);
    return res.json({ success: true });
  }
  if (!RZP_KEY_SECRET || RZP_KEY_SECRET.includes('secret_key_yahan')) {
    db.get('orders').find({ id: order_id }).assign({ payment_status: 'confirmed' }).write();
    return res.json({ success: true });
  }
  const expected = crypto.createHmac('sha256', RZP_KEY_SECRET).update(razorpay_order_id + '|' + razorpay_payment_id).digest('hex');
  if (expected !== razorpay_signature) return res.status(400).json({ success: false, error: 'Payment verification failed' });
  db.get('orders').find({ id: order_id }).assign({ payment_status: 'confirmed', razorpay_payment_id, razorpay_signature }).write();
  const verifiedOrder = db.get('orders').find({ id: order_id }).value();
  sendOrderEmail(verifiedOrder);
  res.json({ success: true });
});

// ══════════════════════════════════════
// ══ RAZORPAY WEBHOOK ══
// ══════════════════════════════════════
app.post('/api/razorpay-webhook', (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

  if (webhookSecret) {
    const receivedSig = req.headers['x-razorpay-signature'];
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.body)
      .digest('hex');
    if (receivedSig !== expectedSig) {
      console.error('❌ Webhook signature mismatch!');
      return res.status(400).json({ success: false, error: 'Invalid signature' });
    }
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString());
  } catch (e) {
    return res.status(400).json({ success: false, error: 'Invalid JSON' });
  }

  const event = payload.event;
  console.log('🔔 Razorpay Webhook received:', event);

  if (event === 'payment.captured') {
    const payment = payload.payload?.payment?.entity;
    if (payment) {
      const rzpOrderId = payment.order_id;
      const order = db.get('orders').find({ razorpay_order_id: rzpOrderId }).value();
      if (order && order.payment_status !== 'confirmed') {
        db.get('orders').find({ razorpay_order_id: rzpOrderId }).assign({
          payment_status: 'confirmed',
          razorpay_payment_id: payment.id,
          webhook_confirmed: true,
          webhook_at: new Date().toISOString()
        }).write();
        const updatedOrder = db.get('orders').find({ razorpay_order_id: rzpOrderId }).value();
        sendOrderEmail(updatedOrder);
        console.log('✅ Webhook: Order', order.id, 'confirmed via webhook');
      }
    }
  }

  if (event === 'payment.failed') {
    const payment = payload.payload?.payment?.entity;
    if (payment) {
      const rzpOrderId = payment.order_id;
      db.get('orders').find({ razorpay_order_id: rzpOrderId }).assign({
        payment_status: 'failed',
        webhook_at: new Date().toISOString()
      }).write();
      console.log('❌ Webhook: Payment failed for', rzpOrderId);
    }
  }

  res.status(200).json({ success: true });
});

app.post('/api/check-area', async (req, res) => {
  const { address, lat, lng } = req.body;
  let inside = false, resolvedAddress = null;
  if (lat !== undefined && lng !== undefined) {
    inside = pointInPolygon({ lat: parseFloat(lat), lng: parseFloat(lng) }, SERVICE_POLYGON);
    if (inside) {
      try {
        const axios = require('axios');
        const { data } = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.GOOGLE_MAPS_API_KEY}`);
        if (data.status === 'OK' && data.results.length) resolvedAddress = data.results[0].formatted_address;
      } catch(e) {}
    }
  } else { inside = !!(await detectArea(address)); }
  res.json({ success: true, serviceable: inside, area: inside ? 'Service Area' : null, address: resolvedAddress, message: inside ? '✅ Badiya! Hum apke area mein deliver karte hain.' : '❌ Sorry! Abhi hum apke area mein deliver nahi karte.' });
});

app.get('/api/orders/check/:phone', (req, res) => {
  const p = req.params.phone.replace(/\D/g,'').slice(-10);
  res.json({ success: true, orders: db.get('orders').value().filter(o => o.phone.replace(/\D/g,'').slice(-10)===p && isActive(o)) });
});

// ════════════════════════════════════════
// ══ PROTECTED API ROUTES ══
// ════════════════════════════════════════

app.get('/api/orders',             requireApiAuth, (req, res) => res.json({ success: true, orders: db.get('orders').value() }));
app.get('/api/orders/active',      requireApiAuth, (req, res) => res.json({ success: true, orders: db.get('orders').value().filter(isActive) }));
app.get('/api/orders/today',       requireApiAuth, (req, res) => { const t = todayStr(); res.json({ success: true, orders: db.get('orders').value().filter(o => isActive(o) && (o.type==='one_time'?(o.deliveryDate||o.startDate)===t:true)) }); });
app.get('/api/orders/:id',         requireApiAuth, (req, res) => { const o = db.get('orders').find({ id: req.params.id }).value(); o ? res.json({ success:true, order:o }) : res.status(404).json({ success:false, error:'Not found' }); });
app.post('/api/orders',            requireApiAuth, async (req, res) => {
  const { name, phone, email, address, item, amount, type, startDate } = req.body;
  if (!name||!phone||!address||!item||!amount||!type||!startDate) return res.status(400).json({ success:false, error:'Details zaroori hain' });
  const area = await detectArea(address);
  if (!area) return res.status(400).json({ success:false, error:'Area not serviceable' });
  const order = { id:'RSF'+Date.now().toString().slice(-6), name:name.trim(), phone:phone.trim(), email:email?.trim()||'', address:address.trim(), area, item, amount:parseInt(amount), type, agent:'', startDate, endDate:calcEndDate(startDate, type==='one_time'?1:30), bookingDate:todayStr(), payment_status:'confirmed', created:new Date().toISOString() };
  db.get('orders').unshift(order).write();
  res.json({ success:true, order });
});
app.patch('/api/orders/:id',       requireApiAuth, (req, res) => { db.get('orders').find({ id:req.params.id }).assign(req.body).write(); res.json({ success:true }); });
app.delete('/api/orders/:id',      requireApiAuth, (req, res) => { db.get('orders').remove({ id:req.params.id }).write(); res.json({ success:true }); });
app.post('/api/orders/:id/assign', requireApiAuth, (req, res) => { db.get('orders').find({ id:req.params.id }).assign({ agent:req.body.agent }).write(); res.json({ success:true }); });

app.get('/api/agents',       requireApiAuth, (req, res) => res.json({ success:true, agents:db.get('agents').value() }));
app.post('/api/agents',      requireApiAuth, (req, res) => { const { name, phone, areas } = req.body; if(!name||!phone) return res.status(400).json({ success:false, error:'Name and phone required' }); const a = { id:'A'+Date.now(), name:name.trim(), phone:phone.trim(), areas:areas||[], active:true, joined:new Date().toISOString() }; db.get('agents').push(a).write(); res.json({ success:true, agent:a }); });
app.patch('/api/agents/:id', requireApiAuth, (req, res) => { db.get('agents').find({ id:req.params.id }).assign(req.body).write(); res.json({ success:true }); });
app.delete('/api/agents/:id',requireApiAuth, (req, res) => { db.get('agents').remove({ id:req.params.id }).write(); res.json({ success:true }); });

app.get('/api/stats', requireApiAuth, (req, res) => {
  const all = db.get('orders').value(), active = all.filter(isActive), t = todayStr();
  const areaMap = {};
  active.forEach(o => { const a = o.area||'Other'; areaMap[a] = (areaMap[a]||0)+1; });
  res.json({ success:true, stats: { totalActive:active.length, revenue:all.reduce((s,o)=>s+o.amount,0), todayOrders:active.filter(o=>o.type==='one_time'?o.startDate===t:o.created?.startsWith(t)).length, customers:[...new Set(active.map(o=>o.phone))].length, areaWise:areaMap } });
});


// ════════════════════════════════════════
// ══ SITE SETTINGS API ══
// ════════════════════════════════════════

// Public: anyone can read settings (website uses this)
app.get('/api/site-settings', (req, res) => {
  const settings = db.get('siteSettings').value() || {};
  res.json({ success: true, settings });
});

// Protected: only owner can update settings
app.patch('/api/site-settings', requireOwner, (req, res) => {
  const current = db.get('siteSettings').value() || {};
  const updated = Object.assign({}, current, req.body);
  db.set('siteSettings', updated).write();
  res.json({ success: true, settings: updated });
});

// ── PAGE ROUTES ──
app.get('/',      (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/admin', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.listen(PORT, () => {
  initDefaultAdmin(); // Default admin create karo agar nahi hai
  console.log('\n🌸 ════════════════════════════════════════');
  console.log('   Riddhi Siddhi Florals — Server Started!');
  console.log('🌸 ════════════════════════════════════════');
  console.log(`\n   🌐 Website:     http://localhost:${PORT}`);
  console.log(`   🔐 Login:       http://localhost:${PORT}/login`);
  console.log(`   🛠️  Admin Panel: http://localhost:${PORT}/admin`);
  console.log(`   💳 Razorpay:    ${razorpay ? 'Connected ✅' : 'Mock Mode ⚠️'}`);
  console.log('\n   🙏 Jai Siya Ram!\n');
});
