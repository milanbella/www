import { PROJECT_NAME } from './consts';
import { Group } from './typesStompGroups';
import { stomp } from './stomp';
import { getLogger } from './logger';
import { settings } from './settings';

const POLL_INTERVAL = 1000;

let logger = getLogger(PROJECT_NAME, 'stompGroups.ts');

type ProgressFn = (progress: number) => void;

// Return currently running message groups.

export function getGroups(): Promise<Group[]> {
	const FUNC = 'getGroups()';
	return stomp.getGroups().then((groups: Group[]) => {
		if (settings.settings.isDebug && settings.settings.isDebugMessageGroups && settings.settings.messageGroupsDebugLevel > 3) {
			logger.info(FUNC, `groups.length: ${groups.length}`, null, groups);
		}
		return groups;
	});
}

// Return message group given the group id. If such a group does not exist returns null.

export function getGroup(id: string): Promise<Group> {
	return stomp.getGroup(id);
}

// Wait untill there are some init groups in stomp stream. Wait indefinetely unless optional timeout specified.
// Calls call back 'fn' passing it all existing init groups in stomp stream.

export function waitForStompGroups(fn: (groups: Group[]) => Promise<any>, timeout?: number): Promise<any> {
	const FUNC = 'waitForStompGroups()';
	let startTime = Date.now();

	let delay = (ms): Promise<any> => {
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve(undefined);
			}, ms);
		});
	};

	let wait = (promise): Promise<any> => {
		return delay(1000).then(() => {
			let currentTime = Date.now();
			if (timeout) {
				if (currentTime - startTime > timeout) {
					let errs = `timeout`;
					let err = new Error(errs);
					logger.error(FUNC, `error: ${err}`, err);
					return Promise.reject(err);
				}
			}

			return promise.then((groups: Group[]) => {
				if (groups.length > 0) {
					return fn(groups);
				} else {
					return wait(getGroups());
				}
			});
		});
	};
	return wait(getGroups());
}

export class GroupProgressEvents {
	private running = false;
	private startTime: number;
	private timerId;
	private progressFn: ProgressFn;

	// Start generating progress events for given message group.
	// Before calling start() you must register event handler using onProgress() method.

	public start(groupId: string, timeoutMilliseconds?: number) {
		const FUNC = 'start()';

		if (this.running) {
			return;
		}
		this.running = true;

		this.startTime = new Date().getTime();

		let loop = () => {
			if (timeoutMilliseconds) {
				let currentTime = new Date().getTime();
				if (currentTime - this.startTime > timeoutMilliseconds) {
					let errs = `init group ${groupId}: timeout`;
					logger.error(FUNC, errs);
					this.progressFn(100);
					return;
				}
			}
			getGroup(groupId).then((group: Group) => {
				if (group === null) {
					if (settings.settings.isDebug && settings.settings.isDebugMessageGroups && settings.settings.messageGroupsDebugLevel > 0) {
						logger.info(FUNC, `group ${group.id}: null`);
					}
					// group does not exist
					this.progressFn(100);
				} else {
					if (settings.settings.isDebug && settings.settings.isDebugMessageGroups && settings.settings.messageGroupsDebugLevel > 0) {
						logger.info(FUNC, `group ${group.id}: seq ${group.sequenceNumber}: last seq ${group.lastSequenceNumber}`);
					}
					if (group.sequenceNumber >= group.lastSequenceNumber) {
						// group is finished
						let progress = 100;

						if (settings.settings.isDebug && settings.settings.isDebugMessageGroups && settings.settings.messageGroupsDebugLevel > 0) {
							logger.info(FUNC, `group ${group.id}: progress ${progress}`);
						}
						this.progressFn(progress);
					} else {
						if (group.lastSequenceNumber > 0) {
							// division by 0 guard
							// Report percentage of progress towards the final state where lastSequenceNumber has been reached.
							let progress = Math.floor((group.sequenceNumber * 100) / group.lastSequenceNumber);

							if (settings.settings.isDebug && settings.settings.isDebugMessageGroups && settings.settings.messageGroupsDebugLevel > 0) {
								logger.info(FUNC, `group ${group.id}: progress ${progress}`);
							}
							this.progressFn(progress);
							setTimeout(loop, POLL_INTERVAL);
						} else {
							// division by 0
							let progress = 100;

							if (settings.settings.isDebug && settings.settings.isDebugMessageGroups && settings.settings.messageGroupsDebugLevel > 0) {
								logger.info(FUNC, `group ${group.id}: error - lastSequenceNumber is 0 !!!!:  progress ${progress}`);
							}
							this.progressFn(progress);
						}
					}
				}
			});
		};

		setTimeout(loop, POLL_INTERVAL);
	}

	// Register on progress event handler. Must be called before start();
	// Progress function callback receives progrress percentage number in the range 0..100, where value of 100 means that
	// last sequence nmber has been receieved in message group.
	// It is guaranteed taht number 100 is returned on non existent message group.
	// In case time is specified when calling GroupProgressEvents.start() number 100 is emmitted once timeout period elapsed.

	public onProgress(fn: ProgressFn) {
		this.progressFn = fn;
	}
}

export function testStompGroupProgress() {
	const FUNC = 'testStompGroupProgress()';

	getGroups()
		.then((groups: Group[]) => {
			// Report progress of each group.

			groups.forEach((group: Group) => {
				let groupProgressEvents = new GroupProgressEvents();
				groupProgressEvents.onProgress((progress) => {
					console.log(`progress: ${progress} %`);
				});
				groupProgressEvents.start(group.id, 500000);
			});
		})
		.catch((err) => {
			let errs = `error: ${err}`;
			logger.error(FUNC, errs, err);
		});
}
