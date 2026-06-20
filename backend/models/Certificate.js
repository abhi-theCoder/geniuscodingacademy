const mongoose = require("mongoose");

const CertificateSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    recipientName: { type: String, required: true },
    type: { type: String, enum: ["course", "internship"], required: true },
    title: { type: String, required: true }, // e.g. "React JS Course" or "Web Development Internship"
    issueDate: { type: Date, default: Date.now },
    duration: { type: String }, // e.g. "3 Months" (optional, useful for internships)
    certificateId: { type: String, unique: true, required: true } // e.g. GCA-YYYYMMDD-XXXX
}, { timestamps: true });

module.exports = mongoose.model("Certificate", CertificateSchema);
