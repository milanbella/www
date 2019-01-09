import { appCache } from './appcache';
import { webServicePlain } from './webserviceplain';
import { sqs } from './sqs1';
import { database } from './database';
import { authPrincipal } from './authprincipal';
import { Principal } from './types';
import { awsService } from './awsservice';
import { settings } from './settings';
import { logger } from './logger';
import { pouch } from './pouch';
import { physInvCountsProvider } from '../providers/phys-inv-counts/phys-inv-counts'

import CryptoJS from 'crypto-js';

export class Auth {
	public getEmail: any;
	public _login: any;
	public login: any;
	public logout: any;
	public synchronizeUser: any;
	public loginOffline: any;

	constructor () {

		var self = this;
		var isDebug = settings.settings.isDebug;

		function loadDatasetSetings (ctx, dataset) : Promise<any> {
			return new Promise<any>(function (resolve, reject) {
				resolve();
			});
		}

		function loadDatasetAws (ctx, dataset) : Promise<any> {
			return new Promise<any>(function (resolve, reject) {
				dataset.get('sqs', function (err, value) {
					if (err) {
						console.error('cloudempiere.services.auth: loadDatasetAws: error');
						console.dir(err);
						logger.error('cloudempiere.services.auth: loadDatasetAws: error', err, {event: 'AUTH'});
						reject(err);
						return;
					}
					resolve({
						userSQSurl: value
					});
				});
			});
		}



		this._login = function (email, password, doSynchronize) : Promise<any> {

			if (isDebug) {
				console.debug('cloudempiere.services.auth: _login()');
			}

			return authPrincipal.logout().then(function () {
				if (isDebug) {
					console.debug('cloudempiere.services.auth: calling webServicePlain.getAccessTokenByOAuth2() ...');
				}
				return webServicePlain.getAccessTokenByOAuth2(email, password).then(function (data) {
					if (isDebug) {
						console.debug('cloudempiere.services.auth: webServicePlain.getAccessTokenByOAuth2(): user authorized');
					}
					// verify if user is comming from correct client
					return database.execute('select client_id from client where id=1').then(function (result) {
						if (result.rows.length < 1) {
							// First user logged into device defines client. All users logins later on must be from same client.
							// Thus we restrict allowed users to particlular client company/firm using this device.
							return database.execute('INSERT INTO client VALUES (1, ?)', [data.ad_client_id]).then(function () {
								return {
									err: null,
									data: data
								};
							});
						} else {
							// verify if user is comming form client company/firm
							var client = result.rows.item(0).client_id;
							if (data.ad_client_id === client) {
								return {
									err: null,
									data: data
								};
							} else {
								var err = new Error('WRONG_CLIENT');
								logger.error('wrong client', err, {event: 'AUTH'});
								return {
									err: 'WRONG_CLIENT',
									data: null
								};
							}
						}
					});
				});
			}).then (function (res) {
				if (res.err) {
					return res;
				}
				var data = res.data;

				// open user session

				var lin = CryptoJS.AES.encrypt(JSON.stringify({email: email, password: password}), data.pin).toString();
				var rtk = data.refresh_token;
				var pin = CryptoJS.SHA256(data.pin).toString();
				var principal: Principal = {
					userUuid: data.user_uuid,
					userName: data.username,
					userEmail: email,
					adUserId: data.ad_user_id,
					adClientId: data.ad_client_id,
					cognitoIdentityId: data.cognito_id,
					cognitoIdentityPoolId: data.identity_pool_id,
					accessToken: data.access_token,
					rtk: rtk,
					pin: pin,
					lin: lin,
					x_auth_username: data.couch_db.x_auth_username,
					x_auth_roles: data.couch_db.x_auth_roles,
				}

				return authPrincipal.setPrincipal(principal).then(() => {
					return res;
				});

			}).then(function(res) {
				var data = res.data;

				if (isDebug) {
					console.debug('cloudempiere.services.auth: token received');
				}

				if (doSynchronize) {
					return self.synchronizeUser().then(function () {
						return {
							err: res.err,
							pin: data.pin
						};
					});
				} else {
					return {
						err: res.err,
						pin: data.pin
					};
				}
			});
		};

		this.login = function(email, password) : Promise<any> {
			return self._login(email, password, true); //TODO: use 'true' to synchronize
		};

		this.logout = function() {
			this.stopServices();
			authPrincipal.logout();
		};

		this.loginOffline = function(principal: Principal) : Promise<any> { 
			return new Promise((resolve) => {
				authPrincipal.setPrincipal(principal);
				resolve();
			});
		};


		this.synchronizeUser = () : Promise<any> => {
			console.info('cognito syncing start: data set: settings');
			logger.info('cognito syncing start: data set: settings', null, {event: 'AWS_COG'});
			return awsService.synchronizeDataset(null, 'settings', loadDatasetSetings)
				.then(() => {
					console.info('cognito syncing finished: data set: settings');
					logger.info('cognito syncing finished: data set: settings', null, {event: 'AWS_COG'});


					console.info('cognito load start: data set: appCache');
					logger.info('cognito load start: data set: appCache', null, {event: 'AWS_COG'});
					return appCache.loadFromCognitoSync().then(function () {
						console.info('cognito load finished: data set: appCache');
						logger.info('cognito load finished: data set: appCache', null, {event: 'AWS_COG'});
					});
				})
				.then(() => {
					console.info('cognito syncing start: data set: aws');
					logger.info('cognito syncing start: data set: aws', null, {event: 'AWS_COG'});
					return awsService.synchronizeDataset(null, 'aws', loadDatasetAws);
				}).then((res) => {
					console.info('cognito syncing finished: data set: aws');
					logger.info('cognito syncing finished: data set: aws', null, {event: 'AWS_COG'});
					return authPrincipal.getPrincipal().then((principal: Principal) => {
						principal.userSQSurl = res.userSQSurl;
						return authPrincipal.setPrincipal(principal);
					});
				}).then(() => {
					return this.startServices()
				})
		};

	}

	async startServices () {
		sqs.start();
		pouch.start();
		physInvCountsProvider.start();
	}

	async stopServices () {
		sqs.stop();
		pouch.stop();
		physInvCountsProvider.stop();
	}
}

export var auth: Auth = new Auth();

