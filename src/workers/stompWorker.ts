import { PROJECT_NAME } from '../consts';
import { getEnvironment } from '../environments/environment';
import { Logger } from '../types';
import { getLogger } from '../logger';

import { IWorkerMessage } from '../types';
import { Group } from '../typesStompGroups';
import { makeMessageRateCounterEventSource } from '../eventSource';
import { GetCloudempiereDatabase, Database } from '../idbDatabase';
import { bootWorker } from './worker';
import { workerCtx, settings } from './workerCtx';
import { sendMessage } from './common';
import { processMessages } from './replication';

import { Client } from '@stomp/stompjs';

import * as _ from 'underscore';
import * as R from 'ramda';

let logger = getLogger(PROJECT_NAME, 'stompWorker.ts');

let ERROR_COUNT_THRESHOLD = 5;

let QUEUES: any[] = [];

function sendMessageRateLimit(isOverLimit: boolean) {
	let msg: IWorkerMessage = {
		workerId: workerCtx.workerId,
		workerName: workerCtx.workerName,
		messageName: 'stompMessageRateLimit',
		messageData: {
			isOverLimit: isOverLimit,
		},
	};
	sendMessage(msg);
	if (settings.settings.isDebug && settings.settings.isDebugMessages && settings.settings.messagesDebugLevel > 0) {
		console.log(`stomp: message rate over limit: ${isOverLimit}`);
	}
}

function makeGroups() {
	let groups: Group[] = [];

	function newGroup(id: string): Group {
		return {
			id: id,
			sequenceNumber: 0,
			lastSequenceNumber: 0,
		};
	}

	function getGroups(): Group[] {
		return R.clone(groups);
	}

	function getGroup(id: string): Group {
		let group = R.find((group: Group) => group.id === id)(groups);
		if (group) {
			return R.clone(group);
		} else {
			return null;
		}
	}

	function saveGroup(group: Group): void {
		let idx = R.findIndex((_group: Group) => _group.id === group.id)(groups);
		if (idx > -1) {
			groups[idx] = group;
		} else {
			groups.push(group);
		}
	}

	function updateGroups(message): void {
		if (message.headers) {
			if (message.headers.hasOwnProperty('GroupID') && message.headers.hasOwnProperty('GroupSeq') && message.headers.hasOwnProperty('GroupSize')) {
				let id = message.headers['GroupID'];
				let sequenceNumber = message.headers['GroupSeq'];
				let lastSequenceNumber = message.headers['GroupSize'] - 1;

				let group = newGroup(id);
				group.sequenceNumber = sequenceNumber;
				group.lastSequenceNumber = lastSequenceNumber;

				if (settings.settings.isDebug && settings.settings.isDebugMessageGroups && settings.settings.messageGroupsDebugLevel > 1) {
					console.log(`stomp:  group ${group.id}: seq ${group.sequenceNumber}: last seq  ${group.lastSequenceNumber}`);
				}

				if (group.sequenceNumber > -1) {
					// for some reason backend is sending -1
					saveGroup(group);
				}
			}
		}
	}

	return {
		getGroups: getGroups,
		getGroup: getGroup,
		updateGroups: updateGroups,
	};
}

