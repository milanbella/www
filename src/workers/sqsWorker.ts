import { logger } from './logger';

import { IWorkerMessage } from '../app/services/types';
import { pingHttp } from '../app/services/pinghttp';
import { bootWorker } from './worker';
import { openDatabase } from './websqlw';
import { webService } from '../app/services/webservice';
import { workerCtx, settings } from './workerCtx';
import { parseSQSmessageToSQL } from '../app/services/jsontosqlparser1';
import { authPrincipal } from './authprincipal';
import { promiseResolve, 
		promiseReject, promiseAll,
		sequenceOfPromisesUntillValue, rowsToJson } from '../app/common/utils';
import { sendMessage } from './common';

import { _ } from 'underscore';

var DEBUG: any = {};

// If number of errors exceeds threshold limit then stream will be forcibly closed.
var STREAM_ERROR_COUNT_THRESHOLD = 5;

// Duration of message buffer. Received messages will be buffered in message buffer prior writing to database
// to avoid db transaction overhead. If time diffrence between last and first message in buffer exceeds MESSAGE_BUFFER_DURATION
// messages in buffer will be flushed from buffer in database using single transaction. Bear in mind that as a side effect data changes received 
// by queue will not be seen by application layer untill MESSAGE_BUFFER_DURATION paseed!

//private MESSAGE_BUFFER_DURATION = 30000; // in milliseconds
var MESSAGE_BUFFER_DURATION = 15000; // in milliseconds

var sqsReceiveStreams = [];

var deadLetterQueueUrl: string;

var nextStreamId = 1;

function makeMessageStream (queueUrl, properties, streamId, sqsQueue) {

	if (!queueUrl) {
		console.error('sqs: makeMessageStream: no queueUrl');
		var err = new Error('sqs: makeMessageStream: no queueUrl');
		logger.error('sqs: makeMessageStream: no queueUrl', err);
		throw err;
	}

	var closed = false;
	var pauseStreamTime = 10; // time to wait to next resume if stream is paused or offline 
	var errorCount = 0; // total count of errors so far on this queue
	var maxErrorCount = properties.streamErroCountThreshold || STREAM_ERROR_COUNT_THRESHOLD;

	var msgsReceived = 0;
	var paused = false;

	// Returns promise containing next incomming message or EOF.

	function receiveMessage () : Promise<any> {

		function resume () {
			return new Promise<any>((resolve) => {
				setTimeout(()=>{
					resolve();
				},  pauseStreamTime);
			});
		}

		function receive () : Promise<any> {
			return new Promise<any>((resolve, reject) => {

				if (closed) {
					// emit EOF when closed
					if (settings.settings.isDebug && settings.settings.isDebugSQS) {
						console.debug('sqs: messageStream: closed: finished receiving from ' + queueUrl);
					}
					resolve({
						err: null,
						data: null,
						eof: true, // end of file
					});
					return;
				}

				if (paused) {
					reject('paused');
					return;
				}

				if (workerCtx.offline || !settings.settings.isSQS) {
					reject('paused');
					return;
				}

				awsSqsReceiveMessage(queueUrl, 10, 20, (err, data) => {
					if (err) {
						console.error('sqs: messageStream: receive failed from ' + queueUrl + ' : ' + err);
						console.dir(err);
						reject(err);
						return;
					} else {
						if (settings.settings.isDebug && settings.settings.isDebugSQS && (settings.settings.sqsDebugLevel > 0)) {
							console.debug('sqs: messageStream: ' + streamId + ' received ' + data.Messages.length +  ' messages from ' + queueUrl);
						}
					}

					msgsReceived += data.Messages.length;

					var EntriesforDelete = [];
					for(var mId in data.Messages)
					{
						EntriesforDelete.push({
							Id: data.Messages[mId].MessageId,
							ReceiptHandle: data.Messages[mId].ReceiptHandle
						});
					}

					// delete received  messages from queue prior pushing it on stream
					var deleteImmediatelly = false;
					if (deleteImmediatelly) {
						((_data) => {
							if (EntriesforDelete.length > 0) {
								awsSqsDeleteMessageBatch(queueUrl, EntriesforDelete, (err) => {
									if(err) {
										console.error('sqs: messageStream: error deleting messages from ' + queueUrl);
										console.dir(err);
										logger.error('sqs: messageStream: error deleting messages from ' + queueUrl, err);
										resolve({
											err: null,
											data: _data,
											eof: false, // end of file
										});
									} else {
										resolve({
											err: null,
											data: _data,
											eof: false, // end of file
										});
									}
								});
							} else {
								resolve({
									err: null,
									data: null,
									eof: false, // end of file
								});
							}
						})(data);
					} else {
						resolve({
							err: null,
							data: data,
							eof: false, // end of file
						});
					}
				});
			});
		}

		function flush () {
			if (sqsQueue.msgBuffer.msg && sqsQueue.msgBuffer.msg.data.Messages.length > 0) {
				// Flush the message buffer by sending 0 count of messages. 
				return promiseResolve({
					err: null,
					data: {
						Messages: []
					},
					eof: false
				});
			}
		}

		// Loops untill recive() returns promise fulfilled with message to be picked by stream or if returned promise is 
		// rejected handles error.  Tries recover from error. If error recovery is successful tries receive() again,
		// if recovery is not successful returns message with error set to be picked by stream.

		function cont (msgp?) : Promise<any> {
			if (!msgp) {
				msgp = resume().then(function () {
					return receive();
				});
				return cont(msgp);
			} else {
				return msgp.then(function (msg) {
					return msg;
				}, function (err) {
					if (_.isString(err)) {
						if (err === 'offline') {
							return flush() || cont();
						}
						if (err === 'sqsoff') {
							return flush() || cont();
						}
						if (err === 'noprincipal') {
							return flush() || cont();
						}
						if (err === 'paused') {
							return flush() || cont();
						}
						err = new Error(err);
					}
					return pingHttp().then(function () { // raise error count only if device is online
						++errorCount;
						console.warn('sqs: ' + queueUrl + ' : allowed erros count decreased to: ' + (maxErrorCount - errorCount));
						if (errorCount < maxErrorCount) { 
							return cont();
						} else {
							console.warn('sqs: closing stream because of too many erros: ' + queueUrl);
							closed = true;
							return promiseResolve({
								err: err,
								data: null,
								eof: true, // end of file
							});
						}
					}, function () {
						return cont();
					});
				});
			}
		}
		return cont();
	}

	return {

		getMsgsReceived: () => {
			return msgsReceived;
		},

		// Returns promise containing next incomming message or EOF.
		next: () => {
			try {
				return receiveMessage();
			} catch (err) {
				console.error('sqs: error: next(): ' + err + ' :'  + queueUrl);
				console.dir(err);
				console.error('sqs: error: next(): ' + err + ' :'  + queueUrl, err);
				closed = true;
				return promiseResolve({
					err: err,
					data: null,
					eof: true, // end of file
				});
			}
		},

		close: () => {
			closed = true;
		},

		isClosed: () => {
			return closed;
		},

		pause: () => {
			paused = true;
		},

		resume: () => {
			paused = false;
		},
	};
}

