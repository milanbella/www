export interface Principal {
	userUuid: string,
	userName?: string,
	userEmail?: string,
	adUserId?: string,
	adClientId?: string,
	cognitoIdentityId?: string,
	cognitoIdentityPoolId?: string,
	accessToken?: string,
	rtk?: string, // refresh token
	pin?: string, // user pin
	lin?: string, // login
	x_auth_username?: string,
	x_auth_roles?: string,
	userSQSurl?: string 
}

export interface CurrentUser {
	id: number,
	userUuid: string
}

export interface IWorkerMessage {
	workerId: any;
	workerName: string;
	dstWorkerId?: any;
	dstWorkerName?: any;
	messageName: string,
	messageData: any
};

export interface WorkerCtx {
	workerId: any,
	workerName: string,
	offline: boolean,
	device: any,
	settings: any,
	appVersion: string,
	environment: string,
	principal: Principal, 
}

export const LOGGING_WORKER = 'loggingWorker';
export const NET_WORKER = 'netWorker';
export const SQS_WORKER = 'sqsWorker';
