import { PROJECT_NAME } from './consts';
import { pouch } from './pouch1';
import { authPrincipal } from './authprincipal';
import { Principal } from './types';
import { settings } from './settings';
import { getLogger } from './logger';

let logger = getLogger(PROJECT_NAME, 'userData.ts');

class UserDataService {
	setUserData(userData: any): Promise<any> {
		const FUNC = 'setUserData()';
		return authPrincipal.getPrincipal().then((principal: Principal) => {
			if (!principal) {
				let err = new Error('no principal');
				logger.error(FUNC, `error: `, err);
				return Promise.reject(err);
			}

			return pouch.setUserData(principal.userUuid, userData).then((userData) => {
				if (settings.settings.isDebug && settings.settings.isDebugPouchDb) {
					let jsonUserData = JSON.stringify(userData);
					logger.info(FUNC, `setUserData: ${jsonUserData}`);
				}

				return userData;
			});
		});
	}

	getUserData(): Promise<any> {
		const FUNC = 'getUserData()';
		return authPrincipal.getPrincipal().then((principal: Principal) => {
			if (!principal) {
				let err = new Error('no principal');
				logger.error(FUNC, `error: `, err);
				return Promise.reject(err);
			}

			return pouch.getUserData(principal.userUuid).then((userData) => {
				if (settings.settings.isDebug && settings.settings.isDebugPouchDb) {
					let jsonUserData = JSON.stringify(userData);
					logger.info(FUNC, `getUserData: ${jsonUserData}`);
				}

				return userData;
			});
		});
	}

	saveControllerScopes(scope: any): Promise<any> {
		return this.getUserData().then((userData) => {
			if (!userData) {
				userData = {};
			}
			userData.controllerScopes = scope;
			return this.setUserData(userData);
		});
	}

	getControllerScopes(): Promise<any> {
		return this.getUserData().then((userData) => {
			if (!userData) {
				return {};
			}
			if (userData.controllerScopes) {
				return userData.controllerScopes;
			} else {
				return {};
			}
		});
	}
}

export let userDataService = new UserDataService();
