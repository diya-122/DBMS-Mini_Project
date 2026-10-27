// Wrap async route handlers so errors reach the error middleware
exports.wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Turn PostgreSQL RAISE EXCEPTION messages (from triggers / procedures) into clean 400 responses
exports.pgMessage = (err) => err.message || 'Database error';
