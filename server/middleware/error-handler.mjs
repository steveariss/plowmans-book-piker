export function errorHandler(err, req, res, _next) {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message);
  res.status(500).json({ error: 'Internal server error' });
}
