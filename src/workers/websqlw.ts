import { IWorkerMessage  } from '../app/services/types'
import { sendMessage } from './common';
import { workerCtx, settings } from './workerCtx';
import { logger } from './logger';

var DEBUG_WORKER_WEBSQL = false;

var dbIdCounter = 0;
var dbs: any = {};

function resultItem (workerId, db, trx, sql, result) {
}

function executeSql (workerId, workerName, db, trx, sql, bindings, resultFn, errFn) {
	trx.sqlIdCounter += 1;

	var _sql: any = {};
	_sql.sqlId = trx.sqlIdCounter;
	_sql.sql = sql;
	_sql.bindings = bindings;
	_sql.resultFn = resultFn;
	_sql.errFn = errFn;

	if (trx.state !== 'opened') {
		console.error('websqlw: executeSql(): transaction in illegall state (this might be caused by calling executeSql() recursively again inside executeSql() success or error callbacks');
		console.error('websqlw: executeSql(): transaction in illegall state (this might be caused by calling executeSql() recursively again inside executeSql() success or error callbacks');
		throw new Error('websqlw: executeSql(): transaction in illegall state (this might be caused by calling executeSql() recursively again inside executeSql() success or error callbacks');
	}

	trx.sqls[_sql.sqlId] = _sql;

	var msg: IWorkerMessage = {
		workerId: workerId,
		workerName: workerName,
		messageName: 'websqlTransactionExecuteSql',
		messageData: {
			dbId: db.dbId,
			trxId: trx.trxId,
			sqlId: _sql.sqlId,
			sql: sql,
			bindings: bindings
		}
	}
	return sendMessage(msg).catch(function (err) {
		console.error('websqlw: websqlTransactionExecuteSql reply: error: ' + err);
		logger.error('websqlw: websqlTransactionExecuteSql reply: error: ' + err);
	});
}

function makeExternalExecuteSqlFn (workerId, workerName, db, trx) {
	return function (sql, bindings, resultFn, errFn) {
		return executeSql(workerId, workerName, db, trx, sql, bindings, resultFn, errFn);
	}
}

function transaction (workerId, workerName, db, trxFn, errFn, successFn, continueOnError?) {
	try {
		db.trxIdCounter += 1;

		var trx: any = {};
		trx.trxId = db.trxIdCounter;
		trx.errFn = errFn;
		trx.successFn = successFn;
		trx.continueOnError = continueOnError;
		trx.sqlIdCounter = 0;
		trx.sqls = {};
		trx.executeSql = makeExternalExecuteSqlFn(workerId, workerName, db, trx);

		dbs[db.dbId].trxs[trx.trxId] = trx;

		var msg: IWorkerMessage = {
			workerId: workerId,
			workerName: workerName,
			messageName: 'websqlTransaction',
			messageData: {
				dbId: db.dbId,
				trxId: trx.trxId,
				continueOnError: trx.continueOnError
			}
		}
		sendMessage(msg).then(function () {
			try {
				trx.state = 'opened';
				trxFn(trx);
			} catch (err) {
				trx.state = 'error';
				console.error('websqlw: error while calling transaction callback');
				console.dir(err);
				logger.error('websqlw: error while calling transaction callback', err);
				msg = {
					workerId: workerId,
					workerName: workerName,
					messageName: 'websqlTransactionRemove',
					messageData: {
						dbId: db.dbId,
						trxId: trx.trxId,
					}
				}
				sendMessage(msg).then(function () {
					try {
						errFn(trx, err);
					} catch (err) {
						console.error('websqlw: transaction: errFn: error while calling transaction error callback');
						console.dir(err);
						logger.error('websqlw: transaction: errFn: error while calling transaction error callback', err);
						delete dbs[db.dbId].trxs[trx.trxId];
						throw err;
					}
					delete dbs[db.dbId].trxs[trx.trxId];
				}, function (err) {
					console.error('websqlw: websqlTransactionRemove reply: error: ' + err);
					logger.error('websqlw: websqlTransactionRemove reply: error: ' + err);
				});
			}
			msg = {
				workerId: workerId,
				workerName: workerName,
				messageName: 'websqlTransactionExecute',
				messageData: {
					dbId: db.dbId,
					trxId: trx.trxId,
				}
			}
			sendMessage(msg).then(function () {
				trx.state = 'executing';
			}, function (err) {
				trx.state = 'error';
				try {
					console.error('websqlw: websqlTransactionExecute reply: error: ' + err);
					logger.error('websqlw: websqlTransactionExecute reply: error: ' + err);
					errFn(err);
				} catch (err) {
					console.error('websqlw: transaction: errFn: error while calling transaction error callback');
					console.dir(err);
					logger.error('websqlw: transaction: errFn: error while calling transaction error callback', err);
					delete dbs[db.dbId].trxs[trx.trxId];
					throw err;
				}
				delete dbs[db.dbId].trxs[trx.trxId];
			});
		}, function (err) {
			trx.state = 'error';
			console.error('websqlw: websqlTransaction reply: error: ' + err);
			logger.error('websqlw: websqlTransaction reply: error: ' + err);
			try {
				errFn(err);
			} catch (err) {
				console.error('websqlw: transaction: errFn: error while calling transaction error callback');
				console.dir(err);
				logger.error('websqlw: transaction: errFn: error while calling transaction error callback', err);
				delete dbs[db.dbId].trxs[trx.trxId];
				throw err;
			}
			delete dbs[db.dbId].trxs[trx.trxId];
			throw err;
		});
	} catch (err) {
		console.error('websqlw: transaction: error: ');
		console.dir(err);
		logger.error('websqlw: transaction: error: ', err);
		throw err;
	}
}

