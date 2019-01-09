import { logger } from './logger';

import  { _ } from 'underscore';
import * as AWS from 'aws-sdk/global';
import * as CognitoSync from 'aws-sdk/clients/cognitosync';
import 'amazon-cognito-js';


// CognitoSyncManager is loaded by npm package 'amazon-cognito-js'. Amazon aws don't provide typescript definition files for CognitoSyncManager.
// By the use of typescript Module Augmentation we open up AWS definition and add CognitoSyncManager propery to AWS to let typescript compiler know about CognitoSyncManager.

declare module "aws-sdk/global" {
	export var CognitoSyncManager: any;
}

export function setAWSCredentials (identityId, identityPoolId, accessToken) {
	//TODO ensure AWS library is loaded
	AWS.config.credentials = new AWS.CognitoIdentityCredentials({
		IdentityId: identityId,
		IdentityPoolId: identityPoolId,
		Logins: {
			'cognito-identity.amazonaws.com': accessToken
		}
	});
	AWS.config.region = 'eu-west-1';
}


class AwsService {

	private gIdentityId: any;
	private gIdentityPoolId: any;

	constructor() {
	}

	setCredentials (identityId, identityPoolId, accessToken) {

		this.gIdentityId = identityId;
		this.gIdentityPoolId = identityPoolId;

		setAWSCredentials(identityId, identityPoolId, accessToken);
	};

	setWrongCredentials (identityId, identityPoolId) {

		//TODO ensure AWS library is loaded
		AWS.config.credentials = new AWS.CognitoIdentityCredentials({
			IdentityId: identityId,
			IdentityPoolId: identityPoolId,
			Logins: {
				'cognito-identity.amazonaws.com': ''
			}
		});
		AWS.config.region = 'eu-west-1';
	};

	invalidateAccessToken () {

		//TODO ensure AWS library is loaded
		AWS.config.credentials = new AWS.CognitoIdentityCredentials({
			IdentityId: this.gIdentityId,
			IdentityPoolId: this.gIdentityPoolId,
			Logins: {
				'cognito-identity.amazonaws.com': ''
			}
		});
		AWS.config.region = 'eu-west-1';
	};

	revokeCredentials () {
		AWS.config.credentials = null;
	};

	getCognitoSync (): Promise<any> {
		return new Promise<any>((resolve, reject) => {
			resolve(new CognitoSync());
		});
	}

	getCognitoSyncManager () : Promise<any> {
		return new Promise<any>((resolve, reject) => {
			resolve(new AWS.CognitoSyncManager());
		});
	}

	openOrCreateCgsDataset (datasetName) :  Promise<any>  {
		return this.getCognitoSyncManager().then((cognitoSyncManager) => {
			return new Promise<any>((resolve, reject) => {
				cognitoSyncManager.openOrCreateDataset(datasetName, (err, dataset) => {
					if (err) {
						console.error('cloudempiere.services.AwsService: openOrCreateCgsDataset: error');
						console.dir(err);
						logger.error('cloudempiere.services.AwsService: openOrCreateCgsDataset: error', err);
						reject(err);
						return;
					}
					resolve(dataset);
				});
			});
		});
	};

	loadCgsDataset (datasetName) : Promise<any> {
		return this.getCognitoSync().then((cognitoSync) => {
			return new Promise<any>((resolve, reject) => {
				cognitoSync.listRecords({
					DatasetName: datasetName,
					IdentityId: this.gIdentityId,
					IdentityPoolId: this.gIdentityPoolId
				}, (err, dataset) => {
					if (err) {
						console.error('cloudempiere.services.AwsService: loadCgsDataset: error');
						console.dir(err);
						logger.error('cloudempiere.services.AwsService: loadCgsDataset: error', err);
						reject(err);
						return;
					}
					resolve(dataset);
				});
			});
		});
	}

	syncCgsDataset (datasetName, synchronizeFns) : Promise<any> {
		return this.openOrCreateCgsDataset(datasetName).then((dataset) => {
			return dataset.synchronize(synchronizeFns);
		});
	}

	// Loads the copy of dataset from sync storage. When dataset is loaded cbFn is called with first parameter being context 'ctx'
	// and with dataset loaded as second parameter.
	//
	// Resolves with promise containing result of 'cbFn' call.
	//
	// 'ctx' is optional parameters and may be null.
	//

	loadDataset (ctx, datasetName, cbFn) : Promise<any>  {

		var load = () => {
			var cb = _.partial(cbFn, ctx);
			return this.loadCgsDataset(datasetName)
				.then(cb);
		}
		return load();
	};

