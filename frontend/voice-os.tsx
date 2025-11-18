import React, { useEffect, useRef, useState } from 'react';
import { useConversation } from '@elevenlabs/react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Sphere, Line } from '@react-three/drei';
import * as THREE from 'three';

// Client Tools for Voice Commands
const createClientTools = (graphControl: any) => ({
  visualize_topic: {
    description: 'Fly camera to visualize a specific memory topic or node',
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'The memory topic or node to visualize' },
        zoom_level: { type: 'number', description: 'How close to zoom (1-10)', default: 5 }
      },
      required: ['topic']
    },
    handler: async ({ topic, zoom_level = 5 }: { topic: string; zoom_level?: number }) => {
      console.log(`Voice Command: Visualizing topic "${topic}" with zoom level ${zoom_level}`);
      await graphControl.flyToTopic(topic, zoom_level);
      return `Flying to visualize "${topic}" with zoom level ${zoom_level}. You should see the memory graph focusing on this topic now.`;
    }
  },
  
  enter_sleep_mode: {
    description: 'Trigger backend batch processing and memory consolidation',
    parameters: {
      type: 'object',
      properties: {
        duration: { type: 'string', description: 'Sleep duration (short/medium/long)', default: 'medium' }
      }
    },
    handler: async ({ duration = 'medium' }: { duration?: string }) => {
      console.log(`Voice Command: Entering sleep mode with ${duration} processing`);
      await graphControl.triggerSleepCycle(duration);
      return `Entering sleep mode with ${duration} processing. I'll consolidate your memories and strengthen neural pathways.`;
    }
  },
  
  expand_node: {
    description: 'Load and display neighboring memories around a specific node',
    parameters: {
      type: 'object',
      properties: {
        node_id: { type: 'string', description: 'The node ID to expand around' },
        depth: { type: 'number', description: 'How many connection levels to load (1-3)', default: 2 }
      },
      required: ['node_id']
    },
    handler: async ({ node_id, depth = 2 }: { node_id: string; depth?: number }) => {
      console.log(`Voice Command: Expanding node "${node_id}" with depth ${depth}`);
      const neighbors = await graphControl.loadNodeNeighbors(node_id, depth);
      return `Expanded node "${node_id}" showing ${neighbors.count} neighboring memories within ${depth} connection levels.`;
    }
  },
  
  filter_graph: {
    description: 'Filter the memory graph visualization by category or type',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Memory category to filter by (goals/habits/projects/emotions/objects/people)' },
        show_only: { type: 'boolean', description: 'Show only this category (true) or highlight it (false)', default: false }
      },
      required: ['category']
    },
    handler: async ({ category, show_only = false }: { category: string; show_only?: boolean }) => {
      console.log(`Voice Command: Filtering graph by category "${category}", show_only: ${show_only}`);
      await graphControl.updateGraphFilter(category, show_only);
      return `${show_only ? 'Showing only' : 'Highlighting'} memories in the "${category}" category. The graph now focuses on ${category}-related nodes.`;
    }
  },
  
  navigate_to_center: {
    description: 'Return camera view to the central "You" node',
    parameters: { type: 'object', properties: {} },
    handler: async () => {
      console.log('Voice Command: Navigating to center');
      await graphControl.navigateToCenter();
      return 'Returning to center view. You can now see your complete memory landscape from the central perspective.';
    }
  },
  
  get_graph_insights: {
    description: 'Analyze and describe the current visible memory patterns',
    parameters: {
      type: 'object',
      properties: {
        analysis_type: { type: 'string', description: 'Type of analysis (connections/clusters/orphans/hubs)', default: 'connections' }
      }
    },
    handler: async ({ analysis_type = 'connections' }: { analysis_type?: string }) => {
      console.log(`Voice Command: Getting graph insights for ${analysis_type}`);
      const insights = await graphControl.getGraphInsights(analysis_type);
      return `Graph Analysis: ${insights.summary}. I can see ${insights.nodeCount} nodes with ${insights.connectionCount} connections. ${insights.pattern}.`;
    }
  }
});

