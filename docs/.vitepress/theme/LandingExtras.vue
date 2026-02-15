<template>
  <div class="landing-extras">
    <!-- Why Vitals Section -->
    <section class="why-section">
      <div class="badge">Why Vitals?</div>
      <h2>Stop Paying the Context Switch Tax</h2>
      <p class="subtitle">
        Every Alt+Tab to check metrics breaks your flow. Vitals brings
        production insights to where you write code.
      </p>

      <div class="benefits-grid">
        <div class="benefit-card">
          <div class="benefit-icon gradient-blue">⚡</div>
          <h3>Debug Faster</h3>
          <p>
            See real-time latency and error rates right in CodeLens. Fix issues
            before they escalate.
          </p>
        </div>
        <div class="benefit-card">
          <div class="benefit-icon gradient-purple">🔒</div>
          <h3>Private & Secure</h3>
          <p>
            Direct connection to your infrastructure. No data leaves your
            network. Zero compliance risk.
          </p>
        </div>
        <div class="benefit-card">
          <div class="benefit-icon gradient-green">🚀</div>
          <h3>Ship Confidently</h3>
          <p>
            Automated regression detection on every deploy. Statistical analysis
            tells you when to rollback.
          </p>
        </div>
      </div>
    </section>

    <!-- Split Content Section -->
    <section class="split-section">
      <div class="split-content">
        <div class="split-text">
          <div class="badge">Real-Time Metrics</div>
          <h2>Live Dashboard in Your Editor</h2>
          <p>
            Query Prometheus with custom PromQL. Visualize CPU, memory, request
            rates—all without leaving VS Code.
          </p>
          <ul class="feature-list">
            <li><i class="check">✓</i> Auto-refresh every 5s</li>
            <li><i class="check">✓</i> Custom metric templates</li>
            <li><i class="check">✓</i> Historical trend analysis</li>
          </ul>
        </div>
        <div class="split-visual">
          <div class="demo-card">
            <div class="card-header">
              <span class="dot red"></span>
              <span class="dot yellow"></span>
              <span class="dot green"></span>
              <span class="card-title">Vitals Dashboard</span>
            </div>
            <div class="card-body">
              <div class="metric-row">
                <span class="metric-label">CPU Usage</span>
                <div class="metric-bar">
                  <div
                    class="bar-fill"
                    style="width: 45%; background: #3b82f6"
                  ></div>
                </div>
                <span class="metric-value">45%</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">Memory</span>
                <div class="metric-bar">
                  <div
                    class="bar-fill"
                    style="width: 72%; background: #f59e0b"
                  ></div>
                </div>
                <span class="metric-value">72%</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">Error Rate</span>
                <div class="metric-bar">
                  <div
                    class="bar-fill"
                    style="width: 3%; background: #10b981"
                  ></div>
                </div>
                <span class="metric-value">0.1%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Pricing Section -->
    <section class="pricing-section">
      <div class="pricing-header">
        <h2>Simple, Transparent Pricing</h2>
        <p>Start monitoring for free. Scale when you need to.</p>
      </div>

      <div class="pricing-grid">
        <div class="price-card">
          <h3>Community</h3>
          <div class="price">
            <span class="amount">$0</span>
            <span class="period">/month</span>
          </div>
          <ul class="features">
            <li><i class="icon-check">✓</i> Unlimited Metrics & Logs</li>
            <li><i class="icon-check">✓</i> Basic Dashboards</li>
            <li><i class="icon-check">✓</i> Community Support</li>
          </ul>
          <a href="/getting_started" class="btn btn-secondary">Get Started</a>
        </div>

        <div class="price-card featured">
          <div class="popular-badge">Most Popular</div>
          <h3>Pro</h3>
          <div class="price">
            <span class="amount">$15</span>
            <span class="period">/user/mo</span>
          </div>
          <ul class="features">
            <li><i class="icon-check">✓</i> Everything in Community</li>
            <li><i class="icon-check">✓</i> Collaborative Incidents</li>
            <li><i class="icon-check">✓</i> CI/CD Regression Analysis</li>
            <li><i class="icon-check">✓</i> AI Post-Mortems</li>
          </ul>
          <a href="#" class="btn btn-primary">Start Free Trial</a>
        </div>

        <div class="price-card">
          <h3>Enterprise</h3>
          <div class="price">
            <span class="amount">Custom</span>
          </div>
          <ul class="features">
            <li><i class="icon-check">✓</i> Everything in Pro</li>
            <li><i class="icon-check">✓</i> SSO & SAML</li>
            <li><i class="icon-check">✓</i> Priority Support</li>
            <li><i class="icon-check">✓</i> On-Premise Options</li>
          </ul>
          <a href="mailto:contact@vitals.dev" class="btn btn-secondary"
            >Contact Sales</a
          >
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta-section">
      <h2>Ready to Transform Your Workflow?</h2>
      <p>Join developers who've eliminated context switching forever.</p>
      <div class="cta-buttons">
        <a
          href="https://marketplace.visualstudio.com/items?itemName=theaniketraj.vitals"
          class="btn btn-primary btn-large"
        >
          Install Now — It's Free
        </a>
        <a href="/getting_started" class="btn btn-secondary btn-large">
          Read Documentation
        </a>
      </div>
    </section>
  </div>
</template>

<style scoped>
.landing-extras {
  max-width: 1152px;
  margin: 0 auto;
  padding: 60px 24px;
}

