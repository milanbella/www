'use strict';

export interface MatReceiptPOSTRequestMInoutLine {
	Line?: number;

	M_Product_ID?: number;

	M_Locator_ID?: number;

	QtyEntered?: number;

	M_AttributeSetInstance_ID?: number;

	C_Uom_ID?: number;

	Description?: string;
}
