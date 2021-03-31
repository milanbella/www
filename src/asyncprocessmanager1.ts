import { PROJECT_NAME } from './consts';
import { Process, ProcessSubType, ProcessStatus, ProcessStatusChangeHanlerFnName, ProcessStatusChangeHanlerFn } from './types';
import { Logger } from './types';
import { webservice_url, restapi_url } from './environment';
import { getLogger } from './logger';
import { whttp } from './whttp';
import { EventSource } from './eventSource';
import { persist } from './persist';
import { net } from './net';
import { settings } from './settings';
import { callIdempiereProcess } from './idempiereProcess';
import { getProcessStatusChangeHandler } from './asyncprocessmanagerHandlers';
import { MovementsPOSTRequest } from './rest-model/MovementsPOSTRequest';
import { PhysCountsPOSTRequest } from './rest-model/PhysCountsPOSTRequest';
import { Order } from './rest-model/Order';
import { newRequest } from './fetch';

import * as R from 'ramda';
import * as _ from 'underscore';
import { v1 as uuidV1 } from 'uuid';
import { filter } from 'rxjs/operators';

const logger = getLogger(PROJECT_NAME, 'asyncprocessmanager1.ts');

export interface ProcessEventHandle {
	// start() must be called aby application level for the process to start.
	// Optionally it is possible to pass to start() the hook to be called whenever process status has changed.
	// Process state is persisted in indexdb between device boots, after the device boots the process is started again.
	start: (statusChangeHandlerFunctionName?: ProcessStatusChangeHanlerFnName, statusChangeHandlerFunctionOptions?: any) => void;
}

function noopProcessEventHandle(): ProcessEventHandle {
	return {
		start: () => {
			return;
		},
	};
}

interface ProcessStatusHandler {
	handler_function_name: ProcessStatusChangeHanlerFnName;
}

interface JobStatusResult {
	isprocessing: boolean;
	iserror: boolean;
	errormsg: string;
}

function noop() {}

class AsyncProcessManager1 {
	queue = [];
	MAX_PROCESSES_COUNT = 10;
	MAX_PROCESSES_ERROR_COUNT = 3;
	processesCount = 0;
	eventSource: EventSource = new EventSource();

	running = false;
	offline = true;

	constructor() {
		this.offline = net.isOffline();
		EventSource.offlineEventSource.source.subscribe((offline) => {
			this.offline = offline;
			if (!this.offline) {
				let count = this.MAX_PROCESSES_COUNT - this.processesCount;
				if (count > 0) {
					this.startProcesses(count, true);
				}
			}
		});
		this.handleProcess();
	}

	start(): Promise<void> {
		const FUNC = 'start()';
		this.running = true;
		logger.info(FUNC, 'async process manager: starting ...');
		return this.startProcesses(this.MAX_PROCESSES_COUNT, true)
			.then(() => {
				logger.info(FUNC, 'async process manager: started');
			})
			.catch((err) => {
				logger.error(FUNC, `error ${err}`, err);
				return Promise.reject(err);
			});
	}

	stop(): Promise<void> {
		const FUNC = 'stop()';
		this.running = false;
		logger.info(FUNC, 'async process manager: stoping ...');
		return Promise.resolve()
			.then(() => {
				logger.info(FUNC, 'async process manager: stoped');
			})
			.catch((err) => {
				logger.error(FUNC, `error ${err}`, err);
				return Promise.reject(err);
			});
	}

	saveProcess(process: Process): Promise<void> {
		const FUNC = 'saveProcess()';
		return persist.saveRecord('process', process).catch((err) => {
			logger.error(FUNC, `error ${err}`, err);
			return Promise.reject(err);
		});
	}

	readProcesses(process_status: ProcessStatus): Promise<Process[]> {
		const FUNC = 'readProcesses()';
		return persist
			.getIndexRecords('process', 'process_status', [process_status])
			.then((rs: unknown[]) => {
				let ps: Process[] = rs.map((r: any) => {
					return r;
				});
				return ps;
			})
			.catch((err) => {
				logger.error(FUNC, `error ${err}`, err);
				return Promise.reject(err);
			});
	}

