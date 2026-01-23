/**
 * @fileoverview Main entry point for the Salesforce Data Migration CLI Tool.
 * Handles command-line arguments, establishes Salesforce connections, and orchestrates
 * the data migration process from source to target org.
 * @module index
 */

import { readFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

import { program }  from 'commander';

import { setOptions, getOptions } from './services/app-options.js'
import { SalesforceConnection } from './services/salesforce-connection.js';
import { RecordFormatter } from './services/record-formatter.js'
import { MigrateService } from './services/migrate-service.js'
import { Database } from './services/database.js'
import { ImportPlanBuilder } from './services/import-plan-builder.js'
import { SObjectDescribeService } from './services/sobject-describe.js'

program
	.option('-s, --source-org <name>', 'Organization from where the data comes.')
	.option('-t, --target-org <name>', 'Organization to where the data comes.')
	.option('-e, --export-config <name>', 'Path to the import configuration file')
	.parse(process.argv);
setOptions(program.opts());

const loginConfig = JSON.parse(execSync(
	`sf org display --target-org ${getOptions().sourceOrg} --verbose --json`,
	{ encoding: 'utf-8' }
));

const exportConfig = JSON.parse(
	readFileSync(getOptions().exportConfig, 'utf-8')
);

if (!existsSync('_output')) {
	mkdirSync('_output', { recursive: true });
}

(async () => {
	const sourceConnection = new SalesforceConnection(loginConfig.result);
	await sourceConnection.connect();

	await new MigrateService(
		sourceConnection,
		new Database(sourceConnection),
		new RecordFormatter(
			new SObjectDescribeService(sourceConnection)
		),
		new ImportPlanBuilder()
	).migrateData(exportConfig);
})();