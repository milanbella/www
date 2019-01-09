import { promiseReject, promiseAll } from '../common/utils';

import { authPrincipal } from './authprincipal';
import { Principal } from './types';
import { net } from './net';
import { pingHttp } from './pinghttp';
import { settings } from './settings';
import { Logger, getLogger } from './logger';

var logger: Logger = getLogger('whttp');



export class Whttp {

	public useInvalidAccessToken: boolean; 	// just for testing - forces invalid access token be used and consequently retry request using new access token 
											// obtained using refresh token

	send (request: any) : Promise<any> {
		return pingHttp()
		.then(() => {
			return authPrincipal.getPrincipal().then((principal: Principal) => {
				return principal;
			});
		}, () => {
			var err = new Error('send(): http call failed, no internet access');
			logger.warn('error: ', err);
			return promiseReject(err);
		})
		.then((principal: Principal) => {
			var setHttpCredentials = (request: any) => {
				if (this.useInvalidAccessToken) {
					request.headers.set('Authorization', 'Bearer xx');
					this.useInvalidAccessToken = false;
				} else {
					request.headers.set('Authorization', 'Bearer ' + principal.accessToken);
				}
			};

			setHttpCredentials(request);

			return fetch(request).then((response) => {
				if (response.ok) {
					return response;
				}
				if(response.status === 401) {
					if (settings.settings.isDebug) {
						console.debug(`send(): http status 401 unauthorized: ${request.url} ${request.method}`);
					}
					logger.debug('send(): status: 401 unauthorized: attempting to refresh token ...');

					return authPrincipal.refreshToken().then(() => {
						return this.send(request); // resend request after refreshing access token
					}, function(err) {
						console.error('send(): cannot refresh access token.', err);
						logger.error('send(): cannot refresh access token', err);									
						return promiseReject(new Error('send(): cannot refresh access token'));
					});

				} else {
					return response.text().then((text) => {
						console.error(`send(): http status ${response.status}: ${request.url} ${request.method}`);
						console.dir(response);
						logger.error(`send(): http status: ${response.status}: ${request.url} ${request.method}: ${text}`, response);
						return promiseReject(new Error(`send(): http status ${response.status}: ${request.url} ${request.method}`));
					}, (err) => {
						logger.error('send(): error: ' + err, err);
						console.error('send(): error: ' + err, err);
						return promiseReject(err);
					});
				}
			});
		});
	}

}

export var whttp: Whttp = new Whttp();