	readProcessesByCouchDocId(docId: string): Promise<Process[]> {
		const FUNC = 'readProcessesByCouchDocId()';
		return persist
			.getIndexRecords('process', 'couch_document_id', [docId])
			.then((rs: unknown[]) => {
				let ps: Process[] = rs.map((r: any) => {
					return r;
				});
				return ps;
			})
			.catch((err) => {
				logger.error(FUNC, `error ${err}`, err);
				return Promise.reject(err);
			});
	}

	saveProcessAndGenerateEvent(process: Process): Promise<void> {
		const FUNC = 'saveProcessAndGenerateEvent()';
		let time = new Date().toISOString();

		process.modified_time = time;
		if (process.process_status === 'queued') {
			process.created_time = time;
		}
		if (process.process_status === 'finished') {
			process.finished_time = time;
		}
		if (process.err) {
			process.err = '' + process.err; // ensure that err is not 'Error' object to prevent json serialization fail
		}

		return persist
			.saveRecord('process', process)
			.then(
				() => {
					this.eventSource.generateEvent(R.clone(process));
				},
				(err) => {
					let errs = `error: ${err}`;
					let _err = new Error(errs);
					logger.error(FUNC, errs, _err);
				}
			)
			.catch((err) => {
				logger.error(FUNC, `error ${err}`, err);
				return Promise.reject(err);
			});
	}

	startProcesses(count?, includeRunningProcesses = false): Promise<void> {
		const FUNC = 'startProcesses()';
		if (!count) {
			count = this.MAX_PROCESSES_COUNT;
		}
		if (settings.settings.isDebug && settings.settings.isDebugProcesses) {
			logger.debug(FUNC, `trying to start processes: max count ${count}`);
		}

		let getProcesses = (): Promise<Process[]> => {
			if (includeRunningProcesses) {
				return this.readProcesses('running').then((processesR: Process[]) => {
					if (processesR.length < count) {
						return this.readProcesses('queued').then((processesQ: Process[]) => {
							let processes = R.slice(0, count)(R.concat(processesR, processesQ));
							return processes;
						});
					} else {
						let processes = R.slice(0, count)(processesR);
						return processes;
					}
				});
			} else {
				return this.readProcesses('queued').then((processesQ: Process[]) => {
					let processes = R.slice(0, count)(processesQ);
					return processes;
				});
			}
		};

		return getProcesses()
			.then((processes: Process[]) => {
				if (settings.settings.isDebug && settings.settings.isDebugProcesses) {
					logger.debug(FUNC, `started processes: count ${processes.length}: ${JSON.stringify(processes)}`);
				}
				processes.forEach((process: Process) => {
					this.eventSource.generateEvent(R.clone(process));
				});
			})
			.catch((err) => {
				logger.error(FUNC, `error ${err}`, err);
				return Promise.reject(err);
			});
	}

	private customHandleProcess(process: Process): Promise<void> {
		const FUNC = 'customHandleProcess()';
		let customHandler: ProcessStatusChangeHanlerFn = getProcessStatusChangeHandler(process.process_status_handler.handler_function_name);
		if (settings.settings.isDebug && settings.settings.isDebugProcesses) {
			logger.debug(FUNC, `calling process status custom handler: ${JSON.stringify(process)}`);
		}

		try {
			return customHandler(process).catch((err) => {
				let errs = `error in custom handler: ${err}`;
				logger.error(FUNC, errs, err);
			});
		} catch (err) {
			let errs = `error: ${err}`;
			logger.error(FUNC, errs, err);
			return Promise.resolve();
		}
	}

