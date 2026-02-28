const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    image: { type: String, required: true },
    category: { type: String, required: true } // e.g. "School", "College"
}, { timestamps: true });

module.exports = mongoose.model("Course", courseSchema);