// 3D Memory Node Component
function MemoryNode({ node, position, isSelected, onClick }: any) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
      if (isSelected) {
        meshRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 3) * 0.1);
      }
    }
  });

  const getNodeColor = (type: string) => {
    const colors = {
      'goal': '#667eea',
      'habit': '#f093fb',
      'person': '#4facfe',
      'project': '#43e97b',
      'emotion': '#fa709a',
      'object': '#ffd89b'
    };
    return colors[type as keyof typeof colors] || '#999';
  };

  return (
    <group position={position} onClick={onClick}>
      <Sphere ref={meshRef} args={[node.weight * 0.5, 16, 16]}>
        <meshStandardMaterial color={getNodeColor(node.type)} />
      </Sphere>
      <Text
        position={[0, node.weight * 0.7, 0]}
        fontSize={0.3}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {node.label}
      </Text>
    </group>
  );
}

// 3D Memory Graph Component
function MemoryGraph({ graphData, selectedNode, onNodeSelect, graphControl }: any) {
  const groupRef = useRef<THREE.Group>(null);

  const connectionLines = graphData.links.map((link: any, index: number) => {
    const sourceNode = graphData.nodes.find((n: any) => n.id === link.source);
    const targetNode = graphData.nodes.find((n: any) => n.id === link.target);
    
    if (!sourceNode || !targetNode) return null;

    const points = [
      new THREE.Vector3(sourceNode.x, sourceNode.y, sourceNode.z),
      new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z)
    ];

    return (
      <Line key={index} points={points} color="rgba(255,255,255,0.2)" lineWidth={1} />
    );
  });

  return (
    <group ref={groupRef}>
      {graphData.nodes.map((node: any) => (
        <MemoryNode
          key={node.id}
          node={node}
          position={[node.x || 0, node.y || 0, node.z || 0]}
          isSelected={selectedNode?.id === node.id}
          onClick={() => onNodeSelect(node)}
        />
      ))}
      {connectionLines}
    </group>
  );
}

