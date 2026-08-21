import type { NextFunction, Request, Response } from "express";
import type { OrganizationRole } from "../shared/tenancy.js";

export function requireOrganizationRole(...allowedRoles: OrganizationRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.organization) return res.status(401).json({ message: "Organization context required" });
    if (req.organization.role !== "platform_admin" && !allowedRoles.includes(req.organization.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    return next();
  };
}
