import { FlameGraphNode, ServiceMap } from './ITraceProvider';

/**
 * Generates D3.js visualization data for service maps and flame graphs
 */
export class VisualizationGenerator {
  /**
   * Generate D3 hierarchy data for flame graph
   */
  public generateFlameGraphD3Data(flameGraph: FlameGraphNode): any {
    return {
      name: flameGraph.name,
      value: flameGraph.value,
      percentage: flameGraph.percentage,
      file: flameGraph.file,
      line: flameGraph.line,
      children: flameGraph.children.map(child => this.generateFlameGraphD3Data(child)),
    };
  }

  /**
   * Generate D3 force-directed graph data for service map
   */
  public generateServiceMapD3Data(serviceMap: ServiceMap): {
    nodes: any[];
    links: any[];
  } {
    const nodes = serviceMap.services.map(service => ({
      id: service.name,
      name: service.name,
      requestCount: service.requestCount,
      errorCount: service.errorCount,
      avgDuration: service.avgDuration,
      p95Duration: service.p95Duration,
      p99Duration: service.p99Duration,
      health: service.health,
      errorRate: service.errorCount / service.requestCount,
    }));

    const links = serviceMap.dependencies.map(dep => ({
      source: dep.caller,
      target: dep.callee,
      requestCount: dep.requestCount,
      errorRate: dep.errorRate,
      avgDuration: dep.avgDuration,
      strength: Math.log10(dep.requestCount + 1) / 5, // Normalize for D3 force strength
    }));

    return { nodes, links };
  }

  /**
   * Generate HTML for flame graph visualization
   */
  public generateFlameGraphHTML(flameGraph: FlameGraphNode, title: string = 'Flame Graph'): string {
    const d3Data = this.generateFlameGraphD3Data(flameGraph);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #d4d4d4);
    }

