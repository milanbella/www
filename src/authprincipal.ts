/**
 *  Contains information about currently logged in user.
 *  @packageDocumentation
 *
 */

import { PROJECT_NAME } from './consts';
import { waitFor } from './common/utils';

import { persist } from './persist';
import { Principal, CurrentUser } from './types';
import { webServicePlain } from './webserviceplain';
import { Logger } from './types';
import { getLogger } from './logger';
import { EventSource } from './eventSource';
import { getEnvironment } from './environments/environment';
import { getPrincipal as getPrincipalFromWorker, setPrincipal as setPrincipalInWorker } from './commonWorker';
import { getExecutionContext } from './executionContext';

import * as CryptoJS from 'crypto-js';

let logger = getLogger(PROJECT_NAME, 'authprincipal.ts');

class AuthPrincipal {
	principal: Principal;

	private refreshingAccessToken = false;

	constructor() {}

	private persistPrincipal(principal: Principal): Promise<any> {
		return persist.saveRecord('user', principal).then(() => {
			let currentUser: CurrentUser = {
				id: 1,
				userUuid: principal.userUuid,
			};
			return persist.saveRecord('current_user', currentUser);
		});
	}

	setPrincipal(principal: Principal): Promise<any> {
		const FUNC = 'setPrincipal()';
		let oauthTokenStorage = getEnvironment().oauthTokenStorage;
		if (oauthTokenStorage === 'indexdb') {
			this.principal = principal;
			return this.persistPrincipal(principal).then(() => {
				EventSource.principalChangeEventSource.generateEvent(principal);
			});
		} else if (oauthTokenStorage === 'webworker') {
			return setPrincipalInWorker(principal).then(() => {
				EventSource.principalChangeEventSource.generateEvent(principal);
			});
		} else {
			let errs = `unsupported token storage: ${oauthTokenStorage}`;
			logger.error(FUNC, errs);
			let err = new Error(errs);
			return Promise.reject(err);
		}
	}

	logout(): Promise<void> {
		const FUNC = 'logout()';
		let oauthTokenStorage = getEnvironment().oauthTokenStorage;

		EventSource.principalChangeEventSource.generateEvent(null);

		if (oauthTokenStorage === 'indexdb') {
			this.principal = null;
			return persist.removeRecord('current_user', [1]);
		} else if (oauthTokenStorage === 'webworker') {
			return setPrincipalInWorker(null).then(() => {
				EventSource.principalChangeEventSource.generateEvent(null);
			});
		} else {
			let errs = `unsupported token storage: ${oauthTokenStorage}`;
			logger.error(FUNC, errs);
			let err = new Error(errs);
			return Promise.reject(err);
		}

		//TODO: revoke access and refresh token
	}

	/**
	 *  Returns currently logged in user or 'undefined' if user is not logged in.
	 */

	getPrincipal(): Promise<Principal> {
		const FUNC = 'getPrincipal()';
		if (getExecutionContext().isServerSide === true) {
			return Promise.resolve(null);
		}
		let oauthTokenStorage = getEnvironment().oauthTokenStorage;
		if (oauthTokenStorage === 'indexdb') {
			return persist.getRecord('current_user', [1]).then((record) => {
				if (record) {
					return persist.getRecord('user', [record.userUuid]).then((record) => {
						if (record) {
							let principal: Principal = record;
							this.principal = principal;
							return principal;
						}
					});
				} else {
				}
			});
		} else if (oauthTokenStorage === 'webworker') {
			return getPrincipalFromWorker();
		} else {
			let errs = `unsupported token storage: ${oauthTokenStorage}`;
			logger.error(FUNC, errs);
			let err = new Error(errs);
			return Promise.reject(err);
		}
	}

	getPrincipalByPin(pin): Promise<any> {
		pin = CryptoJS.SHA256(pin).toString();
		return persist.getIndexRecord('user', 'pin', [pin]).then((record) => {
			if (record) {
				let principal: Principal = record;
				this.principal = principal;
				return principal;
			} else {
			}
		});
	}

