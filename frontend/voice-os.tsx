import React, { useState, useEffect } from 'react';
import { useVoice } from '@humeai/voice-react';

// Define a more specific type for graph data
interface GraphData {
  nodes: any[];
  edges: any[];
}

const VoiceOS = () => {
  const [status, setStatus] = useState('');
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const voice = useVoice();

  const fetchGraphData = async () => {
    try {
      const response = await fetch('/api/graph');
      const result: unknown = await response.json();

      // Type guard to check the shape of the result
      if (typeof result === 'object' && result !== null && 'success' in result && 'graph' in result) {
        if ((result as { success: boolean }).success) {
          setGraphData((result as { graph: GraphData }).graph);
        }
      } else {
        setStatus('Error: Invalid data structure from /api/graph');
      }
    } catch (error) {
      if (error instanceof Error) {
        setStatus(`Error fetching graph data: ${error.message}`);
      } else {
        setStatus('An unknown error occurred while fetching graph data.');
      }
    }
  };

  useEffect(() => {
    fetchGraphData();
  }, []);

  const handleConnect = async () => {
    try {
      await voice.connect({
        auth: { 
          type: 'apiKey', 
          value: process.env.HUME_API_KEY || 'your-api-key-here' 
        },
        // sessionSettings: { ... }
      });
      setStatus('Voice Connected');
    } catch (error) {
      if (error instanceof Error) {
        setStatus(`Connection Error: ${error.message}`);
      } else {
        setStatus('An unknown connection error occurred.');
      }
    }
  };

  const handleDisconnect = async () => {
    try {
      await voice.disconnect();
      setStatus('Voice Disconnected');
    } catch (error) {
      if (error instanceof Error) {
        setStatus(`Disconnect Error: ${error.message}`);
      } else {
        setStatus('An unknown disconnect error occurred.');
      }
    }
  };

  const isConnected = voice.status.value === 'connected';

  return (
    <div className="voice-os-widget">
      <h2>Voice OS</h2>
      <p>Status: {status || voice.status.value}</p>
      <div className="controls">
        <button
            onClick={isConnected ? handleDisconnect : handleConnect}
        >
            {isConnected ? 'Disconnect' : 'Connect'}
        </button>
      </div>
      {graphData && (
        <div className="graph-display">
          <h3>Graph Data</h3>
          <p>{graphData.nodes.length} nodes, {graphData.edges.length} edges</p>
        </div>
      )}
    </div>
  );
};

export default VoiceOS;