function executeSqlParamasToString (sql) {
	var ps = sql[0] + ':' + '[';
	ps = sql[1].reduce((ps, p, i) => {
		if (i < sql[1].length - 1) {
			ps += p + ',';
		} else {
			ps += p;
		}
		return ps;
	}, ps);
	ps += ']';
	return ps;
}

var database;

function getDb () {
	return new Promise<any> (function (resolve, reject) {
		if (database) {
			resolve(database);
		} else {
			openDatabase().then(function (db) {
				database = db;
				resolve(database);
			}, reject);
		}
	});
}

function processSQSmessage (m, tx?)  {
	if (tx) {

		_.each(m.sqls, (sql) => {
			if (DEBUG['sqlError']) {
				sql[0] = 'uuupdate foo whheeere';
				delete DEBUG['sqlError'];
			}
			tx.executeSql(sql[0], sql[1], (tx, results) => {
				var ps, err;

				m.CLOUDEMPIERE_DB_OK = true;
				if (settings.settings.isDebug && settings.settings.isDebugSQS) {
					if (settings.settings.sqsDebugLevel > 1) {
						console.debug('sqs: tx.executeSql: ' + sql[0]);
					} else {
						if (settings.settings.sqsDebugLevel > 2) {
							ps = executeSqlParamasToString(sql);
							console.debug('sqs: tx.executeSql: ' + ps);
						}
					}
				}
			}, (tx, err) => {
				var ps = executeSqlParamasToString(sql);
				m.CLOUDEMPIERE_DB_ERROR = {
					err: 'database error',
					originalError: {
						code: err.code,
						message: err.message
					},
					msg: m.msgJson,
					sql: ps
				}
				console.error('sqs: tx.executeSql: ' + err.message + ' : ' + ps);
				console.dir(err);
				logger.error('sqs: tx.executeSql: ' + err.message + ' : ' + ps, err);
				// See: https://www.w3.org/TR/webdatabase/  4.3.2 Processing model
				// If you return anything other then 'false' next scheduled sql statement will not to be executed, which is in effect immediate transaction rollback.
				// If you return false next sheduled sql statement will be executed. 

				// We want continue with next sql statement in case of error.
				// We are using instead 'continueOnError' optional parameter to transaction() call as our web worker websql interface does not support 'false' return value. 
				// return false; 
			});
		});
	} else {
		return getDb().then((db) => { //TODO:
			return new Promise<any> ((resolve, reject) => {

				return db.transaction((tx) => {
					var sqls = m.sqls;

					for (var i=0; i < sqls.length; i++) {
						var sql = sqls[i];
						tx.executeSql(sql[0], sql[1], (tx, results) => {
							if (settings.settings.isDebug && settings.settings.isDebugSQS) {
								if (settings.settings.sqsDebugLevel > 1 ) {
									console.debug('sqs: tx.executeSql: ' + sql[0]);
								} else {
									if (settings.settings.sqsDebugLevel > 2) {
										var ps = this.executeSqlParamasToString(sql);
										console.debug('sqs: tx.executeSql: ' + ps);
									}
								}
							}
						}, (err) => {
							var ps = executeSqlParamasToString(sql);
							console.error('sqs: tx.executeSql: ' + ps);
							reject(err);
							logger.error('sqs: tx.executeSql: ' + ps, err);
							// See: https://www.w3.org/TR/webdatabase/  4.3.2 Processing model
							// return true to force nex sqs statement not to be executed, which is in effect immediate transaction rollback
							return true; 
						});
					}

				}, (err) => {
					console.error('sqs: transaction: ' + err);
					console.dir(err);
					logger.error('sqs: transaction: ' + err, err);
					reject(err);
				}, () => {
					resolve();
				});
			});
		});
	}
}


