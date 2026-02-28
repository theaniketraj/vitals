/**
 * VITALS Notification Integrations
 * 
 * Action executors for various notification channels (Slack, PagerDuty, Email, Webhook)
 */

import axios, { AxiosError } from 'axios';
import {
  ActionExecutor,
  AutomationAction,
  AutomationContext,
  ActionResult,
  ActionType
} from './policyEngine';
import { RegressionResult } from '../core/regression';
import { BatchResult } from '../core/batch';

/**
 * Slack notification executor
 */
export class SlackExecutor implements ActionExecutor {
  async execute(action: AutomationAction, context: AutomationContext): Promise<ActionResult> {
    try {
      const { webhook_url, channel, username, icon_emoji } = action.config;

      if (!webhook_url) {
        throw new Error('Slack webhook_url is required');
      }

      const message = this.formatSlackMessage(context, action.config);

      const payload = {
        channel,
        username: username || 'VITALS',
        icon_emoji: icon_emoji || ':chart_with_upwards_trend:',
        ...message
      };

      const response = await axios.post(webhook_url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      if (response.status === 200) {
        return {
          success: true,
          action_type: 'slack',
          message: 'Slack notification sent successfully',
          metadata: { channel, response_status: response.status }
        };
      } else {
        throw new Error(`Slack API returned status ${response.status}`);
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        action_type: 'slack',
        message: `Failed to send Slack notification: ${axiosError.message}`,
        error: axiosError
      };
    }
  }

  private formatSlackMessage(context: AutomationContext, config: any): any {
    const result = context.result;
    const customMessage = config.message || config.text;

    if (customMessage) {
      // Use custom message with variable substitution
      const message = this.substituteVariables(customMessage, context);
      return { text: message };
    }

    // Auto-generate message based on result
    if ('verdict' in result) {
      return this.formatSingleRegressionMessage(result as RegressionResult, context.timestamp);
    } else {
      return this.formatBatchResultMessage(result as BatchResult, context.timestamp);
    }
  }

  private formatSingleRegressionMessage(result: RegressionResult, timestamp: Date): any {
    const icon = result.verdict === 'FAIL' ? ':x:' : 
                 result.verdict === 'WARN' ? ':warning:' : ':white_check_mark:';
    
    const color = result.verdict === 'FAIL' ? 'danger' :
                  result.verdict === 'WARN' ? 'warning' : 'good';

    return {
      text: `${icon} VITALS Regression Detection`,
      attachments: [{
        color,
        fields: [
          { title: 'Metric', value: result.metric, short: true },
          { title: 'Verdict', value: result.verdict, short: true },
          { title: 'Change', value: result.change_percent ? `${result.change_percent.toFixed(2)}%` : 'N/A', short: true },
          { title: 'p-value', value: result.p_value?.toFixed(4) || 'N/A', short: true },
          {
            title: 'Baseline Mean',
            value: result.baseline.mean?.toFixed(2) || 'N/A',
            short: true
          },
          {
            title: 'Candidate Mean',
            value: result.candidate.mean?.toFixed(2) || 'N/A',
            short: true
          }
        ],
        footer: 'VITALS Performance Monitoring',
        ts: Math.floor(timestamp.getTime() / 1000)
      }]
    };
  }

  private formatBatchResultMessage(result: BatchResult, timestamp: Date): any {
    const icon = result.summary.failed > 0 ? ':x:' : 
                 result.summary.warned > 0 ? ':warning:' : ':white_check_mark:';
    
    const color = result.summary.failed > 0 ? 'danger' :
                  result.summary.warned > 0 ? 'warning' : 'good';

    const summary = `${result.summary.passed} passed, ${result.summary.failed} failed, ${result.summary.warned} warned`;

    return {
      text: `${icon} VITALS Batch Regression Results`,
      attachments: [{
        color,
        fields: [
          { title: 'Summary', value: summary, short: false },
          { title: 'Total Metrics', value: result.summary.total.toString(), short: true },
          { title: 'Duration', value: `${result.executionTime}ms`, short: true }
        ],
        footer: 'VITALS Performance Monitoring',
        ts: Math.floor(timestamp.getTime() / 1000)
      }]
    };
  }

  private substituteVariables(template: string, context: AutomationContext): string {
    let message = template;
    
    // Replace common variables
    message = message.replace(/\{\{policy\.name\}\}/g, context.policy.name);
    message = message.replace(/\{\{timestamp\}\}/g, context.timestamp.toISOString());
    
    // Replace result fields
    if ('verdict' in context.result) {
      const result = context.result as RegressionResult;
      message = message.replace(/\{\{result\.verdict\}\}/g, result.verdict);
      message = message.replace(/\{\{result\.metric\}\}/g, result.metric);
      if (result.change_percent !== undefined) {
        message = message.replace(/\{\{result\.change_percent\}\}/g, result.change_percent.toFixed(2));
      }
    }

    return message;
  }
}

/**
 * PagerDuty incident executor
 */
export class PagerDutyExecutor implements ActionExecutor {
  async execute(action: AutomationAction, context: AutomationContext): Promise<ActionResult> {
    try {
      const { integration_key, severity, dedup_key } = action.config;

      if (!integration_key) {
        throw new Error('PagerDuty integration_key is required');
      }

      const event = this.createPagerDutyEvent(context, action.config);

      const payload = {
        routing_key: integration_key,
        event_action: 'trigger',
        dedup_key: dedup_key || `vitals-${Date.now()}`,
        payload: {
          summary: event.summary,
          severity: severity || 'error',
          source: 'VITALS',
          timestamp: context.timestamp.toISOString(),
          custom_details: event.custom_details
        }
      };

      const response = await axios.post(
        'https://events.pagerduty.com/v2/enqueue',
        payload,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );

      if (response.status === 202) {
        return {
          success: true,
          action_type: 'pagerduty',
          message: 'PagerDuty incident created successfully',
          metadata: { 
            dedup_key: response.data.dedup_key,
            status: response.data.status
          }
        };
      } else {
        throw new Error(`PagerDuty API returned status ${response.status}`);
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        action_type: 'pagerduty',
        message: `Failed to create PagerDuty incident: ${axiosError.message}`,
        error: axiosError
      };
    }
  }

