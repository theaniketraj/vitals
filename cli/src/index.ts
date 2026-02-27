import { Command } from 'commander';
import { registerRegressCommand } from './commands/regress';
import { registerAnalyzeCommand } from './commands/analyze';
import { registerCompareCommand } from './commands/compare';
import { registerIncidentCommand } from './commands/incident';
import { registerBatchCommand } from './commands/batch';

const program = new Command();

program
  .name('vitals')
  .description('VITALS CLI - Performance decision engine for CI/CD')
  .version('0.1.0');

// Register commands
registerRegressCommand(program);
registerAnalyzeCommand(program);
registerCompareCommand(program);
registerIncidentCommand(program);
registerBatchCommand(program);

program.parse(process.argv);
