import type { SaveError, SaveResult } from "jsforce";
import type { DatabaseUnifiedResult, DML } from "../types/types.ts";


export const _formatDatabaseErrors = (results: SaveResult[]): DatabaseUnifiedResult => {
	const successCount = results.filter(ret => ret.success).length;
	const successIds: Set<string> = new Set<string>();
	results.forEach(ret => ret.id && successIds.add(ret.id));
	const errorCount = results.length - successCount;
	
	const summary: DatabaseUnifiedResult = {
		successCount,
		successIds,
		errorCount,
		errors: []
	};

	if (errorCount > 0) {
		for (const ret of results) {
			if (!ret.success) {
				const errors: SaveError[] = ret.errors;
				errors.forEach((error: SaveError) => {
					summary.errors?.push({
						statusCode: error.errorCode,
						message: error.message,
						fields: error.fields || []
					});
				});
			}
		}
	}

	return summary;
}

export const displayDatabaseResults = (
	actionName: DML,
	results: SaveResult[],
	sObjectApiName: string
): DatabaseUnifiedResult => {
	const summary: DatabaseUnifiedResult = _formatDatabaseErrors(results);
	if (summary.successCount > 0) {
		console.log(`\t✅ ${actionName}ed ${summary.successCount} ${sObjectApiName} record${summary.successCount !== 1 ? 's' : ''}: ${[...summary.successIds].join(', ')}`);
	}
	
	if (summary.errorCount > 0) {
		console.log(`\t⚠️  Failed to ${actionName} ${summary.errorCount} ${sObjectApiName} record${summary.errorCount !== 1 ? 's' : ''}:`);
		
		summary.errors?.forEach(error => {
			console.log(`\t • ${error.message}`);
			console.log(`${error.statusCode ? '\n\t• Status Code: ' + error.statusCode : ''}`);
			console.log(`${error.fields.length ? '\n\t• Fields: ' + error.fields : ''}`);
		});
	}
	return summary;
}
