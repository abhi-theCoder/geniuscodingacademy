const mongoose = require("mongoose");

const ClassNoteSchema = new mongoose.Schema({
  day: { type: String, required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  notes: { type: String, required: true },
  homework: { type: String },
  pdfLink: { type: String },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});


module.exports = mongoose.model("ClassNote", ClassNoteSchema);
