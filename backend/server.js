require("dotenv").config({ path: "./.env" });

const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const session = require("express-session") ;
const nodemailer = require('nodemailer');
const connectDB = require("./models/db");
const User = require("./models/User");
const ClassNote = require("../backend/models/ClassNote");

const app = express();
const PORT = process.env.PORT || 3000;  

// Connect to MongoDB
connectDB();
 
// Middleware
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(express.static("../frontend"));

app.use(
  session({
    secret: "SESSION_SECRET",
    resave: false,
    saveUninitialized: true,
  })
);
 
// Middleware to check authentication
const checkAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/login"); 
  }
  next();
};

// Routes
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
  });

app.get("/register", (req, res) => {
  res.render("register",{ message:null });
});

app.post("/register", async (req, res) => {
  try {
      const { firstName, lastName, username, email, password, confirmPassword } = req.body;

      // Check if the username is already taken
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.render("register", { message: "Username already exists", type: "error" });
      }

      // Check if the passwords match
      if (password !== confirmPassword) {
          return res.render("register", { message: "Passwords do not match", type: "error" });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create a new user
      await User.create({ firstName, lastName, username, email, password: hashedPassword });

      // Redirect to login page with a success message
      return res.render("login", { message: "Registration successful! Please log in.", type: "success" });

  } catch (error) {
      console.error("Registration Error:", error);
      res.status(500).send("Internal Server Error");
  }
});

app.get("/login", async(req, res) => {
  if(!req.session.user)
  return res.render("login", {message : null});

  const classnotes = await ClassNote.find();
  res.render("dashboard", { user: req.session.user, classnotes, message:null });
});
 
app.post("/login", async (req, res) => {
  const { role, username, password } = req.body;

  // Find user by username OR email
  const user = await User.findOne({ $or: [{ username }, { email: username }] });
  
  if (user && (await bcrypt.compare(password, user.password))) {
    req.session.user = user;

    if(role === 'admin'){
      const {security_code} = req.body; 
      // console.log(security_code+" "+process.env.security_code);
      if(security_code != process.env.security_code)
        return res.render("login",{ message : "Wrong security code entered" , type : "error" });
      else{
        const classnotes = await ClassNote.find();
        // Fetch users and class notes for admin
        const users = await User.find();
        return res.render("admin",{user: req.session.user, users, classnotes, message:"Successfully Logged in"});
      }
    }
    
    const classnotes = await ClassNote.find();

    return res.render("dashboard",{user: req.session.user, classnotes, message:"Successfully Logged in"});
  }
  
  res.render("login",{ message : "Bad Credentials" , type : "error" });
});

app.get("/admin", checkAuth, async(req,res)=>{
  const classnotes = await ClassNote.find();
  // Fetch users and class notes for admin
  const users = await User.find();
  return res.render("admin",{user: req.session.user, users, classnotes, message:"Successfully Logged in"});
})
 

app.get("/contact", (req,res)=>{
  res.render('contact',{ message : null });
})
app.get("/dashboard", checkAuth, async(req, res) => {
  const classnotes = await ClassNote.find();
  res.render("dashboard", { user: req.session.user, classnotes, message:null });
});

app.post("/contact", async (req, res) => {
  const { name, email, phone, subject, message } = req.body;

      // Nodemailer Transporter Setup
      let transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS,
          },
      });

      // Email Options
      let mailOptions = {
          from: process.env.EMAIL_USER,
          to: "abhishekkumarmahto20000@gmail.com", // Change to the recipient's email
          subject: `New Contact Form Submission: ${subject}`,
          text: `You have a new message from:

    Name: ${name}
    Email: ${email}
    Phone: ${phone}

    Message:
    ${message}`,
  };

  try {
      await transporter.sendMail(mailOptions);
      return res.render("contact",{message: "Email Sent Successfully!", type: "success"});
  } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ success: false, message: "Email sending failed." });
  }
});

// Admin Dashboard - Show Class Notes
app.get('/admin-dashboard', async (req, res) => {
  try {
      const classnotes = await ClassNote.find();
      res.render('admin', { classnotes });
  } catch (err) {
      console.error(err);
      res.send("Error loading dashboard");
  }
});

// Add Class Note
app.post('/addClassNote', async (req, res) => {
  try {
      const newNote = new ClassNote({
          day: req.body.day,
          notes: req.body.notes,
          homework: req.body.homework,
          pdfLink: req.body.pdfLink
      });
      await newNote.save();
      res.redirect('/admin-dashboard');
  } catch (err) {
      console.error(err);
      res.redirect('/admin-dashboard');
  }
});

// Show Edit Class Note Form
app.get('/editClassNote/:id', async (req, res) => {
  try {
      const note = await ClassNote.findById(req.params.id);
      res.render('editClassNote', { note });
  } catch (err) {
      console.error(err);
      res.redirect('/admin-dashboard');
  }
});

// Update Class Note
app.post('/editClassNote/:id', async (req, res) => {
  try {
      await ClassNote.findByIdAndUpdate(req.params.id, {
          day: req.body.day,
          notes: req.body.notes,
          homework: req.body.homework,
          pdfLink : req.body.pdfLink
      });
      res.redirect('/admin-dashboard');
  } catch (err) {
      console.error(err);
      res.redirect('/admin-dashboard');
  }
});

// Delete Class Note
app.post('/deleteClassNote/:id', async (req, res) => {
  try {
      await ClassNote.findByIdAndDelete(req.params.id);
      res.redirect('/admin-dashboard');
  } catch (err) {
      console.error(err);
      res.redirect('/admin-dashboard');
  } 
});

// Update profile 
app.post("/update-profile", async (req, res) => {
  try {
      const { firstName, lastName, username, email } = req.body;

      // Ensure the user exists
      let user = await User.findOne({ username });
      if (!user) {
          return res.status(404).send("User not found");
      }

      // Update the user's details
      user.firstName = firstName;
      user.lastName = lastName;

      await user.save();
      const classnotes = await ClassNote.find();
      res.render("dashboard", { user, classnotes, message: "Profile updated successfully!" });
  } catch (error) {
      console.error(error);
      res.status(500).send("Internal Server Error");
  }
});

//updatePassword
app.post("/updatePassword", async (req, res) => {
  const { userId, newPassword } = req.body;
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await User.findByIdAndUpdate(userId, { password: hashedPassword });

  res.redirect("/admin");
});

//updateAccess
app.post("/updateAccess", async (req, res) => {
  const { userId, access } = req.body;

  await User.findByIdAndUpdate(userId, { access });

  res.redirect("/admin");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.listen(PORT, () => console.log(`Server running on port : ${PORT}`));
