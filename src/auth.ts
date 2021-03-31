import { PROJECT_NAME } from './consts';
import { rowsToJson } from './common/utils';
import { DeviceInfo } from './types';
import { webServicePlain } from './webserviceplain';
import { webService } from './webservice';
import { EventSource } from './eventSource';
import { UserSession } from './userSession';
import { stomp } from './stomp';
import { persist } from './persist';
import { authPrincipal } from './authprincipal';
import { Principal, assertNever, OnlineLoginSuccess, OnlineLoginError, OnlineLoginResult, OfflineLoginSuccess, OfflineLoginError, OfflineLoginResult, OnlinePinLoginResult, OfflinePinLoginResult, PinLoginResult } from './types';
import { settings } from './settings';
import { Logger } from './types';
import { getLogger } from './logger';
import { pouch } from './pouch1';
import { registerIdleListener, unregisterIdleListener } from './idle';
import { getDeviceInfo } from './deviceInfo';
import { testRefreshToken } from './webservice';
import { asyncProcessManager1 } from './asyncprocessmanager1';
import { registerDevice } from './idempiereProcess';
import { deviceInit } from './deviceInit';
import { initWizardState } from './deviceInitWizard';
import { net } from './net';
import { getEnvironment } from './environments/environment';

import * as CryptoJS from 'crypto-js';
import * as R from 'ramda';
import { v1 as uuidV1 } from 'uuid';

let logger = getLogger(PROJECT_NAME, 'auth.ts');

export class Auth {
	constructor() {}

	private _mobileLogin(email, password): Promise<OnlineLoginResult> {
		let FUNC = '_mobileLogin()';

		if (settings.settings.isDebug) {
			logger.info(FUNC, `_mobileLogin()`);
		}

		return authPrincipal
			.logout()
			.then(() => {
				if (settings.settings.isDebug) {
					logger.info(FUNC, `logging in user, registering device ...`);
				}
				return this.loginAndRegisterDevice(email, password).then(
					(data) => {
						if (settings.settings.isDebug) {
							logger.info(FUNC, `user logged in, device registered`);
						}

						//return this.ensureSameClientOrSetClientIfNone(parseInt(data.ad_client_id, 10)).then((isSameClient): OnlineLoginResult | Promise<OnlineLoginResult> => {
						return this.ensureSameClientOrSetClientIfNone(parseInt(data.ad_client_id, 10)).then((isSameClient) => {
							if (isSameClient) {
								return this.setPrincipalUsingLoginReply(email, password, data).then(
									(): OnlineLoginResult => {
										let loginResult: OnlineLoginSuccess = {
											kind: 'OnlineLoginSuccess',
											pin: data.pin,
											isDeviceInitWizardPageStarted: false,
										};
										return loginResult;
									}
								);
							} else {
								logger.error(FUNC, 'error: wrong client');
								let loginError: OnlineLoginError = {
									kind: 'OnlineLoginError',
									error: 'wrongClient',
									err: null,
								};
								return loginError;
							}
						});
					},
					//(response): OnlineLoginResult => {
					(response) => {
						let loginError: OnlineLoginError;
						if (response.status === 401) {
							loginError = {
								kind: 'OnlineLoginError',
								error: 'wrongCredentials',
								err: null,
							};
							logger.error(FUNC, 'error: wrongCredentials');
						} else {
							let err = response;
							loginError = {
								kind: 'OnlineLoginError',
								error: 'unknownError',
								err: response,
							};
							logger.error(FUNC, `error: unknownError: ${err}`, err);
						}
						return loginError;
					}
				);
			})
			.then((loginResult: OnlineLoginResult) => {
				switch (loginResult.kind) {
					case 'OnlineLoginSuccess':
						if (settings.settings.isDebug) {
							logger.info(FUNC, `token received`);
						}
						break;
					case 'OnlineLoginError':
						break;
					default:
						assertNever(loginResult);
				}
				return loginResult;
			})
			.catch((err) => {
				let loginError: OnlineLoginError = {
					kind: 'OnlineLoginError',
					error: 'unknownError',
					err: err,
				};
				logger.error(FUNC, `error: unknownError: ${err}`, err);
				return Promise.resolve(loginError);
			});
	}