    #container {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
    }

    .flame-rect {
      stroke: var(--vscode-panel-border, #454545);
      stroke-width: 0.5;
      cursor: pointer;
      transition: opacity 0.2s;
    }

    .flame-rect:hover {
      opacity: 0.8;
    }

    .flame-text {
      font-size: 12px;
      pointer-events: none;
      fill: var(--vscode-editor-foreground, #000);
    }

    #tooltip {
      position: absolute;
      padding: 8px 12px;
      background: var(--vscode-editorHoverWidget-background, rgba(0, 0, 0, 0.9));
      border: 1px solid var(--vscode-editorHoverWidget-border, #454545);
      border-radius: 4px;
      pointer-events: none;
      font-size: 12px;
      display: none;
      z-index: 1000;
    }

    #controls {
      position: absolute;
      top: 10px;
      right: 10px;
      background: var(--vscode-editorWidget-background, rgba(0, 0, 0, 0.8));
      padding: 10px;
      border-radius: 4px;
      border: 1px solid var(--vscode-widget-border, #454545);
    }

    button {
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #fff);
      border: none;
      padding: 6px 12px;
      cursor: pointer;
      border-radius: 2px;
      margin: 2px;
    }

    button:hover {
      background: var(--vscode-button-hoverBackground, #1177bb);
    }
  </style>
</head>
<body>
  <div id="container"></div>
  <div id="tooltip"></div>
  <div id="controls">
    <button onclick="resetZoom()">Reset Zoom</button>
    <button onclick="sortByTime()">Sort by Time</button>
    <button onclick="sortByName()">Sort by Name</button>
  </div>

  <script>
    const data = ${JSON.stringify(d3Data)};
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    const barHeight = 24;
    const barPadding = 2;
    
    let currentRoot = data;
    let sortOrder = 'time';

    const svg = d3.select('#container')
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const tooltip = d3.select('#tooltip');

    function getColor(percentage) {
      if (percentage > 20) return '#e74c3c'; // Red
      if (percentage > 10) return '#f39c12'; // Orange
      if (percentage > 5) return '#f1c40f';  // Yellow
      return '#3498db'; // Blue
    }

    function update(root) {
      currentRoot = root;
      
      const hierarchy = d3.hierarchy(root, d => d.children);
      const nodes = hierarchy.descendants();
      
      // Calculate positions
      let y = 0;
      const stack = [{ node: hierarchy, depth: 0, x: 0, width: width }];
      const positions = [];
      
      while (stack.length > 0) {
        const { node, depth, x, width: nodeWidth } = stack.pop();
        
        positions.push({
          node,
          x,
          y: depth * (barHeight + barPadding),
          width: nodeWidth,
          height: barHeight
        });
        
        if (node.children) {
          const totalValue = node.data.value;
          let childX = x;
          
          const sortedChildren = sortOrder === 'time' 
            ? [...node.children].sort((a, b) => b.data.value - a.data.value)
            : [...node.children].sort((a, b) => a.data.name.localeCompare(b.data.name));
          
          for (const child of sortedChildren) {
            const childWidth = (child.data.value / totalValue) * nodeWidth;
            stack.push({ node: child, depth: depth + 1, x: childX, width: childWidth });
            childX += childWidth;
          }
        }
      }
      
      // Update rects
      const rects = svg.selectAll('.flame-rect')
        .data(positions, d => d.node.data.name + d.x);
      
      rects.exit().remove();
      
      const rectsEnter = rects.enter()
        .append('rect')
        .attr('class', 'flame-rect');
      
      rectsEnter.merge(rects)
        .attr('x', d => d.x)
        .attr('y', d => d.y)
        .attr('width', d => Math.max(0, d.width))
        .attr('height', d => d.height)
        .attr('fill', d => getColor(d.node.data.percentage))
        .on('click', (event, d) => {
          if (d.node.children && d.node.children.length > 0) {
            update(d.node.data);
          }
        })
        .on('mouseover', (event, d) => {
          tooltip
            .style('display', 'block')
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY + 10) + 'px')
            .html(\`
              <strong>\${d.node.data.name}</strong><br>
              Duration: \${(d.node.data.value / 1000).toFixed(2)}ms<br>
              Percentage: \${d.node.data.percentage.toFixed(2)}%
              \${d.node.data.file ? '<br>File: ' + d.node.data.file + ':' + d.node.data.line : ''}
            \`);
        })
        .on('mouseout', () => {
          tooltip.style('display', 'none');
        });
      
      // Update text
      const texts = svg.selectAll('.flame-text')
        .data(positions.filter(d => d.width > 40), d => d.node.data.name + d.x);
      
      texts.exit().remove();
      
      const textsEnter = texts.enter()
        .append('text')
        .attr('class', 'flame-text');
      
      textsEnter.merge(texts)
        .attr('x', d => d.x + 4)
        .attr('y', d => d.y + barHeight / 2 + 4)
        .text(d => {
          const name = d.node.data.name;
          const maxChars = Math.floor(d.width / 7);
          return name.length > maxChars ? name.substring(0, maxChars) + '...' : name;
        });
    }

    function resetZoom() {
      update(data);
    }

    function sortByTime() {
      sortOrder = 'time';
      update(currentRoot);
    }

    function sortByName() {
      sortOrder = 'name';
      update(currentRoot);
    }

    update(data);
  </script>
</body>
</html>
    `;
  }

  /**
   * Generate HTML for service dependency map
   */
  public generateServiceMapHTML(serviceMap: ServiceMap, title: string = 'Service Dependency Map'): string {
    const d3Data = this.generateServiceMapD3Data(serviceMap);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #d4d4d4);
      overflow: hidden;
    }

    #container {
      width: 100vw;
      height: 100vh;
    }

    .node {
      cursor: move;
    }

    .node circle {
      stroke: var(--vscode-panel-border, #454545);
      stroke-width: 2;
    }

    .node text {
      font-size: 12px;
      pointer-events: none;
      text-anchor: middle;
      fill: var(--vscode-editor-foreground, #d4d4d4);
    }

    .link {
      fill: none;
      stroke: var(--vscode-editorLineNumber-foreground, #858585);
      stroke-opacity: 0.4;
      marker-end: url(#arrowhead);
    }

    .link:hover {
      stroke-opacity: 0.8;
    }

    #tooltip {
      position: absolute;
      padding: 8px 12px;
      background: var(--vscode-editorHoverWidget-background, rgba(0, 0, 0, 0.9));
      border: 1px solid var(--vscode-editorHoverWidget-border, #454545);
      border-radius: 4px;
      pointer-events: none;
      font-size: 12px;
      display: none;
      z-index: 1000;
    }

    #legend {
      position: absolute;
      top: 10px;
      left: 10px;
      background: var(--vscode-editorWidget-background, rgba(0, 0, 0, 0.8));
      padding: 10px;
      border-radius: 4px;
      border: 1px solid var(--vscode-widget-border, #454545);
    }

    .legend-item {
      display: flex;
      align-items: center;
      margin: 5px 0;
    }

    .legend-circle {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      margin-right: 8px;
    }
  </style>
</head>
<body>
  <div id="container"></div>
  <div id="tooltip"></div>
  <div id="legend">
    <div class="legend-item">
      <div class="legend-circle" style="background: #27ae60;"></div>
      <span>Healthy</span>
    </div>
    <div class="legend-item">
      <div class="legend-circle" style="background: #f39c12;"></div>
      <span>Degraded</span>
    </div>
    <div class="legend-item">
      <div class="legend-circle" style="background: #e74c3c;"></div>
      <span>Critical</span>
    </div>
  </div>

  <script>
    const data = ${JSON.stringify(d3Data)};
    
    const width = window.innerWidth;
    const height = window.innerHeight;

    const svg = d3.select('#container')
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    // Define arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#858585');

    const tooltip = d3.select('#tooltip');

    function getNodeColor(health) {
      switch (health) {
        case 'healthy': return '#27ae60';
        case 'degraded': return '#f39c12';
        case 'critical': return '#e74c3c';
        default: return '#3498db';
      }
    }

    function getNodeRadius(requestCount) {
      return Math.min(50, Math.max(15, Math.log10(requestCount + 1) * 10));
    }

    // Create force simulation
    const simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links).id(d => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => getNodeRadius(d.requestCount) + 10));

    // Draw links
    const link = svg.append('g')
      .selectAll('path')
      .data(data.links)
      .enter().append('path')
      .attr('class', 'link')
      .attr('stroke-width', d => Math.min(10, Math.log10(d.requestCount + 1)))
      .on('mouseover', (event, d) => {
        tooltip
          .style('display', 'block')
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY + 10) + 'px')
          .html(\`
            <strong>\${d.source.id} → \${d.target.id}</strong><br>
            Requests: \${d.requestCount}<br>
            Avg Duration: \${d.avgDuration.toFixed(2)}ms<br>
            Error Rate: \${(d.errorRate * 100).toFixed(2)}%
          \`);
      })
      .on('mouseout', () => {
        tooltip.style('display', 'none');
      });

    // Draw nodes
    const node = svg.append('g')
      .selectAll('g')
      .data(data.nodes)
      .enter().append('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    node.append('circle')
      .attr('r', d => getNodeRadius(d.requestCount))
      .attr('fill', d => getNodeColor(d.health));

    node.append('text')
      .attr('dy', '.35em')
      .text(d => d.name);

    node.on('mouseover', (event, d) => {
      tooltip
        .style('display', 'block')
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY + 10) + 'px')
        .html(\`
          <strong>\${d.name}</strong><br>
          Status: \${d.health}<br>
          Requests: \${d.requestCount}<br>
          Errors: \${d.errorCount} (\${(d.errorRate * 100).toFixed(2)}%)<br>
          Avg Duration: \${d.avgDuration.toFixed(2)}ms<br>
          P95 Duration: \${d.p95Duration.toFixed(2)}ms
        \`);
    })
    .on('mouseout', () => {
      tooltip.style('display', 'none');
    });

    simulation.on('tick', () => {
      link.attr('d', d => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy);
        return \`M\${d.source.x},\${d.source.y}A\${dr},\${dr} 0 0,1 \${d.target.x},\${d.target.y}\`;
      });

      node.attr('transform', d => \`translate(\${d.x},\${d.y})\`);
    });

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  </script>
</body>
</html>
    `;
  }
}
