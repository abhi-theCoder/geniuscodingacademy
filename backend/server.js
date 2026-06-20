require("dotenv").config({ path: require('path').join(__dirname, ".env") });
const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require('nodemailer');
const cors = require('cors');
const PDFDocument = require('pdfkit');

const connectDB = require("./models/db");
const User = require("./models/User");
const ClassNote = require("./models/ClassNote");
const OfferLetter = require("./models/OfferLetter");
const QRCode = require('qrcode');

const Coupon = require("./models/Coupon");
const Course = require("./models/Course");
const Order = require("./models/Order");
const Certificate = require("./models/Certificate");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "genius_coding_academy_secret_key";

// Connect to MongoDB
connectDB();

// CORS Configuration
app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// JWT Verification Middleware
const checkAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided", type: "error" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token", type: "error" });
  }
};

// --- AUTH ROUTES ---

app.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, username, email, password, confirmPassword } = req.body;
    if (!username || !email || !password) return res.status(400).json({ message: "Missing fields" });

    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ message: "Username exists" });

    const existingEmail = await User.findOne({ email });
    if (existingEmail) return res.status(400).json({ message: "Email exists" });

    if (password !== confirmPassword) return res.status(400).json({ message: "Passwords mismatch" });

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({ firstName, lastName, username, email, password: hashedPassword });
    return res.status(201).json({ message: "Registration successful!", type: "success" });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { role, username, password } = req.body;
    const user = await User.findOne({ $or: [{ username }, { email: username }] });

    if (user && (await bcrypt.compare(password, user.password))) {
      let finalRole = "user";
      if (role === 'admin') {
        if (req.body.SECURITY_CODE != process.env.SECURITY_CODE) {
          return res.status(401).json({ message: "Wrong security code" });
        }
        finalRole = "admin";
      }

      const token = jwt.sign({ id: user._id, role: finalRole, username: user.username }, JWT_SECRET, { expiresIn: "24h" });
      return res.status(200).json({ token, user: { id: user._id, firstName: user.firstName, lastName: user.lastName, username: user.username, email: user.email, role: finalRole }, message: "Logged in" });

    }
    res.status(401).json({ message: "Invalid credentials" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// --- PUBLIC DATA ---

app.get("/api/courses", async (req, res) => {
  try {
    const courses = await Course.find().sort({ createdAt: -1 });
    res.status(200).json(courses);
  } catch (err) { res.status(500).json({ message: "Error" }); }
});

// --- ADMIN DATA & MANAGEMENT ---

app.get("/api/admin-data", checkAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: "Denied" });
  try {
    const classnotes = await ClassNote.find().populate('course').sort({ order: 1, createdAt: 1 });



    const users = await User.find().populate('purchasedCourses.course').select("-password");

    const coupons = await Coupon.find().populate('course').sort({ createdAt: -1 });

    const courses = await Course.find().sort({ createdAt: -1 });
    const orders = await Order.find().populate('user').populate('courses').sort({ createdAt: -1 });
    const certificates = await Certificate.find().populate('user').sort({ createdAt: -1 });
    res.status(200).json({ users, classnotes, coupons, courses, orders, certificates });
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
});

// Course Management (Admin)
app.post("/api/admin/courses", checkAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
  try {
    const course = new Course(req.body);
    await course.save();
    res.status(201).json({ message: "Course added" });
  } catch (err) { res.status(500).json({ message: "Error adding course" }); }
});

app.post("/api/admin/edit-course/:id", checkAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
  try {
    await Course.findByIdAndUpdate(req.params.id, req.body);
    res.status(200).json({ message: "Course updated" });
  } catch (err) { res.status(500).json({ message: "Error updating course" }); }
});

app.post("/api/admin/delete-course/:id", checkAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
  try {
    await Course.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Course deleted" });
  } catch (err) { res.status(500).json({ message: "Error deleting course" }); }
});

app.post('/addClassNote', checkAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
  try {
    const newNote = new ClassNote(req.body);
    await newNote.save();
    res.status(201).json({ message: "Note added" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Error" });
  }
});

app.post('/editClassNote/:id', checkAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
  try {
    await ClassNote.findByIdAndUpdate(req.params.id, req.body);
    res.status(200).json({ message: "Note updated" });
  } catch (err) { res.status(500).json({ message: "Error" }); }
});

