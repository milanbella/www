import { promiseReject } from '../app/common/utils';
import { IWorkerMessage, WorkerCtx }  from '../app/services/types';
import { NET_WORKER }  from '../app/services/types';
import { pingHttp as basePingHttp } from './../app/services/pinghttp';
import { Principal } from '../app/services/types';

var _self: any = self;

export var workerCtx: WorkerCtx  = {
	workerId: null,
	workerName: 'unknown',
	offline: true,
	device: {},
	settings: {},
	appVersion: null,
	environment: null,
	principal: null, 
}

export var settings: any = {
	settings: {}
};

export function setSettings (_settings) {
	workerCtx.settings = _settings;
	settings.settings = _settings;
}
