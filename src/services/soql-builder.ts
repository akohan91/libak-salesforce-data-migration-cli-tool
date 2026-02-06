import { FieldName, FieldType, type TreeConfig } from "../types/types.ts";
import type { Database } from "./database.ts";

export class SoqlBuilder {

	private _database?: Database;

	constructor(database?: Database) {
		this._database = database;
	}

	async buildSoqlForConfig(treeConfig: TreeConfig): Promise<string | null> {
		let fieldsList = [...(await this._getAllFieldsForConfig(treeConfig))];
		if (treeConfig.requiredReferences) {
			fieldsList = [...fieldsList, ...treeConfig.requiredReferences];
		}
		const fieldsStr = Array.from(new Set(fieldsList)).join(',');
		const recordIdList = treeConfig.referenceField
			? treeConfig?.parentRecordIds?.map(id => `'${id}'`).join(',')
			: treeConfig?.recordIds?.map(id => `'${id}'`).join(',');
		
		if (!recordIdList?.length) {
			return null;
		}
		let externalIdCondition;
		if (treeConfig.externalIdField) {
			externalIdCondition = Array.isArray(treeConfig.externalIdField)
				? treeConfig.externalIdField.map(fieldName => `${fieldName} != NULL`).join(' OR ')
				: `${treeConfig.externalIdField} != NULL`
		}
		return `
		SELECT ${fieldsStr}
		FROM ${treeConfig.sObjectType}
		WHERE ${treeConfig.referenceField || FieldName.Id} IN (${recordIdList})` + 
		(externalIdCondition ? ` AND (${externalIdCondition})` : '');
	}

	buildSoqlByIds(fieldsToSelect: string[], sobjectApiName: string, recordIds: string[]): string {
		return `
			SELECT ${fieldsToSelect.join(',')}
			FROM ${sobjectApiName}
			WHERE Id IN (${recordIds.map(id => `'${id}'`).join(',')})`
	}

	buildSoqlByFieldValues(fieldsToSelect: string[], sobjectApiName: string, fieldName: string, values: any[]): string {
		const soql = `
			SELECT ${fieldsToSelect.join(',')}
			FROM ${sobjectApiName}` +
			(!fieldName || !values ? '' : ` WHERE ${fieldName} IN (${values.map(value => `'${value}'`).join(',')})`)
		return soql;
	}

	private async _getAllFieldsForConfig(treeConfig: TreeConfig) {
		if (!this._database) {
			throw new Error('The _getAllFieldsForConfig method requires Database instance.');
		}
		const sObjectMetadata = await this._database.sObjectDescribe(treeConfig.sObjectType);
		
		return sObjectMetadata.fields
			.filter((field) => {
				if (field.type === FieldType.id || field.type == FieldType.reference) {
					return true;
				}
				if (
					!field.updateable ||
					!field.createable ||
					treeConfig.excludedFields?.includes(field.name)
				) {
					return false;
				}
				return true;
			})
			.map((field) => field.name);
	}
}