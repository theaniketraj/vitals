/**
 * VITALS Automation Policy Engine
 * 
 * Executes automated actions based on regression detection results
 * and user-defined policies.
 */

import { RegressionResult } from '../core/regression';
import { BatchResult } from '../core/batch';

/**
 * Condition types for automation triggers
 */
export type ConditionOperator = 
  | 'equals' 
  | 'not_equals'
  | 'greater_than' 
  | 'less_than' 
  | 'contains'
  | 'matches';

export interface AutomationCondition {
  field: string;           // e.g., 'metric', 'verdict', 'change_percent'
  operator: ConditionOperator;
  value: string | number;
}

/**
 * Action types that can be executed
 */
export type ActionType = 
  | 'webhook'      // Call HTTP webhook
  | 'slack'        // Send Slack message
  | 'pagerduty'    // Create PagerDuty incident
  | 'email'        // Send email notification
  | 'script'       // Execute custom script
  | 'rollback';    // Trigger rollback

export interface AutomationAction {
  type: ActionType;
  config: Record<string, any>;
  on_failure?: 'continue' | 'abort';  // What to do if action fails
}

/**
 * Automation policy definition
 */
export interface AutomationPolicy {
  name: string;
  description?: string;
  enabled?: boolean;
  trigger: 'regression_detected' | 'warning_detected' | 'all_passed' | 'error_occurred';
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  priority?: number;  // Higher priority policies execute first
  throttle?: {
    max_executions?: number;  // Max executions per time window
    time_window_seconds?: number;
  };
}

/**
 * Automation context passed to action executors
 */
export interface AutomationContext {
  result: RegressionResult | BatchResult;
  policy: AutomationPolicy;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Action executor interface
 */
export interface ActionExecutor {
  execute(action: AutomationAction, context: AutomationContext): Promise<ActionResult>;
}

/**
 * Result of executing an action
 */
export interface ActionResult {
  success: boolean;
  action_type: ActionType;
  message: string;
  metadata?: Record<string, any>;
  error?: Error;
}

/**
 * Policy execution result
 */
export interface PolicyExecutionResult {
  policy_name: string;
  triggered: boolean;
  conditions_met: boolean;
  actions_executed: ActionResult[];
  duration_ms: number;
  error?: Error;
}

/**
 * Evaluates conditions against regression results
 */
export class ConditionEvaluator {
  /**
   * Evaluate a single condition
   */
  evaluate(condition: AutomationCondition, context: AutomationContext): boolean {
    const value = this.extractFieldValue(condition.field, context);
    
    if (value === undefined) {
      return false;
    }

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      
      case 'not_equals':
        return value !== condition.value;
      
      case 'greater_than':
        return Number(value) > Number(condition.value);
      
      case 'less_than':
        return Number(value) < Number(condition.value);
      
      case 'contains':
        return String(value).includes(String(condition.value));
      
      case 'matches':
        const regex = new RegExp(String(condition.value));
        return regex.test(String(value));
      
      default:
        return false;
    }
  }

  /**
   * Evaluate all conditions (AND logic)
   */
  evaluateAll(conditions: AutomationCondition[], context: AutomationContext): boolean {
    if (conditions.length === 0) {
      return true;
    }

    return conditions.every(condition => this.evaluate(condition, context));
  }

  /**
   * Extract field value from context
   */
  private extractFieldValue(field: string, context: AutomationContext): any {
    const parts = field.split('.');
    let value: any = context.result;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = value[part];
    }

    return value;
  }
}

/**
 * Throttle manager to prevent action spam
 */
export class ThrottleManager {
  private executionCounts: Map<string, Array<{ timestamp: Date; count: number }>> = new Map();

  /**
   * Check if policy execution should be throttled
   */
  shouldThrottle(policy: AutomationPolicy): boolean {
    if (!policy.throttle) {
      return false;
    }

    const { max_executions, time_window_seconds } = policy.throttle;
    if (!max_executions || !time_window_seconds) {
      return false;
    }

    const key = policy.name;
    const now = new Date();
    const windowStart = new Date(now.getTime() - time_window_seconds * 1000);

    // Get execution history
    const history = this.executionCounts.get(key) || [];
    
    // Remove old entries
    const recentHistory = history.filter(entry => entry.timestamp >= windowStart);
    
    // Calculate total executions in window
    const totalExecutions = recentHistory.reduce((sum, entry) => sum + entry.count, 0);

    return totalExecutions >= max_executions;
  }

  /**
   * Record a policy execution
   */
  recordExecution(policy: AutomationPolicy): void {
    const key = policy.name;
    const now = new Date();

    const history = this.executionCounts.get(key) || [];
    history.push({ timestamp: now, count: 1 });

    // Keep only recent history
    if (policy.throttle?.time_window_seconds) {
      const windowStart = new Date(now.getTime() - policy.throttle.time_window_seconds * 1000);
      const recentHistory = history.filter(entry => entry.timestamp >= windowStart);
      this.executionCounts.set(key, recentHistory);
    } else {
      this.executionCounts.set(key, history);
    }
  }

  /**
   * Clear throttle history for a policy
   */
  clearHistory(policyName: string): void {
    this.executionCounts.delete(policyName);
  }
}

/**
 * Main automation policy engine
 */
export class AutomationPolicyEngine {
  private conditionEvaluator: ConditionEvaluator;
  private throttleManager: ThrottleManager;
  private actionExecutors: Map<ActionType, ActionExecutor>;

  constructor() {
    this.conditionEvaluator = new ConditionEvaluator();
    this.throttleManager = new ThrottleManager();
    this.actionExecutors = new Map();
  }

