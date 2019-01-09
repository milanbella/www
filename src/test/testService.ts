import { Injectable } from '@angular/core';

import { AuthPrincipalTest  } from './authPrincipalTest';
import { SqsTest } from './sqsTest';
import { LoggingTest } from './loggingTest';

import { Auth } from '../app/services/auth';

@Injectable()
export class TestService {

	constructor (
		private authPrincipalTest: AuthPrincipalTest, 
		private sqsTest: SqsTest,
		private loggingTest: LoggingTest
	) {
	}

	public runTests () {
		//runTests('device transaction tests', deviceTransactionsTest);
		//runTests('sqs tests', sqsTest);
		//this.authPrincipalTest.run();
		this.loggingTest.run();
	}
}
