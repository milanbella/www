import { getEnvironment } from './environments/environment';

export function getCouchClientDbName(clientId: number): string {
	if (getEnvironment().couchDbIsTest) {
		return `tenant_${clientId}${getEnvironment().couchDbNameTestSuffix}`;
	} else {
		return `tenant_${clientId}`;
	}
}

export function getCouchAdminDbName(clientId: number): string {
	return getCouchClientDbName(clientId);
}
