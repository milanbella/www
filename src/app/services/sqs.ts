import { Injectable } from '@angular/core';

import { promiseReject, promiseResolve, promiseAll, rowsToJson } from '../common/utils';
import { sequenceOfPromises, sequenceOfPromisesUntillValue } from '../common/utils';
import { JsonToSQLParser } from './jsontosqlparser';
import { database } from './database';
import { WebService } from './webservice';
import { settings } from './settings';
import { EventSource } from './eventSource';
import { Events } from '@ionic/angular';
import { authPrincipal } from './authprincipal';
import { Principal } from './types';
import { net } from './net';
import { logger } from './logger';

import  { _ } from 'underscore';
import * as AWS from 'aws-sdk';

import * as PouchDB from 'pouchdb'


var isProfiling = true;

@Injectable()
export class SQS {

	public doAccesTokenRefresh: boolean;


	private pouchDb = new PouchDB('product');

	public makeSQSqueue: any;
	public sqsMessagSource: EventSource = new EventSource();

	public userSQSurl: string;

	// If number of errors exceeds threshold limit then stream will be forcibly closed.
	private STREAM_ERROR_COUNT_THRESHOLD = 5;

	// Duration of message buffer. Received messages will be buffered in message buffer prior writing to database
	// to avoid db transaction overhead. If time diffrence between last and first message in buffer exceeds MESSAGE_BUFFER_DURATION
	// messages in buffer will be flushed from buffer in database using single transaction. Bear in mind that as a side effect data changes received 
	// by queue will not be seen by application layer untill MESSAGE_BUFFER_DURATION paseed!
	
	//private MESSAGE_BUFFER_DURATION = 30000; // in milliseconds
	private MESSAGE_BUFFER_DURATION = 15000; // in milliseconds

	private sqsReceiveStreams = [];

	private refreshingAccessToken: boolean;

	public deadLetterQueueUrl: string;

	private nextStreamId = 1;


