import { SetMetadata } from '@nestjs/common';
import { Permission } from '../auth/permissions';

export const PERMISSIONS_KEY = 'permissions';
/** Requires ALL listed permissions. */
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);
