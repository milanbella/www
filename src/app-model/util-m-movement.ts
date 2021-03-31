import { M_Movement } from './m-movement';
import { M_MovementLine } from './m-movement-line';

import { v1 as uuidV1 } from 'uuid';

export function newMovement(): M_Movement {
	return {
		modifiedDate: new Date().toISOString(),
		M_Movement_UU: uuidV1(),
		DB_TableName: 'M_Movement',
		DB_Processed: false,
		M_Movement_ID: 0,
		DocStatus: 'DR',
		Created: new Date(),
		MovementDate: new Date(),
		AD_Org_ID: 0,
		SalesRep_ID: 0,
		C_DocType_ID: 0,
		Description: null,
		M_MovementLine: [],
		M_Locator_ID: 0,
		M_LocatorTo_ID: 0,
		DocAction: 'PR',
		IsConfirmationReq: false,
		AD_PInstance_ID: null,
		documentProcessingStatus: 'new',
	};
}

export function newMovementLine(movement?: M_Movement): M_MovementLine {
	const newMovementLine: M_MovementLine = {
		M_MovementLine_UU: uuidV1(),
		M_Product_ID: 0,
		M_Locator_ID: 0,
		M_LocatorTo_ID: 0,
		C_UOM_ID: 0,
		Line: 10,
		MovementQty: 1,
		M_AttributeSetInstance_ID: 0,
		Description: null,
		ConfirmedNo: 0,
	};
	if (movement) {
		// Set Locator
		if (movement.M_Locator_ID) {
			newMovementLine.M_Locator_ID = movement.M_Locator_ID;
		}

		// Set LocatorTo
		if (movement.M_LocatorTo_ID) {
			newMovementLine.M_LocatorTo_ID = movement.M_LocatorTo_ID;
		}

		// Load Line
		if (movement.M_MovementLine.slice(-1)[0]) {
			newMovementLine.Line = movement.M_MovementLine.slice(-1)[0].Line + 10;
		}
	}
	return newMovementLine;
}
