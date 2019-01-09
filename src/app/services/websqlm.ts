import { database } from './database';
import { IWorkerMessage } from './types';
import { logger } from './logger';
import { settings } from './settings';

import { _ } from 'underscore';

var DEBUG_WORKER_WEBSQL = false;

// Attach main thread websql handler for given worker.
export function websqlmAttach (worker, workerId, workerName) {

	var dbs: any = [];

	var dbId: any;
	var db: any;
	var trxId: any;
	var trx: any;
	var continueOnError: any;
	var sqlId: any;
	var sql: any;

	return function (event) : boolean { // returns true if reply was sent back to worker, i.e. if event was processed
		var messageProcessed = false;

		var err;
		var msg: IWorkerMessage;
		var channel;

		msg = event.data;

		if (msg.workerId !== workerId) {
			console.error('websqlm: workerId diffres');
			err = new Error('websqlm: workerId diffres'); 
			event.ports[0].postMessage({
				err: '' + err
			}); 
			return messageProcessed;
		}

		if (DEBUG_WORKER_WEBSQL) {
			console.log('websqlm: ' + msg.messageName);
			console.log('dbId: ' + msg.messageData.dbId);
			console.log('trxId: ' + msg.messageData.trxId);
			console.log('sqlId: ' + msg.messageData.sqlId);
		}

		try {

			if ('websqlDatabse' === msg.messageName) {
				messageProcessed = true;

				dbId = msg.messageData.dbId
				database.getDb().then((db) => {
					dbs[dbId] = {
						db: db,
						dbId: dbId,
						trxs: {}
					}
					event.ports[0].postMessage({}); 
				}, (err) => {
					event.ports[0].postMessage({
						err: '' + err
					}); 
				});

			} else if ('websqlTransaction' === msg.messageName) {
				messageProcessed = true;

				dbId = msg.messageData.dbId;
				trxId = msg.messageData.trxId;
				continueOnError = msg.messageData.continueOnError;
				dbs[dbId].trxs[trxId] = {
					trxId: trxId,
					continueOnError: continueOnError,
					sqls: {}
				};
				event.ports[0].postMessage({}); 
			} else if ('websqlTransactionRemove' === msg.messageName) {
				messageProcessed = true;

				dbId = msg.messageData.dbId;
				trxId = msg.messageData.trxId;
				delete dbs[dbId].trxs[trxId];
				event.ports[0].postMessage({}); 

			} else if ('websqlTransactionExecuteSql' === msg.messageName) {
				messageProcessed = true;

				dbId = msg.messageData.dbId;
				db = dbs[dbId];
				trxId = msg.messageData.trxId;
				trx = db.trxs[trxId];
				sqlId = msg.messageData.sqlId;
				trx.sqls[sqlId] = {
					sqlId: sqlId,
					sql: msg.messageData.sql,
					bindings: msg.messageData.bindings
				}
				event.ports[0].postMessage({}); 

			} else if ('websqlTransactionExecute' === msg.messageName) {
				messageProcessed = true;

				event.ports[0].postMessage({}); 
				transactionExcecute(msg);

			}
			return messageProcessed;

		} catch (err) {
			messageProcessed = true;

			console.error('websqlm: error: ' + err);
			console.dir(err);
			logger.error('websqlm: error: ' + err, err);
			event.ports[0].postMessage({
				err: '' + err
			});
			return messageProcessed;
		}
	}

	function transactionExcecute (msg) {

		var dbId = msg.messageData.dbId;
		var db = dbs[dbId];
		var trxId = msg.messageData.trxId;
		var trx = db.trxs[trxId];
		var continueOnError = trx.continueOnError;
		if (msg.messageData.continueOnError) {
			continueOnError = msg.messageData.continueOnError;
		}

		//console.log('@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ continueOnError: ' + continueOnError);

		db.db.transaction((tx) => {

			_.each(trx.sqls, function (sql) {
				if (settings.settings.isDebug && settings.settings.isDebugDatabase) {
					console.debug(`websqlm: dbId: ${dbId}:  trxId: ${trxId}: sqlId: ${sql.sqlId}:  execute: ` + sql.sql);
				}
				tx.executeSql(sql.sql, sql.bindings, (tx, result) => {
					sql.result = result;

					var channel = new MessageChannel();
					var msg: IWorkerMessage = {
						workerId: workerId,
						workerName: workerName,
						messageName: 'websqlTransactionExecuteSqlResultSuccess',
						messageData: {
							dbId: dbId,
							trxId: trxId,
							sqlId: sql.sqlId
						}
					}
					var _result : any = {};
					_result.rows = [];
					for (var i=0; i < result.rows.length; i++) {
						_result.rows.push(result.rows.item(i));
					}
					msg.messageData.result = _result;

					channel = new MessageChannel();
					worker.postMessage(msg, [channel.port2]);
					channel.port1.onmessage = function (event) {
						var err = event.data.err;
						if (err) {
							console.error('websqlm: websqlTransactionExecuteSqlResultSuccess reply: error: ' + err);
							logger.error('websqlm: websqlTransactionExecuteSqlResultSuccess reply: error: ' + err);
						}
					}
				}, (tx, err) => {
					sql.err = err;
					var channel = new MessageChannel();
					var msg: IWorkerMessage = {
						workerId: workerId,
						workerName: workerName,
						messageName: 'websqlTransactionExecuteSqlResultError',
						messageData: {
							dbId: dbId,
							trxId: trxId,
							sqlId: sql.sqlId,
							err: '' + err
						}
					}
					if (settings.settings.isDebug && settings.settings.isDebugDatabase) {
						console.debug(`websqlm: dbId: ${dbId}:  trxId: ${trxId}: sqlId: ${sql.sqlId}:  sql execute: error: ` + err);
					}

					worker.postMessage(msg, [channel.port2]);
					channel.port1.onmessage = function (event) {
						var err = event.data.err;
						if (err) {
							console.error('websqlm: websqlTransactionExecuteSqlResultSuccess reply: error: ' + err);
							logger.error('websqlm: websqlTransactionExecuteSqlResultSuccess reply: error: ' + err);
						}
					}

					if (continueOnError) {
						return false;
					}
				});
			});
		}, (err) => {
			var channel = new MessageChannel();
			var msg: IWorkerMessage = {
				workerId: workerId,
				workerName: workerName,
				messageName: 'websqlTransactionResultError',
				messageData: {
					dbId: dbId,
					trxId: trxId,
					err: '' + err
				}
			}
			if (settings.settings.isDebug && settings.settings.isDebugDatabase) {
				console.debug(`websqlm: dbId: ${dbId}:  trxId: ${trxId}: transaction execute: error: ` + err);
			}
			worker.postMessage(msg, [channel.port2]);
			channel.port1.onmessage = function (event) {
				var err = event.data.err;
				if (err) {
					console.error('websqlm: websqlTransactionResultError reply: error: ' + err);
					logger.error('websqlm: websqlTransactionResultError reply: error: ' + err);
				}
			}
			delete db.trxs[trxId];
		}, () => {

			var channel = new MessageChannel();
			var msg: IWorkerMessage = {
				workerId: workerId,
				workerName: workerName,
				messageName: 'websqlTransactionResultSuccess',
				messageData: {
					dbId: dbId,
					trxId: trxId,
				}
			}
			if (settings.settings.isDebug && settings.settings.isDebugDatabase) {
				console.debug(`websqlm: dbId: ${dbId}:  trxId: ${trxId}: transaction execute: ok`);
			}
			worker.postMessage(msg, [channel.port2]);
			channel.port1.onmessage = function (event) {
				var err = event.data.err;
				if (err) {
					console.error('websqlm: websqlTransactionResultSuccess reply: error: ' + err);
					logger.error('websqlm: websqlTransactionResultSuccess reply: error: ' + err);
				}
			}
			delete db.trxs[trxId];
		});
	}
}
