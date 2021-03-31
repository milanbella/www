'use strict';

export interface TransactionPOSTRequestBody {
	EX_System_Trx_ID?: number;

	Command?: string;
	Device_UUID?: string;

	User_UUID?: string;

	AD_User_ID?: number;

	EX_System_App_ID?: number;

	Key?: string;

	Value?: string;

	EX_Trx_Ver?: number;
}
