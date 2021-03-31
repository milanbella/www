/**
 * State of device initialization.
 */

import { PROJECT_NAME } from './consts';
import { rowsToJson } from './common/utils';
import { Principal, DeviceClientRecord, DeviceInitializationRecord } from './types';
import { DeviceInfo } from './types';
import { persist } from './persist';
import { authPrincipal } from './authprincipal';
import { Logger } from './types';
import { getLogger } from './logger';
import { EventSource } from './eventSource';
import { webService } from './webservice';
import { getDeviceInfo } from './deviceInfo';
import { asyncProcessManager1 } from './asyncprocessmanager1';

export const INIT_WIZARD_STATE_INITIAL = 0;
export const INIT_WIZARD_STATE_WELCOME_PAGE = 1;
export const INIT_WIZARD_STATE_SETTINGS_PAGE = 2;
export const INIT_WIZARD_STATE_REPLICATION_INIT_GROUPS_PAGE = 3;
export const INIT_WIZARD_STATE_DONE = 4;

let logger = getLogger(PROJECT_NAME, 'deviceInit.ts');

class DeviceInit {
	/**
	 * Returns true if this device was already initialized or being currently initialized.
	 */

	deviceInitializationWasExceuted(): Promise<boolean> {
		const FUNC = 'deviceInitializationWasAlreadyExceuted()';
		return authPrincipal
			.getPrincipal()
			.then((principal: Principal) => {
				if (principal) {
					let ad_client_id = principal.adClientId;
					return this.isDeviceClientAssigned(ad_client_id).then((assigned) => {
						if (assigned) {
							return this.getInitializationResult(ad_client_id).then((deviceInitialization: DeviceInitializationRecord) => {
								if (deviceInitialization) {
									if (deviceInitialization.initWizardState >= INIT_WIZARD_STATE_DONE) {
										return true;
									} else {
										return false;
									}
								} else {
									return false;
								}
							});
						} else {
							let errs = `This device was not assigned to this client ${ad_client_id}.`;
							logger.error(FUNC, errs);
							return Promise.reject(new Error(errs));
						}
					});
				} else {
					let errs = `User is not logged in.`;
					logger.error(FUNC, errs);
					return Promise.reject(errs);
				}
			})
			.catch((err) => {
				let errs = `error`;
				logger.error(FUNC, errs, err);
				return Promise.reject(err);
			});
	}

	/**
	 * Records the last result of initialization.
	 */

	saveInitializationResult(deviceInitialization: DeviceInitializationRecord, ad_client_id?: number): Promise<void> {
		const FUNC = 'saveInitializationResult()';
		return this.adClientId(ad_client_id)
			.then((ad_client_id) => {
				return this.isDeviceClientAssigned(ad_client_id).then((assigned: boolean) => {
					if (assigned) {
						let record: DeviceClientRecord = {
							id: 1,
							ad_client_id: ad_client_id,
							deviceInitialization: deviceInitialization,
						};
						return persist.saveRecord('client', record);
					} else {
						let errs = `This device was not assigned to client ${ad_client_id}.`;
						logger.error(FUNC, errs);
						return Promise.reject(new Error(errs));
					}
				});
			})
			.catch((err) => {
				let errs = `error`;
				logger.error(FUNC, errs, err);
				return Promise.reject(err);
			});
	}

	/**
	 * Returns initialization last result or undefined if initialization was never executed.
	 */

	getInitializationResult(ad_client_id?: number): Promise<DeviceInitializationRecord> {
		const FUNC = 'getInitializationResult()';
		return this.adClientId(ad_client_id)
			.then(() => {
				return persist.getRecord('client', [1]).then((record: DeviceClientRecord) => {
					if (record) {
						if (record.deviceInitialization) {
							return record.deviceInitialization;
						} else {
							return;
						}
					} else {
						return;
					}
				});
			})
			.catch((err) => {
				let errs = `error`;
				logger.error(FUNC, errs, err);
				return Promise.reject(err);
			});
	}

