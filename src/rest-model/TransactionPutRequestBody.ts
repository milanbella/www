'use strict';

export interface TransactionPutRequestBody {
	Command?: string;

	AD_User_ID?: number;

	User_UUID?: number;

	Device_UUID?: string;

	EX_System_App_ID?: number;

	Key?: string;

	Value?: string;
}