	mobileLogin(email, password, isLoginAfterPin = false): Promise<OnlineLoginResult> {
		const FUNC = 'login()';

		if (!isLoginAfterPin) {
			logger.info(FUNC, `${email} is online logging in using email ...`);
		}

		let doit = (): Promise<OnlineLoginResult> => {
			const startD = Date.now();

			logger.info(FUNC, 'online login start ...');

			return this._mobileLogin(email, password)
				.then((loginResult: OnlineLoginResult) => {
					let result = R.clone(loginResult as any);
					delete result.pin;
					logger.info(FUNC, `loginResult: ${JSON.stringify(result)}`);

					const endD = Date.now();
					logger.info(FUNC, `online login end, login took ${endD - startD} ms`);

					return loginResult;
				})
				.then((loginResult: OnlineLoginResult) => {
					switch (loginResult.kind) {
						case 'OnlineLoginSuccess':
							return this.startDeviceInitWizardIfNeeded().then((isWizardStarted) => {
								if (isWizardStarted) {
									loginResult.isDeviceInitWizardPageStarted = true;
									return loginResult;
								} else {
									return this.mobileCreateUserSessionAndStartServicesOnline(loginResult);
								}
							});
							break;
						case 'OnlineLoginError':
							return loginResult;
							break;
						default:
							assertNever(loginResult);
					}
				})
				.catch((err) => {
					let loginError: OnlineLoginError = {
						kind: 'OnlineLoginError',
						error: 'unknownError',
						err: err,
					};
					logger.error(FUNC, `error: unknownError: ${err}`, err);
					return Promise.resolve(loginError);
				});
		};

		return net
			.pingHttp()
			.then(
				() => {
					return doit();
				},
				() => {
					let loginError: OnlineLoginError = {
						kind: 'OnlineLoginError',
						error: 'offline',
						err: null,
					};
					logger.error(FUNC, `error: offline`);
					return Promise.resolve(loginError);
				}
			)
			.then((loginResult: OnlineLoginResult) => {
				switch (loginResult.kind) {
					case 'OnlineLoginSuccess':
						if (!isLoginAfterPin) {
							logger.info(FUNC, `${email}  successfully online logged in using email`);
						}
						break;
					case 'OnlineLoginError':
						if (!isLoginAfterPin) {
							logger.error(FUNC, `${email} failed to login online using email: ${JSON.stringify(loginResult)}`);
						}
						break;
					default:
						assertNever(loginResult);
				}
				return loginResult;
			});
	}