function makeSQSqueue (queueUrl, properties?) {

	var sqsQueue: any = {};
	sqsQueue.url = queueUrl;
	sqsQueue.msgBuffer = {
		msg: null,
		ts: 0,
		msgsFlushed: 0
	};
	sqsQueue.streamId = nextStreamId;
	++nextStreamId;
	sqsQueue.stream = makeMessageStream(queueUrl, properties, sqsQueue.streamId, sqsQueue);
	if (queueUrl.endsWith('.fifo')) {
		sqsQueue.isFIFO = true;
	} else {
		sqsQueue.isFIFO = false;
	}

	if (settings.settings.isDebug && settings.settings.isDebugSQS && (settings.settings.sqsDebugLevel > 0)) {
		console.debug('sqs: stream opened: ' + sqsQueue.streamId + ' ' + queueUrl);
	}

	function deleteMessagesFromQueue (Messages) : Promise<any> {
		return new Promise<any> ((resolve, reject) => {
			if (Messages.length < 1) {
				resolve();
			}

			var deleteCnt = 0;
			var n = 0;
			// remove frome queue done messages
			var EntriesforDelete = [];
			for (var i=0; i < Messages.length; i++) {
				var m = Messages[i];
				EntriesforDelete.push({
					Id: m.MessageId,
					ReceiptHandle: m.ReceiptHandle
				});
				if (EntriesforDelete.length === 10) {
					deleteCnt += EntriesforDelete.length;
					++n;
					awsSqsDeleteMessageBatch(queueUrl, EntriesforDelete, (err) => {
						if(err) {
							console.error('sqs: messageStream: error deleting messages from ' + queueUrl);
							console.dir(err);
							logger.error('sqs: messageStream: error deleting messages from ' + queueUrl, err);
							reject(err);
							return;
						}
						--n;
						if (n === 0) {
							resolve();
							if (settings.settings.isDebug && settings.settings.isDebugSQS && (settings.settings.sqsDebugLevel > 0)) {
								if (deleteCnt > 0) {
									console.debug('sqs: messageStream: deleted ' + deleteCnt  + ' msgs ' + 'from ' + queueUrl);
								}
							}
						}
					});
					EntriesforDelete = [];
				}
			}
			if (EntriesforDelete.length > 0) {
				deleteCnt += EntriesforDelete.length;
				++n;
				awsSqsDeleteMessageBatch(queueUrl, EntriesforDelete, (err) => {
					if(err) {
						console.error('sqs: messageStream: error deleting messages from ' + queueUrl);
						console.dir(err);
						logger.error('sqs: messageStream: error deleting messages from ' + queueUrl, err);
						reject(err);
						return;
					}
					--n;
					if (n === 0) {
						resolve();
						if (settings.settings.isDebug && settings.settings.isDebugSQS && (settings.settings.sqsDebugLevel > 0)) {
							if (deleteCnt > 0) {
								console.debug('sqs: messageStream: deleted ' + deleteCnt  + ' msgs ' + 'from ' + queueUrl);
							}
						}
					}
				});
			}
		})
	}

	// Try process all messages (skipping dead messages) in one transaction. If message processing failed mark message as dead
	// and return transaction. Calls cb() when finished.

	function processMessageTx (msg, db, cb) {

		var ts, te;
		var i, m, msgJson;
		var txError = false;

		db.transaction((tx) => {
			if (settings.settings.isDebug && settings.settings.isDebugSQS && (settings.settings.sqsDebugLevel > 0)) {
				ts = Date.now();
				console.debug('sqs: start db transaction: ' + msg.data.Messages.length + ' msgs');
			}


			for (i=0; i < msg.data.Messages.length; i++) {
				m = msg.data.Messages[i];
				processSQSmessage(m, tx);
			}

		}, (err) => {
			if (settings.settings.isDebug && settings.settings.isDebugSQS && (settings.settings.sqsDebugLevel > 0)) {
				te = Date.now();
				console.error('sqs: failed db transaction: ' + msg.data.Messages.length + ' msgs' + ' in ' + (te-ts) + ' ms' );
			}
			console.error('sqs: transaction failed: ' + err);
			console.dir(err);
			logger.error('sqs: transaction failed: ' + err, err);

			var failedMessageCnt = 0;
			for (i=0; i < msg.data.Messages.length; i++) {
				m = msg.data.Messages[i];
				if (m.CLOUDEMPIERE_DB_ERROR) {
					++failedMessageCnt;
					reportDeadMessage(sqsQueue.url, {
						err: m.CLOUDEMPIERE_DB_ERROR,
						msg: m
					});
				} else if (!m.CLOUDEMPIERE_DB_OK) {
					++failedMessageCnt;
					reportDeadMessage(sqsQueue.url, {
						err: err,
						msg: m
					});
				}
			}
			if (failedMessageCnt > 0) {
				// retry transaction skipping first failed message
				console.error('sqs: lost of ' + failedMessageCnt + ' messages occured');
				logger.error('sqs: lost of ' + failedMessageCnt + ' messages occured');
			}



			deleteMessagesFromQueue(msg.data.Messages).then(() => {
				cb();
			}, () => {
				cb();
			});


		}, () => {
			if (settings.settings.isDebug && settings.settings.isDebugSQS && (settings.settings.sqsDebugLevel > 0)) {
				te = Date.now();
				console.debug('sqs: finished db transaction: ' + msg.data.Messages.length + ' msgs' + ' in ' + (te-ts) + ' ms' );
			}

			var failedMessageCnt = 0;
			for (i=0; i < msg.data.Messages.length; i++) {
				m = msg.data.Messages[i];
				if (m.CLOUDEMPIERE_DB_ERROR) {
					++failedMessageCnt;
					reportDeadMessage(sqsQueue.url, {
						err: m.CLOUDEMPIERE_DB_ERROR,
						msg: m
					});
				} else if (!m.CLOUDEMPIERE_DB_OK) {
					++failedMessageCnt;
					reportDeadMessage(sqsQueue.url, {
						err: 'unknown',
						msg: m
					});
				}
			}
			if (failedMessageCnt > 0) {
				// retry transaction skipping first failed message
				console.error('sqs: lost of ' + failedMessageCnt + ' messages occured');
				logger.error('sqs: lost of ' + failedMessageCnt + ' messages occured');
			}

			deleteMessagesFromQueue(msg.data.Messages).then(() => {
				cb();
			}, () => {
				cb();
			});
		});
	}

	function processMessage (msg) : Promise<any> {
		// try parse messages into sql
		msg.data.Messages = _.map(msg.data.Messages, (m) => {
			try {
				var msgJson = JSON.parse(m.Body);
				m.msgJson = msgJson;
				var sqls = parseSQSmessageToSQL(m.msgJson);
				m.sqls = sqls;
			} catch (err) {
				console.error('sqs: processMessage: error in jsonToSQLParser(): ' + err);
				console.dir(err);
				logger.error('sqs: processMessage: error in jsonToSQLParser(): ' + err, err);
				m.CLOUDEMPIERE_DB_ERROR = {
						err: 'json to sql parsing error',
						originalError: err,
						msg: m.msgJson
				};
			}
			return m;
		});
		try {
			var reportDeadMessageCnt = 0;
			_.each(msg.data.Messages, (m) => {
				if (m.CLOUDEMPIERE_DB_ERROR) {
					reportDeadMessage(sqsQueue.url, m.CLOUDEMPIERE_DB_ERROR); //TODO: 
					++reportDeadMessageCnt;
				}
			});
			if (settings.settings.isDebug && settings.settings.isDebugSQS && (settings.settings.sqsDebugLevel > 0)) {
				if (reportDeadMessageCnt > 0) {
					console.debug('sqs: reported dead: '  + reportDeadMessageCnt  + ' msgs ' + 'from ' + queueUrl);
				}
			}
			var messagesToDelete = _.filter(msg.data.Messages, (m) => {
				if (m.CLOUDEMPIERE_DB_ERROR) {
					return true;
				} else {
					return false;
				}
			});
			deleteMessagesFromQueue(messagesToDelete); //TODO: wait for ack from aws?
			msg.data.Messages = _.filter(msg.data.Messages, (m) => {
				if (m.CLOUDEMPIERE_DB_ERROR) {
					return false;
				} else {
					return true;
				}
			});
		} catch (err) {
			console.error('sqs: processMessage: error in reportDeadMessage(): ' + err);
			logger.error('sqs: processMessage: error in reportDeadMessage(): ' + err, err);
		}
		return getDb().then((db) => { 
			return new Promise<any>((resolve, reject) => {
				processMessageTx (msg, db, resolve);
			});
		});
	}


	sqsQueue.close =  () : Promise<any> => {
		if (settings.settings.isDebug && settings.settings.isDebugSQS && (settings.settings.sqsDebugLevel > 0)) {
			console.debug('sqs: stream closing: ' + sqsQueue.streamId +  ' ' + sqsQueue.url);
		}
		sqsQueue.stream.close(); 
		return sqsQueue.sequenceOfPromises.then(() => { // wait till stream closes
			if (settings.settings.isDebug && settings.settings.isDebugSQS && (settings.settings.sqsDebugLevel > 0)) {
				console.debug('sqs: stream closed: ' + sqsQueue.streamId + ' ' + sqsQueue.url);
			}
			// remove closed stream
			sqsReceiveStreams = _.filter(sqsReceiveStreams, (sqs) => {
				return sqsQueue.streamId != sqs.streamId;
			});
		});
	};

	var tryMsgBufferFlush = (forceFlush?) : Promise<any> => {
		if ((Date.now() - sqsQueue.msgBuffer.ts > MESSAGE_BUFFER_DURATION) || (MESSAGE_BUFFER_DURATION < 1) || forceFlush) {
			// flush the message buffer

			if (!sqsQueue.msgBuffer.msg) {
				if (settings.settings.isDebug && settings.settings.isDebugSQS && (settings.settings.sqsDebugLevel > 0)) {
					console.debug('sqs: flushing buffer: ' + 0 + ' msgs');
				}
				return promiseResolve();
			} else {
				if (settings.settings.isDebug && settings.settings.isDebugSQS && (settings.settings.sqsDebugLevel > 0)) {
					console.debug('sqs: flushing buffer: ' + sqsQueue.msgBuffer.msg.data.Messages.length + ' msgs');
				}
			}

			var msg = sqsQueue.msgBuffer.msg;
			sqsQueue.msgBuffer.msg = null;
			return processMessage(msg);
		} else {
			return promiseResolve();
		}
	};

	// Loops untill message with eof is received ignoring messages with error on it.

	sqsQueue.sequenceOfPromises = sequenceOfPromisesUntillValue(() => {
		return sqsQueue.stream.next().then((msg) => {
			try { 
				// check for lost messages
				var bufferedCnt = 0;
				var receivedCnt = 0;
				if (sqsQueue.msgBuffer.msg) {
					bufferedCnt = sqsQueue.msgBuffer.msg.data.Messages.length;
				}
				if (msg.data && msg.data.Messages.length) {
					receivedCnt = msg.data.Messages.length;
				}
				var lcnt = sqsQueue.stream.getMsgsReceived() - (sqsQueue.msgsFlushed + bufferedCnt + receivedCnt);
				if (lcnt > 0) {
						console.error('sqs: lost ' + lcnt + ' msgs'); 
						logger.error('sqs: lost ' + lcnt + ' msgs'); 
				}
				return msg;
			} catch (err) {
				console.error('sqs: error: ');
				console.dir(err);
				logger.error('sqs: error: ', err);
				throw err;
			}
		}).then((msg) => {
			try {
				return tryMsgBufferFlush(msg.eof || !msg.data || (msg.data.Messages.length === 0)).then(() => {
					return msg;
				}).catch((err) => {
					console.error('sqs: tryMsgBufferFlush(): ');
					console.dir(err);
					logger.error('sqs: tryMsgBufferFlush(): ', err);
					return msg;
				});
			} catch (err) {
				console.error('sqs: error: ');
				console.dir(err);
				logger.error('sqs: error: ', err);
				throw err;
			}
		}).then((msg) => {
			try {
				if (!msg) {
					// receiveMessage() being called by stream.next() MUST always return message.
					var err = new Error('sqs: no message from stream');
					console.error('sqs: no message from stream, closing queue');
					logger.error('sqs: no message from stream, closing queue', err);
					sqsQueue.stream.close();
					return {
						eof: false // strean.close() shall generate eof which terminates this sequence of promises and thus closes the queue
					}
				}
				if (msg.err) {
					// Ignore message with error on it. 
					// receiveMessage() being called by stream.next() counts errors. If error count
					// exceeds threshold stream si closed (message will have eof stet to true.
					if (settings.settings.isDebug && settings.settings.isDebugSQS && (settings.settings.sqsDebugLevel > 0)) {
						console.debug('sqs: ignore the message because of error');
					}
					return promiseResolve(msg);
				}

				if (settings.settings.isDebug && settings.settings.isDebugSQS && (settings.settings.sqsDebugLevel > 1)) {
					console.debug('sqs: message:');
					console.dir(msg);
				}

				if (settings.settings.isDebug && settings.settings.isDebugSQS && (settings.settings.sqsDebugLevel > 1)) {
					getApproxMsgCount(sqsQueue.url).then((cnt) => { 
						console.debug('sqs:' +  sqsQueue.url + ' message count: ' + cnt);
					});
				}

				if (msg.data) {
					if (!sqsQueue.msgBuffer.msg) {
						sqsQueue.msgBuffer.msg = msg;
						sqsQueue.msgBuffer.ts = Date.now();
					} else {
						sqsQueue.msgBuffer.msg.data.Messages = msg.data.Messages.reduce((ms, m) => {
							ms.push(m);
							return ms;
						}, sqsQueue.msgBuffer.msg.data.Messages)

					}
				}

				if (sqsQueue.isFIFO) {
					// flush buffer immediatelly to force ackonwledgement
					return tryMsgBufferFlush(true).then(() => {
						return msg;
					}).catch((err) => {
						console.error('sqs: tryMsgBufferFlush(): ');
						console.dir(err);
						logger.error('sqs: tryMsgBufferFlush(): ', err);
						return msg;
					});
				}

				return msg;
			} catch (err) {
				console.error('sqs: error: ');
				console.dir(err);
				logger.error('sqs: error: ', err);
				throw err;
			}
		}).catch((err) => {
			console.error('sqs: error: ');
			console.dir(err);
			logger.error('sqs: error: ', err);
			sqsQueue.stream.close();
			return {
				eof: false // sqsQueue.stream.close() shall generate eof which terminates this sequence of promises and thus closes the queue 
			}
		});
	}, (msg) => {
		var err;
		// finish if received message with eof (end of file)
		if (msg.eof === true) {
			console.warn('sqs: finsihed reqceiving form: ' + sqsQueue.url);
			if (msg.err) {
				if (getOpenStreamsCount(queueUrl) === 0) {
					console.error('sqs: error receiving from queue: ' + msg.err);
					console.dir(msg.err);
					logger.error('sqs: error receiving from queue: ' + msg.err, msg.err);
					console.error('sqs: closing queue because of too many erros: ' + sqsQueue.url);
					err = new Error('sqs: closing queue because of too many erros: ' + sqsQueue.url);
					logger.error('sqs: closing queue because of too many erros: ' + sqsQueue.url, msg.err)
				}
			}
			return true;
		} else {
			return false;
		}
	});

	return sqsQueue;
};



