'use strict';

export interface MovementsPOSTRequestMMovementLine {
	Line?: number;

	M_Product_ID?: number;

	MovementQty?: number;

	M_AttributeSetInstance_ID?: number;

	M_AttributeSetInstanceTo_ID?: number;

	M_Locator_ID?: number;

	M_LocatorTo_ID?: number;

	Description?: string;

	M_MovementLine_UU?: string;
}
