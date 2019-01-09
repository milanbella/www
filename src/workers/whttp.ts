import 'whatwg-fetch';
import 'url-search-params-polyfill';

import { promiseReject, promiseAll } from '../app/common/utils';
import { logger } from './logger';
import { pingHttp } from '../app/services/pinghttp';
import { settings } from './workerCtx';
import { webServicePlain } from './webserviceplain';
import { authPrincipal } from './authprincipal';
import { Principal } from '../app/services/types';
import { refreshPrincipal } from './common';


class Whttp {

	public useInvalidAccessToken: boolean; 	// just for testing - forces invalid access token be used and consequently retry request using new access token 
											// obtained using refresh token

	send (request: any) : Promise<any> {
		return pingHttp()
		.then(() => {
			return authPrincipal.getPrincipal().then((principal: Principal) => {
				return principal;
			});
		}, () => {
			var err = new Error('wworkerWhttp: http call failed, no internet access');
			logger.warn('wworkerWhttp: error', err);
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
					if (settings.isDebug) {
						console.debug(`workerWhttp: send(): http status 401 unauthorized: ${request.url} ${request.method}`);
					}
					logger.debug(`workerWhttp status: 401 unauthorized: attempting to refresh token ...`);

					return authPrincipal.refreshToken().then(() => {
						refreshPrincipal();
						return this.send(request); // resend request after refreshing access token
					});

				} else {
					response.text().then((text) => {
						console.error(`workerWhttp: send(): http status ${response.status}: ${request.url} ${request.method}`);
						console.dir(response);
						logger.error(`workerWhttp: send(): http status: ${response.status}: ${request.url} ${request.method}: ${text}`, response);
						return promiseReject(new Error(`workerWhttp: send(): http status ${response.status}: ${request.url} ${request.method}`));
					}, (err) => {
						logger.error('workerWhttp: error: ' + err, err);
						console.error('workerWhttp: error: ' + err, err);
						return promiseReject(err);
					})
				}
			});
		});
	}
}

export var whttp: Whttp = new Whttp();
