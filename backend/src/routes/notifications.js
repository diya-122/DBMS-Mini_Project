const router = require('express').Router();
const auth = require('../middleware/auth');
const { wrap } = require('../utils/helpers');
const { Notification } = require('../models');

router.get('/', auth(), wrap(async (req, res) => {
  res.json(await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50).lean());
}));
router.patch('/read-all', auth(), wrap(async (req, res) => {
  await Notification.updateMany({ userId: req.user.id, read: false }, { read: true });
  res.json({ ok: true });
}));
router.patch('/:id/read', auth(), wrap(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, userId: req.user.id }, { read: true });
  res.json({ ok: true });
}));

module.exports = router;
