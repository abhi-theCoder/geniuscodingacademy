const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({ 
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    access: { type: String, enum: ["pending", "accessed"], default: "pending" } // New field for access control
});

module.exports = mongoose.model("User", UserSchema);