	mobileLoginByPin(pin: string): Promise<PinLoginResult> {
		const FUNC = 'mobileLoginByPin()';

		let logCorrelationId = uuidV1();

		let onlineFn = (): Promise<OnlineLoginResult> => {
			logger.info(FUNC, `user is online logging in using pin ..., logCorrelationId: ${logCorrelationId}`);

			return authPrincipal
				.getPrincipalByPin(pin)
				.then((principal: Principal) => {
					if (principal) {
						// User session was found for entered pin. Decrypt user credentials using entered pin.
						let lin = CryptoJS.AES.decrypt(principal.lin, pin).toString(CryptoJS.enc.Utf8);
						let credentials = JSON.parse(lin);

						return this.mobileLogin(credentials.email, credentials.password, true).then((loginResult: OnlineLoginResult) => {
							switch (loginResult.kind) {
								case 'OnlineLoginSuccess':
									logger.info(FUNC, `${credentials.email} successfully online logged in using pin, logCorrelationId: ${logCorrelationId}`);
									break;
								case 'OnlineLoginError':
									logger.error(FUNC, `${credentials.email} failed to login online using pin: ${JSON.stringify(loginResult)}, logCorrelationId: ${logCorrelationId}`);
									break;
								default:
									assertNever(loginResult);
							}
							return loginResult;
						});
					} else {
						let loginError: OnlineLoginError = {
							kind: 'OnlineLoginError',
							error: 'wrongCredentials',
							err: null,
						};
						logger.error(FUNC, `error: wrongCredentials`);
						logger.error(FUNC, `user failed to login online using pin: ${JSON.stringify(loginError)}, logCorrelationId: ${logCorrelationId}`);
						return loginError;
					}
				})
				.catch((err) => {
					let loginError: OnlineLoginError = {
						kind: 'OnlineLoginError',
						error: 'unknownError',
						err: err,
					};
					logger.error(FUNC, `error: unknownError: ${err}`, err);
					logger.error(FUNC, `user failed to login online using pin: ${JSON.stringify(loginError)}, logCorrelationId: ${logCorrelationId}`);
					return loginError;
				});
		};

		let offlineFn = (): Promise<OfflineLoginResult> => {
			let logCorrelationId = uuidV1();

			logger.info(FUNC, `user is offline logging in using pin ... logCorrelationId: ${logCorrelationId}`);

			return authPrincipal
				.getPrincipalByPin(pin)
				.then((principal: Principal) => {
					if (principal) {
						return this.loginOffline(principal).then((loginResult: OfflineLoginResult) => {
							switch (loginResult.kind) {
								case 'OfflineLoginSuccess':
									logger.info(FUNC, `${principal.userEmail} successfully offline logged in using pin, logCorrelationId: ${logCorrelationId}`);
									break;
								case 'OfflineLoginError':
									logger.error(FUNC, `${principal.userEmail} failed to login offline using pin: ${JSON.stringify(loginResult)}, logCorrelationId: ${logCorrelationId}`);
									break;
								default:
									assertNever(loginResult);
							}
							return loginResult;
						});
					} else {
						let loginError: OfflineLoginError = {
							kind: 'OfflineLoginError',
							error: 'wrongCredentials',
							err: null,
						};
						logger.error(FUNC, `error: wrongCredentials`);
						logger.error(FUNC, `${principal.userEmail} failed to login offline using pin: ${JSON.stringify(loginError)}, logCorrelationId: ${logCorrelationId}`);
						return loginError;
					}
				})
				.catch((err) => {
					let loginError: OfflineLoginError = {
						kind: 'OfflineLoginError',
						error: 'unknownError',
						err: err,
					};
					logger.error(FUNC, `error: unknownError: ${err}`, err);
					logger.error(FUNC, `user failed to login offline using pin: ${JSON.stringify(loginError)}, logCorrelationId: ${logCorrelationId}`);
					return loginError;
				});
		};
		return net.pingHttp().then(
			() => {
				return onlineFn().then(
					(result: OnlineLoginResult) => {
						let onlinePinLoginResult: OnlinePinLoginResult = {
							kind: 'OnlinePinLoginResult',
							result: result,
						};
						return onlinePinLoginResult;
					},
					(err) => {
						let loginError: OnlineLoginError = {
							kind: 'OnlineLoginError',
							error: 'unknownError',
							err: err,
						};
						logger.error(FUNC, `error: unknownError: ${err}`, err);
						let onlinePinLoginResult: OnlinePinLoginResult = {
							kind: 'OnlinePinLoginResult',
							result: loginError,
						};
						return onlinePinLoginResult;
					}
				);
			},
			() => {
				return offlineFn().then(
					(result: OfflineLoginResult) => {
						let offlinePinLoginResult: OfflinePinLoginResult = {
							kind: 'OfflinePinLoginResult',
							result: result,
						};
						return offlinePinLoginResult;
					},
					(err) => {
						let loginError: OfflineLoginError = {
							kind: 'OfflineLoginError',
							error: 'unknownError',
							err: err,
						};
						logger.error(FUNC, `error: unknownError: ${err}`, err);
						let offlinePinLoginResult: OfflinePinLoginResult = {
							kind: 'OfflinePinLoginResult',
							result: loginError,
						};
						return offlinePinLoginResult;
					}
				);
			}
		);
	}

