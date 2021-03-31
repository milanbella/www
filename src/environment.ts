import { getEnvironment } from './environments/environment';

export function webservice_url() {
	return getEnvironment().backendRestApiUrl;
}

export function restapi_url() {
	let environment = getEnvironment();
	if (environment.apiHost) {
		if (environment.apiPathRest) {
			if (environment.apiPathRest.endsWith('/')) {
				throw new Error('environments/environtment.ts: apiPathRest cannot end with /');
			}
			if (!environment.apiPathRest.startsWith('/')) {
				throw new Error('environments/environtment.ts: apiPathRest must start with /');
			}
			return `https://${environment.apiHost}${environment.apiPathRest}`;
		} else {
			throw new Error('environments/environtment.ts: apiPathRest not set');
		}
	} else {
		return environment.backendModelRestApiUrl;
	}
}

export function oauth_url() {
	let environment = getEnvironment();
	if (environment.apiHost) {
		if (environment.apiPathAuth) {
			if (environment.apiPathAuth.endsWith('/')) {
				throw new Error('environments/environtment.ts: apiPathAuth cannot end with /');
			}
			if (!environment.apiPathAuth.startsWith('/')) {
				throw new Error('environments/environtment.ts: apiPathAuth must start with /');
			}
			return `https://${environment.apiHost}${environment.apiPathAuth}`;
		} else {
			throw new Error('environments/environtment.ts: apiPathAuth not set');
		}
	} else {
		return getEnvironment().oauthServerUrl;
	}
}

export function oauth_client_id() {
	return getEnvironment().oauthClientId;
}

export function status_url() {
	let environment = getEnvironment();
	if (environment.apiHost) {
		if (environment.apiPathStatus) {
			if (environment.apiPathStatus.endsWith('/')) {
				throw new Error('environments/environtment.ts: apiPathStatus cannot end with /');
			}
			if (!environment.apiPathStatus.startsWith('/')) {
				throw new Error('environments/environtment.ts: apiPathStatus must start with /');
			}
			return `https://${environment.apiHost}${environment.apiPathStatus}`;
		} else {
			throw new Error('environments/environtment.ts: apiPathStatus not set');
		}
	} else {
		return `${getEnvironment().backendRestApiUrl}/status`;
	}
}
