'use strict';

export interface RMAsPOSTRequestMRMALine {
	Line?: number;

	M_RMALine_UU?: string;

	M_Product_ID?: number;

	C_Charge_ID?: number;

	Qty?: number;

	M_AttributeSetInstance_ID?: number;

	Returned_C_OrderLine_ID?: string;

	C_Tax_ID?: number;

	Description?: string;
}