	handleProcess() {
		const FUNC = 'handleProcess()';
		this.eventSource.source.subscribe((process: Process) => {
			if (settings.settings.isDebug && settings.settings.isDebugProcesses) {
				logger.debug(FUNC, `event: ${JSON.stringify(process)}: service running: ${this.running}, offline: ${this.offline}`);
			}
			if (!this.running || this.offline) {
				if (process.process_status === 'queued' || process.process_status === 'running') {
					if (settings.settings.isDebug && settings.settings.isDebugProcesses) {
						logger.debug(FUNC, `process paused: ${JSON.stringify(process)}: service running: ${this.running}, offline: ${this.offline}`);
					}
					return;
				}
				if (process.process_status === 'error') {
					if (process.error_count < this.MAX_PROCESSES_ERROR_COUNT) {
						if (settings.settings.isDebug && settings.settings.isDebugProcesses) {
							logger.debug(FUNC, `process error ignored: ${JSON.stringify(process)}: service running: ${this.running}, offline: ${this.offline}`);
						}
						process.error_count += 1;
						process.process_status = 'running'; // restart failing process due to killing async manager or device going offline
						delete process.err;
						delete process.msg;
						this.saveProcess(process);
						return;
					}
				}
			}
			this.customHandleProcess(R.clone(process))
				.then(() => {
					if (process.process_status === 'finished' || process.process_status === 'error') {
						if (settings.settings.isDebug && settings.settings.isDebugProcesses) {
							if (process.process_status === 'finished') {
								logger.debug(FUNC, `finished ok: ${JSON.stringify(process)}`);
							}
							if (process.process_status === 'error') {
								logger.debug(FUNC, `finished with error: ${process.err}: ${JSON.stringify(process)}`);
							}
						}
						--this.processesCount;
						let count = this.MAX_PROCESSES_COUNT - this.processesCount;
						if (count > 0) {
							this.startProcesses(count);
						}
					}
					if (process.process_type === 'idempiereJob') {
						this.handleProcessForIdempiereJob(process);
					} else {
						let errs = 'unknown process_type';
						logger.error(FUNC, errs);
						process.process_status = 'error';
						process.err = '' + new Error(errs);
						process.msg = errs;
						this.saveProcessAndGenerateEvent(process);
					}
				})
				.catch((err) => {
					logger.error(FUNC, `error ${err}`, err);
					return Promise.reject(err);
				});
		});
	}

	handleProcessForIdempiereJob(process: Process) {
		const FUNC = 'handleProcessForIdempiereJob()';
		if (settings.settings.isDebug && settings.settings.isDebugProcesses) {
			logger.debug(FUNC, `handling process: ${JSON.stringify(process)}`);
		}
		if (process.process_status === 'queued') {
			process.process_status = 'running';
			if (settings.settings.isDebug && settings.settings.isDebugProcesses) {
				logger.debug(FUNC, `process status changed to 'running': ${JSON.stringify(process)}`);
			}
			this.saveProcessAndGenerateEvent(process);
		} else if (process.process_status === 'running') {
			++this.processesCount;
			if (settings.settings.isDebug && settings.settings.isDebugProcesses) {
				logger.debug(FUNC, `executing: waitForIdempiereJob(${process.AD_PInstance_ID}): ${JSON.stringify(process)}`);
			}
			this.waitForIdempiereJob(process.AD_PInstance_ID)
				.then(
					(msg) => {
						if (settings.settings.isDebug && settings.settings.isDebugProcesses) {
							logger.debug(FUNC, `finished: waitForIdempiereJob(${process.AD_PInstance_ID}): ${JSON.stringify(process)}`);
						}
						process.process_status = 'finished';
						process.msg = msg;
						this.saveProcessAndGenerateEvent(process);
					},
					(err) => {
						if (settings.settings.isDebug && settings.settings.isDebugProcesses) {
							logger.debug(FUNC, `error: waitForIdempiereJob(${process.AD_PInstance_ID}): ${err}: ${JSON.stringify(process)}`);
						}
						process.process_status = 'error';
						process.err = err;
						process.msg = `${err}`;
						let errs = `error: ${err}`;
						logger.error(FUNC, errs, err);
						this.saveProcessAndGenerateEvent(process);
					}
				)
				.catch((err) => {
					logger.error(FUNC, `error ${err}`, err);
					return Promise.reject(err);
				});
		} else if (process.process_status === 'finished') {
			noop();
		} else if (process.process_status === 'error') {
			noop();
		}
	}

