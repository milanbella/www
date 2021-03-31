import { M_Worksheet } from './m-worksheet';
import { M_WorksheetLine } from './m-worksheet-line';

import { v1 as uuidV1 } from 'uuid';

export function newWorksheet(): M_Worksheet {
	return {
		modifiedDate: new Date().toISOString(),
		M_Worksheet_UU: uuidV1(),
		DB_TableName: 'M_Worksheet',
		C_BPartner_ID: 0,
		DocStatus: 'DR',
		DocAction: 'PR',
		Created: new Date(),
		DocumentNo: '',
		IsApproved: false,
		IsCancelled: false,
		IsInDispute: false,
		M_InOutConfirm_ID: 0,
		AD_Org_ID: 0,
		SalesRep_ID: 0,
		C_DocType_ID: 0,
		Description: null,
		M_WorksheetLine: [],
		AD_PInstance_ID: 0,
		documentProcessingStatus: 'new',
	};
}

export function newWorksheetLine(doc?: M_Worksheet): M_WorksheetLine {
	const newWorksheetLine: M_WorksheetLine = {
		M_WorksheetLine_UU: uuidV1(),
		M_Product_ID: 0,
		M_Locator_ID: 0,
		Line: 10,
		Description: null,
		ConfirmedQty: 0,
		DifferenceQty: 0,
		ScrappedQty: 0,
		TargetQty: 0,
	};
	if (doc) {
		// Load Line
		if (doc.M_WorksheetLine.slice(-1)[0]) {
			newWorksheetLine.Line = doc.M_WorksheetLine.slice(-1)[0].Line + 10;
		}
	}
	return newWorksheetLine;
}