function start (b?): Promise<any> {
	var deviceId = workerCtx.device.uuid;

	return webService.getDeviceSettings(deviceId).then((data) => {
		var err;
		var settings: any = rowsToJson(data.Data.Rows);
		if (!settings.device_sqs) {
			console.error('sqs: no deviceSQS url');
			err = new Error('sqs: no deviceSQS url');
			logger.error('sqs: no deviceSQS url', err);
			return promiseReject(err);
		}
		if (!settings.device_prio_sqs) {
			console.error('sqs: no devicePrioSQS url');
			err = new Error('sqs: no devicePrioSQS url');
			logger.error('sqs: no devicePrioSQS url', err);
			return promiseReject(err);
		}

		return getDb().then((db) => {
			return db.execute('UPDATE device SET device_id=?,  device_sqs=?, device_prio_sqs=?, AD_ReplicationStrategy_ID_WS=?, AD_ReplicationStrategy_ID_INIT=?  WHERE id=1', [deviceId, settings.device_sqs, settings.device_prio_sqs, settings.AD_ReplicationStrategy_ID_WS.toString(), settings.AD_ReplicationStrategy_ID_INIT.toString()])
		}).then(() => {
			return {
				device_sqs: settings.device_sqs,
				device_prio_sqs: settings.device_prio_sqs
			}
		});
	}).then((res) => {
		return authPrincipal.getPrincipal().then((principal) => {
			if (!(principal && principal.userSQSurl)) {
				console.error('sqs: no userSQSurl url');
				var err = new Error('sqs: no userSQSurl url');
				logger.error('sqs: no userSQSurl url', err);
				return promiseReject(err);
			}
			res.userSQSurl = principal.userSQSurl;
			return res;
		})
	}).then((res) => {
		var i;
		var properties: any = {};
		if (res.device_sqs) {
			console.info('sqs: starting deviceSQS: ' + res.device_sqs);
			sqsReceiveStreams.push(makeSQSqueue(res.device_sqs, properties));

			getApproxMsgCount(res.device_sqs).then((cnt) => {
				console.info('sqs: ' + res.device_sqs + ' : message count:' + cnt);
			});
		}
		if (res.device_prio_sqs) {
			console.info('sqs: starting devicePrioSQS: ' + res.device_prio_sqs);
			sqsReceiveStreams.push(makeSQSqueue(res.device_prio_sqs, properties));

			getApproxMsgCount(res.device_prio_sqs).then((cnt) => {
				console.info('sqs: ' + res.device_prio_sqs + ' : message count:' + cnt);
			});
		}
		if (res.userSQSurl) {
			console.info('sqs: starting userSQS: ' + res.userSQSurl);
			sqsReceiveStreams.push(makeSQSqueue(res.userSQSurl, properties));

			getApproxMsgCount(res.userSQSurl).then((cnt) => {
				console.info('sqs: ' + res.userSQSurl + ' : message count:' + cnt);
			});
		}
	}).then (() => {
		/*
		return this.waitForFinish().then(() => {
			console.warn('sqs: all sqs qeueues stoped.');
		});
		 */
	});
};