	constructor(private jsonToSQLParser: JsonToSQLParser,
				private webService: WebService,
				public events: Events) {
		var _this = this;


		function makeMessageStream (queueUrl, properties, streamId) {

			if (!queueUrl) {
				console.error('sqs: makeMessageStream: no queueUrl');
				var err = new Error('sqs: makeMessageStream: no queueUrl');
				logger.error('sqs: makeMessageStream: no queueUrl', err);
				throw err;
			}

			var sqs = new AWS.SQS();
			var closed = false;
			//var pauseStreamTime = 10000; // time to wait to next resume if stream is paused or offline
			var pauseStreamTime = 10; 
			var errorCount = 0; // total count of errors so far on this queue
			var maxErrorCount = properties.streamErroCountThreshold || _this.STREAM_ERROR_COUNT_THRESHOLD;

			var msgsReceived = 0;
			var paused = false;

			// Returns promise containing next incomming message or EOF.

			function receiveMessage (sqs) : Promise<any> {

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

						if (!net.isOnline() || !settings.settings.isSQS) {
							reject('paused');
							return;
						}

						sqs.receiveMessage({
							QueueUrl: queueUrl,
							MaxNumberOfMessages: 10,
							WaitTimeSeconds: 20
						}, (err, data) => {
							if (window['cloudempiere'].test.forceSQSreceiveFailure) {
								console.error('sqs: messageStream: receive failed from ' + queueUrl + ' : test.forceSQSreceiveFailure is true');
								err = new Error('sqs: messageStream: receive failed from ' + queueUrl + ' : test.forceSQSreceiveFailure is true');
								console.dir(err);
								reject(err);
								return;
							}
							if (err) {
								console.error('sqs: messageStream: receive failed from ' + queueUrl + ' : ' + err);
								console.dir(err);
								if (err.toString().match(/credentials/i)) {
									reject('credentials');
									return;
								}
								reject(err);
								return;
							} else {
								if (settings.settings.isDebug && settings.settings.isDebugSQS && (settings.settings.sqsDebugLevel > 0)) {
									console.debug('sqs: messageStream: ' + streamId + ' received ' + data.Messages.length +  ' messages from ' + queueUrl);
								}
							}

							if (_this.doAccesTokenRefresh) {
								_this.doAccesTokenRefresh = false;
								reject('credentials');
								return;
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
										sqs.deleteMessageBatch({
											QueueUrl: queueUrl,
											Entries: EntriesforDelete
										}, (err) => {
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
							paused = false;
							return msg;
						}, function (err) {
							if (_.isString(err)) {
								if (err === 'offline') {
									return cont();
								}
								if (err === 'sqsoff') {
									return cont();
								}
								if (err === 'paused') {
									if (!paused) {
										// Flush the message buffer by sending 0 count of messages. 
										paused = true;
										return promiseResolve({
											err: null,
											data: {
												Messages: []
											},
											eof: false
										});
									} else {
										paused = true;
										return cont();
									}
								} else {
									paused = false;
								}
								if (err === 'credentials') {
									_this.refreshToken(); // note: call to refreshToken() will close the stream
									return cont();
								}
								err = new Error(err);
							} else {
								paused = false;
							}
							return net.pingHttp().then(function () { // raise error count only if device is online
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
								net.setOfflineState();
								return cont();
							});
						});
					}
				}
				return cont();
			}

			return {
				awsSQSinstance: sqs,

				getMsgsReceived: () => {
					return msgsReceived;
				},

				// Returns promise containing next incomming message or EOF.
				next: () => {
					try {
						return receiveMessage(sqs);
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

				purge: (param, fn) => {
					sqs.purgeQueue(param, fn);
				}

			};
		}


		_this.makeSQSqueue = (queueUrl, properties?) => {


			var sqsQueue: any = {};
			sqsQueue.url = queueUrl;
			sqsQueue.msgBuffer = {
				msg: null,
				ts: 0,
				msgsFlushed: 0
			};
			sqsQueue.streamId = _this.nextStreamId;
			++_this.nextStreamId;
			sqsQueue.stream = makeMessageStream(queueUrl, properties, sqsQueue.streamId);
			if (queueUrl.endsWith('.fifo')) {
				sqsQueue.isFIFO = true;
			} else {
				sqsQueue.isFIFO = false;
			}

			if (settings.settings.isDebug && settings.settings.isDebugSQS && (settings.settings.sqsDebugLevel > 0)) {
				console.debug('sqs: stream opened: ' + sqsQueue.streamId + ' ' + queueUrl);
			}

			function deleteMessagesFromQueue (msg) {
				var deleteCnt = 0;
				// remove frome queue done messages
				var EntriesforDelete = [];
				for (var i=0; i < msg.data.Messages.length; i++) {
					var m = msg.data.Messages[i];
					if (m.CLOUDEMPIERE_DB_DONE) {
						if (!m.CLOUDEMPIERE_REMOVED_FROM_QUEUE) {
							m.CLOUDEMPIERE_REMOVED_FROM_QUEUE = true;
							EntriesforDelete.push({
								Id: m.MessageId,
								ReceiptHandle: m.ReceiptHandle
							});
						}
						if (EntriesforDelete.length === 10) {
							deleteCnt += EntriesforDelete.length;
							sqsQueue.stream.awsSQSinstance.deleteMessageBatch({
								QueueUrl: queueUrl,
								Entries: EntriesforDelete
							}, (err) => {
								if(err) {
									console.error('sqs: messageStream: error deleting messages from ' + queueUrl);
									console.dir(err);
									logger.error('sqs: messageStream: error deleting messages from ' + queueUrl, err);
								}
							});
							EntriesforDelete = [];
						}
					}
				}
				if (EntriesforDelete.length > 0) {
					deleteCnt += EntriesforDelete.length;
					sqsQueue.stream.awsSQSinstance.deleteMessageBatch({
						QueueUrl: queueUrl,
						Entries: EntriesforDelete
					}, (err) => {
						if(err) {
							console.error('sqs: messageStream: error deleting messages from ' + queueUrl);
							console.dir(err);
							logger.error('sqs: messageStream: error deleting messages from ' + queueUrl, err);
						}
					});
				}
				if (settings.settings.isDebug && settings.settings.isDebugSQS && (settings.settings.sqsDebugLevel > 0)) {
					if (deleteCnt > 0) {
						console.debug('sqs: messageStream: deleting ' + deleteCnt  + ' msgs ' + 'from ' + queueUrl);
					}
				}
			}

			// Try process all messages (skipping dead messages) in one transaction. If message processing failed mark message as dead
			// and return transaction. Call cb() when finished.


			function processMessageTx (msg, db, cb) {
					var continueOnError = true;

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
							if (m.CLOUDEMPIERE_DB_DONE) {
								continue;
							}
							_this.processSQSmessage(m, tx);
						}

					}, (err) => {
						console.error('sqs: transaction failed: ' + err);
						console.dir(err);
						logger.error('sqs: transaction failed: ' + err, err);

						txError = true;

						// skip first failed message
						var failedMessageCnt = 0;
						var reportDeadMessageCnt = 0;
						for (i=0; i < msg.data.Messages.length; i++) {
							m = msg.data.Messages[i];
							if (m.CLOUDEMPIERE_DB_ERROR && !m.CLOUDEMPIERE_DB_DONE) {
								m.CLOUDEMPIERE_DB_DONE = true;
								++failedMessageCnt;
								// TODO: move message to dead message queue
								++reportDeadMessageCnt;
								_this.reportDeadMessage(sqsQueue.url, m.CLOUDEMPIERE_DB_ERROR);
							}
						}

						if (failedMessageCnt > 0) {
							// retry transaction skipping first failed message
							console.error('sqs: lost of ' + failedMessageCnt + ' messages occured, retry transaction again');
							logger.error('sqs: lost of ' + failedMessageCnt + ' messages occured, retry transaction again');
							if (settings.settings.isDebug && settings.settings.isDebugSQS && (settings.settings.sqsDebugLevel > 0)) {
								if (reportDeadMessageCnt > 0) {
									console.debug('sqs: reported dead: '  + reportDeadMessageCnt  + ' msgs ' + 'from ' + queueUrl);
								}
							}
							processMessageTx(msg, db, cb);
						} else {
							console.error('sqs: lost of ' + msg.data.Messages.length + ' messages occured due to failed transaction');
							logger.error('sqs: lost of ' + msg.data.Messages.length + ' messages occured due to failed transaction');
							for (i=0; i < msg.data.Messages.length; i++) {
								m = msg.data.Messages[i];
								if (!m.CLOUDEMPIERE_DB_DONE) {
									m.CLOUDEMPIERE_DB_DONE = true;
									++reportDeadMessageCnt;
									_this.reportDeadMessage(sqsQueue.url, {
										err: 'unknown transaction error',
										originalError: err,
										msg: m
									});
								}
							}
							if (settings.settings.isDebug && settings.settings.isDebugSQS && (settings.settings.sqsDebugLevel > 0)) {
								if (reportDeadMessageCnt > 0) {
									console.debug('sqs: reported dead: '  + reportDeadMessageCnt  + ' msgs ' + 'from ' + queueUrl);
								}
							}
						}

						deleteMessagesFromQueue(msg);


					}, () => {
						if (settings.settings.isDebug && settings.settings.isDebugSQS && (settings.settings.sqsDebugLevel > 0)) {
							te = Date.now();
							console.debug('sqs: finished db transaction: ' + msg.data.Messages.length + ' msgs' + ' in ' + (te-ts) + ' ms' );
						}

						deleteMessagesFromQueue(msg);

						if (!txError) {
							cb()
						}
					}, 
					continueOnError);
			}

			function processMessage (msg) : Promise<any> {
				// try parse messages into sql
				msg.data.Messages = _.map(msg.data.Messages, (m) => {
					try {
						var msgJson = JSON.parse(m.Body);
						m.msgJson = msgJson;
						var sqls = _this.jsonToSQLParser.parseSQL(m.msgJson);
						if (window['cloudempiere_sqs_test_db_errors_json_to_sql_parser'] && window['cloudempiere_sqs_test_db_errors_json_to_sql_parser'] > 0) { 
							window['cloudempiere_sqs_test_db_errors_json_to_sql_parser'] -= 1;
							throw new Error('test error');
						}
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
						m.CLOUDEMPIERE_DB_DONE = true;
					}
					return m;
				});
				try {
					var reportDeadMessageCnt = 0;
					_.each(msg.data.Messages, (m) => {
						if (m.CLOUDEMPIERE_DB_ERROR) {
							_this.reportDeadMessage(sqsQueue.url, m.CLOUDEMPIERE_DB_ERROR);
							++reportDeadMessageCnt;
						}
					});
					if (settings.settings.isDebug && settings.settings.isDebugSQS && (settings.settings.sqsDebugLevel > 0)) {
						if (reportDeadMessageCnt > 0) {
							console.debug('sqs: reported dead: '  + reportDeadMessageCnt  + ' msgs ' + 'from ' + queueUrl);
						}
					}
					deleteMessagesFromQueue(msg);
					msg.data.Messages = _.filter(msg.data.Messages, (m) => {
						if (m.CLOUDEMPIERE_DB_DONE) {
							return false;
						} else {
							return true;
						}
					})
				} catch (err) {
					console.error('sqs: processMessage: error in reportDeadMessage(): ' + err);
					logger.error('sqs: processMessage: error in reportDeadMessage(): ' + err, err);
				}
				return database.getDb().then((db) => {
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
					_this.sqsReceiveStreams = _.filter(_this.sqsReceiveStreams, (sqs) => {
						return sqsQueue.streamId != sqs.streamId;
					});
				});
			};

			var tryMsgBufferFlush =  (forceFlush?) : Promise<any> => {
				if ((Date.now() - sqsQueue.msgBuffer.ts > _this.MESSAGE_BUFFER_DURATION) || (_this.MESSAGE_BUFFER_DURATION < 1) || forceFlush) {
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
					return processMessage(msg).then(() => {

						// check for lost messages
						var cnt = msg.data.Messages.reduce((a, m) => {
							if (m.CLOUDEMPIERE_DB_DONE) {
								++a.done;
							}
							if (m.CLOUDEMPIERE_REMOVED_FROM_QUEUE) {
								++a.removed;
							}
							return a;
						}, {done: 0, removed: 0});
						sqsQueue.msgsFlushed += cnt.done; 
						if (cnt.done != cnt.removed) {
							console.error('sqs: msgBuffer: msgs processed: ' + cnt.done + ' : msgs deleted from queue: ' + cnt.removed); 
							logger.error('sqs: msgBuffer: msgs processed: ' + cnt.done + ' : msgs deleted from queue: ' + cnt.removed); 
						}
						if (msg.data.Messages.length != cnt.done) {
							console.error('sqs: msgBuffer flush did not flush all messages: flushed count: ' + cnt.done + ' : msgs count: ' + msg.data.Messages.length); 
							logger.error('sqs: msgBuffer flush did not flush all messages: flushed count: ' + cnt.done + ' : msgs count: ' + msg.data.Messages.length); 
						}
						if (msg.data.Messages.length != cnt.removed) {
							console.error('sqs: msgBuffer flush did not delete all messages from queue: deleted count: ' + cnt.removed + ' : msgs count: ' + msg.data.Messages.length); 
							logger.error('sqs: msgBuffer flush did not delete all messages from queue: deleted count: ' + cnt.removed + ' : msgs count: ' + msg.data.Messages.length); 
						}
					});
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
							_this.getApproxMsgCount(sqsQueue.url).then((cnt) => {
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
						eof: false // strean.close() shall generate eof which terminates this sequence of promises and thus closes the queue 
					}
				});
			}, (msg) => {
				var err;
				// finish if received message with eof (end of file)
				if (msg.eof === true) {
					console.warn('sqs: finsihed reqceiving form: ' + sqsQueue.url);
					if (msg.err) {
						if (_this.getOpenStreamsCount(queueUrl) === 0) {
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
	}

	private executeSqlParamasToString (sql) {
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

	processSQSmessage (m, tx?)  {
		if (tx) {

			var dosql = (tx, sqls) => {
				var sql = sqls.shift();
				if (sql) {
					tx.executeSql(sql[0], sql[1], (tx, results) => {
							var ps, err;

							if (window['cloudempiere_sqs_test_db_errors'] && window['cloudempiere_sqs_test_db_errors'] > 0) { 
								ps = this.executeSqlParamasToString(sql);
								err = new Error('test error');
								m.CLOUDEMPIERE_DB_ERROR = {
									err: 'database error',
									originalError: err,
									msg: m.msgJson,
									sql: ps
								}
								console.error('sqs: tx.executeSql: ' + err.message + ' : ' + ps);
								console.dir(err);
								logger.error('sqs: tx.executeSql: ' + err.message + ' : ' + ps, err);
								window['cloudempiere_sqs_test_db_errors'] -= 1;
								throw err;
							}

							m.CLOUDEMPIERE_DB_DONE = true;
							if (settings.settings.isDebug && settings.settings.isDebugSQS) {
								if (settings.settings.sqsDebugLevel > 1) {
									console.debug('sqs: tx.executeSql: ' + sql[0]);
								} else {
									if (settings.settings.sqsDebugLevel > 2) {
										ps = this.executeSqlParamasToString(sql);
										console.debug('sqs: tx.executeSql: ' + ps);
									}
								}
							}
							dosql(tx, sqls);
					}, (tx, err) => {
						var ps = this.executeSqlParamasToString(sql);
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
						// You must return true to force next scheduled sql statement not to be executed, which is in effect immediate transaction rollback.
						// If you return false next sheduled sql statement will be executed. 
						//return true; 
						return false; 
					});
				} else {
					return;
				}
			}
			dosql(tx, m.sqls);
		} else {
			return database.getDb().then((db) => {
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
								var ps = this.executeSqlParamasToString(sql);
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

	getEventSourceForMessage ()  {
		return this.sqsMessagSource.source.flatMap((msg) => {
			var messages;
			if (msg.data && msg.data.Messages) {
				messages = msg.data.Messages;
			} else {
				messages = [];
			}

			return _.map(messages, (message) => {
				return JSON.parse(message.Body);
			});
		});
	};

	getEventSourceForKeyStore () {
		return this.sqsMessagSource.source.filter((message) => {
			var _message = message[_.keys(message)[0]];
			return _message.TargetType === 'KeyStore';
		});
	};

	getEventSourceForSQL () {
		return this.sqsMessagSource.source.filter((message) => {
			var _message = message[_.keys(message)[0]];
			return _message.TargetType !== 'KeyStore';
		});
	};

	start (b?): Promise<any> {
		var deviceId = window['device'].uuid;

		return this.webService.getDeviceSettings(deviceId).then((data) => {
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

			return database.execute('UPDATE device SET device_id=?,  device_sqs=?, device_prio_sqs=?, AD_ReplicationStrategy_ID_WS=?, AD_ReplicationStrategy_ID_INIT=?  WHERE id=1', [deviceId, settings.device_sqs, settings.device_prio_sqs, settings.AD_ReplicationStrategy_ID_WS.toString(), settings.AD_ReplicationStrategy_ID_INIT.toString()])
			.then(() => {
				return {
					device_sqs: settings.device_sqs,
					device_prio_sqs: settings.device_prio_sqs
				}
			});
		}).then((res) => {
			return authPrincipal.getPrincipal().then((principal) => {
				if (!principal.userSQSurl) {
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
				this.sqsReceiveStreams.push(this.makeSQSqueue(res.device_sqs, properties));

				this.getApproxMsgCount(res.device_sqs).then((cnt) => {
					console.info('sqs: ' + res.device_sqs + ' : message count:' + cnt);
				});
			}
			if (res.device_prio_sqs) {
				console.info('sqs: starting devicePrioSQS: ' + res.device_prio_sqs);
				this.sqsReceiveStreams.push(this.makeSQSqueue(res.device_prio_sqs, properties));

				this.getApproxMsgCount(res.device_prio_sqs).then((cnt) => {
					console.info('sqs: ' + res.device_prio_sqs + ' : message count:' + cnt);
				});
			}
			if (res.userSQSurl) {
				console.info('sqs: starting userSQS: ' + res.userSQSurl);
				this.sqsReceiveStreams.push(this.makeSQSqueue(res.userSQSurl, properties));

				this.getApproxMsgCount(res.userSQSurl).then((cnt) => {
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

	stop(b?): Promise<any> {
		console.info('sqs: stopping all sqs qeueues.');
		var arr = this.sqsReceiveStreams.map((sqs) => {
			return sqs.close();
		})

		return promiseAll(arr).then(() => {
			//this.sqsReceiveStreams = [];
			console.info('sqs: all sqs qeueues stopped.');
		});
	};

	// Return promise resolving when all queues finished either because of errors or just being closed by explicitly calling close() on sqs stream.
	waitForFinish () {
		var arr = this.sqsReceiveStreams.map((sqs) => {
			return sqs.sequenceOfPromises
		});
		return promiseAll(arr);
	}

	// Return promised successfully resolved when there are 0 mesaseges on all queues collectivelly

	waitForNoMessages () : Promise<any> {
		var getCount = () : Promise<any> => {
			return new Promise<any>((resolve) => {
				setTimeout(()=>{
					resolve();
				},  25000); // wait fro 25s because queue long poll period is set to 20s 
			}).then (() => {
				return this.getApproxAllMsgCount().then((cnt) => {
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
				return this.getApproxAllMsgCount().then((cnt) => {
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

	pause () {
		console.info('sqs: pausing all sqs qeueues.');
		this.sqsReceiveStreams.map((sqs) => {
			sqs.stream.pause();
		});
	}

	resume () {
		console.info('sqs: resuming all sqs qeueues.');
		this.sqsReceiveStreams.map((sqs) => {
			sqs.stream.resume();
		});
	}

	//TODO: rename to 'purge'
	purgeSQSQueues (): Promise<any> {
		var purged = {};
		var arr = this.sqsReceiveStreams.map((sqs) => {
			return new Promise((resolve) => {
				if (!purged[sqs.url]) {
					sqs.stream.purge({QueueUrl: sqs.url}, (err, data) => {
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

	getOpenStreamsCount (url) {
		return this.sqsReceiveStreams.reduce((a, sqs) => {
			if ((sqs.url === url) && !sqs.stream.isClosed()) {
				++a;
			}
			return a;
		}, 0)
	}

	refreshToken () {
		// aws credentials a permanently buffered in SQS object.
		// Callinng just  AWS.config.credentials = new AWS.CognitoIdentityCredentials() (see awsservice.ts) does not set credentials in SQS, we need to
		// to call again constructor  new SQS(), so that new credentials from configuration are again read and set in SQS object. 
		// Therefore we must call  stop/start sqs to force calling  constructor  new SQS().
		// Please note, that whttp.ts may have refreshed access token already, this invalidates access token buffered in SQS and this is gonna trigger
		// refresing of access token again in sqs.
		if (!this.refreshingAccessToken) {
			this.refreshingAccessToken = true;
			console.info('sqs: refreshing access token: start (sqs will be stoped and started after access token successfuly refreshed)');
			logger.info('sqs: refreshing access token: start (sqs will be stoped and started after access token successfuly refreshed)');
			this.stop().then(() => {
				return authPrincipal.refreshToken().then((data) => {
					console.info('sqs: refreshing access token: finished ok');
					logger.info('sqs: refreshing access token: finished ok');
					this.refreshingAccessToken = false;
					this.start()
				}, (err) => {
					console.error('sqs: refreshing access token: error: ' + err);
					console.dir(err);
					logger.error('sqs: refreshing access token: error: ' + err, err);
					this.refreshingAccessToken = false;
				});
			});
		}
	}

	getAllActiveQueueUrls () {
		var urls = this.sqsReceiveStreams.reduce((urls, sqs) => {
			urls[sqs.url] = sqs.url;
			return urls;
		}, {})
		var arr = [];
		for (var k in urls) {
			arr.push(k);
		}
		return arr;
	}


	getApproxMsgCount (url): Promise<any> {

		var sqs = new AWS.SQS();
		var req: AWS.SQS.GetQueueAttributesRequest = {
			QueueUrl: url,
			AttributeNames: [
				'ApproximateNumberOfMessages'
			]
		};

		return new Promise((resolve, reject)=> {
			sqs.getQueueAttributes(req, (err, data)=> {
				if (err) {
					reject(err);
				}
				resolve(Number(data.Attributes.ApproximateNumberOfMessages));
			});
		});
	}

	getApproxAllMsgCount(): Promise<any> {
		var cnt = 0;
		var urls = this.getAllActiveQueueUrls();
		var parr = urls.map((url) => {
			return this.getApproxMsgCount(url).then((n) => {
				cnt += n;
			});
		});
		return promiseAll(parr).then(() => {
			return cnt;
		});
	}

	reportDeadMessage (url, msg) : Promise<any> {
		var sqs = new AWS.SQS();

		var durl;
		if (url.endsWith('.fifo')) {
			durl = url.slice(0, url.length -'.fifo'.length) + '_Deadletter';
		} else {
			durl = url + '_Deadletter'; 
		}


		var params = {
			DelaySeconds: 10,
			MessageAttributes: {},
			MessageBody: JSON.stringify(msg),
			QueueUrl: durl
		};

		return new Promise<any>((resolve, reject) => {
			sqs.sendMessage(params, function(err, data) {
				if (err) {
					console.error('sqs: reportDeadMessag(): ' + durl + ' : ' + err);
					console.dir(err);
					logger.error('sqs: reportDeadMessag(): ' + durl + ' : ' + err, err);
					reject(err);
					return;
				}

				resolve(data.MessageId);
			});
		});
	}


}

