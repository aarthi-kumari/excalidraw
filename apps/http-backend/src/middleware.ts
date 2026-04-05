import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";

declare global {
  namespace Express {
    interface Request {
      userId?: string | number;
    }
  }
}
export function middleware(req: Request, res: Response, next: NextFunction) {
  const authorizationHeader = req.headers["authorization"] ?? "";
  const token = authorizationHeader.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length)
    : authorizationHeader;

  if (!token) {
    res.status(403).json({
      message: "Unauthorized"
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;

    if (!decoded.userId) {
      res.status(403).json({
        message: "Unauthorized"
      });
      return;
    }

    req.userId = decoded.userId;
    next();
  } catch {
    res.status(403).json({
        message: "Unauthorized"
    });
  }
}