	waitForIdempiereJob(AD_PInstance_ID, timeout?): Promise<any> {
		const FUNC = 'waitForIdempiereJob()';
		const startD = Date.now();

		let timeWait = 30000;
		timeout = timeout || 3 * timeWait;

		function delay(time): Promise<any> {
			return new Promise((resolve) => {
				setTimeout(resolve, time);
			});
		}

		function getJobStatus(AD_PInstance_ID: number): Promise<JobStatusResult> {
			const FUNC = 'getJobStatus()';
			try {
				let request = newRequest(restapi_url() + `/processes/jobs/${AD_PInstance_ID}`, { method: 'GET' });

				return whttp
					.send(request)
					.then((response) => {
						return response.json().then((rep) => {
							let result: JobStatusResult = {
								//ad_pinstance_id: rep[0].ad_pinstance_id.id,
								isprocessing: rep.processing,
								iserror: false,
								errormsg: '',
							};
							return result;
						});
					})
					.catch((err) => {
						logger.error(FUNC, `error: ${err}`, err);
						return Promise.reject(new Error(`${FUNC} failed`));
					});
			} catch (err) {
				logger.error(FUNC, `error: ${err}`, err);
				return Promise.reject(new Error(`${FUNC} failed`));
			}
		}

		function waitFor(AD_PInstance_ID): Promise<any> {
			return getJobStatus(AD_PInstance_ID)
				.then(
					(pinstance: JobStatusResult) => {
						const endD = Date.now();
						if (!pinstance.isprocessing) {
							if (!pinstance.iserror) {
								logger.info(FUNC, `async process ${AD_PInstance_ID}, took ${endD - startD} ms`);
								logger.event({ profile: 'async process', cd_duration: endD - startD, ad_pinstance_id: AD_PInstance_ID, error_msg: null });
								return Promise.resolve(pinstance.errormsg);
							} else {
								logger.event({ profile: 'async process', cd_duration: endD - startD, AD_PInstance_ID: AD_PInstance_ID, error_msg: pinstance.errormsg });
								return Promise.reject(pinstance.errormsg);
							}
						} else {
							return delay(timeWait).then(() => {
								if (endD - startD > timeout) {
									let err = new Error(`async process timeout`);
									logger.error(FUNC, `${err}`, err);
									return Promise.reject(err);
								}
								return waitFor(AD_PInstance_ID);
							});
						}
					},
					(err) => {
						const endD = Date.now();
						logger.error(FUNC, `async process ${AD_PInstance_ID}: ${err}`, err);
						logger.event({ profile: 'async process', cd_duration: endD - startD, AD_PInstance_ID: AD_PInstance_ID, error_msg: err.toString() });
						return Promise.reject(err);
					}
				)
				.catch((err) => {
					const endD = Date.now();
					logger.error(FUNC, `async process ${AD_PInstance_ID}: ${err}`, err);
					logger.event({ profile: 'async process', cd_duration: endD - startD, AD_PInstance_ID: AD_PInstance_ID, error_msg: err.toString() });
					return Promise.reject(err);
				});
		}

		return waitFor(AD_PInstance_ID).catch((err) => {
			logger.error(FUNC, `error ${err}`, err);
			return Promise.reject(err);
		});
	}

	suchProcessAlreadyExist(couch_document_id: string): Promise<boolean> {
		const FUNC = 'suchProcessAlreadyExist()';
		return this.readProcessesByCouchDocId(couch_document_id)
			.then((processes: Process[]) => {
				if (settings.settings.isDebug && settings.settings.isDebugProcesses) {
					if (processes.length === 0) {
						logger.debug(FUNC, `no process found for couch_document_id: ${couch_document_id}`);
					} else {
						logger.debug(FUNC, `found existing process for couch_document_id ${couch_document_id}: ${JSON.stringify(processes)}`);
					}
				}
				return processes.length > 0;
			})
			.catch((err) => {
				logger.error(FUNC, `error ${err}`, err);
				return Promise.reject(err);
			});
	}

