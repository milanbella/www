let navigationParametersMap: any = {};

export function setNavigationParameter(name: string, value: any) {
	navigationParametersMap[name] = value;
}

export function getNavigationParameter(name: string): any {
	let value = navigationParametersMap[name];
	delete navigationParametersMap[name];
	return value;
}

export interface CallPageParameter {
	name: string;
	value: any;
}

interface CallPageCall {
	caller: string;
	parameters: Array<CallPageParameter>;
	returnValue: any;
}

class CallPage {
	private callPageStack: Array<CallPageCall>;

	call(caller: string, parameters: Array<CallPageParameter>) {
		this.callPageStack.push({
			caller: caller,
			parameters: parameters,
			returnValue: undefined,
		});
	}

	callBack(returnValue?: any): string {
		let entry = this.callPageStack[this.callPageStack.length - 1];
		entry.returnValue = returnValue;
		return entry.caller;
	}

	getReturnValue(): any {
		let entry = this.callPageStack.pop();
		return entry.returnValue;
	}
}

export let callPage: CallPage = new CallPage();
