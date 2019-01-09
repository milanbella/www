import { Injectable } from '@angular/core';

import { promiseReject, promiseAll } from '../app/common/utils';
import { sqs } from '../app/services/sqs1';
import { Auth } from '../app/services/auth';

import  { _ }  from 'underscore';

import {
	defineTest,
	runTests
} from './utils';

@Injectable()
export class SqsTest {
 	private tests = [];
	constructor (private auth: Auth) {
		var test;

		test = defineTest('logs in', () => {
			return this.logIn();
		});
		this.tests.push(test);

		test = defineTest('parse SQL message', () => {
			return this.logIn().then(() => {
				var msgJson: any = 
				{
				"DataType": "list",
				   "AD_Note":{
					  "TextMsg":"Task: IM/RP/1018536/02/2017",
					  "ReplicationType":"R",
					  "WebContext":"/albatros-cargo",
					  "Record_ID":1236708,
					  "AD_User_ID":1009857,
					  "IsActive":true,
					  "AD_Note_ID":1806843,
					  "AD_Column_ID":"AD_Note_ID",
					  "Created":{
						 "DateFormat":"yyyy-MM-dd'T'HH:mm:ssZ",
						 "DataType":"DATE",
						 "content":"2017-02-16T15:24:26+0100"
					  },
					  "UpdatedBy":1010032,
					  "Version":"Mobile0.1",
					  "AD_Note_UU":"30c65723-e011-45e6-b7ce-13721a76446a",
					  "DataType":"Record",
					  "AD_Table_ID":323,
					  "AD_Client_ID":1000015,
					  "Processed":false,
					  "CreatedBy":1001019,
					  "AD_Broadcastmessage_ID":1039589,
					  "Updated":{
						 "DateFormat":"yyyy-MM-dd'T'HH:mm:ssZ",
						 "DataType":"DATE",
						 "content":"2017-03-21T04:56:54+0100"
					  },
					  "AD_Client_Value":"ALB",
					  "ReplicationEvent":0,
					  "Expired":true,
					  "ReplicationMode":0,
					  "AD_Table":"AD_Note",
					  "AD_Org_ID":0
				   }
				};
				return sqs.processSQSmessage(msgJson);
			});
		});
		this.tests.push(test);
	}

	private logIn (): Promise<any>  {

		return this.auth._login('m5@alb-st.com', 'm5ur3c5O', false).then((data) => {
			if (data.err) {
				console.error('Auth.login(): error:');
				console.dir(data.err);
				throw new Error('Auth.login(): error');
			} else {
				console.log('logged in:');
				console.dir(data);
			}
		});
	}

	public run (): any {
		runTests('sqs', this.tests);
	}
}







