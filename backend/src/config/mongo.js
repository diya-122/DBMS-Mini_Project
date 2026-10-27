const mongoose = require('mongoose');

async function connectMongo() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/scholarship_nosql';
  await mongoose.connect(uri);
  console.log('[MongoDB] connected');
}

module.exports = connectMongo;