function stop(b?): Promise<any> {
	console.info('sqs: stopping all sqs qeueues.');
	var arr = sqsReceiveStreams.map((sqs) => {
		return sqs.close();
	})

	return promiseAll(arr).then(() => {
		//this.sqsReceiveStreams = [];
		console.info('sqs: all sqs qeueues stopped.');
	});
};

// Return promise resolving when all queues finished either because of errors or just being closed by explicitly calling close() on sqs stream.
function waitForFinish (): Promise<any> {
	var arr = sqsReceiveStreams.map((sqs) => {
		return sqs.sequenceOfPromises
	});
	return promiseAll(arr);
}

// Return promised successfully resolved when there are 0 mesaseges on all queues collectivelly

function waitForNoMessages () : Promise<any> {
	var getCount = () : Promise<any> => {
		return new Promise<any>((resolve) => {
			setTimeout(()=>{
				resolve();
			},  25000); // wait fro 25s because queue long poll period is set to 20s 
		}).then (() => {
			return getApproxAllMsgCount().then((cnt) => {
				return cnt;
			})
		})
	}
	var wait = () : Promise<any> => {
		return new Promise<any>((resolve) => {
			setTimeout(()=>{
				resolve();
			},  23000); // check remaining count every 23s 
		}).then (() => {
			return getApproxAllMsgCount().then((cnt) => {
				if (cnt > 0) {
					return wait();
				} else {
					// read count again to be on the safe side
					return getCount().then((cnt) => {
						if (cnt === 0) {
							return;
						} else {
							return wait();
						}
					})
				}
			})
		})
	}
	return wait();
}

