'use strict';

export interface ConfirmDDORequestDDOrderlines {
	DD_OrderLine_ID?: number;

	Lot?: string;

	PickedQty?: number;

	ScrappedQty?: number;

	WmsNote?: string;
}