app.post('/deleteClassNote/:id', checkAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
  try {
    await ClassNote.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Note deleted" });
  } catch (err) { res.status(500).json({ message: "Error" }); }
});

app.post('/api/admin/toggle-lock-note/:id', checkAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
  try {
    const note = await ClassNote.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });
    note.locked = !note.locked;
    await note.save();
    res.status(200).json({ message: "Lock status updated", locked: note.locked });
  } catch (err) { res.status(500).json({ message: "Error" }); }
});

app.post('/api/admin/reorder-notes', checkAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
  try {
    const { orderList } = req.body; // Array of { id, order }
    const updatePromises = orderList.map(item =>
      ClassNote.findByIdAndUpdate(item.id, { order: item.order })
    );
    await Promise.all(updatePromises);
    res.status(200).json({ message: "Order updated" });
  } catch (err) { res.status(500).json({ message: "Error reordering notes" }); }
});


app.post("/updateAccess", checkAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
  try {
    const { userId, courseId, status } = req.body;

    if (!courseId) return res.status(400).json({ message: "Course ID is required" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const courseIdx = user.purchasedCourses.findIndex(c => c.course && c.course.toString() === courseId);
    if (courseIdx !== -1) {
      user.purchasedCourses[courseIdx].status = status;
    } else {
      user.purchasedCourses.push({ course: courseId, status: status });
    }
    await user.save();


    res.status(200).json({ message: "Access updated" });
  } catch (err) { res.status(500).json({ message: "Error updating access" }); }
});


// --- COUPON ROUTES ---

app.post("/api/admin/coupons", checkAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
  try {
    const { code, discount, course } = req.body;
    const coupon = new Coupon({
      code: code.toUpperCase(),
      discount,
      course: course || null
    });
    await coupon.save();
    res.status(201).json({ message: "Coupon created", coupon });
  } catch (err) { res.status(500).json({ message: "Error create coupon" }); }
});

app.post("/api/admin/edit-coupon/:id", checkAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
  try {
    const { code, discount, course } = req.body;
    await Coupon.findByIdAndUpdate(req.params.id, {
      code: code.toUpperCase(),
      discount,
      course: course || null
    });
    res.status(200).json({ message: "Coupon updated" });
  } catch (err) { res.status(500).json({ message: "Error updating coupon" }); }
});


app.post("/api/admin/delete-coupon/:id", checkAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Coupon deleted" });
  } catch (err) { res.status(500).json({ message: "Error delete coupon" }); }
});

app.post("/api/validate-coupon", async (req, res) => {
  try {
    const { code, cartCourseIds } = req.body;
    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

    if (!coupon) return res.status(404).json({ message: "Invalid or expired coupon" });

    // If coupon is course-wise, check if that course is in cart
    if (coupon.course) {
      if (!cartCourseIds || !cartCourseIds.includes(coupon.course.toString())) {
        return res.status(400).json({ message: "Coupon not applicable to courses in cart" });
      }
    }

    res.status(200).json({ id: coupon._id, discount: coupon.discount });
  } catch (err) { res.status(500).json({ message: "Error" }); }
});


// --- CERTIFICATE ROUTES ---

app.post("/api/admin/certificates", checkAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
  try {
    const { userId, recipientName, type, title, duration, issueDate } = req.body;
    if (!recipientName || !type || !title) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const count = await Certificate.countDocuments();
    const certificateId = `GCA-${today}-${(count + 1).toString().padStart(4, "0")}`;

    const newCertificate = new Certificate({
      user: userId || null,
      recipientName,
      type,
      title,
      duration: duration || null,
      issueDate: issueDate || new Date(),
      certificateId
    });

    await newCertificate.save();
    res.status(201).json({ message: "Certificate created successfully", certificate: newCertificate });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating certificate" });
  }
});

app.post("/api/admin/delete-certificate/:id", checkAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
  try {
    await Certificate.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Certificate deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting certificate" });
  }
});

app.get("/api/public/certificates/:userId", async (req, res) => {
  try {
    const certificates = await Certificate.find({ user: req.params.userId }).sort({ createdAt: -1 });
    const user = await User.findById(req.params.userId).select("firstName lastName username email");
    res.status(200).json({ certificates, user });
  } catch (err) {
    res.status(500).json({ message: "Error fetching certificates" });
  }
});

