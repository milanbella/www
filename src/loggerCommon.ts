import { Logger, LogFn } from './types';

export interface ILogEventData {
	level: string;
	message: string;
}

export interface ISender {
	sendLog(attrs: any): Promise<any>;
}

export interface ILogEntry {
	entry_type: string;
	flush_count: number;
	senders: {
		[senderName: string]: ILogEntrySender;
	};
	message?: string;
	level?: string;
	time?: string;
	attrs?: any;
	event?: any;
}

export interface ILogEntrySender {
	timeSentAt: number;
	errorCounter: number;
	sentOk: boolean;
}

export interface IRegisteredSenders {
	[senderName: string]: ISender;
}

export const DATABASE_NAME_OFFLINE_LOG = 'logDb';
export const STORE_NAME_OFFLINE_LOG = 'offlineLog';
