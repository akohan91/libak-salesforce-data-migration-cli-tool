import { execSync } from 'child_process';
import { Connection } from 'jsforce';

import { Command, type OptionValues }  from 'commander';
import { Database } from './services/database.ts';
import { CliArgName } from './types/types.ts';

let _argNameToValue: OptionValues;
let _connections: {[key: string]: Connection} = {};

let _sourceDb: Database | null = null;
let _targetDb: Database | null = null;

export const initArguments = (): void => {
	const program = new Command();
	program
		.option('-s, --source-org <name>', 'Organization from where the data comes.')
		.option('-t, --target-org <name>', 'Organization to where the data comes.')
		.option('-e, --export-config <name>', 'Path to the import configuration file')
		.option('-a, --analyze-references', 'Runs the reference analyzer.')
		.parse(process.argv);
	_argNameToValue = program.opts();
};

export const getArg = (cliArgName: CliArgName): string =>  {
	return _argNameToValue[cliArgName];
};

export const connectToOrgs = (): void => {
	const sourceLoginConfig = JSON.parse(execSync(
		`sf org display --target-org ${getArg(CliArgName.sourceOrg)} --verbose --json`,
		{ encoding: 'utf-8' }
	)).result;
	_connections[getArg(CliArgName.sourceOrg)] = new Connection({
		instanceUrl: sourceLoginConfig.instanceUrl,
		accessToken: sourceLoginConfig.accessToken
	});
	
	const targetLoginConfig = JSON.parse(execSync(
		`sf org display --target-org ${getArg(CliArgName.targetOrg)} --verbose --json`,
		{ encoding: 'utf-8' }
	)).result;
	_connections[getArg(CliArgName.targetOrg)] = new Connection({
		instanceUrl: targetLoginConfig.instanceUrl,
		accessToken: targetLoginConfig.accessToken
	});
};

export const getConnection = (orgAlias: string): Connection => {
	if (_connections[orgAlias]) {
		return _connections[orgAlias];
	}
	throw new Error(`There are no connection for ${orgAlias}.`);
}

export const getSourceDb = (): Database => {
	if (!_sourceDb) {
		_sourceDb = new Database(getConnection(getArg(CliArgName.sourceOrg)));
	}
	return _sourceDb;
}

export const getTargetDb = (): Database => {
	if (!_targetDb) {
		_targetDb = new Database(getConnection(getArg(CliArgName.targetOrg)));
	}
	return _targetDb;
}