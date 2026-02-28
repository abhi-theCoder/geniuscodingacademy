require("dotenv").config({ path: require('path').join(__dirname, ".env") });
const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require('nodemailer');
const cors = require('cors');

const connectDB = require("./models/db");
const User = require("./models/User");
const ClassNote = require("./models/ClassNote");

const Coupon = require("./models/Coupon");
const Course = require("./models/Course");
const Order = require("./models/Order");

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
        if (req.body.security_code != process.env.security_code) {
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
    res.status(200).json({ users, classnotes, coupons, courses, orders });
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

    res.status(200).json({ user: userFromDb, classnotes });
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
