export class UserSession {
	static session: UserSession;

	attrs: {
		[key: string]: any;
	};

	constructor() {
		this.attrs = {};
	}
}