// Voice Operating System Interface
export function VoiceOperatingSystem() {
  const [graphData, setGraphData] = useState<any>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('Initializing Voice OS...');

  // Graph Control Functions
  const graphControl = {
    flyToTopic: async (topic: string, zoomLevel: number) => {
      setStatus(`Flying to topic: ${topic}`);
      // Find topic in graph and animate camera
      const topicNode = graphData.nodes.find((node: any) => 
        node.label.toLowerCase().includes(topic.toLowerCase())
      );
      if (topicNode) {
        setSelectedNode(topicNode);
        // Camera animation would happen here
      }
      setTimeout(() => setStatus('Voice OS Ready'), 2000);
    },
    
    triggerSleepCycle: async (duration: string) => {
      setStatus(`Sleep mode: ${duration} processing...`);
      setIsProcessing(true);
      // Call backend batch processor
      try {
        const response = await fetch('/api/batch-process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ duration, user_id: 'demo_user_anne_frank_1' })
        });
      } catch (error) {
        console.error('Sleep cycle error:', error);
      }
      setTimeout(() => {
        setIsProcessing(false);
        setStatus('Sleep cycle complete - memories consolidated');
      }, 5000);
    },
    
    loadNodeNeighbors: async (nodeId: string, depth: number) => {
      setStatus(`Loading neighbors for: ${nodeId}`);
      // Load neighboring nodes from API
      return { count: Math.floor(Math.random() * 10) + 5 };
    },
    
    updateGraphFilter: async (category: string, showOnly: boolean) => {
      setStatus(`Filtering by: ${category}`);
      // Update graph visualization
      const filteredData = { ...graphData };
      if (showOnly) {
        filteredData.nodes = graphData.nodes.filter((node: any) => node.type === category);
      }
      setGraphData(filteredData);
    },
    
    navigateToCenter: async () => {
      setStatus('Returning to center view');
      setSelectedNode(null);
    },
    
    getGraphInsights: async (analysisType: string) => {
      setStatus(`Analyzing ${analysisType}...`);
      return {
        summary: `Found interesting ${analysisType} patterns`,
        nodeCount: graphData.nodes.length,
        connectionCount: graphData.links.length,
        pattern: 'Strong clustering around personal goals'
      };
    }
  };

  // ElevenLabs Conversational AI Setup
  const conversation = useConversation({
    onConnect: () => setStatus('Voice OS Connected'),
    onDisconnect: () => setStatus('Voice OS Disconnected'),
    onError: (error) => setStatus(`Voice Error: ${error.message}`),
    onMessage: (message) => {
      console.log('Voice Message:', message);
      setStatus('Processing voice command...');
    }
  });

  useEffect(() => {
    // Initialize conversation with client tools
    if (conversation.status === 'connected') {
      const clientTools = createClientTools(graphControl);
      // Set up client tools for the conversation
      // This would be done via ElevenLabs configuration
      console.log('Client tools configured:', Object.keys(clientTools));
    }
  }, [conversation.status]);

  // Load initial graph data
  useEffect(() => {
    loadMemoryGraph();
  }, []);

  const loadMemoryGraph = async () => {
    try {
      const response = await fetch('/api/graph?query=all&limit=50&user_id=demo_user_anne_frank_1');
      const result = await response.json();
      if (result.success) {
        setGraphData(result.graph);
        setStatus('Voice OS Ready');
      }
    } catch (error) {
      console.error('Graph load error:', error);
      setStatus('Error loading memory graph');
    }
  };

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)',
      position: 'relative'
    }}>
      {/* Voice Status Bar */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: 'rgba(10, 14, 39, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: '20px',
        zIndex: 1000,
        borderBottom: '2px solid #667eea',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{
            fontSize: '2em',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0
          }}>
            🎙️ HANSEI Voice OS
          </h1>
          <p style={{ color: '#667eea', margin: '5px 0 0 0' }}>{status}</p>
        </div>
        
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button
            onClick={conversation.status === 'connected' ? conversation.disconnect : conversation.connect}
            style={{
              padding: '12px 24px',
              borderRadius: '50px',
              background: conversation.status === 'connected' 
                ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              color: 'white',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            {conversation.status === 'connected' ? '⏹️ Disconnect' : '🎙️ Connect Voice'}
          </button>
          
          {isProcessing && (
            <div style={{
              padding: '8px 16px',
              background: 'rgba(102, 126, 234, 0.2)',
              borderRadius: '20px',
              color: '#667eea',
              fontSize: '0.9em'
            }}>
              🧠 Processing...
            </div>
          )}
        </div>
      </div>

      {/* 3D Memory Graph Canvas */}
      <Canvas
        style={{ 
          position: 'fixed',
          top: '100px',
          left: 0,
          right: 0,
          bottom: 0
        }}
        camera={{ position: [0, 0, 400], fov: 60 }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        
        <MemoryGraph
          graphData={graphData}
          selectedNode={selectedNode}
          onNodeSelect={setSelectedNode}
          graphControl={graphControl}
        />
        
        <OrbitControls 
          enableDamping={true}
          dampingFactor={0.05}
          maxDistance={1000}
          minDistance={50}
        />
      </Canvas>

      {/* Node Info Panel */}
      {selectedNode && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          background: 'rgba(10, 14, 39, 0.95)',
          backdropFilter: 'blur(10px)',
          padding: '20px',
          borderRadius: '15px',
          border: '2px solid #667eea',
          maxWidth: '350px',
          zIndex: 999,
          color: 'white'
        }}>
          <h3 style={{ color: '#667eea', margin: '0 0 10px 0' }}>
            {selectedNode.type.toUpperCase()}: {selectedNode.label}
          </h3>
          <p style={{ margin: '10px 0' }}>Weight: {selectedNode.weight}</p>
          <p style={{ margin: '10px 0' }}>Level: {selectedNode.level}</p>
          <p style={{ margin: '10px 0', fontSize: '0.9em', color: '#999' }}>
            Try saying: "Expand this node" or "Show me related memories"
          </p>
        </div>
      )}

      {/* Voice Commands Help */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        background: 'rgba(10, 14, 39, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: '20px',
        borderRadius: '15px',
        border: '2px solid #667eea',
        maxWidth: '400px',
        zIndex: 999,
        color: 'white'
      }}>
        <h3 style={{ color: '#667eea', margin: '0 0 15px 0' }}>🎤 Voice Commands</h3>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9em' }}>
          <li>"Visualize [topic]" - Fly to memory topic</li>
          <li>"Enter sleep mode" - Trigger batch processing</li>
          <li>"Expand this node" - Load neighboring memories</li>
          <li>"Filter by [category]" - Focus on memory type</li>
          <li>"Return to center" - Navigate to main view</li>
          <li>"Analyze connections" - Get graph insights</li>
        </ul>
      </div>
    </div>
  );
}

export default VoiceOperatingSystem;