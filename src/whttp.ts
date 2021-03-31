import { PROJECT_NAME } from './consts';
import { authPrincipal } from './authprincipal';
import { Principal } from './types';
import { pingHttp } from './pinghttp';
import { settings } from './settings';
import { getLogger } from './logger';
import { getExecutionContext } from './executionContext';
import { ERROR_NO_INTERNET_ACCESS } from './errors';
import { fetch } from './fetch';

let logger = getLogger(PROJECT_NAME, 'whttp.ts');

export class Whttp {
	public useInvalidAccessToken: boolean; // just for testing - forces invalid access token be used and consequently retry request using new access token
	// obtained using refresh token

	send(request: any): Promise<any> {
		const FUNC = 'send()';
		let executionContext = getExecutionContext();
		return pingHttp()
			.then(
				() => {
					return authPrincipal.getPrincipal().then((principal: Principal) => {
						return principal;
					});
				},
				() => {
					let err = new Error(ERROR_NO_INTERNET_ACCESS);
					logger.warn(FUNC, 'error: ', err);
					return Promise.reject(err);
				}
			)
			.then((principal: Principal) => {
				let setHttpCredentials = (request: any) => {
					if (this.useInvalidAccessToken) {
						request.headers.set('Authorization', 'Bearer xx');
						this.useInvalidAccessToken = false;
					} else {
						request.headers.set('Authorization', 'Bearer ' + principal.accessToken);
					}
				};

				if (getExecutionContext().isServerSide === false) {
					setHttpCredentials(request);
				}

				return fetch(request.clone()).then((response) => {
					if (response.ok) {
						return response;
					}
					if (response.status === 401 && getExecutionContext().isServerSide === false) {
						if (settings.settings.isDebug) {
							logger.info(FUNC, `http status 401 unauthorized: ${request.url} ${request.method}`);
						}
						logger.info(FUNC, `status: 401 unauthorized: attempting to refresh token ...`);

						return authPrincipal.refreshToken().then(
							() => {
								return this.send(request.clone()); // resend request after refreshing access token
							},
							function (err) {
								logger.error(FUNC, `cannot refresh access token.`, err);
								return Promise.reject(new Error(`cannot refresh access token.`));
							}
						);
					} else {
						return response.text().then(function (responseText) {
							logger.error(FUNC, `http status ${response.status}: ${request.method} ${request.url}: ${responseText}`);
							return Promise.reject(new Error(`http status ${response.status}: ${request.method} ${request.url}`));
						});
					}
				});
			});
	}
}

export let whttp: Whttp = new Whttp();
