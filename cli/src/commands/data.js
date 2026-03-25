"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDataCommand = registerDataCommand;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const regressionDatabase_1 = require("../database/regressionDatabase");
const incidentKnowledgeGraph_1 = require("../database/incidentKnowledgeGraph");
const serviceDependencyMapper_1 = require("../database/serviceDependencyMapper");
const crossSourceCorrelator_1 = require("../database/crossSourceCorrelator");
function getDataRoot(input) {
    if (!input || input === '~/.vitals') {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        return path.join(homeDir, '.vitals');
    }
    if (input.startsWith('~')) {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        return path.join(homeDir, input.slice(2));
    }
    return input;
}
function createPhase5Services(dataRootOption) {
    const dataRoot = getDataRoot(dataRootOption);
    return {
        dataRoot,
        regressionDb: new regressionDatabase_1.RegressionDatabase(path.join(dataRoot, 'database')),
        knowledgeGraph: new incidentKnowledgeGraph_1.IncidentKnowledgeGraph(path.join(dataRoot, 'knowledge-graph')),
        dependencyMapper: new serviceDependencyMapper_1.ServiceDependencyMapper(path.join(dataRoot, 'service-dependencies'))
    };
}
function toServiceId(value) {
    return value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}
function parseDate(value) {
    if (!value) {
        return undefined;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error(`Invalid date: ${value}`);
    }
    return parsed;
}
function parseStringList(value) {
    if (!value) {
        return [];
    }
    return value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}
