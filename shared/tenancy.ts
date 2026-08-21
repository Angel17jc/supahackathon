export const platformRoles = ["platform_admin"] as const;
export type PlatformRole = (typeof platformRoles)[number];

export const organizationRoles = ["owner", "manager", "cashier"] as const;
export type OrganizationRole = (typeof organizationRoles)[number];

export const organizationStatuses = ["active", "suspended"] as const;
export type OrganizationStatus = (typeof organizationStatuses)[number];

export const membershipStatuses = ["active", "disabled"] as const;
export type MembershipStatus = (typeof membershipStatuses)[number];
