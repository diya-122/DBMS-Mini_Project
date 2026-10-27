const jwt = require('jsonwebtoken');

// auth()                -> any logged-in user
// auth(['admin'])       -> only these roles
module.exports = function auth(roles = []) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Login required' });
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    } catch {
      return res.status(401).json({ error: 'Session expired, please login again' });
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission for this action' });
    }
    next();
  };
};