  /**
   * Register an action executor
   */
  registerExecutor(actionType: ActionType, executor: ActionExecutor): void {
    this.actionExecutors.set(actionType, executor);
  }

  /**
   * Determine which trigger to use based on result
   */
  private determineTrigger(result: RegressionResult | BatchResult): string {
    if ('verdict' in result) {
      // Single regression result
      if (result.verdict === 'FAIL') {
        return 'regression_detected';
      } else if (result.verdict === 'WARN') {
        return 'warning_detected';
      } else if (result.verdict === 'PASS') {
        return 'all_passed';
      } else {
        return 'error_occurred';
      }
    } else {
      // Batch result
      if (result.failed > 0) {
        return 'regression_detected';
      } else if (result.warned > 0) {
        return 'warning_detected';
      } else if (result.passed > 0) {
        return 'all_passed';
      } else {
        return 'error_occurred';
      }
    }
  }

  /**
   * Execute a single policy
   */
  async executePolicy(
    policy: AutomationPolicy,
    result: RegressionResult | BatchResult,
    metadata?: Record<string, any>
  ): Promise<PolicyExecutionResult> {
    const startTime = Date.now();
    const context: AutomationContext = {
      result,
      policy,
      timestamp: new Date(),
      metadata
    };

    // Check if policy is enabled
    if (policy.enabled === false) {
      return {
        policy_name: policy.name,
        triggered: false,
        conditions_met: false,
        actions_executed: [],
        duration_ms: Date.now() - startTime
      };
    }

    // Check if trigger matches
    const trigger = this.determineTrigger(result);
    if (policy.trigger !== trigger) {
      return {
        policy_name: policy.name,
        triggered: false,
        conditions_met: false,
        actions_executed: [],
        duration_ms: Date.now() - startTime
      };
    }

    // Check if throttled
    if (this.throttleManager.shouldThrottle(policy)) {
      return {
        policy_name: policy.name,
        triggered: false,
        conditions_met: false,
        actions_executed: [],
        duration_ms: Date.now() - startTime,
        error: new Error('Policy execution throttled')
      };
    }

    // Evaluate conditions
    const conditionsMet = this.conditionEvaluator.evaluateAll(policy.conditions, context);
    if (!conditionsMet) {
      return {
        policy_name: policy.name,
        triggered: true,
        conditions_met: false,
        actions_executed: [],
        duration_ms: Date.now() - startTime
      };
    }

    // Execute actions
    const actionResults: ActionResult[] = [];
    for (const action of policy.actions) {
      try {
        const executor = this.actionExecutors.get(action.type);
        if (!executor) {
          actionResults.push({
            success: false,
            action_type: action.type,
            message: `No executor registered for action type: ${action.type}`,
            error: new Error(`Missing executor: ${action.type}`)
          });

          if (action.on_failure === 'abort') {
            break;
          }
          continue;
        }

        const result = await executor.execute(action, context);
        actionResults.push(result);

        if (!result.success && action.on_failure === 'abort') {
          break;
        }
      } catch (error) {
        actionResults.push({
          success: false,
          action_type: action.type,
          message: `Action execution failed: ${error}`,
          error: error as Error
        });

        if (action.on_failure === 'abort') {
          break;
        }
      }
    }

    // Record execution for throttling
    this.throttleManager.recordExecution(policy);

    return {
      policy_name: policy.name,
      triggered: true,
      conditions_met: true,
      actions_executed: actionResults,
      duration_ms: Date.now() - startTime
    };
  }

  /**
   * Execute multiple policies
   */
  async executePolicies(
    policies: AutomationPolicy[],
    result: RegressionResult | BatchResult,
    metadata?: Record<string, any>
  ): Promise<PolicyExecutionResult[]> {
    // Sort by priority (higher first)
    const sortedPolicies = [...policies].sort((a, b) => 
      (b.priority || 0) - (a.priority || 0)
    );

    const results: PolicyExecutionResult[] = [];
    for (const policy of sortedPolicies) {
      const result_exec = await this.executePolicy(policy, result, metadata);
      results.push(result_exec);
    }

    return results;
  }

  /**
   * Load policies from configuration
   */
  static loadPoliciesFromConfig(config: any): AutomationPolicy[] {
    if (!config.automation || !Array.isArray(config.automation)) {
      return [];
    }

    return config.automation.map((policy: any) => ({
      name: policy.name,
      description: policy.description,
      enabled: policy.enabled !== false,
      trigger: policy.trigger || 'regression_detected',
      conditions: policy.conditions || [],
      actions: policy.actions || [],
      priority: policy.priority || 0,
      throttle: policy.throttle
    }));
  }
}

/**
 * Format policy execution results for display
 */
export function formatPolicyExecutionResults(results: PolicyExecutionResult[]): string {
  const lines: string[] = [];
  
  lines.push('Automation Policy Execution Results:');
  lines.push('');

  for (const result of results) {
    if (!result.triggered) {
      continue;
    }

    lines.push(`Policy: ${result.policy_name}`);
    lines.push(`  Conditions Met: ${result.conditions_met ? '✓' : '✗'}`);
    lines.push(`  Duration: ${result.duration_ms}ms`);

    if (result.actions_executed.length > 0) {
      lines.push('  Actions:');
      for (const action of result.actions_executed) {
        const status = action.success ? '✓' : '✗';
        lines.push(`    ${status} ${action.action_type}: ${action.message}`);
      }
    }

    if (result.error) {
      lines.push(`  Error: ${result.error.message}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}
