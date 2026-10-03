const logger = require('../logger');

function errorHandlerMiddleware(err, req, res, next) {
  logger.error({
    err: {
      message: err.message,
      stack: err.stack,
      name: err.name,
    },
    requestId: req.id,
    path: req.originalUrl,
    method: req.method,
  }, 'Unhandled HTTP request error');

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.code || 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected internal error occurred.',
    requestId: req.id,
  });
}

module.exports = errorHandlerMiddleware;
