import { getExecutionContext } from './executionContext';
import fetchNode, { Request as RequestNode, Headers as HeadersNode } from 'node-fetch';

export function newHeaders(headers: any): any {
	if (!getExecutionContext().isServerSide) {
		return new Headers(headers);
	} else {
		return new HeadersNode(headers);
	}
}

export function newRequest(url: string, options: any): any {
	if (!getExecutionContext().isServerSide) {
		return new Request(url, options);
	} else {
		return new RequestNode(url, options);
	}
}

export function fetch(request: any) {
	if (!getExecutionContext().isServerSide) {
		return self.fetch(request);
	} else {
		return fetchNode(request);
	}
}