function pause () {
	console.info('sqs: pausing all sqs qeueues.');
	sqsReceiveStreams.map((sqs) => {
		sqs.stream.pause();
	});
}

function resume () {
	console.info('sqs: resuming all sqs qeueues.');
	sqsReceiveStreams.map((sqs) => {
		sqs.stream.resume();
	});
}

//TODO: rename to 'purge'
function purgeSQSQueues (): Promise<any> {
	var purged = {};
	var arr = sqsReceiveStreams.map((sqs) => {
		return new Promise((resolve) => {
			if (!purged[sqs.url]) {
				awsSqsPurgeQueue(sqs.url, (err) => {
					if (err) {
						console.error('sqs: error while purging: ' + err);
						console.dir(err);
						logger.error('sqs: error while purging: ', err);
					}
					resolve();
				});
				purged[sqs.url] = true;
				console.warn('sqs: queue purged: ' + sqs.url);
			} else {
				resolve();
			}
		});
	});

	return promiseAll(arr).then(() => {
		console.info('sqs: all sqs qeueues purged.');
	});
}

function getOpenStreamsCount (url) {
	return sqsReceiveStreams.reduce((a, sqs) => {
		if ((sqs.url === url) && !sqs.stream.isClosed()) {
			++a;
		}
		return a;
	}, 0)
}

