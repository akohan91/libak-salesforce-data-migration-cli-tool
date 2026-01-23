export class SoqlBuilder {
	constructor(database, exportConfig) {
		this.database = database;
		this.exportConfig = structuredClone(exportConfig);
	}

	async buildSOQL() {
		const fieldsStr = (await this._getFields(this.exportConfig.apiName)).join(',');
		const recordIdList = this.exportConfig.referenceField
			? this.exportConfig?.parentRecordIds.map(id => `'${id}'`).join(',')
			: this.exportConfig?.recordIds.map(id => `'${id}'`).join(',');
		
		if (!recordIdList?.length) {
			return null;
		}

		return `
		SELECT ${fieldsStr}
		FROM ${this.exportConfig.apiName}
		WHERE ${this.exportConfig.referenceField || 'Id'} IN (${recordIdList})`;
	}

	async _getFields(sObjectApiName) {
		const sObjectMetadata = await this.database.sObjectDescribe(sObjectApiName);
		
		return sObjectMetadata.fields
			.filter(field => {
				if (field.type === 'id') {
					return true;
				}
				if (!field.createable || this.exportConfig.excludedFields?.includes(field.name)) {
					return false;
				}
				return true;
			})
			.map(field => field.name);
	}
}