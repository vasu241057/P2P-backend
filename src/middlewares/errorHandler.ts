// src/middlewares/errorHandler.ts

import { ErrorRequestHandler, NextFunction, Request, Response } from "express";

const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the error (you can use a more robust logging library like Winston or Pino in production)
  console.error(err);

  // Determine the HTTP status code based on the error type or message (you'll likely need to customize this)
  let statusCode = 500; // Default to Internal Server Error
  if (err.message.includes("not found")) {
    statusCode = 404; // Not Found
  } else if (err.message.includes("validation failed")) {
    statusCode = 400; // Bad Request
  }

  // Send a JSON error response to the client
  res.status(statusCode).json({
    error: {
      message: err.message || "An unexpected error occurred",
      // You can include additional details like error codes or stack traces in development environments
      // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    },
  });
};

export { errorHandler };