function getAllActiveQueueUrls () {
	var urls = sqsReceiveStreams.reduce((urls, sqs) => {
		urls[sqs.url] = sqs.url;
		return urls;
	}, {})
	var arr = [];
	for (var k in urls) {
		arr.push(k);
	}
	return arr;
}


function getApproxMsgCount (url): Promise<any> {
	return sqsGetApproxMsgCount(url).then(function (data) {
		return data.count;
	})
}

function getApproxAllMsgCount(): Promise<any> {
	var cnt = 0;
	var urls = getAllActiveQueueUrls();
	var parr = urls.map((url) => {
		return getApproxMsgCount(url).then((n) => {
			cnt += n;
		});
	});
	return promiseAll(parr).then(() => {
		return cnt;
	});
}

function reportDeadMessage (url, msg) : Promise<any> {
	var durl;
	if (url.endsWith('.fifo')) {
		durl = url.slice(0, url.length -'.fifo'.length) + '_Deadletter';
	} else {
		durl = url + '_Deadletter'; 
	}

	return sqsReportDeadMessage(url, JSON.stringify(msg)).then(function (){}, function (err) {
		console.error('sqs: reportDeadMessag(): ' + durl + ' : ' + err);
		console.dir(err);
		logger.error('sqs: reportDeadMessag(): ' + durl + ' : ' + err, err);
		return promiseReject(err);
	})
}

// Following AWS calls have to be proxied over main thread as AWS library references window object internally.
// As window object is not available in web worker we cannot execute those calls inside web worker proccess.

