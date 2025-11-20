// ElevenLabs Voice Agent Integration for HANSEI
// Enables voice-controlled 3D graph navigation and interaction

class VoiceAgent {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.conversation = null;
    this.isActive = false;
    this.agentId = null;
  }

  /**
   * Initialize voice conversation with ElevenLabs
   */
  async startConversation(agentId) {
    try {
      if (!window.ElevenLabs) {
        throw new Error('ElevenLabs SDK not loaded. Please include the SDK script.');
      }

      this.agentId = agentId;
      const { useConversation } = window.ElevenLabs;
      
      this.conversation = useConversation({
        agentId: agentId,
        onMessage: (message) => this.handleMessage(message),
        onStatusChange: (status) => this.handleStatusChange(status),
        onError: (error) => this.handleError(error),
      });

      // Start session with client tools for 3D control
      await this.conversation.startSession({
        clientTools: {
          rotateCamera: {
            description: 'Rotate the 3D camera view left or right',
            parameters: {
              direction: { type: 'string', enum: ['left', 'right'], required: true },
              degrees: { type: 'number', default: 45 }
            },
            handler: this.rotateCamera.bind(this)
          },
          zoomCamera: {
            description: 'Zoom the camera in or out',
            parameters: {
              direction: { type: 'string', enum: ['in', 'out'], required: true },
              amount: { type: 'number', default: 1.3 }
            },
            handler: this.zoomCamera.bind(this)
          },
          searchGraph: {
            description: 'Search the memory graph for entities or concepts',
            parameters: {
              query: { type: 'string', required: true }
            },
            handler: this.searchGraph.bind(this)
          },
          focusNode: {
            description: 'Focus the camera on a specific node in the graph',
            parameters: {
              nodeName: { type: 'string', required: true }
            },
            handler: this.focusNode.bind(this)
          },
          showStats: {
            description: 'Display graph statistics',
            parameters: {},
            handler: this.showStats.bind(this)
          }
        }
      });

      this.isActive = true;
      console.log('Voice agent started successfully');
      return true;
    } catch (error) {
      console.error('Failed to start voice conversation:', error);
      this.handleError(error);
      return false;
    }
  }

  /**
   * Client Tool: Rotate 3D camera
   */
  async rotateCamera({ direction, degrees = 45 }) {
    try {
      if (!window.Graph) {
        return { success: false, message: 'Graph not initialized' };
      }

      const camera = Graph.camera();
      const currentPos = camera.position;
      
      const angle = degrees * Math.PI / 180;
      const multiplier = direction === 'left' ? 1 : -1;
      
      // Rotate around Y-axis
      const x = currentPos.x * Math.cos(angle * multiplier) - currentPos.z * Math.sin(angle * multiplier);
      const z = currentPos.x * Math.sin(angle * multiplier) + currentPos.z * Math.cos(angle * multiplier);
      
      Graph.cameraPosition({ x, y: currentPos.y, z }, null, 1000);
      
      return { 
        success: true, 
        message: `Rotated camera ${direction} by ${degrees}°` 
      };
    } catch (error) {
      console.error('Camera rotation error:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Client Tool: Zoom camera
   */
  async zoomCamera({ direction, amount = 1.3 }) {
    try {
      if (!window.Graph) {
        return { success: false, message: 'Graph not initialized' };
      }

      const camera = Graph.camera();
      const currentPos = camera.position;
      const distance = Math.sqrt(currentPos.x**2 + currentPos.y**2 + currentPos.z**2);
      
      const zoomFactor = direction === 'in' ? (1 / amount) : amount;
      const newDistance = distance * zoomFactor;
      
      const scale = newDistance / distance;
      Graph.cameraPosition({
        x: currentPos.x * scale,
        y: currentPos.y * scale,
        z: currentPos.z * scale
      }, null, 1000);
      
      return { 
        success: true, 
        message: `Zoomed ${direction}`,
        newDistance: Math.round(newDistance)
      };
    } catch (error) {
      console.error('Camera zoom error:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Client Tool: Search graph for entity
   */
  async searchGraph({ query }) {
    try {
      if (!window.API_BASE || !window.USER_ID) {
        return { success: false, message: 'API configuration missing' };
      }

      const response = await fetch(
        `${API_BASE}/api/graph?query=${encodeURIComponent(query)}&limit=50&user_id=${USER_ID}`
      );
      const data = await response.json();
      
      if (data.success && window.buildHierarchy && window.Graph) {
        Graph.graphData(buildHierarchy(data.graph));
        
        return { 
          success: true, 
          message: `Found ${data.graph.nodes.length} nodes for "${query}"`,
          nodeCount: data.graph.nodes.length,
          edgeCount: data.graph.links.length
        };
      }
      
      return { success: false, message: 'Search failed or no results found' };
    } catch (error) {
      console.error('Graph search error:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Client Tool: Focus on specific node
   */
  async focusNode({ nodeName }) {
    try {
      if (!window.Graph) {
        return { success: false, message: 'Graph not initialized' };
      }

      const graphData = Graph.graphData();
      const node = graphData.nodes.find(n => 
        n.label?.toLowerCase().includes(nodeName.toLowerCase()) ||
        n.id?.toLowerCase().includes(nodeName.toLowerCase())
      );
      
      if (node) {
        const distance = 150;
        const cameraPos = {
          x: node.x || 0,
          y: node.y || 0,
          z: (node.z || 0) + distance
        };
        
        Graph.cameraPosition(cameraPos, node, 2000);
        
        return { 
          success: true, 
          message: `Focused on ${node.label || node.id}`,
          nodeType: node.type,
          nodeLevel: node.level
        };
      }
      
      return { 
        success: false, 
        message: `Node "${nodeName}" not found. Try searching first.` 
      };
    } catch (error) {
      console.error('Node focus error:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Client Tool: Show graph statistics
   */
  async showStats() {
    try {
      if (!window.Graph) {
        return { success: false, message: 'Graph not initialized' };
      }

      const graphData = Graph.graphData();
      const nodeCount = graphData.nodes.length;
      const edgeCount = graphData.links.length;
      
      const nodesByType = {};
      const nodesByLevel = {};
      
      graphData.nodes.forEach(node => {
        nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
        nodesByLevel[node.level] = (nodesByLevel[node.level] || 0) + 1;
      });
      
      return {
        success: true,
        message: `Graph contains ${nodeCount} nodes and ${edgeCount} connections`,
        stats: {
          totalNodes: nodeCount,
          totalEdges: edgeCount,
          nodesByType,
          nodesByLevel
        }
      };
    } catch (error) {
      console.error('Stats error:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Handle incoming messages from voice agent
   */
  handleMessage(message) {
    console.log('Voice Agent:', message);
    const text = message.text || message.content || '';
    
    if (window.showStatus) {
      showStatus(text);
    }
  }

  /**
   * Handle status changes
   */
  handleStatusChange(status) {
    console.log('Voice Agent Status:', status);
    
    if (status === 'connected' && window.showStatus) {
      showStatus('🎤 Voice agent ready! Try: "rotate camera left" or "search for goals"');
    } else if (status === 'disconnected' && window.showStatus) {
      showStatus('Voice agent disconnected');
      this.isActive = false;
    }
  }

  /**
   * Handle errors
   */
  handleError(error) {
    console.error('Voice Agent Error:', error);
    
    if (window.showStatus) {
      showStatus(`❌ Voice agent error: ${error.message}`, 5000);
    }
  }

  /**
   * Stop voice conversation
   */
  async stop() {
    try {
      if (this.conversation) {
        await this.conversation.endSession();
        this.isActive = false;
        console.log('Voice agent stopped');
        
        if (window.showStatus) {
          showStatus('Voice agent stopped');
        }
        return true;
      }
    } catch (error) {
      console.error('Error stopping voice agent:', error);
      return false;
    }
  }

  /**
   * Check if voice agent is active
   */
  get status() {
    return {
      isActive: this.isActive,
      agentId: this.agentId
    };
  }
}

// Initialize voice agent (will be configured with API key from HTML)
window.VoiceAgent = VoiceAgent;
