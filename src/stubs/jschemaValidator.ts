import { ISchemaValidationResult, ISchemaValidator } from '@cloudempiere/clde-types/dist/stubs';

import * as Ajv from 'ajv';

function validate(schema: any, data: any): ISchemaValidationResult {
	const ajv = new Ajv();
	const validateFn = ajv.compile(schema);
	const valid = validateFn(data);
	if (valid) {
		return {
			valid: true,
			errors: null,
		};
	} else {
		return {
			valid: false,
			errors: validateFn.errors,
		};
	}
}

export let schemaValidator: ISchemaValidator = {
	validate: validate,
};