/* Trusted By Section */
.trusted-section {
  text-align: center;
  padding: 60px 0;
  border-bottom: 1px solid var(--vp-c-divider);
}

.section-label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--vp-c-text-3);
  margin-bottom: 32px;
}

.tech-logos {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 40px;
}

.tech-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  opacity: 0.7;
  transition: all 0.3s ease;
}

.tech-item:hover {
  opacity: 1;
  transform: translateY(-4px);
}

.tech-item .icon {
  font-size: 2rem;
}

.tech-item span {
  font-weight: 600;
  color: var(--vp-c-text-2);
}

/* Why Section */
.why-section {
  text-align: center;
  padding: 80px 0;
}

.badge {
  display: inline-block;
  padding: 6px 16px;
  border-radius: 20px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand);
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 16px;
}

.why-section h2 {
  font-size: 2.5rem;
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 16px;
}

.subtitle {
  font-size: 1.25rem;
  color: var(--vp-c-text-2);
  max-width: 700px;
  margin: 0 auto 48px;
}

.benefits-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 32px;
  margin-top: 48px;
}

.benefit-card {
  background: var(--vp-c-bg-soft);
  padding: 32px;
  border-radius: 16px;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.benefit-card:hover {
  transform: translateY(-8px);
  border-color: var(--vp-c-brand);
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.1);
}

.benefit-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
  margin: 0 auto 20px;
}

.gradient-blue {
  background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
}

.gradient-purple {
  background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
}

.gradient-green {
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
}

.benefit-card h3 {
  font-size: 1.5rem;
  margin-bottom: 12px;
}

.benefit-card p {
  color: var(--vp-c-text-2);
  line-height: 1.6;
}

/* Split Section */
.split-section {
  padding: 80px 0;
}

.split-content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 48px;
  align-items: center;
}

@media (min-width: 960px) {
  .split-content {
    grid-template-columns: 1fr 1fr;
  }
}

.split-text h2 {
  font-size: 2rem;
  font-weight: 700;
  margin: 16px 0;
}

.feature-list {
  list-style: none;
  padding: 0;
  margin: 24px 0;
}

.feature-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 1.1rem;
}

.check {
  color: var(--vp-c-brand);
  font-weight: bold;
}

/* Demo Card */
.demo-card {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.demo-card:hover {
  transform: translateY(-4px);
}

.card-header {
  background: var(--vp-c-bg-mute);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.dot.red {
  background: #ef4444;
}
.dot.yellow {
  background: #f59e0b;
}
.dot.green {
  background: #10b981;
}

.card-title {
  margin-left: auto;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}

.card-body {
  padding: 24px;
}

.metric-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.metric-row:last-child {
  margin-bottom: 0;
}

.metric-label {
  min-width: 100px;
  font-weight: 600;
  font-size: 0.9rem;
}

.metric-bar {
  flex: 1;
  height: 8px;
  background: var(--vp-c-bg-mute);
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.metric-value {
  min-width: 50px;
  text-align: right;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

/* Pricing Section */
.pricing-section {
  padding: 80px 0;
  background: var(--vp-c-bg-soft);
  margin: 80px -24px;
  padding-left: 24px;
  padding-right: 24px;
}

.pricing-header {
  text-align: center;
  margin-bottom: 56px;
}

.pricing-header h2 {
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 16px;
}

.pricing-header p {
  font-size: 1.25rem;
  color: var(--vp-c-text-2);
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 32px;
  max-width: 1000px;
  margin: 0 auto;
}

.price-card {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  padding: 32px;
  position: relative;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
}

.price-card:hover {
  transform: translateY(-8px);
  border-color: var(--vp-c-brand);
  box-shadow: 0 20px 40px -10px rgba(59, 130, 246, 0.2);
}

.price-card.featured {
  border: 2px solid var(--vp-c-brand);
  box-shadow: 0 10px 30px -5px rgba(59, 130, 246, 0.3);
}

.popular-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--vp-c-brand);
  color: white;
  padding: 4px 16px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.price-card h3 {
  font-size: 1.5rem;
  margin-bottom: 16px;
}

.price {
  margin-bottom: 24px;
}

.price .amount {
  font-size: 3rem;
  font-weight: 800;
  color: var(--vp-c-text-1);
}

.price .period {
  font-size: 1rem;
  color: var(--vp-c-text-2);
}

.features {
  list-style: none;
  padding: 0;
  margin: 0 0 32px 0;
  flex: 1;
}

.features li {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: var(--vp-c-text-2);
}

.icon-check {
  color: var(--vp-c-brand);
  font-weight: bold;
}

/* Buttons */
.btn {
  display: block;
  text-align: center;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s ease;
}

.btn-primary {
  background: var(--vp-c-brand);
  color: white;
}

.btn-primary:hover {
  background: var(--vp-c-brand-dark);
  transform: translateY(-2px);
}

.btn-secondary {
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
}

.btn-secondary:hover {
  background: var(--vp-c-bg-soft);
  border-color: var(--vp-c-brand);
}

.btn-large {
  padding: 16px 32px;
  font-size: 1.1rem;
}

/* CTA Section */
.cta-section {
  text-align: center;
  padding: 80px 0;
}

.cta-section h2 {
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 16px;
}

.cta-section p {
  font-size: 1.25rem;
  color: var(--vp-c-text-2);
  margin-bottom: 40px;
}

.cta-buttons {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .cta-buttons {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