	/**
	 * Test if device initialization record exists.
	 */
	isInitializationResult(ad_client_id?: number): Promise<boolean> {
		const FUNC = 'getInitializationResult()';
		return this.adClientId(ad_client_id)
			.then(() => {
				return persist.getRecord('client', [1]).then((record: DeviceClientRecord) => {
					if (record) {
						if (record.deviceInitialization) {
							return true;
						} else {
							return false;
						}
					} else {
						return false;
					}
				});
			})
			.catch((err) => {
				let errs = `error`;
				logger.error(FUNC, errs, err);
				return Promise.reject(err);
			});
	}

	/**
	 * During the initialization process device is assigned to specific client.
	 * This call associates a device with a client.
	 */

	deviceClientAssign(ad_client_id: number): Promise<boolean> {
		const FUNC = 'deviceClientAssign()';
		return this.isDeviceClientAssigned()
			.then((assigned: boolean) => {
				if (assigned) {
					let errs = `This device was already assigned to client. The only way to assign it to different client is to re-install software.`;
					logger.error(FUNC, errs);
					return Promise.reject(new Error(errs));
				} else {
					let record: DeviceClientRecord = {
						id: 1,
						ad_client_id: ad_client_id,
						deviceInitialization: null,
					};
					return persist.saveRecord('client', record);
				}
			})
			.catch((err) => {
				let errs = `error`;
				logger.error(FUNC, errs, err);
				return Promise.reject(err);
			});
	}

	/**
	 * During the initialization process device is assigned to specific client.
	 * Check if this device was already associated with a client.
	 * If client id provided check is also performed if device is assigned to client with the given client id.
	 *
	 */

	isDeviceClientAssigned(ad_client_id?: number): Promise<boolean> {
		let FUNC = 'isDeviceClientAssigned()';

		return persist
			.getRecord('client', [1])
			.then((record: DeviceClientRecord) => {
				if (record) {
					if (ad_client_id) {
						return ad_client_id === record.ad_client_id;
					} else {
						return true;
					}
				} else {
					return false;
				}
			})
			.catch((err) => {
				let errs = `error`;
				logger.error(FUNC, errs, err);
				return Promise.reject(err);
			});
	}

	/**
	 * Calls up device init wizard page.
	 */
	initDeviceUsingWizard() {
		EventSource.startDeviceInitWizardPage.generateEvent();
	}

	/**
	 *  Boots up the continuous backend database data replication. Database records are sent to device continuously upon change using stomp queue.
	 *  When the replication is triggred the backend first sends all database records (this might be quite a lot of data) and after that it is
	 *  just sending records as they are changing.
	 *
	 */
	async initReplication(): Promise<void> {
		const FUNC = 'initReplication()';
		try {
			let deviceInfo: DeviceInfo = await getDeviceInfo();
			let deviceUuid = deviceInfo.uuid;
			let data = await webService.getDeviceSettings(deviceUuid);
			let settings = rowsToJson(data.Data.Rows);

			let msg = `calling init device backend service ...`;
			logger.info(FUNC, msg);

			asyncProcessManager1.initDevice(settings.AD_Queue_ID, settings.AD_ReplicationStrategy_ID_INIT).catch((err) => {
				logger.error(FUNC, 'asyncProcessManager1.initDevice() failed, ignoring the error', err);
			});
		} catch (err) {
			let errs = `error:`;
			logger.error(FUNC, errs, err);
			throw err;
		}
	}

	/**
	 * Return passed in client id or if none passed in returns client id of current user.
	 */

	private adClientId(ad_client_id?: number): Promise<number> {
		const FUNC = 'getAdClientId()';
		if (ad_client_id) {
			return Promise.resolve(ad_client_id);
		} else {
			return authPrincipal.getPrincipal().then((principal: Principal) => {
				if (principal) {
					return principal.adClientId;
				} else {
					let errs = `no principal. Have you logged in?`;
					logger.error(FUNC, errs);
					return Promise.reject(new Error(errs));
				}
			});
		}
	}
}

export let deviceInit = new DeviceInit();