  private createPagerDutyEvent(context: AutomationContext, config: any): any {
    const result = context.result;

    if ('verdict' in result) {
      const regression = result as RegressionResult;
      return {
        summary: `Performance regression detected: ${regression.metric}`,
        custom_details: {
          metric: regression.metric,
          verdict: regression.verdict,
          change_percent: regression.change_percent,
          p_value: regression.p_value,
          baseline_mean: regression.baseline.mean,
          candidate_mean: regression.candidate.mean,
          policy: context.policy.name
        }
      };
    } else {
      const batch = result as BatchResult;
      return {
        summary: `Batch regression detected: ${batch.summary.failed} metrics failed`,
        custom_details: {
          total: batch.summary.total,
          passed: batch.summary.passed,
          failed: batch.summary.failed,
          warned: batch.summary.warned,
          duration_ms: batch.executionTime,
          policy: context.policy.name
        }
      };
    }
  }
}

/**
 * Generic webhook executor
 */
export class WebhookExecutor implements ActionExecutor {
  async execute(action: AutomationAction, context: AutomationContext): Promise<ActionResult> {
    try {
      const { url, method, headers, body_template } = action.config;

      if (!url) {
        throw new Error('Webhook url is required');
      }

      const requestMethod = method || 'POST';
      const requestHeaders = headers || { 'Content-Type': 'application/json' };

      let requestBody: any;
      if (body_template) {
        // Use custom body template
        requestBody = this.substituteVariables(body_template, context);
      } else {
        // Default: send full context
        requestBody = {
          policy: context.policy.name,
          timestamp: context.timestamp.toISOString(),
          result: context.result,
          metadata: context.metadata
        };
      }

      const response = await axios({
        method: requestMethod,
        url,
        headers: requestHeaders,
        data: requestBody,
        timeout: 30000
      });

      return {
        success: response.status >= 200 && response.status < 300,
        action_type: 'webhook',
        message: `Webhook called successfully: ${response.status}`,
        metadata: {
          url,
          method: requestMethod,
          status: response.status,
          response_data: response.data
        }
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        action_type: 'webhook',
        message: `Webhook call failed: ${axiosError.message}`,
        error: axiosError
      };
    }
  }

  private substituteVariables(template: any, context: AutomationContext): any {
    const templateStr = JSON.stringify(template);
    const substituted = templateStr
      .replace(/\{\{policy\.name\}\}/g, context.policy.name)
      .replace(/\{\{timestamp\}\}/g, context.timestamp.toISOString());
    
    return JSON.parse(substituted);
  }
}

/**
 * Email notification executor
 */
export class EmailExecutor implements ActionExecutor {
  async execute(action: AutomationAction, context: AutomationContext): Promise<ActionResult> {
    try {
      const { smtp_host, smtp_port, smtp_user, smtp_pass, from, to, subject, body_template } = action.config;

      // For now, we'll use a webhook-based approach or SMTP library
      // This is a placeholder implementation
      
      const emailContent = this.formatEmailContent(context, body_template);

      // In production, use nodemailer or similar
      // For now, return success with metadata
      return {
        success: true,
        action_type: 'email',
        message: `Email notification prepared (not sent - requires SMTP configuration)`,
        metadata: {
          from,
          to,
          subject: subject || 'VITALS Regression Alert',
          content_length: emailContent.length
        }
      };
    } catch (error) {
      return {
        success: false,
        action_type: 'email',
        message: `Failed to send email: ${error}`,
        error: error as Error
      };
    }
  }