	// Synchronize data set with sync storage.
	//
	// 'ctx', 'synchronizeFns' are optional parameters. 'ctx' may be null.
	//
	// 'synchronizeFns' object contains same callbacks as for aws dataset.synchronize(), except that they are just wrappers accepting additional
	// first parametr  'ctx' (i.e. context) being passed to them. If 'synchronizeFns' is not an object but function
	// then it is assumed to be wrapped onSuccess() callback.
	//
	// Returns promise which fullfills with result of synchronizeFns.onSuccess() aws callback or rejects with result of aws synchronizeFns.onFailure()
	// callback (see dataset.synchronize()).
	//
	// If synchronizeFns.onSuccess or synchronizeFns.onFailure are undefined returend promise resolves
	// with object containing 'dataset' and 'newRecords' attributes (i.e. parameters passed by aws to onSuccess() callback) or rejects with object
	// having attribute 'err' (i.e.  parameter to onFailure() callback).
	//

	synchronizeDataset (ctx, datasetName, synchronizeFns) {

		if (_.isFunction(synchronizeFns)) {
			synchronizeFns = {
				onSuccess: synchronizeFns
			};
		}

		var sync = () : Promise<any> => {
			return new Promise<any>((resolve, reject) => {
				var cbs: any = {};
				if (synchronizeFns && synchronizeFns.onSuccess) {
					var onSuccess = _.partial(synchronizeFns.onSuccess, ctx);
					cbs.onSuccess = (dataset, newRecords) => {
						var ret = onSuccess(dataset, newRecords);
						resolve(ret);
						return ret;
					};
				} else {
					cbs.onSuccess = (dataset, newRecords) => {
						resolve({
							dataset: dataset,
							newRecords: newRecords
						});
					};
				}
				if (synchronizeFns && synchronizeFns.onFailure) {
					var onFailure = _.partial(synchronizeFns.onFailure, ctx);
					cbs.onFailure = (err) => {
						var ret = onFailure(err);
						reject(ret);
						return ret;
					};
				} else {
					cbs.onFailure = (err) => {
						console.error('AwsService.synchronizeDataset(): ' + err);
						console.dir(err);
						logger.error('AwsService.synchronizeDataset(): ', err);
						reject({err: err});
					};
				}
				if (synchronizeFns && synchronizeFns.onConflict) {
					cbs.onConflict = _.partial(synchronizeFns.onConflict, ctx);
				} else {
					cbs.onConflict =  (dataset, conflicts, callback) => {

						logger.info('AwsService.synchronizeDataset(): DatasetConflictCallback',);
						console.info('AwsService.synchronizeDataset(): DatasetConflictCallback',);

						var resolved = [];

						for (var i=0; i<conflicts.length; i++) {

							// Take remote version.
							resolved.push(conflicts[i].resolveWithRemoteRecord());

							// Or... take local version.
							// resolved.push(conflicts[i].resolveWithLocalRecord());

							// Or... use custom logic.
							// var newValue = conflicts[i].getRemoteRecord().getValue() + conflicts[i].getLocalRecord().getValue();
							// resolved.push(conflicts[i].resovleWithValue(newValue);

						}

						dataset.resolve(resolved, () => {
							return callback(true);
						});

						// Or... callback false to stop the synchronization process.
						// return callback(false);

					}

				}
				if (synchronizeFns && synchronizeFns.onDatasetDeleted) {
					cbs.onDatasetDeleted = _.partial(synchronizeFns.onDatasetDeleted, ctx);
				} else {
					cbs.onDatasetDeleted = (dataset, datasetName, callback) => {

						logger.info('AwsService.synchronizeDataset(): DatasetDeletedCallback',);
						console.info('AwsService.synchronizeDataset(): DatasetDeletedCallback',);

						// Return true to delete the local copy of the dataset.
						// Return false to handle deleted datasets outside the synchronization callback.

						return callback(true);

					}
				}
				if (synchronizeFns && synchronizeFns.onDatasetMerged) {
					cbs.onDatasetMerged = _.partial(synchronizeFns.onDatasetMerged, ctx);
				} else {
					cbs.onDatasetMerged = (dataset, datasetName, callback) => {

						logger.info('AwsService.synchronizeDataset(): DatasetMergedCallback',);
						console.info('AwsService.synchronizeDataset(): DatasetMergedCallback',);

						// Return true to continue the synchronization process.
						// Return false to handle dataset merges outside the synchronization callback.

						return callback(false);

					}
				}
				this.syncCgsDataset(datasetName, cbs)
				.catch((err) => {
					console.error('AwsService.synchronizeDataset(): ' + err);
					console.dir(err);
					logger.error('AwsService.synchronizeDataset(): ', err);
					reject({err: err});
				});
			});
		}
		return sync();
	};
}

export var awsService: AwsService = new AwsService();