	private loginOffline(principal: Principal): Promise<OfflineLoginResult> {
		const FUNC = 'login()';
		const startD = Date.now();
		logger.info(FUNC, `offline login start ...`);
		return authPrincipal
			.setPrincipal(principal)
			.then(() => {
				let loginResult: OfflineLoginSuccess = {
					kind: 'OfflineLoginSuccess',
				};
				return this.createUserSessionAndStartServicesOffline(loginResult).then((loginResult: OfflineLoginResult) => {
					return loginResult;
				});
			})
			.then((loginResult: OfflineLoginResult) => {
				let result = loginResult;
				logger.info(FUNC, `loginResult: ${JSON.stringify(result)}`);

				const endD = Date.now();
				logger.info(FUNC, `offline login end, login took ${endD - startD} ms)`);
				return loginResult;
			})
			.catch((err) => {
				let loginError: OfflineLoginError = {
					kind: 'OfflineLoginError',
					error: 'unknownError',
					err: err,
				};
				logger.error(FUNC, `error: unknownError: ${err}`, err);
				return Promise.resolve(loginError);
			});
	}

	mobileLogout(): Promise<void> {
		const FUNC = 'mobileLogout()';

		const startD = Date.now();

		logger.info(FUNC, `logout start ...`);

		// destroy user session
		EventSource.userSessionDestroyEventSource.generateEvent(UserSession.session);
		UserSession.session = null;

		unregisterIdleListener();

		return this.stopServices()
			.then(() => {
				return authPrincipal.logout();
			})
			.then(
				(v) => {
					const endD = Date.now();
					logger.info(FUNC, `logout end, took ${endD - startD} ms`);
					return v;
				},
				(err) => {
					logger.error(FUNC, `logout error: ${err} `, err);
					return Promise.reject(err);
				}
			);
	}

	private _browserLogin(email, password): Promise<OnlineLoginResult> {
		let FUNC = '_browserLogin';

		if (settings.settings.isDebug) {
			logger.info(FUNC, `_browserLogin()`);
		}

		return authPrincipal
			.logout()
			.then(() => {
				if (settings.settings.isDebug) {
					logger.info(FUNC, `logging in user ...`);
				}
				return this.callOAuth2PasswordGrant(email, password).then(
					(data) => {
						if (settings.settings.isDebug) {
							logger.info(FUNC, `user logged in`);
						}

						return this.ensureSameClientOrSetClientIfNone(parseInt(data.ad_client_id, 10)).then((isSameClient) => {
							if (isSameClient) {
								return this.setPrincipalUsingLoginReply(email, password, data, true).then(
									(): OnlineLoginResult => {
										let loginResult: OnlineLoginSuccess = {
											kind: 'OnlineLoginSuccess',
											pin: data.pin,
											isDeviceInitWizardPageStarted: false,
										};
										return loginResult;
									}
								);
							} else {
								logger.error(FUNC, `error: wrong client`);
								let loginError: OnlineLoginError = {
									kind: 'OnlineLoginError',
									error: 'wrongClient',
									err: null,
								};
								return loginError;
							}
						});
					},
					(response) => {
						let loginError: OnlineLoginError;
						if (response.status === 401) {
							loginError = {
								kind: 'OnlineLoginError',
								error: 'wrongCredentials',
								err: null,
							};
							logger.error(FUNC, `error: wrongCredentials`);
						} else {
							let err = response;
							loginError = {
								kind: 'OnlineLoginError',
								error: 'unknownError',
								err: response,
							};
							logger.error(FUNC, `error: unknownError: ${err}`, err);
						}
						return loginError;
					}
				);
			})
			.then((loginResult: OnlineLoginResult) => {
				switch (loginResult.kind) {
					case 'OnlineLoginSuccess':
						if (settings.settings.isDebug) {
							logger.info(FUNC, `token received`);
						}
						break;
					case 'OnlineLoginError':
						break;
					default:
						assertNever(loginResult);
				}
				return loginResult;
			})
			.catch((err) => {
				let loginError: OnlineLoginError = {
					kind: 'OnlineLoginError',
					error: 'unknownError',
					err: err,
				};
				logger.error(FUNC, `error: unknownError: ${err}`, err);
				return Promise.resolve(loginError);
			});
	}

