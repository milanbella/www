export interface InvoicePrint {
	DocumentNo: string;
	VarNo: string;
	DateCreated: string;
	DateDue: string;
	DatePrinted: string;
	TotalPrice: string;
	GrandTotal: string;
	BPartner?: BPartner;
	BillAddress?: Address;
	BPAddress?: Address;
	SalesRep?: string;
	Items: InvoiceItemPrint[];
	TaxRates: InvoiceTax[];
	//TODO Additional Data
}

export interface InvoiceItemPrint {
	Line: string;
	Name: string;
	Value: string;
	UPC: string;
	SKU: string;
	Discount: string;
	Qty: string;
	Price: string;
	LineNetAmt: string;
	WasteFee?: string;
	WasteFeeSum?: string;
	UOM: string;
	TaxRate: string;
	//TODO Additional Data
}

export interface InvoiceTax {
	TaxRate: string;
	TaxAmt: string;
	TaxBase: string;
	TotalLine: string;

	//TODO Additional Data
}

export interface Address {
	Address: string;
	City: string;
	ZIP: string;
	//TODO Additional Data
}

export interface BPartner {
	Name: string;
	Value: string;
	TaxID?: string;
	TaxID_Alternative?: string;
	CompRegNo?: string;
	BPAddress?: Address;
}