	queueProcess(process: Process): Promise<void> {
		const FUNC = 'queueProcess()';
		return new Promise((resolve, reject) => {
			this.eventSource.source
				.pipe(
					filter((p: Process) => {
						return p.process_id === process.process_id;
					})
				)
				.subscribe((process: Process) => {
					if (process.process_status === 'finished') {
						resolve(undefined);
					} else if (process.process_status === 'error') {
						reject(process.err);
					}
				});
			this.saveProcessAndGenerateEvent(process);
		}).catch((err) => {
			logger.error(FUNC, `error ${err}`, err);
			return Promise.reject(err);
		}) as Promise<void>;
	}

	// Adds new async job to manager. Returns event handle.

	queueProcessE(process: Process): ProcessEventHandle {
		let handle: ProcessEventHandle = {
			start: () => {
				this.saveProcessAndGenerateEvent(process);
			},
		};
		return handle;
	}

	/**
	Calls webservice triggering async job on backend. 
	Adds new async job to manager.	Return promise resolved when async job is finished.
	*/

	asyncWebservice(request, idempiereService: ProcessSubType): Promise<any> {
		const FUNC = `asyncWebservice()`;
		return whttp
			.send(request)
			.then((response) => {
				return response.json().then((rep) => {
					let responseMsg = rep.Data.Response;
					let str = responseMsg.split('AD_PInstance_ID = ')[1];
					let AD_PInstance_ID = parseInt(str, 10);

					let time = new Date().toISOString();
					let process: Process = {
						process_id: uuidV1(),
						AD_PInstance_ID: AD_PInstance_ID,
						process_status: 'queued',
						process_type: 'idempiereJob',
						process_sub_type: idempiereService,
						created_time: time,
						modified_time: time,
						finished_time: null,
						process_status_handler: {
							handler_function_name: 'noopHandler',
						},
						error_count: 0,
					};
					return this.queueProcess(process);
				});
			})
			.catch((err) => {
				logger.error(FUNC, `error ${err}`, err);
				return Promise.reject(err);
			});
	}

	/**
	Calls webservice triggering async job on backend. Use idempiere rest api process call for invoking webservice.
	Adds new async job to manager.	Return promise resolved when async job is finished.
	*/

	asyncWebserviceByIdempiereProcess(processName: string, processParameters: any, idempiereService: ProcessSubType): Promise<any> {
		const FUNC = `asyncWebserviceByIdempiereProcess()`;
		return callIdempiereProcess(processName, processParameters)
			.then((rep) => {
				//let AD_PInstance_ID = rep.AD_PInstance_ID;
				let AD_PInstance_ID = rep.id;

				let time = new Date().toISOString();
				let process: Process = {
					process_id: uuidV1(),
					AD_PInstance_ID: AD_PInstance_ID,
					process_status: 'queued',
					process_type: 'idempiereJob',
					process_sub_type: idempiereService,
					created_time: time,
					modified_time: time,
					finished_time: null,
					process_status_handler: {
						handler_function_name: 'noopHandler',
					},
					error_count: 0,
				};
				return this.queueProcess(process);
			})
			.catch((err) => {
				logger.error(FUNC, `error ${err}`, err);
				return Promise.reject(err);
			});
	}

	/**
	Call webservice triggering async job on backend. 
	Adds new async job to manager. Return promise resolved with event handle to be used to register process event handlers and to start the process.
	*/

