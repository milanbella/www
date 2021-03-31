const FILE = 'pouchDbIndexes.ts';

export async function createIndexes(db, logger): Promise<void> {
	const FUNC = 'createIndexes()';
	function createIndex(fields: string[]) {
		let startTime = Date.now();
		console.log(`${FILE}:${FUNC}: creating index ${fields} ...`);
		logger.info(`${FILE}:${FUNC}: creating index ${fields} ...`);
		return db
			.createIndex({
				index: { fields: fields },
			})
			.then(
				() => {
					let endTime = Date.now();
					let duration = endTime - startTime;
					console.log(`${FILE}:${FUNC}: created index ${fields}, in ${duration} ms`);
					logger.info(`${FILE}:${FUNC}: created index ${fields}, in ${duration} ms`);
				},
				(err) => {
					console.error(`${FILE}:${FUNC}: creating index ${fields}: ${err}`, err);
					logger.error(`${FILE}:${FUNC}: creating index ${fields}: ${err}`, err);
				}
			);
	}

	let promises = [];
	let promise;

	promise = createIndex(['DB_TableName', 'M_Product_ID', 'C_BPartner_ID']);
	promises.push(promise);

	let v = await Promise.all(promises);
	return (v as unknown) as void;
}
