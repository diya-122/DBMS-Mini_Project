const { ActivityLog, Notification } = require('../models');

// Fire-and-forget helpers: a MongoDB hiccup must never break the main (PostgreSQL) transaction.
async function logActivity(user, action, entity, entityId, details = {}) {
  try {
    await ActivityLog.create({ userId: user?.id, role: user?.role, action, entity, entityId, details });
  } catch (e) { console.error('[log]', e.message); }
}

async function notify(userId, title, message, type = 'info') {
  try {
    await Notification.create({ userId, title, message, type });
  } catch (e) { console.error('[notify]', e.message); }
}

module.exports = { logActivity, notify };