function makeExternalTransactionFn (workerId, workerName, db) {
	return function (trxFn, errFn, successFn, continueOnError) {
		return transaction (workerId, workerName, db, trxFn, errFn, successFn, continueOnError);
	}
}

function execute (db, sql, binding) : Promise<any> {
	var workerStr = '' + workerCtx.workerName + '(' + workerCtx.workerId + ')';
	if (settings.settings.isDebug && settings.settings.isDebugDatabase) {
		console.debug(workerStr + ' :database.execute: ' + sql);
	}
	var exceuted = false;
	var executedOk;
	return new Promise<any>((resolve, reject) => {
		db.transaction((tx) => {
			tx.executeSql(sql, binding, (tx, results) => {
				exceuted = true;
				executedOk = true;
				resolve(results);
			}, (tx, err) => {
				exceuted = true;
				executedOk = false;
				console.error(workerStr + ' :database.execute: tx.executeSql: ' + err);
				console.dir(err);
				logger.error(workerStr +' :database.execute: tx.executeSql: ' + err, err, {event: 'SQL'});
				reject(err);
			});
		}, (err) => {
			if (!exceuted) {
				console.error(workerStr + ' :database.execute: internal error: sql was not executed');
				err = new Error(workerStr + ' :database.execute: internal error: sql was not executed');
				logger.error(workerStr + ' :database.execute: transaction: ' + err, err, {event: 'SQL'});
				reject(err);
				return;
			}
			if (executedOk) {
				console.error(workerStr + ' :database.execute: internal error');
				err = new Error(workerStr + ' :database.execute: internal error');
				logger.error(workerStr + ' :database.execute: transaction: ' + err, err, {event: 'SQL'});
				reject(err);
				return;
			}
			console.error(workerStr + ' :database.execute: transaction: ' + err);
			console.dir(err);
			logger.error(workerStr + ' :database.execute: transaction: ' + err, err, {event: 'SQL'});
		}, () => {
			var err;
			if (!exceuted) {
				console.error(workerStr + ' :database.execute: internal error: sql was not executed');
				err = new Error(workerStr + ' :database.execute: internal error: sql was not executed');
				logger.error(workerStr + ' :database.execute: transaction: ' + err, err, {event: 'SQL'});
				reject(err);
				return;
			}
			if (!executedOk) {
				console.error(workerStr + ' :database.execute: internal error');
				err = new Error(workerStr + ' :database.execute: internal error');
				logger.error(workerStr + ' :database.execute: transaction: ' + err, err, {event: 'SQL'});
				reject(err);
				return;
			}
		});
	});
};

function _openDatabase (callbackFn) {
	dbIdCounter += 1;

	var db: any = {};
	db.dbId = dbIdCounter;
	db.trxIdCounter = 0;
	db.trxs = {};
	db.transaction = makeExternalTransactionFn(workerCtx.workerId, workerCtx.workerName, db); 
	db.close = function () {
		delete dbs[db.dbId];
	};
	db.execute = function (sql, binding) {
		return execute(db, sql, binding);
	};

	var msg: IWorkerMessage = {
		workerId: workerCtx.workerId,
		workerName: workerCtx.workerName,
		messageName: 'websqlDatabse',
		messageData: {
			dbId: db.dbId
		}
	}
	return sendMessage(msg).then(function () {
		dbs[db.dbId] = db;
		callbackFn(undefined, db);
	}, function (err) {
		callbackFn(err);
	})
}


