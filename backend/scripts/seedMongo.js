// Loads the NoSQL sample data into MongoDB:  cd backend && npm run db:seed-mongo
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { ScholarshipExtra, Review, ActivityLog, Notification } = require('../src/models');

(async () => {
  const data = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', '..', 'database', 'mongodb', 'seed_data.json'), 'utf8'));
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/scholarship_nosql');
  await Promise.all([ScholarshipExtra.deleteMany({}), Review.deleteMany({}), ActivityLog.deleteMany({}), Notification.deleteMany({})]);
  await ScholarshipExtra.insertMany(data.scholarship_extras);
  await Review.insertMany(data.reviews);
  await Notification.insertMany(data.notifications);
  await ScholarshipExtra.syncIndexes(); await ActivityLog.syncIndexes();
  console.log('MongoDB seeded:', data.scholarship_extras.length, 'scholarship extras,',
              data.reviews.length, 'reviews,', data.notifications.length, 'notifications');
  await mongoose.disconnect();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
