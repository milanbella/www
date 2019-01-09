import { IWorkerMessage } from './types';
import { SQS_WORKER } from './types';
import { logger } from './logger';
import { EventSource } from './eventSource';
import { waitFor } from '../common/utils';
import { authPrincipal } from './authprincipal';

import * as AWS from 'aws-sdk/global';                                                                                                                                            
import * as SQS from 'aws-sdk/clients/sqs';
import { _ } from 'underscore';

export var sqs;
sqs = {};
EventSource.principalChangeEventSource.source.subscribe((principal) => {
	// Must create new SQS instance to refresh cashed local credentials in SQS from globals set by setAWSCredentials() from awsservice.ts (calle by authPrincipal).
	sqs.awsSQS = new SQS();
});

var worker;
var workerId;
var workerName: string;

function initFinished (): Promise<any> {
	return waitFor(function () {return workerId >= 0;});
}

var sqsMessagSource: EventSource = new EventSource(); //TODO

//TODO
sqs.getEventSourceForMessage = function ()  {
	return sqsMessagSource.source.flatMap((msg) => {
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

//TODO
sqs.getEventSourceForSQL = function () {
	return sqsMessagSource.source.filter((message) => {
		var _message = message[_.keys(message)[0]];
		return _message.TargetType !== 'KeyStore';
	});
};

sqs.start = function () : Promise<any> {
	return initFinished().then(function () {

		return authPrincipal.getPrincipal().then(function (principal) { // SQS webworker might refreshed access token. Calling getPrincipal() ensures that setAWSCredentials() is called with new access token.

			// Must create new SQS instance to refresh cashed local credentials in SQS from globals set by setAWSCredentials() from awsservice.ts
			sqs.awsSQS = new SQS();

			return new Promise<any>(function (resolve, reject) {

				var channel = new MessageChannel();
				var msg: IWorkerMessage = {
					workerId: workerId,
					workerName: workerName,
					messageName: 'sqsStart',
					messageData: {
					}
				}

				worker.postMessage(msg, [channel.port2]);

				channel.port1.onmessage = function (event) {
					if (event.data.err) {
						console.error('sqs: start(): ' + event.data.err); 
						console.dir(event.data.err);
						logger.error('sqs: start(): ' + event.data.err); 
						reject(event.data.err);
						return;
					}
					resolve();
				}
			});
		});

	});
}

sqs.stop = function () : Promise<any> {
	return initFinished().then(function () {

		return new Promise<any>(function (resolve, reject) {

			var channel = new MessageChannel();
			var msg: IWorkerMessage = {
				workerId: workerId,
				workerName: workerName,
				messageName: 'sqsStop',
				messageData: {
				}
			}

			worker.postMessage(msg, [channel.port2]);

			channel.port1.onmessage = function (event) {
				if (event.data.err) {
					console.error('sqs: stop(): ' + event.data.err); 
					console.dir(event.data.err);
					logger.error('sqs: stop(): ' + event.data.err); 
					reject(event.data.err);
					return;
				}
				resolve();
			}
		});
	});
}

sqs.waitForFinish = function (): Promise<any> {
	return initFinished().then(function () {
		return new Promise<any>(function (resolve, reject) {

			var channel = new MessageChannel();
			var msg: IWorkerMessage = {
				workerId: workerId,
				workerName: workerName,
				messageName: 'sqsWaitForFinish',
				messageData: {
				}
			}

			worker.postMessage(msg, [channel.port2]);

			channel.port1.onmessage = function (event) {
				if (event.data.err) {
					console.error('sqs: waitForFinish(): ' + event.data.err); 
					console.dir(event.data.err);
					logger.error('sqs: waitForFinish(): ' + event.data.err); 
					reject(event.data.err);
					return;
				}
				resolve();
			}
		});
	});
}

sqs.waitForNoMessages = function (): Promise<any> {
	return initFinished().then(function () {
		return new Promise<any>(function (resolve, reject) {

			var channel = new MessageChannel();
			var msg: IWorkerMessage = {
				workerId: workerId,
				workerName: workerName,
				messageName: 'sqsWaitForNoMessages',
				messageData: {
				}
			}

			worker.postMessage(msg, [channel.port2]);

			channel.port1.onmessage = function (event) {
				if (event.data.err) {
					console.error('sqs: waitForNoMessages(): ' + event.data.err); 
					console.dir(event.data.err);
					logger.error('sqs: waitForNoMessages(): ' + event.data.err); 
					reject(event.data.err);
					return;
				}
				resolve();
			}
		});
	});
}

sqs.pause = function () : Promise<any> {
	return initFinished().then(function () {
		return new Promise<any>(function (resolve, reject) {

			var channel = new MessageChannel();
			var msg: IWorkerMessage = {
				workerId: workerId,
				workerName: workerName,
				messageName: 'sqsPause',
				messageData: {
				}
			}

			worker.postMessage(msg, [channel.port2]);

			channel.port1.onmessage = function (event) {
				if (event.data.err) {
					console.error('sqs: pause(): ' + event.data.err); 
					console.dir(event.data.err);
					logger.error('sqs: pause(): ' + event.data.err); 
					reject(event.data.err);
					return;
				}
				resolve();
			}
		});
	});
}

sqs.resume = function () {
	return initFinished().then(function () {
		return new Promise<any>(function (resolve, reject) {

			var channel = new MessageChannel();
			var msg: IWorkerMessage = {
				workerId: workerId,
				workerName: workerName,
				messageName: 'sqsResume',
				messageData: {
				}
			}

			worker.postMessage(msg, [channel.port2]);

			channel.port1.onmessage = function (event) {
				if (event.data.err) {
					console.error('sqs: resume(): ' + event.data.err); 
					console.dir(event.data.err);
					logger.error('sqs: resume(): ' + event.data.err); 
					reject(event.data.err);
					return;
				}
				resolve();
			}
		});
	});
}

sqs.purgeSQSQueues = function (): Promise<any> {
	return initFinished().then(function () {
		return new Promise<any>(function (resolve, reject) {

			var channel = new MessageChannel();
			var msg: IWorkerMessage = {
				workerId: workerId,
				workerName: workerName,
				messageName: 'sqsPurgeSQSQueues',
				messageData: {
				}
			}

			worker.postMessage(msg, [channel.port2]);

			channel.port1.onmessage = function (event) {
				if (event.data.err) {
					console.error('sqs: purgeSQSQueues(): ' + event.data.err); 
					console.dir(event.data.err);
					logger.error('sqs: purgeSQSQueues(): ' + event.data.err); 
					reject(event.data.err);
					return;
				}
				resolve();
			}
		});
	});
}

sqs.getApproxMsgCount = function (url): Promise<any> {
	return initFinished().then(function () {
		return new Promise<any>(function (resolve, reject) {

			var channel = new MessageChannel();
			var msg: IWorkerMessage = {
				workerId: workerId,
				workerName: workerName,
				messageName: 'sqsGetApproxMsgCount',
				messageData: {
					url: url
				}
			}

			worker.postMessage(msg, [channel.port2]);

			channel.port1.onmessage = function (event) {
				if (event.data.err) {
					console.error('sqs: getApproxMsgCount(): ' + event.data.err); 
					console.dir(event.data.err);
					logger.error('sqs: getApproxMsgCount(): ' + event.data.err); 
					reject(event.data.err);
					return;
				}
				resolve(event.data.cnt);
			}
		});
	});
}

sqs.getApproxAllMsgCount = function (): Promise<any> {
	return initFinished().then(function () {
		return new Promise<any>(function (resolve, reject) {

			var channel = new MessageChannel();
			var msg: IWorkerMessage = {
				workerId: workerId,
				workerName: workerName,
				messageName: 'sqsGetApproxAllMsgCount',
				messageData: {
				}
			}

			worker.postMessage(msg, [channel.port2]);

			channel.port1.onmessage = function (event) {
				if (event.data.err) {
					console.error('sqs: getApproxAllMsgCount(): ' + event.data.err); 
					console.dir(event.data.err);
					logger.error('sqs: getApproxAllMsgCount(): ' + event.data.err); 
					reject(event.data.err);
					return;
				}
				resolve(event.data.cnt);
			}
		});
	});
}

sqs.setDebug = function (name, value): Promise<any> {
	return initFinished().then(function () {
		return new Promise<any>(function (resolve, reject) {

			var channel = new MessageChannel();
			var msg: IWorkerMessage = {
				workerId: workerId,
				workerName: workerName,
				messageName: 'sqsSetDebug',
				messageData: {
					name: name,
					value: value
				}
			}

			worker.postMessage(msg, [channel.port2]);

			channel.port1.onmessage = function (event) {
				if (event.data.err) {
					console.error('sqs: setDebug(): ' + event.data.err); 
					console.dir(event.data.err);
					reject(event.data.err);
					return;
				}
				resolve(event.data);
			}
		});
	});
}
window['sqsSetDebug'] = sqs.setDebug;


export function workerMessageHandler (event) {
	var msg: IWorkerMessage = event.data;

	// Wrap aws call to refresh access token and rery call again in case of expired access token.

	function awsCall (callName, callParams, cbFn) {

		function wcbFn (err, data) {
			if (err) {
				if (err.toString().match(/credentials/i)) {
					console.warn('sqs: ' + callName + ': ' + err);
					authPrincipal.refreshToken(function () {
						sqs.awsSQS = new SQS(); // must re-create sqs to force new aws config credentials be picked up by SQS  
					}).then(function () {
						// repeat call using new credentials after refreshing token
						sqs.awsSQS[callName](callParams, cbFn); 
					}, function (err) {
						console.error('sqs: refreshing access token: error: ' + err);
						console.dir(err);
						logger.error('sqs: refreshing access token: error: ' + err, err);
						event.ports[0].postMessage({
							err: '' + err
						});
					})
				} else {
					cbFn(err, data)
				}
			} else {
				cbFn(err, data)
			}
		}
		return function() {
			sqs.awsSQS[callName](callParams, wcbFn); 
		};
	}

	
	try {

		if ('awsSqsReceiveMessage' === msg.messageName) {
			awsCall('receiveMessage', {
				QueueUrl: msg.messageData.QueueUrl,
				MaxNumberOfMessages: msg.messageData.MaxNumberOfMessages,
				WaitTimeSeconds: msg.messageData.WaitTimeSeconds
			}, function (err, data) {
				if (err) {
					event.ports[0].postMessage({
						err: '' + err
					});
					return;
				}
				event.ports[0].postMessage({
					data: data
				});
			})();
		} else if ('awsSqsDeleteMessageBatch' === msg.messageName) {
			awsCall('deleteMessageBatch', {
				QueueUrl: msg.messageData.QueueUrl,
				Entries: msg.messageData.Entries
			}, function (err, data) {
				if (err) {
					event.ports[0].postMessage({
						err: '' + err
					});
					return;
				}
				event.ports[0].postMessage({
				});
			})();
		} else if ('awsSqsPurgeQueue' === msg.messageName) {
			awsCall('purgeQueue', {
				QueueUrl: msg.messageData.QueueUrl
			}, function (err, data) {
				if (err) {
					event.ports[0].postMessage({
						err: '' + err
					});
					return;
				}
				event.ports[0].postMessage({
				});
			})();
		} else if ('sqsGetApproxMsgCount' === msg.messageName) {
			var req: SQS.GetQueueAttributesRequest = {
				QueueUrl: msg.messageData.QueueUrl,
				AttributeNames: [
					'ApproximateNumberOfMessages'
				]
			};
			awsCall('getQueueAttributes', req, function (err, data) {
				if (err) {
					event.ports[0].postMessage({
						err: '' + err
					});
					return;
				}
				event.ports[0].postMessage({
					count: Number(data.Attributes.ApproximateNumberOfMessages)
				});
			})();
		} else if ('sqsReportDeadMessage' === msg.messageName) {
			var params = {
				DelaySeconds: 10,
				MessageAttributes: {},
				MessageBody: msg.messageData.MessageBody,
				QueueUrl: msg.messageData.QueueUrl
			};
			awsCall('sendMessage', params, function (err, data) {
				if (err) {
					event.ports[0].postMessage({
						err: '' + err
					});
					return;
				}
				event.ports[0].postMessage({
					data: data
				});
			})();
		} else {
			event.ports[0].postMessage({
				err: 'unknow messageName'
			});
		}


	} catch (err) {
		console.error('sqs: error: ');
		console.dir(err);
		event.ports[0].postMessage({
			err: '' + err
		});
	}
};

export function setWorker (_worker, _workerId, _workerName) {
	worker = _worker;
	workerId = _workerId;
	workerName = _workerName;
};
