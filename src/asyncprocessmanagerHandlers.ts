import { PROJECT_NAME } from './consts';
import { PouchDbObject } from './providers/pouchDbObject';
import { cdDocument, Process, ProcessStatusChangeHanlerFnName, ProcessStatusChangeHanlerFn } from './types';
import { getLogger } from './logger';

let logger = getLogger(PROJECT_NAME, 'asyncprocessmanagerHandlers.ts');

function documentProcessingStatusHandler(process: Process): Promise<void> {
	const FUNC = 'documentProcessingStatusHandler()';
	if (!process.couch_document_id) {
		let errs = `process: ${process.couch_document_id},  process is missing couch_document_id`;
		logger.error(FUNC, errs);
		return Promise.reject(new Error(errs));
	}
	return PouchDbObject.GetDocument(process.couch_document_id, true).then((doc: cdDocument) => {
		if (doc) {
			if (process.process_status === 'queued') {
				doc.AD_PInstance_ID = process.AD_PInstance_ID;
				doc.documentProcessingStatus = 'processed';
			} else if (process.process_status === 'finished') {
				doc.documentProcessingStatus = 'posted';
			} else if (process.process_status === 'error') {
				doc.documentProcessingStatus = 'error';
				doc.errorMsg = '' + process.err;
			}
			return (PouchDbObject.UpdateDocument(doc) as unknown) as Promise<void>;
		} else {
			return;
		}
	});
}

function noopHandler(): Promise<void> {
	return Promise.resolve();
}

export function getProcessStatusChangeHandler(handlerName: ProcessStatusChangeHanlerFnName): ProcessStatusChangeHanlerFn {
	const FUNC = 'getProcessStatusChangeHandler()';
	if (handlerName === 'documentProcessingStatusHandler') {
		return documentProcessingStatusHandler;
	} else if (handlerName === 'noopHandler') {
		return noopHandler;
	} else {
		let errs = `unknown handler name`;
		let err = new Error(errs);
		logger.error(FUNC, errs, err);
		return () => Promise.resolve();
	}
}
