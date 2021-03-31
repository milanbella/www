export interface Principal {
	userUuid: string;
	userName?: string;
	userEmail?: string;
	adUserId?: number;
	adClientId?: number;
	accessToken?: string;
	rtk?: string; // refresh token
	pin?: string; // user pin
	lin?: string; // login
	x_auth_username?: string;
	x_auth_roles?: string;
	cubejsToken?: string;
	deviceStopmQueue: string;
	apps?: [any];
}

export interface CurrentUser {
	id: number;
	userUuid: string;
}

export interface DeviceClientRecord {
	id: number; // db key, always 1
	ad_client_id: number;
	deviceInitialization: DeviceInitializationRecord;
}

export interface DeviceInitializationRecord {
	initializedAt: Date;
	initializedBy: string; // user uuid
	initWizardState: number;
	replicationWasTriggered: boolean;
}

export interface IWorkerMessage {
	workerId: any;
	workerName: string;
	dstWorkerId?: any;
	dstWorkerName?: any;
	messageName: string;
	messageData: any;
}

export interface WorkerCtx {
	workerId: any;
	workerName: string;
	offline: boolean;
	device: any;
	settings: any;
	appVersion: string;
	principal: Principal;
}

export interface DialogParameters {
	isModal: boolean;
	dismissFn: (data: any) => void;
}

//TODO: better names for items
export interface LookupDialogParameters extends DialogParameters {
	isIdLookup: boolean;
	searchValue: string | number;
	resolvedValueCallbackFn: (resolvedValue: any) => void;
}

export interface CouchDbVersion {
	version: string;
	created: string;
}

export interface CouchDbAdminDoc {
	_id?: string;
	_rev?: string;
	versions: CouchDbVersion[];
}

/*

Document processing status with respect to device user point of view.

new - document is new, user is working on new document
processed - user already proceseed
posted - document was  posted to idempiere
error - error while processing document

*/
export type DocumentProcessingStatus = 'new' | 'processed' | 'posted' | 'error';

export type Ownership = 'Mine' | 'Others' | 'Unassigned';

export interface cdDbObject {
	_id?: string;
	_rev?: string;
	_lock?: any;
	_hash?: any;
	_hashAll?: any;
	_meta?: any;
	DB_TableName?: string;
	modifiedDate?: string;
}

export interface cdDocument extends cdDbObject {
	AD_PInstance_ID: any;
	AD_Org_ID: number;
	C_DocType_ID: number;
	SalesRep_ID: number;
	documentProcessingStatus: DocumentProcessingStatus;
	errorMsg?: string;
}

/*
export interface cdDbObject {
	_id?: string;
	_rev?: string;
	DB_TableName: string;
	modifiedDate?: string;
}
*/

export const DEFAUL_DOCUMENT_FILTER_MODIFIED_DATE_DAYS_BACK = 10;
export const DEFAUL_DOCUMENT_FILTER_DOCUMENTS_COUNT = 2000;

export interface DocumentFilter {
	modifiedDate: Date;
	isModifiedDate: boolean;

	documentsCountLimit: number;
	isDocumentsCountLimit: boolean;

	AD_Org_ID: number;
	isAD_Org_ID: boolean;

	C_DocType_ID: number;
	isC_DocType_ID: boolean;

	ownerships: string[];
	isOwnership: boolean;

	documentProcessingStatuses: DocumentProcessingStatus[];
	isDocumentProcessingStatus: boolean;
}

export type ProcessSatus = 'none' | 'queued' | 'running' | 'finished' | 'error';
export type ProcessType = 'idempiereJob';
export type ProcessSubType = 'initDevice' | 'createShipmentFromHU' | 'postInvMoves' | 'postPhysInvMoves' | 'putOrder';

export type ProcessStatusChangeHanlerFnName = 'noopHandler' | 'documentProcessingStatusHandler';
export type ProcessStatusChangeHanlerFn = (process: Process) => Promise<void>;

