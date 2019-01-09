import { _ } from 'underscore';

export class ValidationService {
		static getValidatorErrorMessage(validatorName: string, validatorValue?: any) {

				if (validatorName === 'validate-model-fn') {
					if (validatorValue) {
						if (_.isString(validatorValue)) {
							return validatorValue;
						} else if (_.isObject(validatorValue)) {
							var msg = _.reduce(validatorValue, function (acc, msg) {
								return acc += msg + '; ';
							}, "");
							return msg;
						} else {
							return 'validator "model-validate" reported error';
						}
					} else {
						return 'validator "model-validate" reported error';
					}
				} else {
					let config = {
							'required': 'Required',
							'minlength': `Minimum length ${validatorValue.requiredLength}`,
							'maxlength': `Maximum length ${validatorValue.requiredLength}`
					};

					return config[validatorName];
				}
		}
}