	refreshTokenUsingRefreshToken(): Promise<any> {
		const FUNC = 'refreshTokenUsingRefreshToken()';
		logger.info(FUNC, `authprincipal: refreshing access token ......`);
		let err;
		let werr = new Error(`refreshingAccessToken === false`);
		return waitFor(() => {
			return this.refreshingAccessToken === false;
		}, werr).then(() => {
			this.refreshingAccessToken = true;
			return this.getPrincipal()
				.then((principal) => {
					if (principal) {
						if (!principal.rtk) {
							logger.error(FUNC, `authprincipal: failed: no rtk`);
							err = new Error(`authprincipal: failed: no rtk`);
							return Promise.reject(err);
						}
						return webServicePlain.getAccessTokenByOAuth2RefreshToken(principal.rtk).then((data) => {
							principal.accessToken = data.accessToken;
							principal.rtk = data.refreshToken;
							principal.cubejsToken = data.cubejsToken;

							return this.setPrincipal(principal).then(
								() => {
									logger.info(FUNC, `authprincipal: access token refreshed`);
								},
								(err) => {
									logger.error(FUNC, `authprincipal: failed`, err);
									return Promise.reject(err);
								}
							);
						});
					} else {
						logger.error(FUNC, `authprincipal: failed: no principal`);
						err = new Error(`authprincipal: failed: no principal`);
						return Promise.reject(err);
					}
				})
				.then(
					(ret) => {
						this.refreshingAccessToken = false;
						return ret;
					},
					(err) => {
						this.refreshingAccessToken = false;
						return Promise.reject(err);
					}
				);
		});
	}

	refresTokenUsingSession() {
		const FUNC = 'refresTokenUsingSession()';
		logger.info(FUNC, `authprincipal: refreshing access token ......`);
		let err;
		let werr = new Error(`refreshingAccessToken === false`);
		return waitFor(() => {
			return this.refreshingAccessToken === false;
		}, werr).then(() => {
			this.refreshingAccessToken = true;
			return this.getPrincipal()
				.then((principal) => {
					if (principal) {
						return webServicePlain.sessionGetToken().then((data) => {
							if (!data.accessToken) {
								let err = new Error(`no access token received`);
								logger.error(FUNC, `error: `, err);
								return Promise.reject(err);
							}
							principal.accessToken = data.accessToken;
							if (!data.accessToken) {
								let err = new Error(`no access token received`);
								logger.error(FUNC, `error: `, err);
								return Promise.reject(err);
							}
							principal.cubejsToken = data.cubejsToken;

							return this.setPrincipal(principal).then(
								() => {
									logger.info(FUNC, `authprincipal: access token refreshed`);
								},
								(err) => {
									logger.error(FUNC, `authprincipal: failed`, err);
									return Promise.reject(err);
								}
							);
						});
					} else {
						logger.error(FUNC, `authprincipal: failed: no principal`);
						err = new Error(`authprincipal: failed: no principal`);
						return Promise.reject(err);
					}
				})
				.then(
					(ret) => {
						this.refreshingAccessToken = false;
						return ret;
					},
					(err) => {
						this.refreshingAccessToken = false;
						return Promise.reject(err);
					}
				);
		});
	}

	refreshToken(): Promise<any> {
		const FUNC = 'refreshToken()';
		let oauthTokenStorage = getEnvironment().oauthTokenStorage;
		if (oauthTokenStorage === 'indexdb') {
			return this.refreshTokenUsingRefreshToken();
		} else if (oauthTokenStorage === 'webworker') {
			if (false) {
				return this.refresTokenUsingSession();
			} else {
				return this.refreshTokenUsingRefreshToken();
			}
		} else {
			let errs = `unsupported token storage: ${oauthTokenStorage}`;
			logger.error(FUNC, errs);
			let err = new Error(errs);
			return Promise.reject(err);
		}
	}
}

export let authPrincipal: AuthPrincipal = new AuthPrincipal();