export interface Process {
	process_id: string;
	process_type: ProcessType;
	process_sub_type: ProcessSubType;
	process_status: ProcessStatus;
	created_time: string;
	modified_time: string;
	finished_time: string;
	process_status_handler: {
		handler_function_name: ProcessStatusChangeHanlerFnName;
	};
	error_count: number;
	couch_document_id?: string;
	AD_PInstance_ID?: number;
	msg?: string;
	err?: string;
}

export const LOGGING_WORKER = 'loggingWorker';
export const NET_WORKER = 'netWorker';
export const SQS_WORKER = 'sqsWorker';
export const STOMP_WORKER = 'stompWorker';
export const POUCH_WORKER = 'pouchWorker';
export const COMMON_WORKER = 'commonWorker';

export const WORKERS_BROADCAST_CHANNEL_NAME = 'workers_broadcast';

export type ProcessStatus = 'queued' | 'running' | 'finished' | 'error';

export interface DeviceInfo {
	manufacturer: string;
	model: string;
	operatingSystem: string;
	osVersion: string;
	platform: string;
	uuid: string;
}

export interface OnlineLoginSuccess {
	kind: 'OnlineLoginSuccess';
	pin: string;
	isDeviceInitWizardPageStarted: boolean;
}

export interface OnlineLoginError {
	kind: 'OnlineLoginError';
	error: 'wrongCredentials' | 'wrongClient' | 'offline' | 'unknownError';
	err: any;
}

export type OnlineLoginResult = OnlineLoginSuccess | OnlineLoginError;

export interface OfflineLoginSuccess {
	kind: 'OfflineLoginSuccess';
}

export interface OfflineLoginError {
	kind: 'OfflineLoginError';
	error: 'wrongCredentials' | 'unknownError';
	err: any;
}

export type OfflineLoginResult = OfflineLoginSuccess | OfflineLoginError;

export interface OnlinePinLoginResult {
	kind: 'OnlinePinLoginResult';
	result: OnlineLoginResult;
}

export interface OfflinePinLoginResult {
	kind: 'OfflinePinLoginResult';
	result: OfflineLoginResult;
}

export type PinLoginResult = OnlinePinLoginResult | OfflinePinLoginResult;

export function assertNever(x: never): never {
	throw new Error('Unexpected object: ' + x);
}

export type LogFn = (message: string, err?: any, attrs?: any) => any;

export interface Logger {
	log: LogFn;
	info: LogFn;
	fatal: LogFn;
	error: LogFn;
	debug: LogFn;
	warn: LogFn;
	trace: LogFn;
	doLog: any;
	event: (attrs: any) => any;
}

export interface EnvironmentBase<T = unknown> {
	name: 'prod' | 'dev' | 'test' | 'staging';
	production: boolean;
	versionCode: number;

	applicationName: string;
	applicationVersion: string;
	applicationPlatform: 'mobile' | 'web' | 'node';

	customerName: string;

	cubejsApiUrl: string;

	couchDbIsTest: boolean;
	couchDbNameTestSuffix: string;
	couchDbAdminDocName: string;

	apiHost: string;
	apiPathRest: string;
	apiPathAuth: string;
	apiPathStatus: string;

	/* Endpoint URL for REST API backend calls */
	backendRestApiUrl: string;

	backendModelRestApiUrl: string;

	/* Endpoint URL for CouchDB Mobile */
	backendCouchDbApiUrl: string;

	/* Endpoint URL for Logging */
	backendLoggingApiUrl: string;

	/* Endpoint URL for Stompf Broker */
	backendStompfBrokerUrl: string;

	/* IndexedDB main DB Name */
	indexedDbMainDbName: string;

	/* IndexedDB logs DB Name */
	indexedDbLogsDbName: string;

	/* Oauth Settings */
	oauthServerUrl: string;
	oauthClientId: string;
	oauthTokenStorage: 'indexdb' | 'webworker';

	backendMockEndpointURL: string;

	deactivateMobileDeviceInitWizard: boolean;

	application?: T;
}

export interface ExecutionContext {
	isServerSide: boolean;
}
