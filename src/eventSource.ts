import { Observable, Subject, BehaviorSubject, ConnectableObservable } from 'rxjs';
import { windowTime, distinctUntilChanged, map, reduce, concatAll } from 'rxjs/operators';
import { multicast } from 'rxjs/operators';

import * as _ from 'underscore';

export class EventSource {
	public foo: string;

	private subscribers: any = [];
	public source: Observable<any>;
	public subject: Observable<any>;

	constructor() {
		this.subscribers = [];

		this.source = new Observable((subscriber) => {
			this.subscribers.push(subscriber);

			return () => {
				this.subscribers = _.filter(this.subscribers, (o) => {
					return o !== subscriber;
				});
			};
		});
	}

	public generateEvent(e?) {
		_.each(this.subscribers, (subscriber: any) => {
			subscriber.next(e);
		});
	}

	public generateError(err) {
		_.each(this.subscribers, (subscriber: any) => {
			subscriber.error(err);
		});
	}

	public generateComplete() {
		_.each(this.subscribers, (subscriber: any) => {
			subscriber.complete();
		});
	}

	static authenticateEvenSource: EventSource = new EventSource();
	static principalChangeEventSource: EventSource = new EventSource();
	static offlineEventSource = new EventSource();
	static settingsChangeEventSource = new EventSource();
	static componentsMessagingnEventSource: EventSource = new EventSource();
	static pouchLockChangeEventSource: EventSource = new EventSource();
	static pouchDocumentChangeEventSource: EventSource = new EventSource();
	static pouchDocumentListChangeEventSource: EventSource = new EventSource();
	static pouchDocumentLoadDocumentsProgressEventSource: EventSource = new EventSource();
	static applicationSlotsEventSource: EventSource = new EventSource();
	static userSessionCreateEventSource: EventSource = new EventSource();
	static userSessionDestroyEventSource: EventSource = new EventSource();
	static goToLoginPageEventSource: EventSource = new EventSource();
	static startDeviceInitWizardPage: EventSource = new EventSource();
	static showBusyBox: EventSource = new EventSource();
	static stompMessageRateOverLimit = new EventSource();
	static pouchMessageRateOverLimit = new EventSource();

	static makeEventSources() {
		let eventSource;

		eventSource = new EventSource();
		eventSource.subject = eventSource.source.pipe(multicast(new BehaviorSubject<boolean>(false)));
		(eventSource.subject as ConnectableObservable<boolean>).connect();
		EventSource.stompMessageRateOverLimit = eventSource;

		eventSource = new EventSource();
		eventSource.subject = eventSource.source.pipe(multicast(new BehaviorSubject<boolean>(false)));
		(eventSource.subject as ConnectableObservable<boolean>).connect();
		EventSource.pouchMessageRateOverLimit = eventSource;
	}
}

EventSource.makeEventSources();

export type ComponentName = 'page-login' | 'page-bla-bla';

interface ComponentMessage {
	componentName: ComponentName;
	message: any;
}

export function sendComponentMessage(target: ComponentName, message: any) {
	let componentMessage: ComponentMessage = {
		componentName: target,
		message: message,
	};
	EventSource.componentsMessagingnEventSource.generateEvent(componentMessage);
}

/**
 * Emits true/false based on number of messages over/bellow limitMessageCount within windowInMilliseconds time window.
 */

export function makeMessageRateCounterEventSource(windowInMilliseconds = 2000, limitMessageCount = 50): EventSource {
	let eventSource = new EventSource();

	let source = eventSource.source.pipe(
		windowTime(windowInMilliseconds),
		map((win) =>
			win.pipe(
				reduce((a) => {
					a += 1;
					return a;
				}, 0)
			)
		),
		concatAll(),
		map((count) => count > limitMessageCount),
		distinctUntilChanged()
	);

	eventSource.source = source;
	eventSource.subject = eventSource.source.pipe(multicast(new Subject<boolean>()));
	(eventSource.subject as ConnectableObservable<boolean>).connect();

	return eventSource;
}