function printRegressionList(records) {
    console.log('');
    console.log('Phase 5 Regression Records');
    console.log('='.repeat(80));
    if (records.length === 0) {
        console.log('No regression records found.');
        console.log('');
        return;
    }
    for (const record of records) {
        const timestamp = new Date(record.timestamp).toISOString();
        console.log(`${timestamp}  ${record.service.padEnd(18)}  ${record.metric.padEnd(24)}  ${record.verdict.padEnd(5)}  ${record.change_percent.toFixed(2)}%`);
    }
    console.log('');
}
function parseTraceFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    if (Array.isArray(data) && data.every(item => Array.isArray(item))) {
        return data;
    }
    if (Array.isArray(data) && data.every(item => typeof item === 'object' && item !== null && 'span_id' in item)) {
        return [data];
    }
    if (data && Array.isArray(data.traces)) {
        return data.traces;
    }
    throw new Error('Trace file must contain TraceSpan[][], TraceSpan[], or { traces: TraceSpan[][] }');
}
async function ensureRegressionNode(graph, database, regressionId) {
    const nodeId = `regression-${regressionId}`;
    const existing = await graph.getNode(nodeId);
    if (existing) {
        return;
    }
    const regression = await database.getById(regressionId);
    if (!regression) {
        throw new Error(`Regression not found in database: ${regressionId}`);
    }
    const node = {
        id: nodeId,
        type: 'regression',
        label: `${regression.service}:${regression.metric}`,
        properties: {
            regression_id: regression.id,
            service: regression.service,
            metric: regression.metric,
            verdict: regression.verdict,
            change_percent: regression.change_percent,
            deployment_id: regression.deployment_id,
            timestamp: regression.timestamp
        }
    };
    await graph.addNode(node);
}
async function ensureDeploymentNode(graph, deploymentId) {
    const nodeId = `deployment-${deploymentId}`;
    const existing = await graph.getNode(nodeId);
    if (existing) {
        return;
    }
    const node = {
        id: nodeId,
        type: 'deployment',
        label: deploymentId,
        properties: {
            deployment_id: deploymentId
        }
    };
    await graph.addNode(node);
}
function registerDataCommand(program) {
    const dataCommand = program
        .command('data')
        .description('Phase 5 source-of-truth commands for regressions, incidents, dependencies, and correlations');
    const regressionsCommand = dataCommand
        .command('regressions')
        .description('Manage regression records in the Phase 5 database');
    regressionsCommand
        .command('list')
        .description('List regression records from the structured database')
        .option('--data-root <path>', 'Phase 5 data root', '~/.vitals')
        .option('--service <service>', 'Filter by service')
        .option('--metric <metric>', 'Filter by metric')
        .option('--verdict <verdict>', 'Filter by verdict')
        .option('--start-date <date>', 'Filter start date (ISO-8601)')
        .option('--end-date <date>', 'Filter end date (ISO-8601)')
        .option('--limit <count>', 'Maximum records to return', '20')
        .option('--format <format>', 'Output format: json or pretty', 'pretty')
        .action(async (options) => {
        try {
            const { regressionDb } = createPhase5Services(options.dataRoot);
            await regressionDb.initialize();
            const filter = {
                service: options.service,
                metric: options.metric,
                verdict: options.verdict,
                start_date: parseDate(options.startDate),
                end_date: parseDate(options.endDate),
                limit: Number.parseInt(options.limit, 10),
                sort_by: 'timestamp',
                sort_order: 'desc'
            };
            const results = await regressionDb.query(filter);
            if (options.format === 'json') {
                console.log(JSON.stringify(results, null, 2));
            }
            else {
                printRegressionList(results);
            }
        }
        catch (error) {
            console.error(`Error: ${error.message}`);
            process.exit(2);
        }
    });
    regressionsCommand
        .command('import-historical')
        .description('Import Phase 4 JSONL historical storage into the structured regression database')
        .option('--data-root <path>', 'Phase 5 data root', '~/.vitals')
        .option('--history-dir <path>', 'Phase 4 history directory', '~/.vitals/history')
        .action(async (options) => {
        try {
            const { regressionDb } = createPhase5Services(options.dataRoot);
            await regressionDb.initialize();
            const imported = await (0, regressionDatabase_1.migrateFromHistoricalStorage)(getDataRoot(options.historyDir), regressionDb);
            console.log(JSON.stringify({ imported }, null, 2));
        }
        catch (error) {
            console.error(`Error: ${error.message}`);
            process.exit(2);
        }
    });
    regressionsCommand
        .command('stats')
        .description('Aggregate regression records by service, metric, environment, or verdict')
        .option('--data-root <path>', 'Phase 5 data root', '~/.vitals')
        .option('--group-by <field>', 'Group by service, metric, environment, or verdict', 'service')
        .option('--format <format>', 'Output format: json or pretty', 'pretty')
        .action(async (options) => {
        try {
            const { regressionDb } = createPhase5Services(options.dataRoot);
            await regressionDb.initialize();
            const results = await regressionDb.aggregate(options.groupBy, {});
            if (options.format === 'json') {
                console.log(JSON.stringify(results, null, 2));
                return;
            }
            console.log('');
            console.log(`Regression Stats by ${options.groupBy}`);
            console.log('='.repeat(80));
            for (const result of results) {
                console.log(`${result.value.padEnd(24)} count=${String(result.count).padEnd(6)} fail=${String(result.fail_count).padEnd(6)} avg_change=${result.avg_change_percent.toFixed(2)}%`);
            }
            console.log('');
        }
        catch (error) {
            console.error(`Error: ${error.message}`);
            process.exit(2);
        }
    });
    const incidentsCommand = dataCommand
        .command('incidents')
        .description('Manage Phase 5 incident knowledge graph');
    incidentsCommand
        .command('create')
        .description('Create an incident node and optional links to deployments/regressions')
        .requiredOption('--id <id>', 'Incident ID')
        .requiredOption('--title <title>', 'Incident title')
        .requiredOption('--services <services>', 'Comma-separated affected services')
        .option('--severity <severity>', 'Incident severity', 'medium')
        .option('--status <status>', 'Incident status', 'open')
        .option('--started-at <date>', 'Incident start time (ISO-8601)')
        .option('--resolved-at <date>', 'Incident resolution time (ISO-8601)')
        .option('--deployment-id <id>', 'Link incident to deployment')
        .option('--regression-id <id>', 'Link incident to regression')
        .option('--data-root <path>', 'Phase 5 data root', '~/.vitals')
        .action(async (options) => {
        try {
            const { regressionDb, knowledgeGraph } = createPhase5Services(options.dataRoot);
            await regressionDb.initialize();
            await knowledgeGraph.initialize();
            const affectedServices = parseStringList(options.services);
            const incident = (0, incidentKnowledgeGraph_1.createIncidentNode)(options.id, options.title, options.severity, affectedServices);
            incident.properties.status = options.status;
            incident.properties.started_at = parseDate(options.startedAt) || new Date();
            incident.properties.resolved_at = parseDate(options.resolvedAt);
            await knowledgeGraph.addNode(incident);
            if (options.deploymentId) {
                await ensureDeploymentNode(knowledgeGraph, options.deploymentId);
                await knowledgeGraph.addEdge((0, incidentKnowledgeGraph_1.linkIncidentToDeployment)(options.id, options.deploymentId));
            }
            if (options.regressionId) {
                await ensureRegressionNode(knowledgeGraph, regressionDb, options.regressionId);
                await knowledgeGraph.addEdge((0, incidentKnowledgeGraph_1.linkIncidentToRegression)(options.id, options.regressionId));
            }
            console.log(JSON.stringify({ incident_id: options.id, status: 'created' }, null, 2));
        }
        catch (error) {
            console.error(`Error: ${error.message}`);
            process.exit(2);
        }
    });
    incidentsCommand
        .command('analyze')
        .description('Run root-cause and correlation analysis for an incident')
        .requiredOption('--id <id>', 'Incident ID')
        .option('--data-root <path>', 'Phase 5 data root', '~/.vitals')
        .option('--format <format>', 'Output format: json or pretty', 'pretty')
        .action(async (options) => {
        try {
            const { knowledgeGraph } = createPhase5Services(options.dataRoot);
            await knowledgeGraph.initialize();
            const nodeId = `incident-${options.id}`;
            const rootCause = await knowledgeGraph.analyzeRootCause(nodeId);
            const correlations = await knowledgeGraph.analyzeCorrelations(nodeId);
            if (options.format === 'json') {
                console.log(JSON.stringify({ root_cause: rootCause, correlations }, null, 2));
                return;
            }
            console.log('');
            console.log(`Incident Analysis: ${options.id}`);
            console.log('='.repeat(80));
            console.log(`Recommendation: ${rootCause.recommendation}`);
            console.log('Likely Causes:');
            for (const cause of rootCause.likely_causes) {
                console.log(`  - ${cause.description} (${cause.node_type}, confidence=${cause.confidence.toFixed(2)})`);
            }
            console.log('Correlated Incidents:');
            for (const incident of correlations.correlated_incidents) {
                console.log(`  - ${incident.incident_id} (score=${incident.correlation_score.toFixed(2)})`);
            }
            console.log('');
        }
        catch (error) {
            console.error(`Error: ${error.message}`);
            process.exit(2);
        }
    });
    const dependenciesCommand = dataCommand
        .command('dependencies')
        .description('Manage service dependencies discovered from traces');
    dependenciesCommand
        .command('import-traces')
        .description('Import a trace export and build/update the service dependency map')
        .requiredOption('--file <path>', 'Path to JSON trace file')
        .option('--data-root <path>', 'Phase 5 data root', '~/.vitals')
        .action(async (options) => {
        try {
            const { dependencyMapper } = createPhase5Services(options.dataRoot);
            await dependencyMapper.initialize();
            const traces = parseTraceFile(options.file);
            await dependencyMapper.extractFromTraces(traces);
            const map = await dependencyMapper.getServiceMap();
            console.log(JSON.stringify({ traces: traces.length, services: map.services.length, dependencies: map.dependencies.length }, null, 2));
        }
        catch (error) {
            console.error(`Error: ${error.message}`);
            process.exit(2);
        }
    });
    dependenciesCommand
        .command('map')
        .description('Print or export the current service dependency map')
        .option('--data-root <path>', 'Phase 5 data root', '~/.vitals')
        .option('--format <format>', 'Output format: pretty, json, or dot', 'pretty')
        .action(async (options) => {
        try {
            const { dependencyMapper } = createPhase5Services(options.dataRoot);
            await dependencyMapper.initialize();
            const serviceMap = await dependencyMapper.getServiceMap();
            if (options.format === 'json') {
                console.log(JSON.stringify(serviceMap, null, 2));
                return;
            }
            if (options.format === 'dot') {
                console.log((0, serviceDependencyMapper_1.exportToDot)(serviceMap));
                return;
            }
            console.log('');
            console.log('Service Dependency Map');
            console.log('='.repeat(80));
            console.log(`Services: ${serviceMap.services.length}`);
            console.log(`Dependencies: ${serviceMap.dependencies.length}`);
            for (const dependency of serviceMap.dependencies) {
                const fromName = serviceMap.services.find(service => service.id === dependency.from_service)?.name || dependency.from_service;
                const toName = serviceMap.services.find(service => service.id === dependency.to_service)?.name || dependency.to_service;
                console.log(`  - ${fromName} -> ${toName} (${dependency.avg_latency_ms.toFixed(0)}ms, health=${dependency.health_score})`);
            }
            console.log('');
        }
        catch (error) {
            console.error(`Error: ${error.message}`);
            process.exit(2);
        }
    });
    dependenciesCommand
        .command('health')
        .description('Show dependency health for a service')
        .requiredOption('--service <service>', 'Service name or normalized service ID')
        .option('--data-root <path>', 'Phase 5 data root', '~/.vitals')
        .option('--format <format>', 'Output format: json or pretty', 'pretty')
        .action(async (options) => {
        try {
            const { dependencyMapper } = createPhase5Services(options.dataRoot);
            await dependencyMapper.initialize();
            const summary = await dependencyMapper.getServiceHealthSummary(toServiceId(options.service));
            if (options.format === 'json') {
                console.log(JSON.stringify(summary, null, 2));
                return;
            }
            console.log('');
            console.log(`Dependency Health: ${options.service}`);
            console.log('='.repeat(80));
            console.log(`Overall health: ${summary.overall_health}`);
            for (const recommendation of summary.recommendations) {
                console.log(`  - ${recommendation}`);
            }
            console.log('');
        }
        catch (error) {
            console.error(`Error: ${error.message}`);
            process.exit(2);
        }
    });
    const correlateCommand = dataCommand
        .command('correlate')
        .description('Correlate incidents and regressions across the Phase 5 data model');
    correlateCommand
        .command('incident')
        .description('Correlate an incident against nearby events')
        .requiredOption('--id <id>', 'Incident ID')
        .option('--window-minutes <minutes>', 'Correlation window in minutes', '60')
        .option('--data-root <path>', 'Phase 5 data root', '~/.vitals')
        .option('--format <format>', 'Output format: json or pretty', 'pretty')
        .action(async (options) => {
        try {
            const { regressionDb, knowledgeGraph, dependencyMapper } = createPhase5Services(options.dataRoot);
            const correlator = new crossSourceCorrelator_1.CrossSourceCorrelator(regressionDb, knowledgeGraph, dependencyMapper);
            await correlator.initialize();
            const incidentNode = await knowledgeGraph.getNode(`incident-${options.id}`);
            if (!incidentNode || incidentNode.type !== 'incident') {
                throw new Error(`Incident not found: ${options.id}`);
            }
            const startedAt = new Date(incidentNode.properties.started_at);
            const windowMinutes = Number.parseInt(options.windowMinutes, 10);
            const result = await correlator.correlateIncident(options.id, {
                start: new Date(startedAt.getTime() - windowMinutes * 60000),
                end: new Date(startedAt.getTime() + windowMinutes * 60000)
            });
            if (options.format === 'json') {
                console.log(JSON.stringify(result, null, 2));
                return;
            }
            console.log('');
            console.log(`Incident Correlation: ${options.id}`);
            console.log('='.repeat(80));
            console.log(`Likely root cause: ${result.likely_root_cause || 'unknown'}`);
            console.log(`Affected services: ${result.affected_services.join(', ')}`);
            for (const item of result.correlated_events) {
                console.log(`  - ${item.event.source}:${item.event.type} (${item.correlation_score.toFixed(2)}) ${item.explanation}`);
            }
            console.log('');
        }
        catch (error) {
            console.error(`Error: ${error.message}`);
            process.exit(2);
        }
    });
    correlateCommand
        .command('regression')
        .description('Correlate a regression against nearby events')
        .requiredOption('--id <id>', 'Regression ID')
        .option('--data-root <path>', 'Phase 5 data root', '~/.vitals')
        .option('--format <format>', 'Output format: json or pretty', 'pretty')
        .action(async (options) => {
        try {
            const { regressionDb, knowledgeGraph, dependencyMapper } = createPhase5Services(options.dataRoot);
            const correlator = new crossSourceCorrelator_1.CrossSourceCorrelator(regressionDb, knowledgeGraph, dependencyMapper);
            await correlator.initialize();
            const result = await correlator.correlateRegression(options.id);
            if (options.format === 'json') {
                console.log(JSON.stringify(result, null, 2));
                return;
            }
            console.log('');
            console.log(`Regression Correlation: ${options.id}`);
            console.log('='.repeat(80));
            console.log(`Likely root cause: ${result.likely_root_cause || 'unknown'}`);
            for (const item of result.correlated_events) {
                console.log(`  - ${item.event.source}:${item.event.type} (${item.correlation_score.toFixed(2)}) ${item.explanation}`);
            }
            console.log('');
        }
        catch (error) {
            console.error(`Error: ${error.message}`);
            process.exit(2);
        }
    });
}