	browserLogin(email, password): Promise<OnlineLoginResult> {
		const FUNC = 'login()';

		logger.info(FUNC, `${email} is online logging in using email ...`);

		let doit = (): Promise<OnlineLoginResult> => {
			const startD = Date.now();

			logger.info(FUNC, `online login start ...`);

			return this._browserLogin(email, password)
				.then((loginResult: OnlineLoginResult) => {
					let result = R.clone(loginResult as any);
					delete result.pin;
					logger.info(FUNC, `loginResult: ${JSON.stringify(result)}`);

					const endD = Date.now();
					logger.info(FUNC, `online login end, login took ${endD - startD} ms`);

					return loginResult;
				})
				.then((loginResult: OnlineLoginResult) => {
					switch (loginResult.kind) {
						case 'OnlineLoginSuccess':
							return this.browserCreateUserSessionAndStartServicesOnline(loginResult);
							break;
						case 'OnlineLoginError':
							return loginResult;
							break;
						default:
							assertNever(loginResult);
					}
				})
				.catch((err) => {
					let loginError: OnlineLoginError = {
						kind: 'OnlineLoginError',
						error: 'unknownError',
						err: err,
					};
					logger.error(FUNC, `error: unknownError: ${err}`, err);
					return Promise.resolve(loginError);
				});
		};

		return net
			.pingHttp()
			.then(
				() => {
					return doit();
				},
				() => {
					let loginError: OnlineLoginError = {
						kind: 'OnlineLoginError',
						error: 'offline',
						err: null,
					};
					logger.error(FUNC, `error: offline`);
					return Promise.resolve(loginError);
				}
			)
			.then((loginResult: OnlineLoginResult) => {
				switch (loginResult.kind) {
					case 'OnlineLoginSuccess':
						logger.info(FUNC, `${email}  successfully online logged in using email`);
						break;
					case 'OnlineLoginError':
						logger.error(FUNC, `${email} failed to login online using email: ${JSON.stringify(loginResult)}`);
						break;
					default:
						assertNever(loginResult);
				}
				return loginResult;
			});
	}

	browserLogout(): Promise<void> {
		const FUNC = 'browserLogout()';

		const startD = Date.now();

		logger.info(FUNC, `logout start ...`);

		// destroy user session
		EventSource.userSessionDestroyEventSource.generateEvent(UserSession.session);
		UserSession.session = null;

		unregisterIdleListener();

		return this.browserStopServices()
			.then(() => {
				return authPrincipal.logout();
			})
			.then(
				(v) => {
					const endD = Date.now();
					logger.info(FUNC, `logout end, took ${endD - startD} ms`);
					return v;
				},
				(err) => {
					logger.error(FUNC, `logout error: ${err} `, err);
					return Promise.reject(err);
				}
			);
	}

	private setPrincipalUsingLoginReply(email: string, password: string, data: any, browser = false): Promise<void> {
		const FUNC = 'setPrincipalUsingLoginReply()';
		let lin: string, rtk: string, pin: string;

		if (browser === false) {
			lin = CryptoJS.AES.encrypt(JSON.stringify({ email: email, password: password }), data.pin).toString();
			pin = CryptoJS.SHA256(data.pin).toString();
		} else {
			lin = '';
			pin = '';
		}

		data = R.clone(data);
		if (browser !== false) {
			data.user_uuid = email;
			data.username = email;
			data.ad_user_id = 0;
			data.ad_client_id = 0;
			(data.couch_db = {}), (data.couch_db.x_auth_username = '');
			data.couch_db.x_auth_roles = '';
			data.cubejs_token = '';
		}

		rtk = data.refresh_token;

		let principal: Principal = {
			userUuid: data.user_uuid,
			userName: data.username,
			userEmail: email,
			adUserId: parseInt(data.ad_user_id, 10),
			adClientId: parseInt(data.ad_client_id, 10),
			accessToken: data.access_token,
			rtk: rtk,
			pin: pin,
			lin: lin,
			x_auth_username: data.couch_db.x_auth_username,
			x_auth_roles: data.couch_db.x_auth_roles,
			cubejsToken: data.cubejs_token,
			deviceStopmQueue: data.device_stomp_queue,
			apps: data.apps,
		};

		return authPrincipal.setPrincipal(principal).then(() => {
			let printPrincipal = R.pick(['userUuid', 'userName', 'userEmail', 'adUserId', 'adClientId', 'apps'], principal);
			return data;
		});
	}

