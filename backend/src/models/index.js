const mongoose = require('mongoose');
const { Schema } = mongoose;

// Flexible, schema-light data that does not fit neatly into relational tables.
// `scholarshipId`, `userId` etc. are the primary keys from PostgreSQL (the link between both databases).

// 1. Rich / unstructured scholarship details (tags, FAQs, steps, links)
const ScholarshipExtra = mongoose.model('ScholarshipExtra', new Schema({
  scholarshipId: { type: Number, unique: true, index: true },
  tags: [String],
  howToApply: [String],
  faqs: [{ q: String, a: String }],
  links: [{ label: String, url: String }],
  tips: [String],
  extra: Schema.Types.Mixed,            // any provider-specific attributes
}, { timestamps: true }));

// 2. Student reviews / feedback on scholarships
const Review = mongoose.model('Review', new Schema({
  scholarshipId: { type: Number, index: true },
  userId: Number,
  studentName: String,
  rating: { type: Number, min: 1, max: 5 },
  comment: String,
}, { timestamps: true }));

// 3. Activity / audit log (who did what, when) - high-volume append-only data
const ActivityLog = mongoose.model('ActivityLog', new Schema({
  userId: Number,
  role: String,
  action: { type: String, index: true },
  entity: String,
  entityId: Number,
  details: Schema.Types.Mixed,
}, { timestamps: true }));

// 4. In-app notifications
const Notification = mongoose.model('Notification', new Schema({
  userId: { type: Number, index: true },
  title: String,
  message: String,
  type: { type: String, default: 'info' },
  read: { type: Boolean, default: false },
}, { timestamps: true }));

module.exports = { ScholarshipExtra, Review, ActivityLog, Notification };
