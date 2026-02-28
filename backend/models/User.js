const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    // courseAccess: [{ courseId: ObjectId, status: "locked"/"accessed" }]
    purchasedCourses: [{
        course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
        status: { type: String, enum: ["locked", "accessed", "approved"], default: "locked" }
    }]

});


module.exports = mongoose.model("User", UserSchema);