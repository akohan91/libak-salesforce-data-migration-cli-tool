import { getSourceDb, getTargetDb } from "../cli.ts";
import { FieldName, type TreeConfig } from "../types/types.ts";
import { SoqlBuilder } from "./soql-builder.ts";
import type { Field, SaveResult } from "jsforce";

export class SobjectReferenceService {
	_referenceFields: string[];
	_sourceRecordIdToTargetRecordId;
	
	constructor() {
		this._referenceFields = [];
		this._sourceRecordIdToTargetRecordId = new Map();
	}

	async assignReferences(
		sourceRecords: any[],
		sObjectApiName: string,
		keepField: (fieldMetadata: Field) => boolean
	): Promise<any[]> {
		sourceRecords = structuredClone(sourceRecords);
		const sObjectMetadata = await getSourceDb()
			.sObjectDescribe(sObjectApiName);
		this._referenceFields = sObjectMetadata.fields
			.filter(field => (field.type === 'reference' || field.name === 'Id'))
			.map(field => field.name);

		return sourceRecords.map(record => {
			delete record.attributes;
			for (const fieldName in record) {
				this._deleteNulls(record, fieldName);
				this._assignReferences(record, fieldName);
			}
			sObjectMetadata.fields
				.forEach((fieldMetadata: Field) => {
					!keepField(fieldMetadata) && delete record[fieldMetadata.name]
				});
			return record;
		});
	}

	async addReferencesFromDbResults(
		sourceRecords: any[],
		targetDbResults: SaveResult[],
		treeConfig: TreeConfig
	): Promise<void> {
		sourceRecords = structuredClone(sourceRecords);
		const sourceRecordIdToTargetRecordId = new Map();
		for (let i = 0; i < sourceRecords.length; i++) {
			this._sourceRecordIdToTargetRecordId.set(sourceRecords[i].Id, targetDbResults[i]?.id);
			sourceRecordIdToTargetRecordId.set(sourceRecords[i].Id, targetDbResults[i]?.id);
		}
		if (!treeConfig.requiredReferences) {
			return;
		}
		
		const recordIdToTargetRecord = (await getTargetDb().query(
			new SoqlBuilder().buildSoqlByIds(
				[FieldName.Id, ...treeConfig.requiredReferences],
				treeConfig.apiName,
				[...sourceRecordIdToTargetRecordId.values()]
			)
		)).reduce((recordIdToRecord, record) => {
			if (record.Id) {
				recordIdToRecord[record.Id] = record;
			}
			return recordIdToRecord;
		}, {});

		sourceRecords.forEach(record => {
			const targetRecordId = sourceRecordIdToTargetRecordId.get(record.Id);
			const targetRecord = recordIdToTargetRecord[targetRecordId];
			treeConfig.requiredReferences?.forEach(fieldName => {
				this._sourceRecordIdToTargetRecordId.set(record[fieldName], targetRecord[fieldName]);
			});
		});
	}

	async addRecordTypeReferences(treeConfig: TreeConfig): Promise<void> {
		const sObjectTypes = this._extractAllSobjectTypes(treeConfig);
		const recordTypeSoql = new SoqlBuilder().buildSoqlByFieldValues(
			[FieldName.Id, FieldName.DeveloperName],
			FieldName.RecordType,
			FieldName.SobjectType,
			[...sObjectTypes.values()]
		);
		const sourceRecordTypes = await getSourceDb().query(recordTypeSoql);
		const devNameToTargetRtId = (await getTargetDb().query(recordTypeSoql))
			.reduce((result, recordType) => {
				result.set(recordType.DeveloperName, recordType.Id)
				return result
			}, new Map());
		sourceRecordTypes.forEach(sourceRecordType => {
			this._sourceRecordIdToTargetRecordId.set(
				sourceRecordType.Id,
				devNameToTargetRtId.get(sourceRecordType.DeveloperName)
			);
		});
	}

	_extractAllSobjectTypes(treeConfig: TreeConfig, sobjectTypes: Set<string> = new Set()): Set<string> {
		sobjectTypes.add(treeConfig.apiName);
		
		if (!treeConfig.children?.length) {
			return sobjectTypes;
		}
		
		for (let childConfig of treeConfig.children) {
			sobjectTypes = this._extractAllSobjectTypes(childConfig, sobjectTypes);
		}
		return sobjectTypes;
	}

	_deleteNulls (record: any, fieldName: string) {
		if (record[fieldName] === null || record[fieldName] === undefined) {
			delete record[fieldName];
		}
		return record;
	}

	_assignReferences(record: any, fieldName: string) {
		const fieldValue = record[fieldName];
		if (
			this._referenceFields.includes(fieldName) &&
			this._sourceRecordIdToTargetRecordId.has(fieldValue)
		) {
			record[fieldName] = this._sourceRecordIdToTargetRecordId.get(fieldValue);
		} else if (
			this._referenceFields.includes(fieldName) &&
			!this._sourceRecordIdToTargetRecordId.has(fieldValue)
		) {
			delete record[fieldName];
		}
		return record;
	}
}