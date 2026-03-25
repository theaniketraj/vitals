"use strict";
/**
 * VITALS Incident Knowledge Graph
 *
 * Graph-based storage for incidents, their relationships, and context.
 * Enables root cause analysis and incident correlation.
 */
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
exports.IncidentKnowledgeGraph = void 0;
exports.createIncidentNode = createIncidentNode;
exports.linkIncidentToDeployment = linkIncidentToDeployment;
exports.linkIncidentToRegression = linkIncidentToRegression;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util_1 = require("util");
const writeFile = (0, util_1.promisify)(fs.writeFile);
const readFile = (0, util_1.promisify)(fs.readFile);
const mkdir = (0, util_1.promisify)(fs.mkdir);
/**
 * Incident Knowledge Graph
 *
 * Uses an adjacency list representation for efficient traversal.
 * For production, consider using Neo4j, ArangoDB, or Neptune.
 */
class IncidentKnowledgeGraph {
    constructor(basePath = '~/.vitals/knowledge-graph') {
        this.loaded = false;
        // Expand home directory
        if (basePath.startsWith('~')) {
            const homeDir = process.env.HOME || process.env.USERPROFILE || '';
            basePath = path.join(homeDir, basePath.slice(2));
        }
        this.basePath = basePath;
        this.nodes = new Map();
        this.edges = new Map();
        this.adjacencyList = new Map();
        this.reverseAdjacencyList = new Map();
    }
    /**
     * Initialize the graph
     */
    async initialize() {
        await mkdir(this.basePath, { recursive: true });
        await this.load();
        this.loaded = true;
    }
    /**
     * Add a node to the graph
     */
    async addNode(node) {
        await this.ensureLoaded();
        const now = new Date();
        const fullNode = {
            ...node,
            created_at: now,
            updated_at: now
        };
        this.nodes.set(node.id, fullNode);
        if (!this.adjacencyList.has(node.id)) {
            this.adjacencyList.set(node.id, new Set());
        }
        if (!this.reverseAdjacencyList.has(node.id)) {
            this.reverseAdjacencyList.set(node.id, new Set());
        }
        await this.save();
        return node.id;
    }
    /**
     * Add an edge to the graph
     */
    async addEdge(edge) {
        await this.ensureLoaded();
        // Validate nodes exist
        if (!this.nodes.has(edge.from_node)) {
            throw new Error(`Source node not found: ${edge.from_node}`);
        }
        if (!this.nodes.has(edge.to_node)) {
            throw new Error(`Target node not found: ${edge.to_node}`);
        }
        const fullEdge = {
            ...edge,
            created_at: new Date()
        };
        this.edges.set(edge.id, fullEdge);
        // Update adjacency lists
        this.adjacencyList.get(edge.from_node).add(edge.id);
        this.reverseAdjacencyList.get(edge.to_node).add(edge.id);
        await this.save();
        return edge.id;
    }
    /**
     * Get a node by ID
     */
    async getNode(nodeId) {
        await this.ensureLoaded();
        return this.nodes.get(nodeId) || null;
    }
    /**
     * Get an edge by ID
     */
    async getEdge(edgeId) {
        await this.ensureLoaded();
        return this.edges.get(edgeId) || null;
    }
    /**
     * Find nodes by type
     */
    async findNodesByType(type) {
        await this.ensureLoaded();
        return Array.from(this.nodes.values()).filter(n => n.type === type);
    }
    /**
     * Find edges by type
     */
    async findEdgesByType(type) {
        await this.ensureLoaded();
        return Array.from(this.edges.values()).filter(e => e.type === type);
    }
    /**
     * Get outgoing edges from a node
     */
    async getOutgoingEdges(nodeId) {
        await this.ensureLoaded();
        const edgeIds = this.adjacencyList.get(nodeId);
        if (!edgeIds)
            return [];
        return Array.from(edgeIds)
            .map(id => this.edges.get(id))
            .filter((e) => e !== undefined);
    }
    /**
     * Get incoming edges to a node
     */
    async getIncomingEdges(nodeId) {
        await this.ensureLoaded();
        const edgeIds = this.reverseAdjacencyList.get(nodeId);
        if (!edgeIds)
            return [];
        return Array.from(edgeIds)
            .map(id => this.edges.get(id))
            .filter((e) => e !== undefined);
    }
    /**
     * Find shortest path between two nodes
     */
    async findPath(fromNodeId, toNodeId, maxDepth = 5) {
        await this.ensureLoaded();
        if (!this.nodes.has(fromNodeId) || !this.nodes.has(toNodeId)) {
            return null;
        }
        // BFS to find shortest path
        const queue = [
            { nodeId: fromNodeId, path: [fromNodeId], edges: [] }
        ];
        const visited = new Set([fromNodeId]);
        while (queue.length > 0) {
            const { nodeId, path, edges: edgePath } = queue.shift();
            if (path.length > maxDepth)
                continue;
            if (nodeId === toNodeId) {
                // Found path
                const nodes = path.map(id => this.nodes.get(id));
                const edges = edgePath.map(id => this.edges.get(id));
                const totalWeight = edges.reduce((sum, e) => sum + (e.weight || 1), 0);
                return {
                    nodes,
                    edges,
                    path_length: path.length - 1,
                    total_weight: totalWeight
                };
            }
            // Explore neighbors
            const outgoing = await this.getOutgoingEdges(nodeId);
            for (const edge of outgoing) {
                if (!visited.has(edge.to_node)) {
                    visited.add(edge.to_node);
                    queue.push({
                        nodeId: edge.to_node,
                        path: [...path, edge.to_node],
                        edges: [...edgePath, edge.id]
                    });
                }
            }
        }
        return null;
    }
    /**
     * Find all related incidents
     */
    async findRelatedIncidents(incidentId, maxDepth = 2) {
        await this.ensureLoaded();
        const incident = this.nodes.get(incidentId);
        if (!incident || incident.type !== 'incident') {
            return [];
        }
        const related = new Set();
        const queue = [{ nodeId: incidentId, depth: 0 }];
        const visited = new Set([incidentId]);
        while (queue.length > 0) {
            const { nodeId, depth } = queue.shift();
            if (depth >= maxDepth)
                continue;
            // Get all connected nodes
            const outgoing = await this.getOutgoingEdges(nodeId);
            const incoming = await this.getIncomingEdges(nodeId);
            for (const edge of [...outgoing, ...incoming]) {
                const connectedNodeId = edge.from_node === nodeId ? edge.to_node : edge.from_node;
                if (!visited.has(connectedNodeId)) {
                    visited.add(connectedNodeId);
                    const connectedNode = this.nodes.get(connectedNodeId);
                    if (connectedNode) {
                        if (connectedNode.type === 'incident' && connectedNodeId !== incidentId) {
                            related.add(connectedNodeId);
                        }
                        queue.push({ nodeId: connectedNodeId, depth: depth + 1 });
                    }
                }
            }
        }
        return Array.from(related).map(id => this.nodes.get(id));
    }
    /**
     * Analyze correlations between incidents
     */
    async analyzeCorrelations(incidentId) {
        await this.ensureLoaded();
        const incident = this.nodes.get(incidentId);
        if (!incident || incident.type !== 'incident') {
            throw new Error(`Incident not found: ${incidentId}`);
        }
        const relatedIncidents = await this.findRelatedIncidents(incidentId, 3);
        const correlatedIncidents = [];
        for (const related of relatedIncidents) {
            // Calculate correlation score
            const commonFactors = await this.findCommonFactors(incidentId, related.id);
            const correlationScore = commonFactors.length / 10; // Normalize
            // Calculate time proximity
            const incidentTime = incident.properties.started_at;
            const relatedTime = related.properties.started_at;
            const timeProximity = incidentTime && relatedTime
                ? Math.abs(new Date(incidentTime).getTime() - new Date(relatedTime).getTime()) / (60 * 1000)
                : undefined;
            correlatedIncidents.push({
                incident_id: related.id,
                correlation_score: Math.min(1, correlationScore),
                common_factors: commonFactors,
                time_proximity_minutes: timeProximity
            });
        }
        // Sort by correlation score
        correlatedIncidents.sort((a, b) => b.correlation_score - a.correlation_score);
        return {
            incident_id: incidentId,
            correlated_incidents: correlatedIncidents
        };
    }
    /**
     * Perform root cause analysis
     */
    async analyzeRootCause(incidentId) {
        await this.ensureLoaded();
        const incident = this.nodes.get(incidentId);
        if (!incident || incident.type !== 'incident') {
            throw new Error(`Incident not found: ${incidentId}`);
        }
        const likelyCauses = [];
        const contributingFactors = [];
        // Find nodes that caused this incident
        const incoming = await this.getIncomingEdges(incidentId);
        const causedByEdges = incoming.filter(e => e.type === 'caused_by' || e.type === 'triggered_by');
        for (const edge of causedByEdges) {
            const causeNode = this.nodes.get(edge.from_node);
            if (!causeNode)
                continue;
            const evidence = [];
            // Gather evidence from node properties
            if (causeNode.type === 'deployment') {
                evidence.push(`Deployment ${causeNode.properties.deployment_id} preceded incident`);
            }
            else if (causeNode.type === 'regression') {
                evidence.push(`Performance regression detected: ${causeNode.properties.metric}`);
                evidence.push(`Change: ${causeNode.properties.change_percent}%`);
            }
            else if (causeNode.type === 'metric_anomaly') {
                evidence.push(`Metric anomaly: ${causeNode.properties.metric}`);
            }
            likelyCauses.push({
                node_id: causeNode.id,
                node_type: causeNode.type,
                description: causeNode.label,
                confidence: edge.weight || 0.5,
                evidence
            });
        }
        // Analyze contributing factors
        const factorCounts = new Map();
        // Count related node types
        const outgoing = await this.getOutgoingEdges(incidentId);
        for (const edge of [...incoming, ...outgoing]) {
            const nodeId = edge.from_node === incidentId ? edge.to_node : edge.from_node;
            const node = this.nodes.get(nodeId);
            if (node) {
                factorCounts.set(node.type, (factorCounts.get(node.type) || 0) + 1);
            }
        }
        for (const [factor, count] of factorCounts) {
            contributingFactors.push({
                factor,
                weight: Math.min(1, count / 5)
            });
        }
        // Sort causes by confidence
        likelyCauses.sort((a, b) => b.confidence - a.confidence);
        // Generate recommendation
        let recommendation = 'Review incident timeline and related changes.';
        if (likelyCauses.length > 0) {
            const topCause = likelyCauses[0];
            if (topCause.node_type === 'deployment') {
                recommendation = 'Consider rolling back the recent deployment.';
            }
            else if (topCause.node_type === 'regression') {
                recommendation = 'Investigate performance regression in recent changes.';
            }
            else if (topCause.node_type === 'metric_anomaly') {
                recommendation = 'Investigate the anomalous metric behavior.';
            }
        }
        return {
            incident_id: incidentId,
            likely_causes: likelyCauses,
            contributing_factors: contributingFactors,
            recommendation
        };
    }
    /**
     * Update node properties
     */
    async updateNode(nodeId, properties) {
        await this.ensureLoaded();
        const node = this.nodes.get(nodeId);
        if (!node) {
            throw new Error(`Node not found: ${nodeId}`);
        }
        Object.assign(node, properties);
        node.updated_at = new Date();
        await this.save();
    }
    /**
     * Delete a node and its edges
     */
    async deleteNode(nodeId) {
        await this.ensureLoaded();
        // Delete all edges connected to this node
        const outgoing = await this.getOutgoingEdges(nodeId);
        const incoming = await this.getIncomingEdges(nodeId);
        for (const edge of [...outgoing, ...incoming]) {
            this.edges.delete(edge.id);
        }
        // Delete node
        this.nodes.delete(nodeId);
        this.adjacencyList.delete(nodeId);
        this.reverseAdjacencyList.delete(nodeId);
        await this.save();
    }
    // Private helper methods
    async ensureLoaded() {
        if (!this.loaded) {
            await this.initialize();
        }
    }
    async load() {
        const nodesPath = path.join(this.basePath, 'nodes.json');
        const edgesPath = path.join(this.basePath, 'edges.json');
        try {
            // Load nodes
            const nodesData = await readFile(nodesPath, 'utf8');
            const nodes = JSON.parse(nodesData);
            this.nodes.clear();
            this.adjacencyList.clear();
            this.reverseAdjacencyList.clear();
            for (const node of nodes) {
                node.created_at = new Date(node.created_at);
                node.updated_at = new Date(node.updated_at);
                this.nodes.set(node.id, node);
                this.adjacencyList.set(node.id, new Set());
                this.reverseAdjacencyList.set(node.id, new Set());
            }
            // Load edges
            const edgesData = await readFile(edgesPath, 'utf8');
            const edges = JSON.parse(edgesData);
            this.edges.clear();
            for (const edge of edges) {
                edge.created_at = new Date(edge.created_at);
                this.edges.set(edge.id, edge);
                if (this.adjacencyList.has(edge.from_node)) {
                    this.adjacencyList.get(edge.from_node).add(edge.id);
                }
                if (this.reverseAdjacencyList.has(edge.to_node)) {
                    this.reverseAdjacencyList.get(edge.to_node).add(edge.id);
                }
            }
        }
        catch (error) {
            // Files don't exist yet, start fresh
        }
    }
    async save() {
        const nodesPath = path.join(this.basePath, 'nodes.json');
        const edgesPath = path.join(this.basePath, 'edges.json');
        const nodes = Array.from(this.nodes.values());
        const edges = Array.from(this.edges.values());
        await writeFile(nodesPath, JSON.stringify(nodes, null, 2), 'utf8');
        await writeFile(edgesPath, JSON.stringify(edges, null, 2), 'utf8');
    }
    async findCommonFactors(incident1Id, incident2Id) {
        const factors1 = new Set();
        const factors2 = new Set();
        // Get connected nodes for both incidents
        const edges1 = [...await this.getOutgoingEdges(incident1Id), ...await this.getIncomingEdges(incident1Id)];
        const edges2 = [...await this.getOutgoingEdges(incident2Id), ...await this.getIncomingEdges(incident2Id)];
        for (const edge of edges1) {
            const nodeId = edge.from_node === incident1Id ? edge.to_node : edge.from_node;
            const node = this.nodes.get(nodeId);
            if (node) {
                factors1.add(`${node.type}:${node.label}`);
            }
        }
        for (const edge of edges2) {
            const nodeId = edge.from_node === incident2Id ? edge.to_node : edge.from_node;
            const node = this.nodes.get(nodeId);
            if (node) {
                factors2.add(`${node.type}:${node.label}`);
            }
        }
        // Find intersection
        const common = [];
        for (const factor of factors1) {
            if (factors2.has(factor)) {
                common.push(factor);
            }
        }
        return common;
    }
}
exports.IncidentKnowledgeGraph = IncidentKnowledgeGraph;
/**
 * Helper to create incident node
 */
function createIncidentNode(incidentId, title, severity, affectedServices) {
    return {
        id: `incident-${incidentId}`,
        type: 'incident',
        label: title,
        properties: {
            incident_id: incidentId,
            title,
            severity,
            status: 'open',
            started_at: new Date(),
            affected_services: affectedServices
        }
    };
}
/**
 * Helper to link incident to deployment
 */
function linkIncidentToDeployment(incidentId, deploymentId) {
    return {
        id: `edge-${incidentId}-${deploymentId}`,
        type: 'triggered_by',
        from_node: `deployment-${deploymentId}`,
        to_node: `incident-${incidentId}`,
        weight: 0.8
    };
}
/**
 * Helper to link incident to regression
 */
function linkIncidentToRegression(incidentId, regressionId) {
    return {
        id: `edge-${incidentId}-${regressionId}`,
        type: 'caused_by',
        from_node: `regression-${regressionId}`,
        to_node: `incident-${incidentId}`,
        weight: 0.9
    };
}
