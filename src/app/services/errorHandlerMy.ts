import { Injectable } from '@angular/core';
import { ErrorHandler} from '@angular/core';
import { AlertError } from './alerterror';

import { logger } from './logger';

import { _ } from "underscore";


@Injectable()
export class ErrorHandlerMy implements ErrorHandler {

	constructor (private alertError: AlertError) {
	}

	handleError(err): void {

		logger.error('error: ', err.originalError || err); 
		console.error('error:');
		console.dir(err);
	}	
}


