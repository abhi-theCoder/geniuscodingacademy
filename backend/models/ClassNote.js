const mongoose = require("mongoose");

const ClassNoteSchema = new mongoose.Schema({ 
  day: { type: String, required: true, unique: true },
  notes: { type: String, required: true },
  homework: { type: String},
  pdfLink: {type: String},
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ClassNote", ClassNoteSchema);