function makeQueue(db, queueName) {
	const FUNC = 'makeQueue()';
	let client;
	let connected = false;
	let subscription;
	let errorsCount = 0;
	let closed = false;

	let connect;
	let ctimeoutId;

	let messageBuffer = makeMessageBuffer();

	let groups = makeGroups();

	let messageRateCounterEventSource = makeMessageRateCounterEventSource(settings.settings.stompMessageRateIndicationWindowMilliseconds, settings.settings.stompMessageRateIndicationLimitCount);

	let brokerURL = getEnvironment().backendStompfBrokerUrl;

	client = new Client({
		brokerURL: brokerURL,
		connectHeaders: {
			login: 'cloudempiere',
			passcode: '6gEz8NeFWjDw',
		},
		reconnectDelay: 5000,
		heartbeatIncoming: 4000,
		heartbeatOutgoing: 4000,
	});

	logger.info(FUNC, `broker url: ${brokerURL}`);
	logger.info(FUNC, `connecting ${queueName} ...`);

	client.onConnect = function () {
		logger.info(FUNC, `connected ${queueName}`);

		connect = _connect;
		connected = true;
		if (ctimeoutId) {
			clearTimeout(ctimeoutId);
			ctimeoutId = null;
		}

		if (settings.settings.isStomp) {
			if (subscription) {
				// Client has automatically reconnected after network failure. We must set 'subscription' to null so that subscribe() do subscribe() calls client.subscribe().
				subscription = null;
			}
			subscribe();
		}
	};

	client.onStompError = function (frame) {
		const FUNC = 'client.onStompError()';
		if (workerCtx.offline) {
			// client should automatically reconnect
			return;
		}
		let err = new Error(
			`stomp: makeQueue(): stomp error:
			${frame.headers['message']}
			${frame.body}`
		);

		logger.error(FUNC, `${err}`, err);
	};

	function _connect() {
		if (closed) {
			return;
		}
		if (connected) {
			return;
		}

		//  Prevent calling connect() again untill we receive reply for previous connect().
		connect = function () {};
		ctimeoutId = setTimeout(function () {
			connect = _connect;
			connected = false;
			ctimeoutId = null;
		}, 6000);
		client.activate();
	}

	connect = _connect;

	function disconnect() {
		if (closed) {
			return;
		}
		if (ctimeoutId) {
			clearTimeout(ctimeoutId);
			connect = _connect;
			connected = false;
			ctimeoutId = null;
		}
		if (connected) {
			if (subscription) {
				subscription.unsubscribe();
			}
			client.deactivate();
			connected = false;
		}
	}

	function pause() {
		if (!connected) {
			return;
		}
		unsubscribe();
		logger.info(FUNC, `queue paused: ${queueName}`);
	}

	function resume() {
		if (!connected) {
			return;
		}
		subscribe();
		logger.info(FUNC, `queue resumed: ${queueName}`);
	}

	function subscribe() {
		if (!subscription) {
			subscription = client.subscribe(
				`/queue/${queueName}`,
				(message) => {
					if (settings.settings.isDebug && ((settings.settings.isDebugMessages && settings.settings.messagesDebugLevel > 3) || (settings.settings.isDebugMessageGroups && settings.settings.messageGroupsDebugLevel > 2))) {
						console.log(`stomp:  msg: ${message.headers['message-id']}`);
						console.dir(message.headers);
					}
					messageRateCounterEventSource.generateEvent(1);
					groups.updateGroups(message);
					messageBuffer.push(message);
				},
				{ ack: 'client-individual' }
			);
		}
	}

	function unsubscribe() {
		if (subscription) {
			subscription.unsubscribe();
			subscription = null;
		}
	}

	function makeMessageBuffer() {
		let buffer = [];
		let flushSize = 950; // This should not be greater then activeMq prefetch limit which is by default 1000. See https://activemq.apache.org/what-is-the-prefetch-limit-for.html
		let bufferFushInterval = 5 * 1000;
		let bufferFlushTimoutId;

		function flush() {
			if (bufferFlushTimoutId) {
				clearTimeout(bufferFlushTimoutId);
				bufferFlushTimoutId = null;
			}
			if (buffer.length > 0) {
				let messages = buffer;
				buffer = [];
				let _messages = messages.map((message) => {
					return message.body;
				});

				processMessages(db, _messages).then(
					() => {
						const FUNC = 'processMessages()';
						messages.forEach((message) => {
							if (connected) {
								message.ack();
							}
						});
					},
					(err) => {
						messages.forEach((message) => {
							if (connected) {
								message.ack();
							}
						});
						++errorsCount;
						let errs = `error while processing message: ${err}`;
						logger.error(FUNC, errs, err);
						if (errorsCount > ERROR_COUNT_THRESHOLD) {
							logger.error(FUNC, `stop receiving because of too many errors`);
							disconnect();
						}
					}
				);
			}
			if (!closed) {
				bufferFlushTimoutId = setTimeout(() => {
					flush();
				}, bufferFushInterval);
			}
		}

		function push(message) {
			if (buffer.length >= flushSize) {
				flush();
			} else {
				if (!bufferFlushTimoutId) {
					if (!closed) {
						bufferFlushTimoutId = setTimeout(() => {
							flush();
						}, bufferFushInterval);
					}
				}
			}
			buffer.push(message);
		}

		return {
			push: push,
		};
	}

	function startMessageRateCounter() {
		messageRateCounterEventSource.subject.subscribe((isOverLimit: boolean) => {
			sendMessageRateLimit(isOverLimit);
		});
	}

	startMessageRateCounter();
	connect();

	return {
		pause: (): Promise<any> => {
			return new Promise((resolve) => {
				if (closed) {
					return;
				}
				pause();
				resolve(undefined);
			});
		},

		resume: (): Promise<any> => {
			return new Promise((resolve) => {
				if (closed) {
					return;
				}
				resume();
				resolve(undefined);
			});
		},

		close: (): Promise<any> => {
			return new Promise((resolve) => {
				disconnect();
				closed = true;
				resolve(undefined);
			});
		},

		isClosed: (): boolean => {
			return closed;
		},

		queueName: queueName,
		groups: groups,
	};
}