	private createUserSession() {
		// create new user session
		UserSession.session = new UserSession();
		EventSource.userSessionCreateEventSource.generateEvent(UserSession.session);
	}

	private startIdleListener(onIdleFn) {
		registerIdleListener(() => {
			onIdleFn();
		});
	}

	private mobileCreateUserSessionAndStartServicesOnline(loginResult: OnlineLoginResult): Promise<OnlineLoginResult> {
		const FUNC = 'createUserSessionAndStartServicesOnline()';
		this.createUserSession();
		this.startIdleListener(() => {
			this.mobileLogout().then(() => {
				EventSource.goToLoginPageEventSource.generateEvent();
			});
		});
		return this.startServices(false)
			.then(
				() => {
					return loginResult;
				},
				(err) => {
					let loginError: OnlineLoginError = {
						kind: 'OnlineLoginError',
						error: 'unknownError',
						err: err,
					};
					logger.error(FUNC, `error: unknownError: ${err}`, err);
					return Promise.resolve(loginError);
				}
			)
			.then((loginResult: OnlineLoginResult) => {
				if (false) {
					testRefreshToken();
				}
				return loginResult;
			})
			.catch((err) => {
				let loginError: OnlineLoginError = {
					kind: 'OnlineLoginError',
					error: 'unknownError',
					err: err,
				};
				logger.error(FUNC, `error: unknownError: ${err}`, err);
				return Promise.resolve(loginError);
			});
	}

	private browserCreateUserSessionAndStartServicesOnline(loginResult: OnlineLoginResult): Promise<OnlineLoginResult> {
		const FUNC = 'browserCreateUserSessionAndStartServicesOnline()';
		this.createUserSession();
		return this.browserStartServices(false)
			.then(
				() => {
					return loginResult;
				},
				(err) => {
					let loginError: OnlineLoginError = {
						kind: 'OnlineLoginError',
						error: 'unknownError',
						err: err,
					};
					logger.error(FUNC, `error: unknownError: ${err}`, err);
					return Promise.resolve(loginError);
				}
			)
			.then((loginResult: OnlineLoginResult) => {
				if (false) {
					testRefreshToken();
				}
				return loginResult;
			})
			.catch((err) => {
				let loginError: OnlineLoginError = {
					kind: 'OnlineLoginError',
					error: 'unknownError',
					err: err,
				};
				logger.error(FUNC, `error: unknownError: ${err}`, err);
				return Promise.resolve(loginError);
			});
	}

	private createUserSessionAndStartServicesOffline(loginResult: OfflineLoginResult): Promise<OfflineLoginResult> {
		const FUNC = 'createUserSessionAndStartServicesOffline()';
		this.createUserSession();
		return this.startServices(true)
			.then(() => {
				return loginResult;
			})
			.catch((err) => {
				let loginError: OfflineLoginError = {
					kind: 'OfflineLoginError',
					error: 'unknownError',
					err: err,
				};
				logger.error(FUNC, `error: unknownError: ${err}`, err);
				return loginError;
			});
	}

	private ensureSameClientOrSetClientIfNone(ad_client_id: number): Promise<boolean> {
		let FUNC = 'ensureSameClientOrSetClientIfNone()';

		return deviceInit
			.isDeviceClientAssigned()
			.then((assigned) => {
				if (assigned) {
					return deviceInit.isDeviceClientAssigned(ad_client_id).then((assigned) => {
						if (assigned) {
							return true;
						} else {
							logger.error(FUNC, `wrong client`);
							return false;
						}
					});
				} else {
					return deviceInit.deviceClientAssign(ad_client_id).then(() => {
						return true;
					});
				}
			})
			.catch((err) => {
				let errs = `error`;
				logger.error(FUNC, errs, err);
				return Promise.reject(err);
			});
	}

