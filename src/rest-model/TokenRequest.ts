'use strict';

export interface TokenRequest {
	password?: string;

	AuthTokenType?: string;

	AuthTokenProvider?: string;

	model?: string;

	uuid?: string;

	platform?: string;

	username?: string;
}