  private formatEmailContent(context: AutomationContext, template?: string): string {
    if (template) {
      return this.substituteVariables(template, context);
    }

    // Default email template
    const result = context.result;
    let content = `VITALS Performance Regression Alert\n\n`;
    content += `Policy: ${context.policy.name}\n`;
    content += `Timestamp: ${context.timestamp.toISOString()}\n\n`;

    if ('verdict' in result) {
      const regression = result as RegressionResult;
      content += `Metric: ${regression.metric}\n`;
      content += `Verdict: ${regression.verdict}\n`;
      content += `Change: ${regression.change_percent?.toFixed(2)}%\n`;
      content += `p-value: ${regression.p_value?.toFixed(4)}\n`;
    } else {
      const batch = result as BatchResult;
      content += `Total Metrics: ${batch.summary.total}\n`;
      content += `Passed: ${batch.summary.passed}\n`;
      content += `Failed: ${batch.summary.failed}\n`;
      content += `Warned: ${batch.summary.warned}\n`;
    }

    return content;
  }

  private substituteVariables(template: string, context: AutomationContext): string {
    let content = template;
    content = content.replace(/\{\{policy\.name\}\}/g, context.policy.name);
    content = content.replace(/\{\{timestamp\}\}/g, context.timestamp.toISOString());
    return content;
  }
}

/**
 * Rollback action executor
 */
export class RollbackExecutor implements ActionExecutor {
  async execute(action: AutomationAction, context: AutomationContext): Promise<ActionResult> {
    try {
      const { type, target, webhook_url, command } = action.config;

      if (!type) {
        throw new Error('Rollback type is required (e.g., "canary", "deployment", "feature_flag")');
      }

      // Execute rollback based on type
      if (webhook_url) {
        // Trigger rollback via webhook
        const response = await axios.post(webhook_url, {
          action: 'rollback',
          type,
          target,
          reason: 'VITALS regression detected',
          policy: context.policy.name,
          result: context.result
        }, {
          timeout: 30000
        });

        return {
          success: response.status >= 200 && response.status < 300,
          action_type: 'rollback',
          message: `Rollback triggered successfully: ${type}`,
          metadata: {
            type,
            target,
            response_status: response.status
          }
        };
      } else if (command) {
        // Execute rollback command
        // This would require spawning a child process
        // For safety, we'll just log this for now
        return {
          success: true,
          action_type: 'rollback',
          message: `Rollback command prepared: ${command} (not executed - configure webhook_url)`,
          metadata: { type, target, command }
        };
      } else {
        throw new Error('Either webhook_url or command must be provided for rollback');
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        action_type: 'rollback',
        message: `Rollback failed: ${axiosError.message}`,
        error: axiosError
      };
    }
  }
}

/**
 * Script executor for custom actions
 */
export class ScriptExecutor implements ActionExecutor {
  async execute(action: AutomationAction, context: AutomationContext): Promise<ActionResult> {
    try {
      const { command, args, env, timeout } = action.config;

      if (!command) {
        throw new Error('Script command is required');
      }

      // For security, scripts are not executed directly
      // Instead, we prepare the execution context
      return {
        success: true,
        action_type: 'script',
        message: `Script prepared: ${command} (not executed for security - use webhook instead)`,
        metadata: {
          command,
          args,
          env,
          timeout: timeout || 30000
        }
      };
    } catch (error) {
      return {
        success: false,
        action_type: 'script',
        message: `Script execution failed: ${error}`,
        error: error as Error
      };
    }
  }
}

/**
 * Register all default executors
 */
export function registerDefaultExecutors(engine: any): void {
  engine.registerExecutor('slack', new SlackExecutor());
  engine.registerExecutor('pagerduty', new PagerDutyExecutor());
  engine.registerExecutor('webhook', new WebhookExecutor());
  engine.registerExecutor('email', new EmailExecutor());
  engine.registerExecutor('rollback', new RollbackExecutor());
  engine.registerExecutor('script', new ScriptExecutor());
}