	private getAndSaveDeviceInformation(): Promise<any> {
		const FUNC = 'getAndSaveDeviceInformation()';
		return getDeviceInfo()
			.then((deviceInfo: DeviceInfo) => {
				return webService.getDeviceSettings(deviceInfo.uuid).then((data) => {
					let settings: any = rowsToJson(data.Data.Rows);
					let record = {
						id: 1,
						device_id: deviceInfo.uuid,
						ad_replicationstrategy_id_ws: settings.AD_ReplicationStrategy_ID_WS.toString(),
						ad_replicationstrategy_id_init: settings.AD_ReplicationStrategy_ID_INIT.toString(),
					};

					return persist.saveRecord('device', record).then(() => {
						return record;
					});
				});
			})
			.catch((err) => {
				let errs = `error`;
				logger.error(FUNC, errs, err);
				return Promise.reject(err);
			});
	}

	private startStompService(): Promise<void> {
		const FUNC = 'startStompService()';
		return authPrincipal
			.getPrincipal()
			.then((principal: Principal) => {
				let queue = principal.deviceStopmQueue;
				if (!queue) {
					let errs = `no stomp queue name defined for this device`;
					logger.error(FUNC, errs);
					return Promise.reject(new Error(errs));
				}
				return stomp.start([queue]);
			})
			.catch((err) => {
				let errs = `error`;
				logger.error(FUNC, errs, err);
				return Promise.reject(err);
			});
	}

	private stopStompService(): Promise<void> {
		const FUNC = 'startStompService()';
		return stomp.stop().catch((err) => {
			let errs = `error`;
			logger.error(FUNC, errs, err);
			return Promise.reject(err);
		});
	}

	private startPouchService(): Promise<void> {
		const FUNC = 'startPouchService()';
		return pouch.start().catch((err) => {
			let errs = `error`;
			logger.error(FUNC, errs, err);
			return Promise.reject(err);
		});
	}

	private stopPouchService(): Promise<void> {
		const FUNC = 'stopPouchService()';
		return pouch.stop().catch((err) => {
			let errs = `error`;
			logger.error(FUNC, errs, err);
			return Promise.reject(err);
		});
	}

	private startAsyncProcessManagerService(): Promise<void> {
		const FUNC = 'startasyncProcessManagerService()';
		return asyncProcessManager1.start().catch((err) => {
			let errs = `error`;
			logger.error(FUNC, errs, err);
			return Promise.reject(err);
		});
	}

	private stopAsyncProcessManagerService(): Promise<void> {
		const FUNC = 'stopAsyncProcessManagerService()';
		return asyncProcessManager1.stop().catch((err) => {
			let errs = `error`;
			logger.error(FUNC, errs, err);
			return Promise.reject(err);
		});
	}

	/**
	 * Start services either in online mode or offline mode.
	 */
	startServices(offline: boolean): Promise<void> {
		const FUNC = 'startServices()';

		let doIt = (): Promise<void> => {
			if (!offline) {
				return this.getAndSaveDeviceInformation().then(() => {
					let promises = [];
					promises.push(this.startStompService());
					promises.push(this.startPouchService());
					promises.push(this.startAsyncProcessManagerService());
					return Promise.all(promises).then(() => {
						return;
					});
				});
			} else {
				let promises = [];
				promises.push(this.startPouchService());
				return Promise.all(promises).then(() => {
					return;
				});
			}
		};

		const startD = Date.now();
		logger.info(FUNC, `starting services, offline: ${offline} ...`);

		return doIt()
			.then(() => {
				const endD = Date.now();
				logger.info(FUNC, `services (offline: ${offline}) started in ${endD - startD} ms`);
			})
			.catch((err) => {
				let errs = `error`;
				logger.error(FUNC, errs, err);
				return Promise.reject(err);
			});
	}

	async stopServices() {
		const FUNC = 'stopServices()';

		logger.info(FUNC, `stopping services ...`);

		let promises = [];
		promises.push(stomp.stop());
		promises.push(pouch.stop());
		promises.push(asyncProcessManager1.stop());
		return Promise.all(promises)
			.then(() => {
				logger.info(FUNC, `services stopped`);
			})
			.catch((err) => {
				let errs = `error`;
				logger.error(FUNC, errs, err);
				return Promise.reject(err);
			});
	}

