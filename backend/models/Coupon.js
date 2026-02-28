const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    discount: { type: Number, required: true }, // e.g. 10 for 10%
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null }, // Null means all courses (optional)
    isActive: { type: Boolean, default: true }

}, { timestamps: true });

module.exports = mongoose.model("Coupon", couponSchema);
