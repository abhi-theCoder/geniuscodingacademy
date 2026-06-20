const mongoose = require('mongoose');

const OfferLetterSchema = new mongoose.Schema({
  offerLetterId: { type: String, required: true, unique: true },
  recipientName: { type: String, required: true },
  recipientEmail: { type: String, required: true },
  roleType: { type: String, required: true },
  jobTitle: { type: String, required: true },
  startDate: { type: Date, required: true },
  stipendAmount: { type: Number, required: true },
  stipendMonths: { type: Number },
  issueDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('OfferLetter', OfferLetterSchema);