	browserStartServices(offline: boolean): Promise<void> {
		const FUNC = 'browserStartServices()';

		let doIt = (): Promise<void> => {
			if (!offline) {
				let promises = [];
				return Promise.all(promises).then(() => {
					return;
				});
			} else {
				let promises = [];
				return Promise.all(promises).then(() => {
					return;
				});
			}
		};

		const startD = Date.now();
		logger.info(FUNC, `starting services, offline: ${offline} ...`);

		return doIt()
			.then(() => {
				const endD = Date.now();
				logger.info(FUNC, `services (offline: ${offline}) started in ${endD - startD} ms`);
			})
			.catch((err) => {
				let errs = `error`;
				logger.error(FUNC, errs, err);
				return Promise.reject(err);
			});
	}

	browserStopServices() {
		const FUNC = 'browserStopServices()';

		logger.info(FUNC, `stopping services ...`);

		let promises = [];
		promises.push(stomp.stop());
		promises.push(pouch.stop());
		promises.push(asyncProcessManager1.stop());
		return Promise.all(promises)
			.then(() => {
				logger.info(FUNC, `services stopped`);
			})
			.catch((err) => {
				let errs = `error`;
				logger.error(FUNC, errs, err);
				return Promise.reject(err);
			});
	}

	private callOAuth2PasswordGrant(email, password): Promise<any> {
		const FUNC = 'callOAuth2PasswordGrant()';

		return webServicePlain
			.getAccessTokenByOAuth2PasswordGrant(email, password)
			.then(
				(replyLogin) => {
					return replyLogin;
				},
				(err) => {
					if (err.status && err.status === 401) {
						return Promise.reject(err);
					} else {
						let errs = `error with webServicePlain.getAccessTokenByOAuth2PasswordGrant()`;
						logger.error(FUNC, errs, err);
						return Promise.reject(err);
					}
				}
			)
			.then((replyLogin) => {
				return replyLogin;
			});
	}

	loginAndRegisterDevice(email, password): Promise<any> {
		const FUNC = 'loginAndRegisterDevice()';

		return this.callOAuth2PasswordGrant(email, password).then((replyLogin) => {
			return getDeviceInfo().then((deviceInfo: DeviceInfo) => {
				return registerDevice(replyLogin.access_token, deviceInfo.uuid, deviceInfo.model, deviceInfo.platform).then(
					(replyDeviceInfo) => {
						let reply = R.mergeRight(replyLogin, replyDeviceInfo);
						return reply;
					},
					(err) => {
						let errs = `error with registerDevice()`;
						logger.error(FUNC, errs, err);
						return Promise.reject(err);
					}
				);
			});
		});
	}

	/**
	 * Start device initialization wizard if nccessary.
	 * Returns true if wizard was started.
	 */
	private startDeviceInitWizardIfNeeded(): Promise<boolean> {
		const FUNC = 'startDeviceInitWizardIfNeeded()';

		// start minimal set of services needed by device initialization
		let startMinimalServices = (): Promise<void> => {
			this.createUserSession();
			let promises = [];
			promises.push(this.startStompService());
			promises.push(this.startAsyncProcessManagerService());
			return Promise.all(promises).then(() => {});
		};

		return deviceInit.deviceInitializationWasExceuted().then((wasExecuted: boolean) => {
			if (getEnvironment().deactivateMobileDeviceInitWizard) {
				if (wasExecuted) {
					logger.info(FUNC, `device is initialized`);
					return false;
				} else {
					logger.warn(FUNC, `device is not initialized, device init wizard is not started due to environment value 'dactivateMobileDeviceInitializationWizard' being set to true`);
					return false;
				}
			} else if (wasExecuted) {
				logger.info(FUNC, `device is initialized`);
				return false;
			} else {
				logger.info(FUNC, `device is not initialized, starting init wizard`);

				return startMinimalServices().then(() => {
					// ensure initial state exists
					return deviceInit
						.isInitializationResult()
						.then((initializationResultExists: boolean) => {
							if (!initializationResultExists) {
								return initWizardState(); // set initialization initials state
							}
						})
						.then(() => {
							// call up device init wizard page
							deviceInit.initDeviceUsingWizard();
							return true;
						});
				});
			}
		});
	}
}

export let auth: Auth = new Auth();