	asyncWebserviceE(request, processStatusHandler: ProcessStatusHandler, doc_id: string, idempiereService: ProcessSubType): Promise<ProcessEventHandle> {
		const FUNC = 'asyncWebserviceE()';
		return this.suchProcessAlreadyExist(doc_id)
			.then((processAlreadyExist) => {
				if (processAlreadyExist) {
					if (settings.settings.isDebug && settings.settings.isDebugProcesses) {
						logger.debug(FUNC, `process already exists, do not create same process again`);
					}
					return noopProcessEventHandle();
				} else {
					const TEST = false;
					if (TEST) {
						return new Promise((resolve) => {
							let AD_PInstance_ID = 111111;
							let time = new Date().toISOString();
							let process: Process = {
								process_id: uuidV1(),
								process_status: 'queued',
								process_type: 'idempiereJob',
								process_sub_type: idempiereService,
								created_time: time,
								modified_time: time,
								finished_time: null,
								process_status_handler: processStatusHandler,
								error_count: 0,
								couch_document_id: doc_id,
								AD_PInstance_ID: AD_PInstance_ID,
							};
							let handle: ProcessEventHandle = this.queueProcessE(process);
							resolve(handle);
						});
					} else {
						return whttp.send(request).then((response) => {
							return response.json().then((rep) => {
								//get Instance ID Back
								let responseMsg = rep.Data.Response;
								let str = responseMsg.split('AD_PInstance_ID = ')[1];
								let AD_PInstance_ID = parseInt(str, 10);
								let time = new Date().toISOString();
								let process: Process = {
									process_id: uuidV1(),
									process_status: 'queued',
									process_type: 'idempiereJob',
									process_sub_type: idempiereService,
									created_time: time,
									modified_time: time,
									finished_time: null,
									process_status_handler: processStatusHandler,
									error_count: 0,
									couch_document_id: doc_id,
									AD_PInstance_ID: AD_PInstance_ID,
								};
								let handle: ProcessEventHandle = this.queueProcessE(process);
								return handle;
							});
						});
					}
				}
			})
			.catch((err) => {
				logger.error(FUNC, `error ${err}`, err);
				return Promise.reject(err);
			});
	}

	/**
	Call webservice triggering async job on backend. Use idempiere rest api process call for invoking webservice.
	Adds new async job to manager. Return promise resolved with event handle to be used to register process event handlers and to start the process.
	*/

	asyncWebserviceByIdempiereProcessE(processName: string, processParameters: any, processStatusHandler: ProcessStatusHandler, doc_id: string, idempiereService: ProcessSubType): Promise<ProcessEventHandle> {
		const FUNC = 'asyncWebserviceE()';
		return this.suchProcessAlreadyExist(doc_id)
			.then((processAlreadyExist) => {
				if (processAlreadyExist) {
					if (settings.settings.isDebug && settings.settings.isDebugProcesses) {
						logger.debug(FUNC, `process already exists, do not create same process again`);
					}
					return noopProcessEventHandle();
				} else {
					const TEST = false;
					if (TEST) {
						return new Promise((resolve) => {
							let AD_PInstance_ID = 111111;
							let time = new Date().toISOString();
							let process: Process = {
								process_id: uuidV1(),
								process_status: 'queued',
								process_type: 'idempiereJob',
								process_sub_type: idempiereService,
								created_time: time,
								modified_time: time,
								finished_time: null,
								process_status_handler: processStatusHandler,
								error_count: 0,
								couch_document_id: doc_id,
								AD_PInstance_ID: AD_PInstance_ID,
							};
							let handle: ProcessEventHandle = this.queueProcessE(process);
							resolve(handle);
						});
					} else {
						return callIdempiereProcess(processName, processParameters).then((rep) => {
							//get Instance ID Back
							//let AD_PInstance_ID = rep.AD_PInstance_ID;
							let AD_PInstance_ID = rep.id;
							let time = new Date().toISOString();
							let process: Process = {
								process_id: uuidV1(),
								process_status: 'queued',
								process_type: 'idempiereJob',
								process_sub_type: idempiereService,
								created_time: time,
								modified_time: time,
								finished_time: null,
								process_status_handler: processStatusHandler,
								error_count: 0,
								couch_document_id: doc_id,
								AD_PInstance_ID: AD_PInstance_ID,
							};
							let handle: ProcessEventHandle = this.queueProcessE(process);
							return handle;
						});
					}
				}
			})
			.catch((err) => {
				logger.error(FUNC, `error ${err}`, err);
				return Promise.reject(err);
			}) as Promise<ProcessEventHandle>;
	}

