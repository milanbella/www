import { toPromise, promiseAll, promiseReject } from '../common/utils';
import { database } from './database';
import { awsService } from './awsservice';
import { logger } from './logger';

import  { _ } from 'underscore';

export class AppCache {

	public clearCache: any;
	public loadFromCognitoSync: any;
	public getState: any;
	public saveState: any;
	public syncCognito: any;


	constructor () {

		var self = this;

		// by http://stackoverflow.com/questions/6393943/convert-javascript-string-in-dot-notation-into-an-object-reference
		function arrayIndex (obj?, is?, value?) {
			if (typeof is === 'string') {
				return arrayIndex(obj,is.split('.'), value);
			} else if ((is.length===1) && value) {
				obj[is[0]] = value;
				return obj[is[0]];
			} else if (is.length===0) {
				return obj;
			} else {
				return arrayIndex(obj[is[0]],is.slice(1), value);
			}
		}

		this.clearCache = function(): Promise<any> {
			// promise pipe
			return database.execute('DELETE FROM "__appcache";');
		};

		function writeDataset (ctx, dataset): Promise<any> {
			return new Promise (function (resolve, reject) {
				dataset.getAllRecords(function (err, records) {
					if (err) {
						console.error('cloudempiere.services.appcache: writeDataset: error');
						console.dir(err);
						logger.error('cloudempiere.services.appcache: writeDataset: error', err);
						reject(err);
						return;
					}

					var parr = [];
					_.each(records, function (record) {
						var appIdController = record.key.split(':');

						if(appIdController.length < 2 || !appIdController[1]) {
							console.error('cloudempiere.services.appcache: writeDataset: Not Valid Controler name: ' + appIdController[1]);	// Valid format AppName:ControllerName
							var err = new Error('cloudempiere.services.appcache: writeDataset: Not Valid Controler name: ' + appIdController[1]);
							logger.error('cloudempiere.services.appcache: writeDataset: Not Valid Controler name: ' + appIdController[1], err);
							return; // Continue Loop
						}
						var p = self.saveState(record.value, appIdController[0], appIdController[1], null, true);
						parr.push(p);
					});
					promiseAll(parr)
					.then(function () {
						resolve();
					}, function (err) {
						console.error('cloudempiere.services.appcache: writeDataset: error');
						console.dir(err);
						logger.error('cloudempiere.services.appcache: writeDataset: error', err);
						return reject(err);
					});
				});
			});
		}

		this.loadFromCognitoSync = function() : Promise<any>  {
			return awsService.synchronizeDataset(null, 'appcache', writeDataset);
		};

		this.getState = function(scope, appid, controller, vars) : Promise<any> {
			return database.execute('SELECT "scope" FROM "__appcache" WHERE "appid" = ? AND "controller" = ? LIMIT 1', [appid, controller])
			.then(function(results) {
				if(results.rows.length == 0) {
					console.error('appcache.getState: No cached state for Identity/App'); //LOG only
					logger.error('appcache.getState: No cached state for Identity/App');
					return null;
				}

				var cacheScope = JSON.parse(results.rows.item(0).scope);
				for(var _v in vars) {
					/*var vInstance =*/ arrayIndex(scope, vars[_v], cacheScope[vars[_v]]);
					//vInstance = cacheScope[vars[_v]];
				}

				return cacheScope;
			});
		};

		this.saveState = function (scope, appid, controller, vars, notSyncToCognitoAfterSave) : Promise<any> {
			var rawScope = null;

			if(typeof scope === 'string')
			{
				rawScope = scope;
			} else if(typeof scope === 'object') {
				rawScope = {};

				for(var _v in vars)
				{
					var v2o = arrayIndex(scope, vars[_v]);
					if(typeof v2o !== 'undefined' &&
						typeof v2o !== 'function') {
						rawScope[vars[_v]] = v2o;
					}
				}

				//TODO: ensure JSON library is loaded
				rawScope = JSON.stringify(rawScope);
			}
			return toPromise(database.execute(
				'INSERT OR REPLACE INTO "__appcache" ("appid", "controller", "scope") VALUES (?, ?, ?)',
				[appid, controller, rawScope]
			).then((function (appid, controller) {
				return function() {
					console.debug('cloudempiere.services.appcache: saveState: ' + appid + ', ' + controller);
					if(notSyncToCognitoAfterSave) {
						return _.noop();
					} else {
						return self.syncCognito();
					}
				};
			})(appid, controller)
			, function(err) {
				console.error('cloudempiere.services.appcache: saveState: INSERT: error');
				console.dir(err);
				logger.error('cloudempiere.services.appcache: saveState: INSERT: error', err);
				return err;
			}));
		};


		this.syncCognito = function () : Promise<any> {
			return toPromise(awsService.openOrCreateCgsDataset('appcache').then(function(dataset) {
				return database.execute('SELECT "appid", "controller", "scope" FROM "__appcache"').then(function(results) {
					var errFn = function (err) {
						if(err) {
							console.error(err);
							console.dir(err);
							logger.error('cloudempiere.services.appcache: error with syncCognito()', err);
						}
					};
					for(var i = 0; i < results.rows.length; i++)
					{
						var appid = results.rows.item(i).appid,
							controller = results.rows.item(i).controller,
							scope = results.rows.item(i).scope;
						dataset.put(
							appid + ':' + controller,
							scope,
							errFn
						);
					}

					dataset.synchronize();
				});
			}));
		};
	}
}

export var appCache: AppCache = new AppCache();
