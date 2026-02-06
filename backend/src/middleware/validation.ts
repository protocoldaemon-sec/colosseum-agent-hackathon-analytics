import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

// Validation error handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }
  next();
};

// Common validators
export const validatePagination = [
  query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt(),
  handleValidationErrors
];

export const validatePostId = [
  param('postId').isInt({ min: 1 }).toInt(),
  handleValidationErrors
];

export const validateAgentIdentifier = [
  param('identifier').notEmpty().trim().escape(),
  handleValidationErrors
];

export const validateChatMessage = [
  body('message').notEmpty().trim().isLength({ min: 1, max: 5000 }),
  body('sessionId').optional().isUUID(),
  handleValidationErrors
];

export const validateSearchQuery = [
  body('query').notEmpty().trim().isLength({ min: 1, max: 500 }),
  handleValidationErrors
];

export const validateAgentName = [
  body('agentName').notEmpty().trim().isLength({ min: 1, max: 200 }),
  handleValidationErrors
];

export const validateDays = [
  query('days').optional().isInt({ min: 1, max: 365 }).toInt(),
  handleValidationErrors
];

export const validateTags = [
  query('tags').optional().isString(),
  handleValidationErrors
];

export const validateSort = [
  query('sort').optional().isIn(['hot', 'new', 'top', 'recent', 'pure', 'human']),
  handleValidationErrors
];

export const validateType = [
  query('type').optional().isIn(['post', 'comment', 'all']),
  handleValidationErrors
];
