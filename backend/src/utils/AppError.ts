export type ValidationIssue = {
  path: string;
  message: string;
};

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: ValidationIssue[];

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: ValidationIssue[],
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    if (details && details.length > 0) {
      this.details = details;
    }
  }
}