async function start(queueNames: string[]): Promise<any> {
	const FUNC = 'start()';
	let db: Database = await GetCloudempiereDatabase();

	function queueExists(queueName) {
		let idx = R.findIndex((q) => q.queueName === queueName)(QUEUES);
		return idx > -1;
	}

	queueNames.forEach((queueName) => {
		if (queueExists(queueName)) {
			logger.info(FUNC, `queue is already running: ${queueName}`);
			logger.info(FUNC, `queue started: ${queueName}`);
		} else {
			logger.info(FUNC, `queue started: ${queueName}`);
			QUEUES.push(makeQueue(db.db, queueName));
		}
	});
}

function stop(): Promise<any> {
	const FUNC = 'stop()';
	return new Promise((resolve) => {
		logger.info(FUNC, `stopping all qeueues.`);
		QUEUES.forEach((queue) => {
			queue
				.close()
				.catch((err) => {
					let errs = `queue: ${queue.queueName}: error: ${err}`;
					logger.error(FUNC, errs, err);
				})
				.then(() => {
					logger.info(FUNC, `queue stopped: ${queue.queueName}`);
				});
		});
		QUEUES = [];
		resolve(undefined);
	});
}

function pause(): Promise<any> {
	const FUNC = 'pause()';

	logger.info(FUNC, `pausing all stomp qeueues.`);
	let arr = QUEUES.map((queue) => {
		return queue.pause();
	});
	return Promise.all(arr);
}

function resume(): Promise<any> {
	const FUNC = 'resume()';

	logger.info(FUNC, `resuming all stomp qeueues.`);
	let arr = QUEUES.map((queue) => {
		return queue.resume();
	});
	return Promise.all(arr);
}

function getGroups(): Group[] {
	let groups = R.reduce((a, groups: Group[]) => {
		a = R.concat(a, groups);
		return a;
	})([], R.map((queue) => queue.groups.getGroups())(QUEUES));
	if (settings.settings.isDebug && settings.settings.isDebugMessageGroups) {
		console.log(`stomp:  groups count ${groups.length}`);
		console.dir(groups);
	}
	return groups;
}

function getGroup(id: string): Group {
	const FUNC = 'getGroup()';

	let groups = R.map((queue) => queue.groups.getGroup(id))(QUEUES);
	groups = R.filter((group: Group) => group !== null)(groups);
	if (groups.length > 1) {
		let errs = `more then one group found`;
		logger.error(FUNC, errs);
	}
	let group: Group;
	if (groups.length > 0) {
		group = groups[0];
	} else {
		group = null;
	}
	if (settings.settings.isDebug && settings.settings.isDebugMessageGroups) {
		console.log(`stomp:  group ${group.id}: seq ${group.sequenceNumber}: last seq  ${group.lastSequenceNumber}`);
		console.dir(group);
	}
	return group;
}

function stompTest() {
	let messageRateCounterEventSource = makeMessageRateCounterEventSource(settings.settings.stompMessageRateIndicationWindowMilliseconds, settings.settings.stompMessageRateIndicationLimitCount);

	messageRateCounterEventSource.source.subscribe((isOverLimit: boolean) => {
		sendMessageRateLimit(isOverLimit);
	});

	function generateEvents(count: number) {
		setTimeout(() => {
			messageRateCounterEventSource.generateEvent(1);
			--count;
			if (count > 0) {
				generateEvents(count);
			}
		}, 10);
	}
	generateEvents(25);
}

bootWorker(function (event) {
	const FUNC = 'messageHandlerFn()';
	let msg: IWorkerMessage = event.data;

	try {
		if ('stompStart' === msg.messageName) {
			start(msg.messageData.queueNames).then(
				function () {
					event.ports[0].postMessage({});
				},
				function (err) {
					event.ports[0].postMessage({
						err: '' + err,
					});
				}
			);
			return true;
		}

		if ('stompStop' === msg.messageName) {
			stop().then(
				function () {
					event.ports[0].postMessage({});
				},
				function (err) {
					event.ports[0].postMessage({
						err: '' + err,
					});
				}
			);
			return true;
		}

		if ('stompPause' === msg.messageName) {
			pause();
			event.ports[0].postMessage({});
			return true;
		}

		if ('stompResume' === msg.messageName) {
			resume();
			event.ports[0].postMessage({});
			return true;
		}

		if ('stompGetGroups' === msg.messageName) {
			let groups = getGroups();
			event.ports[0].postMessage({ groups: groups });
			return true;
		}

		if ('stompGetGroup' === msg.messageName) {
			let group = getGroup(msg.messageData.id);
			event.ports[0].postMessage({ group: group });
			return true;
		}

		if ('stompTest' === msg.messageName) {
			stompTest();
			event.ports[0].postMessage({});
			return true;
		}
	} catch (err) {
		logger.error(FUNC, `error`, err);
		event.ports[0].postMessage({
			err: '' + err,
		});
	}
});
