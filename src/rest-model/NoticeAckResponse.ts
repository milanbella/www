'use strict';

export interface NoticeAckResponse {
	processed?: string;

	expired?: string;

	ad_notice_id?: number;

	ad_broadcastmessage_id?: number;

	ad_user_id?: number;
}
