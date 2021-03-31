import { PROJECT_NAME } from './consts';
import { authPrincipal } from './authprincipal';
import { getLogger } from './logger';
import { Principal, DeviceInitializationRecord } from './types';
import { INIT_WIZARD_STATE_INITIAL } from './deviceInit';
import { deviceInit } from './deviceInit';

let logger = getLogger(PROJECT_NAME, 'deviceInitWizard.ts');

export function initWizardState(): Promise<void> {
	const FUNC = 'initWizardState()';

	return authPrincipal
		.getPrincipal()
		.then((principal: Principal) => {
			if (!principal) {
				let errs = `no principal`;
				logger.error(FUNC, errs);
				return Promise.reject(new Error(errs));
			}

			let deviceInitialization: DeviceInitializationRecord = {
				initializedAt: new Date(),
				initializedBy: principal.userUuid,
				initWizardState: INIT_WIZARD_STATE_INITIAL,
				replicationWasTriggered: false,
			};

			return deviceInit.saveInitializationResult(deviceInitialization, principal.adClientId).catch((err) => {
				let errs = `error`;
				logger.error(FUNC, errs, err);
				return Promise.reject(err);
			});
		})
		.catch((err) => {
			let errs = `error`;
			logger.error(FUNC, errs, err);
			return Promise.reject(err);
		});
}

export function getWizardState(): Promise<number> {
	const FUNC = 'getWizardState()';
	return deviceInit
		.getInitializationResult()
		.then((deviceInitialization: DeviceInitializationRecord) => {
			return deviceInitialization.initWizardState;
		})
		.catch((err) => {
			let errs = `error`;
			logger.error(FUNC, errs, err);
			return Promise.reject(err);
		});
}

export function saveWizardState(state: number): Promise<void> {
	const FUNC = 'saveWizardState()';
	return deviceInit
		.getInitializationResult()
		.then((deviceInitialization: DeviceInitializationRecord) => {
			deviceInitialization.initWizardState = state;

			return deviceInit.saveInitializationResult(deviceInitialization);
		})
		.catch((err) => {
			let errs = `error`;
			logger.error(FUNC, errs, err);
			return Promise.reject(err);
		});
}
