import { Injectable } from '@angular/core';

import { promiseResolve, promiseReject, promiseAll } from '../app/common/utils';
import { Auth } from '../app/services/auth';
import { Logger, getLogger } from '../app/services/logger';

import  { _ }  from 'underscore';

import {
	defineTest,
	runTests
} from './utils';

var logger: Logger = getLogger('LoggingTest'); 


@Injectable()
export class LoggingTest {

	private tests = [];

	constructor (private auth: Auth) {
		var test;

		test = defineTest('logs in', () => {
			return this.logIn();
		});
		this.tests.push(test);


		test = defineTest('logs in error message', () => {
			var err;
			err = new Error('1 foo error');
			logger.error('test error message', err, {attr1: 'val1', attr2: 'val2'}); 
			err = new Error('2 foo error');
			logger.error('test error message', err, {attr1: 'val1', attr2: 'val2'}); 
			err = new Error('3 foo error');
			logger.error('test error message', err, {attr1: 'val1', attr2: 'val2'}); 
			err = new Error('4 foo error');
			logger.error('test error message', err, {attr1: 'val1', attr2: 'val2'}); 
			err = new Error('5 foo error');
			logger.error('test error message', err, {attr1: 'val1', attr2: 'val2'}); 
			err = new Error('6 foo error');
			logger.error('test error message', err, {attr1: 'val1', attr2: 'val2'}); 
			err = new Error('7 foo error');
			logger.error('test error message', err, {attr1: 'val1', attr2: 'val2'}); 
			err = new Error('8 foo error');
			logger.error('test error message', err, {attr1: 'val1', attr2: 'val2'}); 
			err = new Error('9 foo error');
			logger.error('test error message', err, {attr1: 'val1', attr2: 'val2'}); 
			return promiseResolve();
		});
		this.tests.push(test);

	}

	private logIn () : Promise<any>  {

		return this.auth._login('d3@pemax.sk', 'Pem23ax23', false).then((data) => {
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
		runTests('logging tests', this.tests);
	}
}
