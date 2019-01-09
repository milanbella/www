import { Injectable } from '@angular/core';
import { toPromise, promiseResolve, promiseReject, promiseAll, waitFor } from '../common/utils';

import { Database } from './idbDatabase';
import { GetCloudempiereDatabase } from './idbDatabase';
import { STORAGE_NAME_USER, STORAGE_NAME_CURRENT_USER, INDEX_NAME_USER_PIN } from './idbDatabase';
import { Principal, CurrentUser } from './types';
import { awsService } from './awsservice';
import { webServicePlain } from '../../workers/webserviceplain';
import { logger } from './logger';
import { EventSource } from './eventSource';

import CryptoJS from 'crypto-js';
import { _ } from 'underscore';

class AuthPrincipal {

	principal: Principal;

	private refreshingAccessToken = false;

	constructor () {

		this.getPrincipal().then(function (principal) {
			EventSource.principalChangeEventSource.generateEvent(principal);
		}, function (err) {
			console.error('authprincipal: getPrincipal(): error');
			console.dir(err);
			logger.error('authprincipal: getPrincipal(): error', err, {event: 'AUTH'});
		});

	}

	private persistPrincipal (principal: Principal) : Promise<any> {
		return GetCloudempiereDatabase().then((database: Database) => {
			return database.putRecord(STORAGE_NAME_USER, principal).then(() => {
				var currentUser: CurrentUser = {
					id: 1,
					userUuid: principal.userUuid
				}
				return database.putRecord(STORAGE_NAME_CURRENT_USER, currentUser);
			});
		})
	}


	setPrincipal (principal: Principal) : Promise<any> {
		awsService.setCredentials(principal.cognitoIdentityId, principal.cognitoIdentityPoolId, principal.accessToken);
		this.principal = principal;
		return this.persistPrincipal(principal).then(() => {
			EventSource.principalChangeEventSource.generateEvent(principal);
		});
	}

	logout (): Promise<any> {
		
		EventSource.principalChangeEventSource.generateEvent(null);
		awsService.revokeCredentials();
		this.principal = null;
		return GetCloudempiereDatabase().then((database: Database) => {
			return database.removeRecord(STORAGE_NAME_CURRENT_USER, 1);
		});

		//TODO: revoke access and refresh token
	}

	getPrincipal () : Promise<any> {
		return GetCloudempiereDatabase().then((database: Database) => {
			return database.getRecord(STORAGE_NAME_CURRENT_USER, 1).then((record) => {
				if (record) {
					return database.getRecord(STORAGE_NAME_USER, record.userUuid).then((record) => {
						if (record) {
							var principal: Principal = {
								userUuid: record.userUuid,
								userName: record.userName,
								userEmail: record.userEmail,
								adUserId: record.adUserId,
								adClientId: record.adClientId,
								cognitoIdentityId: record.cognitoIdentityId,
								cognitoIdentityPoolId: record.cognitoIdentityPoolId,
								accessToken: record.accessToken,
								rtk: record.rtk,
								pin: record.pin,
								lin: record.lin,
								// Get CouchDB Auth
								x_auth_username: record.x_auth_username, //TODO: rename to couchdb_x_auth_username
								x_auth_roles: record.x_auth_roles,
								userSQSurl: record.userSQSurl
							}
							awsService.setCredentials(principal.cognitoIdentityId, principal.cognitoIdentityPoolId, principal.accessToken);
							this.principal = principal;
							return principal;
						}
					});
				} else {
					awsService.revokeCredentials();
				}
			});
		});
	}

	getPrincipalByPin (pin): Promise<any> {
		pin = CryptoJS.SHA256(pin).toString();
		return GetCloudempiereDatabase().then((database: Database) => {
			return database.getIndexRecord(STORAGE_NAME_USER, INDEX_NAME_USER_PIN, pin).then((record) => {
				if (record) {
					var principal: Principal = {
						userUuid: record.userUuid,
						userName: record.userName,
						userEmail: record.userEmail,
						adUserId: record.adUserId,
						adClientId: record.adClientId,
						cognitoIdentityId: record.cognitoIdentityId,
						cognitoIdentityPoolId: record.cognitoIdentityPoolId,
						accessToken: record.accessToken,
						rtk: record.rtk,
						pin: record.pin,
						lin: record.lin,

						// Get CouchDB Auth
						x_auth_username: record.x_auth_username,
						x_auth_roles: record.x_auth_roles,

						userSQSurl: record.userSQSurl
					};
					awsService.setCredentials(principal.cognitoIdentityId, principal.cognitoIdentityPoolId, principal.accessToken);
					this.principal = principal;
					return principal;
				} else {
					awsService.revokeCredentials();
				}
			});
		});
	}


	refreshToken (onRefreshCb?) : Promise<any>  {
		console.info('authprincipal: refreshToken(): refreshing access token ......');
		var err;
		return waitFor(() => {
			return this.refreshingAccessToken === false;
		}).then(() => {
			this.refreshingAccessToken = true;
			return this.getPrincipal().then((principal) => {
				if (principal) {
					if (!principal.rtk) {
						console.error('authprincipal: refreshToken(): failed: no rtk');
						err = new Error('authprincipal: refreshToken(): failed: no rtk')
						logger.error('authprincipal: refreshToken(): failed: no rtk', null, {event: 'AUTH'});
						this.refreshingAccessToken = false;
						return promiseReject(err);
					}
					return webServicePlain.getAccessTokenByOAuth2byRefreshToken(principal.rtk).then((data) => {
						principal.accessToken = data.accessToken;
						principal.rtk = data.refreshToken;
						principal.cognitoIdentityId = data.identityId;
						principal.cognitoIdentityPoolId = data.identityPoolId;

						return this.setPrincipal(principal).then(() => {
							console.info('authprincipal: refreshToken(): access token refreshed');
							logger.info('authprincipal: refreshToken(): access token refreshed', null, {event: 'AUTH'});
							this.refreshingAccessToken = false;
							if (onRefreshCb) {
								if (_.isFunction(onRefreshCb.then)) {
									return onRefreshCb().catch((err) => {
										console.error('authprincipal: refreshToken(): error calling onRefreshCb()');
										console.dir(err);
										logger.error('authprincipal: refreshToken(): error calling onRefreshCb()', err);
										return promiseReject(err);
									});
								} else {
									try {
										onRefreshCb();
									} catch (err) {
										console.error('authprincipal: refreshToken(): error calling onRefreshCb()');
										console.dir(err);
										logger.error('authprincipal: refreshToken(): error calling onRefreshCb()', err);
										return promiseReject(err);
									}
								}
							}
						}, (err) => {
							console.error('authprincipal: refreshToken(): failed' + err);
							console.dir(err);
							logger.error('authprincipal: refreshToken(): failed' + err, err, {event: 'AUTH'});
							this.refreshingAccessToken = false;
							return promiseReject(err);
						});
					});
				} else {
						console.error('authprincipal: refreshToken(): failed: no principal');
						err = new Error('authprincipal: refreshToken(): failed: no principal')
						logger.error('authprincipal: refreshToken(): failed: no principal', err, {event: 'AUTH'});
						this.refreshingAccessToken = false;
						return promiseReject(err);
				}
			});
		});
	}
}

export var authPrincipal: AuthPrincipal = new AuthPrincipal();
