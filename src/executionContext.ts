import { ExecutionContext } from './types';
import * as R from 'ramda';

let executionContext: ExecutionContext = {
	isServerSide: false,
};

export function setExecutionContext(_executionContext: ExecutionContext) {
	executionContext = _executionContext;
}

export function getExecutionContext(): ExecutionContext {
	return R.clone(executionContext);
}