export function listenToEvenets (event) {  // returns true if reply was sent back to main thread, i.e. if event was processed
	var err;
	var result;

	var msg: IWorkerMessage = event.data;
	var dbId;
	var db;
	var trxId;
	var trx;
	var sqlId;
	var sql;

	if (DEBUG_WORKER_WEBSQL) {
		console.log('websqlw: ' + msg.messageName);
		console.log('dbId: ' + msg.messageData.dbId);
		console.log('trxId: ' + msg.messageData.trxId);
		console.log('sqlId: ' + msg.messageData.sqlId);
	}

	try {

		if ('websqlTransactionExecuteSqlResultSuccess' === msg.messageName) {
			dbId = msg.messageData.dbId;
			db = dbs[dbId];
			trxId = msg.messageData.trxId;
			trx = db.trxs[trxId];
			sqlId = msg.messageData.sqlId;
			sql = trx.sqls[sqlId];
			sql.result =  msg.messageData.result;
			sql.result.rows.item = function (i) {
				if (i < sql.result.rows.length) {
					return sql.result.rows[i];
				} 
			}
			try {
				sql.resultFn(trx, sql.result);
				event.ports[0].postMessage({});
				trx.sqls[sqlId] = null;
			} catch (err) {
				try {
					console.error('websqlw: error while calling executeSql success callback');
					console.dir(err);
					logger.error('websqlw: error while calling executeSql success callback', err);
					sql.err = err;
					result = sql.errFn(trx, sql.err);
					if (false === result) {
						console.error('websqlw: error: executeSql() error callback "false" return value not supported, use instead "continueOnError" optional parameter for transaction() call');
						logger.error('websqlw: error: executeSql() error callback "false" return value not supported, use instead "continueOnError" optional parameter for transaction() call');
					}
					event.ports[0].postMessage({
						err: '' + err
					});
					trx.sqls[sqlId] = null;
				} catch (err) {
					try {
						console.error('websqlw: error while calling executeSql error callback');
						console.dir(err);
						logger.error('websqlw: error while calling executeSql error callback', err);
						event.ports[0].postMessage({
							err: '' + err
						});
						trx.sqls[sqlId] = null;
					} catch (err) {
						event.ports[0].postMessage({
							err: '' + err,
						});
						trx.sqls[sqlId] = null;
					}
				}
			}
			return true;

		} 
		if ('websqlTransactionExecuteSqlResultError' === msg.messageName) {
			dbId = msg.messageData.dbId;
			db = dbs[dbId];
			trxId = msg.messageData.trxId;
			trx = db.trxs[trxId];
			sqlId = msg.messageData.sqlId;
			sql = trx.sqls[sqlId];
			sql.err = msg.messageData.err;
			try {
				result = sql.errFn(trx, sql.err);
				if (false === result) {
					console.error('websqlw: error: executeSql() error callback "false" return value not supported, use instead "continueOnError" optional parameter for transaction() call');
					logger.error('websqlw: error: executeSql() error callback "false" return value not supported, use instead "continueOnError" optional parameter for transaction() call');
				}
				event.ports[0].postMessage({});
				trx.sqls[sqlId] = null;
			} catch (err) {
				console.error('websqlw: error while calling executeSql error callback');
				console.dir(err);
				logger.error('websqlw: error while calling executeSql error callback', err);
				event.ports[0].postMessage({});
				trx.sqls[sqlId] = null;
				throw err;
			}
			return true;
		}

		if ('websqlTransactionResultError' === msg.messageName) {
			dbId = msg.messageData.dbId;
			db = dbs[dbId];
			trxId = msg.messageData.trxId;
			trx = db.trxs[trxId];
			try {
				trx.errFn(msg.messageData.err);
				event.ports[0].postMessage({});
				delete db.trxs[trxId];
			} catch (err) {
				event.ports[0].postMessage({});
				delete db.trxs[trxId];
				console.error('websqlw: error while calling transaction callback');
				console.dir(err);
				logger.error('websqlw: error while calling transaction callback', err);
				throw err;
			}
			return true;
		}

		if ('websqlTransactionResultSuccess' === msg.messageName) {
			dbId = msg.messageData.dbId;
			db = dbs[dbId];
			trxId = msg.messageData.trxId;
			trx = db.trxs[trxId];
			try {
				trx.successFn();
				event.ports[0].postMessage({});
				delete db.trxs[trxId];
			} catch (err) {
				event.ports[0].postMessage({});
				delete db.trxs[trxId];
				console.error('websqlw: error while calling transaction callback');
				console.dir(err);
				logger.error('websqlw: error while calling transaction callback', err);
				throw err;
			}
			return true;
		}

	} catch (err) {
		console.error('websqlw: error: ');
		console.dir(err);
		event.ports[0].postMessage({
			err: '' + err
		});
		return true;
	}
};    

export function openDatabase (): Promise<any> {
	return new Promise<any> (function (resolve, reject) {
		_openDatabase(function (err, db) {
			if (err) {
				reject(err)
			} else {
				resolve(db)
			}
		});
	});
}
