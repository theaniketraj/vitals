"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const regress_1 = require("./commands/regress");
const analyze_1 = require("./commands/analyze");
const compare_1 = require("./commands/compare");
const incident_1 = require("./commands/incident");
const batch_1 = require("./commands/batch");
const validate_1 = require("./commands/validate");
const historical_1 = require("./commands/historical");
const data_1 = require("./commands/data");
const program = new commander_1.Command();
program
    .name('vitals')
    .description('VITALS CLI - Performance decision engine for CI/CD')
    .version('0.4.0');
// Register commands
(0, regress_1.registerRegressCommand)(program);
(0, analyze_1.registerAnalyzeCommand)(program);
(0, compare_1.registerCompareCommand)(program);
(0, incident_1.registerIncidentCommand)(program);
(0, batch_1.registerBatchCommand)(program);
(0, validate_1.registerValidateCommand)(program);
(0, historical_1.registerHistoricalCommand)(program);
(0, data_1.registerDataCommand)(program);
program.parse(process.argv);
