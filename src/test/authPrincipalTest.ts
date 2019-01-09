import { Injectable } from '@angular/core';

import { promiseReject, promiseAll } from '../app/common/utils';
import { Auth } from '../app/services/auth';
import { webService } from '../app/services/webservice';
import { whttp } from '../app/services/whttp';

import  { _ }  from 'underscore';

import {
	defineTest,
	runTests
} from './utils';


@Injectable()
export class AuthPrincipalTest {

	private tests = [];

	constructor (private auth: Auth) {
		var test;

		test = defineTest('logs in', () => {
			return this.logIn();
		});
		this.tests.push(test);


		test = defineTest('calls device settings service', () => {
			return this.logIn().then(() => {
				return webService.getDeviceSettings('Browser1').then((response) => {
					console.log('device settings service response:');
					console.dir(response);
				});
			});
		});
		this.tests.push(test);

		test = defineTest('calls device settings service with invalid access token', () => {
			return this.logIn().then(() => {
				whttp.useInvalidAccessToken = true; // force invalid access token
				return webService.getDeviceSettings('Browser1').then((response) => {
					console.log('device settings service response:');
					console.dir(response);
				});
			});
		});
		this.tests.push(test);
	}

	private logIn () : Promise<any>  {

		return this.auth._login('d3@pemax.sk', '', false).then((data) => {
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
		runTests('auth pprincipal tests', this.tests);
	}
}
