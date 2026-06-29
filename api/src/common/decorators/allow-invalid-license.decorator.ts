import { SetMetadata } from '@nestjs/common';

export const ALLOW_INVALID_LICENSE_KEY = 'allowInvalidLicense';

/**
 * Marks a handler/controller as reachable even when the tenant's license is
 * invalid (expired/suspended). Use for endpoints the client needs to render a
 * "license problem" state or recover — e.g. profile, capabilities, logout.
 */
export const AllowInvalidLicense = () => SetMetadata(ALLOW_INVALID_LICENSE_KEY, true);