	initDevice(queueId, v_AD_ReplicationStrategy_ID_INIT): Promise<any> {
		const FUNC = 'initDevice()';
		let processParameters = {
			AD_ReplicationStrategy_ID: v_AD_ReplicationStrategy_ID_INIT,
			AD_Queue_ID: queueId,
			MaxQueryRecords: 0,
			IsIncludeEventReplications: 'Y',
			DisplayReplMsg: 'N',
			ReplicationStrategyType: 'T',
			EXP_Processor_ID: 1000027,
			ReplicationPurpose: 'Init',
		};
		return this.asyncWebserviceByIdempiereProcess('jobs/exportreplicationdata', processParameters, 'initDevice').catch((err) => {
			logger.error(FUNC, `error ${err}`, err);
			return Promise.reject(err);
		});
	}

	createShipmentFromHU(org_id, loc_id, docType_id, huitems): Promise<any> {
		const FUNC = 'createShipmentFromHU';
		let handlingUnits = [];
		for (let _hui in huitems) {
			handlingUnits.push({ HuSearchKey: huitems[_hui] });
		}

		let options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				C_DocType_ID: docType_id,
				AD_Org_ID: org_id,
				M_Locator_ID: loc_id,
				HandlingUnits: handlingUnits,
				isRunAsJob: 'Y', // Async Call
			}),
		};

		let request = newRequest(webservice_url() + '/shipment/createfromhu', options);
		return this.asyncWebservice(request, 'createShipmentFromHU').catch((err) => {
			logger.error(FUNC, `error ${err}`, err);
			return Promise.reject(err);
		});
	}

	postInvMoves(p_PhysCount: MovementsPOSTRequest, doc_id: string): Promise<ProcessEventHandle> {
		const FUNC = 'postInvMoves()';
		let options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(p_PhysCount),
		};
		let request = newRequest(webservice_url() + '/movements', options);
		let processStatusHandler: ProcessStatusHandler = {
			handler_function_name: 'documentProcessingStatusHandler',
		};
		return this.asyncWebserviceE(request, processStatusHandler, doc_id, 'postInvMoves').catch((err) => {
			logger.error(FUNC, `error ${err}`, err);
			return Promise.reject(err);
		});
	}

	postPhysInvMoves(p_PhysCount: PhysCountsPOSTRequest, doc_id: string): Promise<ProcessEventHandle> {
		const FUNC = 'postPhysInvMoves()';
		let options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(p_PhysCount),
		};
		let request = newRequest(webservice_url() + '/physcounts', options);
		let processStatusHandler: ProcessStatusHandler = {
			handler_function_name: 'documentProcessingStatusHandler',
		};
		return this.asyncWebserviceE(request, processStatusHandler, doc_id, 'postPhysInvMoves').catch((err) => {
			logger.error(FUNC, `error ${err}`, err);
			return Promise.reject(err);
		});
	}

	putOrder(p_order: Order, doc_id: string): Promise<any> {
		const FUNC = 'putOrder()';
		let options = {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(p_order),
		};
		let request = newRequest(webservice_url() + '/order', options);
		let processStatusHandler: ProcessStatusHandler = {
			handler_function_name: 'documentProcessingStatusHandler',
		};
		return this.asyncWebserviceE(request, processStatusHandler, doc_id, 'putOrder').catch((err) => {
			logger.error(FUNC, `error ${err}`, err);
			return Promise.reject(err);
		});
	}
}

export let asyncProcessManager1: AsyncProcessManager1 = new AsyncProcessManager1();