app.get("/api/public/certificates/verify/:certId", async (req, res) => {
  try {
    const certificate = await Certificate.findOne({ certificateId: req.params.certId.toUpperCase() }).populate('user', 'firstName lastName email username');
    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found or invalid ID" });
    }
    res.status(200).json({ certificate });
  } catch (err) {
    res.status(500).json({ message: "Error verifying certificate" });
  }
});

app.post("/api/admin/send-offer-letter", checkAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
  try {
    const { recipientName, recipientEmail, roleType, jobTitle, startDate, stipendAmount, stipendMonths, compensation, duration } = req.body;
    // For backward compat: use stipendAmount if present, else fallback to compensation
    const stipend = stipendAmount || compensation;
    const months = stipendMonths || duration;
    if (!recipientName || !recipientEmail || !roleType || !jobTitle || !startDate || !stipend) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Generate Offer Letter ID (Uppercase GCA-OL-YYYYMMDD-XXXX)
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    const offerLetterId = `GCA-OL-${datePart}-${randomPart}`;

    // Get origin to build verification link
    const referer = req.headers.referer || "http://127.0.0.1:5500/";
    const origin = new URL(referer).origin;
    const verificationUrl = `${origin}/verify-offer.html?id=${offerLetterId}`;

    // Generate QR code buffer (using margins: 1 to make it fit nicely and brand blue color)
    const qrBuffer = await QRCode.toBuffer(verificationUrl, {
      margin: 1,
      width: 100,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#1e3a8a',  // Brand primary blue
        light: '#ffffff'  // Background
      }
    });

    // Save record to DB
    const newOffer = new OfferLetter({
      offerLetterId,
      recipientName,
      recipientEmail,
      roleType,
      jobTitle,
      startDate,
      stipendAmount: stipend,
      stipendMonths: months || undefined
    });
    await newOffer.save();

    const issueDate = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
    const formattedStartDate = new Date(startDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

    // ── 1. Generate PDF in memory ──────────────────────────────────────────────
    const pdfBuffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 60 });
      const buffers = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const pageW = doc.page.width;
      const margin = 60;
      const contentW = pageW - margin * 2;

      // ── Header / Letterhead ──────────────────────────────────────────────────
      const logoPath = path.join(__dirname, "../frontend/images/logo1.png");
      const fs = require('fs');

      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, margin, 55, { width: 45 });
        // Title text to the right
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#1e3a8a').text('GENIUS CODING ACADEMY', margin + 55, 60);
        doc.fontSize(9).font('Helvetica').fillColor('#64748b').text('contact.geniuscodingacademy@gmail.com', margin + 55, 78);
      } else {
        doc
          .fontSize(18)
          .font('Helvetica-Bold')
          .fillColor('#1e3a8a')
          .text('GENIUS CODING ACADEMY', margin, 60, { align: 'center', width: contentW });

        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor('#64748b')
          .text('contact.geniuscodingacademy@gmail.com', margin, 84, { align: 'center', width: contentW });
      }

      // Divider line
      doc.moveTo(margin, 115).lineTo(pageW - margin, 115).strokeColor('#1e3a8a').lineWidth(2).stroke();
      doc.moveTo(margin, 119).lineTo(pageW - margin, 119).strokeColor('#06b6d4').lineWidth(0.5).stroke();

      // ── Document Title ───────────────────────────────────────────────────────
      doc
        .fontSize(13)
        .font('Helvetica-Bold')
        .fillColor('#1e3a8a')
        .text('OFFER LETTER', margin, 135, { align: 'center', width: contentW, underline: false });

      // ── Date & Ref ───────────────────────────────────────────────────────────
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#475569')
        .text(`Date: ${issueDate}`, margin, 165);

      // ── Salutation ───────────────────────────────────────────────────────────
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text(`Dear ${recipientName},`, margin, 195);

      // ── Opening paragraph ────────────────────────────────────────────────────
      doc
        .moveDown(0.8)
        .fontSize(10.5)
        .font('Helvetica')
        .fillColor('#334155')
        .text(
          `We are pleased to offer you the position of ${jobTitle} (${roleType}) at Genius Coding Academy. ` +
          `After reviewing your profile, we are confident that your skills and enthusiasm will be a great asset to our team.`,
          { align: 'justify', lineGap: 3 }
        );

      // ── Details table ────────────────────────────────────────────────────────
      doc.moveDown(1.5);
      const tableTop = doc.y;
      const col1 = margin;
      const col2 = margin + 200;
      const rowH = 26;

      // Build stipend display value
      const stipendLabel = roleType === 'Internship' ? 'Internship Stipend' : 'Compensation';
      const stipendValue = roleType === 'Internship' && months
        ? `Rs. ${stipend} per month only for ${months} months`
        : `Rs. ${stipend} per month`;

      const rows = [
        ['Offer ID', offerLetterId],
        ['Position', jobTitle],
        ['Role Type', roleType],
        ['Start Date', formattedStartDate],
        [stipendLabel, stipendValue],
      ];

      rows.forEach((row, i) => {
        const y = tableTop + i * rowH;
        if (i % 2 === 0) {
          doc.rect(col1, y, contentW, rowH).fillColor('#f0f7ff').fill();
        }
        doc
          .fillColor('#1e3a8a')
          .fontSize(9.5)
          .font('Helvetica-Bold')
          .text(row[0], col1 + 10, y + 8, { width: 180 });
        doc
          .fillColor('#334155')
          .font('Helvetica')
          .fontSize(9.5)
          .text(row[1], col2, y + 8, { width: contentW - 210 });
      });

      // Border around table
      doc
        .rect(col1, tableTop, contentW, rows.length * rowH)
        .strokeColor('#cbd5e1')
        .lineWidth(0.75)
        .stroke();

      // Reset cursor position
      doc.x = col1;
      doc.y = tableTop + rows.length * rowH;

      // ── Body paragraphs ──────────────────────────────────────────────────────
      doc.moveDown(1.8);
      doc
        .fontSize(10.5)
        .font('Helvetica')
        .fillColor('#334155')
        .text(
          'We expect you to join us on the date mentioned above. Please bring the required documents on your first day. ' +
          'This offer is subject to your acceptance and fulfilment of any conditions mentioned herein.',
          { align: 'justify', lineGap: 3 }
        );

      doc
        .moveDown(1)
        .text(
          'Kindly sign and return a copy of this letter as a token of your acceptance of the above terms and conditions.',
          { align: 'justify', lineGap: 3 }
        );

      doc
        .moveDown(1)
        .text('We look forward to your joining and wish you a successful career at Genius Coding Academy.', { lineGap: 3 });

      // ── Signature block ──────────────────────────────────────────────────────
      doc.moveDown(2.5);
      const sigTop = doc.y;

      // Draw the QR Code on the right-hand side of the signature block
      const qrW = 75;
      const qrX = pageW - margin - qrW;
      doc.rect(qrX - 2, sigTop - 2, qrW + 4, qrW + 4).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      doc.image(qrBuffer, qrX, sigTop, { width: qrW });
      doc
        .fontSize(7.5)
        .font('Helvetica-Bold')
        .fillColor('#1e3a8a')
        .text('VERIFY OFFER', qrX - 10, sigTop + qrW + 6, { width: qrW + 20, align: 'center' });
      doc
        .fontSize(6.5)
        .font('Helvetica')
        .fillColor('#64748b')
        .text('Scan with phone camera', qrX - 15, sigTop + qrW + 16, { width: qrW + 30, align: 'center' });

      // Draw the textual signature block on the left
      doc
        .font('Helvetica')
        .fontSize(10.5)
        .fillColor('#334155')
        .text("Yours faithfully,", col1, sigTop);
      doc.moveDown(0.8);
      doc
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text('HR Team', col1);
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#64748b')
        .text('Genius Coding Academy', col1);

      // ── Footer ───────────────────────────────────────────────────────────────
      const footerY = doc.page.height - 50;
      doc
        .moveTo(margin, footerY - 8).lineTo(pageW - margin, footerY - 8)
        .strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#94a3b8')
        .text(
          'This is a digitally verified confidential document. Authentic copies can be verified online.',
          margin, footerY, { align: 'center', width: contentW }
        );

      doc.end();
    });

    // ── 2. Build plain covering email (no colors, no HTML tricks) ─────────────
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    // First name only for the greeting
    const firstName = recipientName.split(' ')[0];

    const plainText =
      `Dear ${firstName},\n\n` +
      `I am pleased to offer you the position of "${jobTitle}" at Genius Coding Academy.\n\n` +
      `Please find the offer letter attached with this email. Kindly go through it and revert with your acceptance at the earliest.\n\n` +
      `Looking forward to having you on the team.\n\n` +
      `Kind Regards,\n` +
      `HR Team\n` +
      `Genius Coding Academy`;

    const mailOptions = {
      from: `"Genius Coding Academy" <${process.env.EMAIL_USER}>`,
      replyTo: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: `Offer Letter – ${jobTitle} | Genius Coding Academy`,
      text: plainText,          // plain-text only = best inbox delivery
      attachments: [
        {
          filename: `Offer_Letter_${recipientName.replace(/\s+/g, '_')}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Offer letter sent successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send offer letter email" });
  }
});

// Verification endpoint for Offer Letters
app.get("/api/public/offer-letters/verify/:id", async (req, res) => {
  try {
    const offer = await OfferLetter.findOne({ offerLetterId: req.params.id.toUpperCase() });
    if (!offer) {
      return res.status(404).json({ message: "Offer letter not found" });
    }
    res.status(200).json({ offer });
  } catch (err) {
    res.status(500).json({ message: "Error verifying offer letter" });
  }
});

// --- CHECKOUT ROUTE ---


app.post("/api/checkout", checkAuth, async (req, res) => {
  try {
    const { courses, totalAmount, discountAmount, finalAmount, couponCode } = req.body;

    // Final check: Amount must be 0 for automatic success as requested
    if (finalAmount > 0) {
      return res.status(400).json({ message: "Checkout only allowed for free/fully discounted courses currently." });
    }

    let couponId = null;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
      if (coupon) couponId = coupon._id;
    }

    const newOrder = new Order({
      user: req.user.id,
      courses: courses,
      totalAmount,
      discountAmount,
      finalAmount,
      couponUsed: couponId,
      status: "approved" // Automatic approval since finalAmount is 0
    });

    await newOrder.save();

    // Add courses to user account as "locked" initially
    const user = await User.findById(req.user.id);
    courses.forEach(id => {
      if (!user.purchasedCourses.find(c => c.course && c.course.toString() === id)) {
        user.purchasedCourses.push({ course: id, status: "locked" });
      }
    });
    await user.save();


    res.status(200).json({ message: "Order placed successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error during checkout" });
  }
});

// --- USER ROUTES ---

app.get("/api/dashboard-data", checkAuth, async (req, res) => {
  try {
    const classnotes = await ClassNote.find().populate('course').sort({ order: 1, createdAt: 1 });


    const userFromDb = await User.findById(req.user.id).populate('purchasedCourses.course').select("-password");
    const certificates = await Certificate.find({ user: req.user.id }).sort({ createdAt: -1 });

    res.status(200).json({ user: userFromDb, classnotes, certificates });
  } catch (err) { res.status(500).json({ message: "Error" }); }
});

app.post("/contact", async (req, res) => {
  try {
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
    await transporter.sendMail({ from: req.body.email, to: process.env.EMAIL_USER, subject: `Message from ${req.body.name}`, text: req.body.message });
    res.status(200).json({ message: "Sent" });
  } catch (error) { res.status(500).json({ message: "Failed" }); }
});

app.post("/update-profile", checkAuth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.user.id, { firstName: req.body.firstName, lastName: req.body.lastName }, { new: true });
    res.status(200).json({ message: "Updated", user });
  } catch (error) { res.status(500).json({ message: "Error" }); }
});

app.post("/updatePassword", checkAuth, async (req, res) => {
  try {
    const targetUserId = (req.user.role === 'admin' && req.body.userId) ? req.body.userId : req.user.id;
    const hashedPassword = await bcrypt.hash(req.body.newPassword, 10);
    await User.findByIdAndUpdate(targetUserId, { password: hashedPassword });
    res.status(200).json({ message: "Password updated" });
  } catch (err) { res.status(500).json({ message: "Error" }); }
});

app.listen(PORT, () => console.log(`JWT Server running on port : ${PORT}`));