function awsSqsReceiveMessage (QueueUrl, MaxNumberOfMessages, WaitTimeSeconds, cbFn) : Promise<any> {
	var msg: IWorkerMessage = {
		workerId: workerCtx.workerId,
		workerName: workerCtx.workerName,
		messageName: 'awsSqsReceiveMessage',
		messageData: {
			QueueUrl: QueueUrl,
			MaxNumberOfMessages: MaxNumberOfMessages,
			WaitTimeSeconds: WaitTimeSeconds
		}
	};
	return sendMessage(msg).then(function (res) {
		cbFn(null, res.data);
	}, function (err) {
		cbFn(err);
	});
}

function awsSqsDeleteMessageBatch (QueueUrl, Entries, cbFn) {
	var msg: IWorkerMessage = {
		workerId: workerCtx.workerId,
		workerName: workerCtx.workerName,
		messageName: 'awsSqsDeleteMessageBatch',
		messageData: {
			QueueUrl: QueueUrl,
			Entries: Entries
		}
	};
	return sendMessage(msg).then(function () {
		cbFn(null);
	}, function (err) {
		cbFn(err);
	});
}

function awsSqsPurgeQueue (QueueUrl, cbFn) {
	var msg: IWorkerMessage = {
		workerId: workerCtx.workerId,
		workerName: workerCtx.workerName,
		messageName: 'awsSqsPurgeQueue',
		messageData: {
			QueueUrl: QueueUrl
		}
	};
	return sendMessage(msg).then(function () {
		cbFn(null);
	}, function (err) {
		cbFn(err);
	});
}

function sqsGetApproxMsgCount (QueueUrl) {
	var msg: IWorkerMessage = {
		workerId: workerCtx.workerId,
		workerName: workerCtx.workerName,
		messageName: 'sqsGetApproxMsgCount',
		messageData: {
			QueueUrl: QueueUrl,
		}
	};
	return sendMessage(msg);
}

function sqsReportDeadMessage (QueueUrl, MessageBody) {
	var msg: IWorkerMessage = {
		workerId: workerCtx.workerId,
		workerName: workerCtx.workerName,
		messageName: 'sqsReportDeadMessage',
		messageData: {
			QueueUrl: QueueUrl,
			MessageBody: MessageBody
		}
	};
	return sendMessage(msg);
}


bootWorker(function (event) {     
	var msg: IWorkerMessage = event.data;
	var err;

	try {

		if (settings.settings.isDebug && settings.settings.isDebugNet) {
			console.debug('sqsWorker: received message: ' + msg.messageName);
		}

		if ('sqsStart' === msg.messageName) {

			start().then(function () {
				event.ports[0].postMessage({});
			}, function (err) {
				event.ports[0].postMessage({
					err: '' + err
				});
			})
			return true; 
		} 

		if ('sqsStop' === msg.messageName) {

			stop().then(function () {
				event.ports[0].postMessage({});
			}, function (err) {
				event.ports[0].postMessage({
					err: '' + err
				});
			})
			return true; 
		} 

		if ('sqsWaitForFinish' === msg.messageName) {

			waitForFinish().then(function () {
				event.ports[0].postMessage({});
			}, function (err) {
				event.ports[0].postMessage({
					err: '' + err
				});
			})
			return true; 
		} 

		if ('sqsWaitForNoMessages' === msg.messageName) {

			waitForNoMessages().then(function () {
				event.ports[0].postMessage({});
			}, function (err) {
				event.ports[0].postMessage({
					err: '' + err
				});
			})
			return true; 
		} 

		if ('sqsPause' === msg.messageName) {
			pause();
			event.ports[0].postMessage({});
			return true; 
		} 

		if ('sqsResume' === msg.messageName) {
			resume();
			event.ports[0].postMessage({});
			return true; 
		} 

		if ('sqsPurgeSQSQueues' === msg.messageName) {

			purgeSQSQueues().then(function () {
				event.ports[0].postMessage({});
			}, function (err) {
				event.ports[0].postMessage({
					err: '' + err
				});
			})
			return true; 
		} 

		if ('sqsGetApproxMsgCount' === msg.messageName) {

			getApproxMsgCount(msg.messageData.url).then(function (cnt) {
				event.ports[0].postMessage({
					cnt: cnt
				});
			}, function (err) {
				event.ports[0].postMessage({
					err: '' + err
				});
			})
			return true; 
		} 

		if ('sqsGetApproxAllMsgCount' === msg.messageName) {

			getApproxAllMsgCount().then(function (cnt) {
				event.ports[0].postMessage({
					cnt: cnt
				});
			}, function (err) {
				event.ports[0].postMessage({
					err: '' + err
				});
			})
			return true; 
		} 

		if ('sqsSetDebug' === msg.messageName) {
			DEBUG[msg.messageData.name] = msg.messageData.value;
			event.ports[0].postMessage({});
			return true; 
		} 


	} catch (err) {
		console.error('sqsWorker: error: ');
		console.dir(err);
		logger.error('sqsWorker: error', err);
		event.ports[0].postMessage({
			err: '' + err
		});
	}
});    

