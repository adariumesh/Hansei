import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  OrbitControls, 
  MeshTransmissionMaterial, 
  Text,
  Environment,
  EffectComposer,
  Bloom,
  PerspectiveCamera
} from '@react-three/drei';
import * as THREE from 'three';
import { useVoice } from '@humeai/voice-react';

// Types
interface MemoryNode {
  id: string;
  label: string;
  type: 'goal' | 'habit' | 'person' | 'project' | 'emotion' | 'object';
  x: number;
  y: number;
  z: number;
  level: number;
  weight: number;
}

interface MemoryEdge {
  source: string;
  target: string;
  type?: string;
}

interface GraphData {
  nodes: MemoryNode[];
  links: MemoryEdge[];
}

// Color mapping for node types
const NODE_COLORS = {
  goal: '#00ffff',      // Cyan
  habit: '#ff00ff',     // Magenta
  person: '#4facfe',    // Blue
  project: '#43e97b',   // Green
  emotion: '#fa709a',   // Pink
  object: '#ffd89b'     // Yellow
};

// Refractive Memory Orb Component
function MemoryOrb({ node, onClick, isActive }: { node: MemoryNode; onClick: () => void; isActive: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = NODE_COLORS[node.type] || '#ffffff';
  const size = Math.max(node.weight * 2, 0.5) * (node.level === 0 ? 3 : 1);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.002;
      if (isActive) {
        meshRef.current.scale.setScalar(Math.sin(state.clock.elapsedTime * 2) * 0.1 + 1);
      }
    }
  });

  return (
    <group position={[node.x / 50, node.y / 50, node.z / 50]}>
      <mesh ref={meshRef} onClick={onClick}>
        <icosahedronGeometry args={[size, 2]} />
        <MeshTransmissionMaterial
          color={color}
          transmission={0.95}
          roughness={0.1}
          thickness={0.5}
          envMapIntensity={1.5}
          clearcoat={1}
          clearcoatRoughness={0.1}
          ior={1.5}
          chromaticAberration={0.1}
          anisotropy={1}
          distortion={0.2}
          distortionScale={0.5}
          temporalDistortion={0.1}
        />
      </mesh>
      <Text
        position={[0, size + 0.5, 0]}
        fontSize={0.3}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="#000000"
      >
        {node.label}
      </Text>
    </group>
  );
}

// Glowing Connection Line
function ConnectionLine({ start, end, isActive }: { start: THREE.Vector3; end: THREE.Vector3; isActive: boolean }) {
  const lineRef = useRef<THREE.Line>(null);

  useFrame(() => {
    if (lineRef.current && isActive) {
      const material = lineRef.current.material as THREE.LineBasicMaterial;
      material.opacity = Math.sin(Date.now() * 0.002) * 0.3 + 0.5;
    }
  });

  const points = [start, end];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  return (
    <line ref={lineRef} geometry={geometry}>
      <lineBasicMaterial
        color={isActive ? '#00ffff' : '#667eea'}
        transparent
        opacity={isActive ? 0.8 : 0.3}
        linewidth={isActive ? 3 : 1}
      />
    </line>
  );
}

// 3D Scene Component
function MemoryScene({ graphData, activeNode, onNodeClick }: { 
  graphData: GraphData; 
  activeNode: string | null;
  onNodeClick: (nodeId: string) => void;
}) {
  const { camera } = useThree();

  // Fly to node animation
  useEffect(() => {
    if (activeNode) {
      const node = graphData.nodes.find(n => n.id === activeNode);
      if (node) {
        const targetPos = new THREE.Vector3(node.x / 50, node.y / 50, node.z / 50);
        const distance = 15;
        const cameraPos = new THREE.Vector3(
          targetPos.x + distance,
          targetPos.y + distance * 0.5,
          targetPos.z + distance
        );
        
        // Smooth camera animation
        const startPos = camera.position.clone();
        const startTime = Date.now();
        const duration = 1000;

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic
          
          camera.position.lerpVectors(startPos, cameraPos, eased);
          camera.lookAt(targetPos);
          
          if (progress < 1) {
            requestAnimationFrame(animate);
          }
        };
        animate();
      }
    }
  }, [activeNode, graphData.nodes, camera]);

  return (
    <>
      {/* Ambient Environment */}
      <Environment preset="night" />
      
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 0, 0]} intensity={2} color="#667eea" distance={50} />
      <pointLight position={[20, 20, 20]} intensity={1} color="#00ffff" />
      <pointLight position={[-20, -20, -20]} intensity={1} color="#ff00ff" />
      
      {/* Memory Orbs */}
      {graphData.nodes.map(node => (
        <MemoryOrb
          key={node.id}
          node={node}
          onClick={() => onNodeClick(node.id)}
          isActive={activeNode === node.id}
        />
      ))}
      
      {/* Connection Lines */}
      {graphData.links.map((link, idx) => {
        const sourceNode = graphData.nodes.find(n => n.id === link.source);
        const targetNode = graphData.nodes.find(n => n.id === link.target);
        if (!sourceNode || !targetNode) return null;
        
        const start = new THREE.Vector3(sourceNode.x / 50, sourceNode.y / 50, sourceNode.z / 50);
        const end = new THREE.Vector3(targetNode.x / 50, targetNode.y / 50, targetNode.z / 50);
        const isActive = activeNode === link.source || activeNode === link.target;
        
        return <ConnectionLine key={idx} start={start} end={end} isActive={isActive} />;
      })}
      
      {/* Camera Controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
        minDistance={5}
        maxDistance={100}
      />
      
      {/* Bloom Post-Processing */}
      <EffectComposer>
        <Bloom
          intensity={1.5}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

// Audio Visualizer Component
function AudioVisualizer({ isActive, volume }: { isActive: boolean; volume: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      
      if (isActive) {
        // Pulsing orb visualization
        const centerX = width / 2;
        const centerY = height / 2;
        const baseRadius = 30;
        const radius = baseRadius + volume * 20;
        
        // Outer glow
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, 'rgba(0, 255, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(102, 126, 234, 0.4)');
        gradient.addColorStop(1, 'rgba(102, 126, 234, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Core orb
        ctx.fillStyle = 'rgba(0, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Inactive state
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, 30, 0, Math.PI * 2);
        ctx.fill();
      }
      
      requestAnimationFrame(draw);
    };
    
    draw();
  }, [isActive, volume]);
  
  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={120}
      className="mx-auto"
    />
  );
}

// Message Component with Generative UI
function ChatMessage({ message, type, component }: { 
  message: string; 
  type: 'user' | 'assistant'; 
  component?: React.ReactNode;
}) {
  return (
    <div className={`mb-4 ${type === 'user' ? 'text-right' : 'text-left'}`}>
      <div className={`inline-block max-w-[80%] p-3 rounded-2xl ${
        type === 'user' 
          ? 'bg-cyan-500/20 border border-cyan-500/30' 
          : 'bg-white/5 border border-white/10'
      }`}>
        <p className="text-white text-sm">{message}</p>
        {component && <div className="mt-3">{component}</div>}
      </div>
    </div>
  );
}

// Sleep Cycle Progress Component
function SleepCycleProgress({ progress }: { progress: number }) {
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-white/60 mb-1">
        <span>Memory Consolidation</span>
        <span>{Math.round(progress * 100)}%</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-500"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}

// Memory Insight Card
function MemoryInsightCard({ title, value, trend }: { title: string; value: string; trend: 'up' | 'down' | 'neutral' }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3 mt-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/60 text-xs">{title}</p>
          <p className="text-white text-lg font-bold mt-1">{value}</p>
        </div>
        <div className={`text-2xl ${
          trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-white/40'
        }`}>
          {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'}
        </div>
      </div>
    </div>
  );
}

// Main Spatial UI Component
export default function SpatialUI() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [sleepMode, setSleepMode] = useState(false);
  const [sleepProgress, setSleepProgress] = useState(0);
  const [messages, setMessages] = useState<Array<{ text: string; type: 'user' | 'assistant'; component?: React.ReactNode }>>([
    { 
      text: "Welcome to HANSEI. Your neural memory graph is ready.", 
      type: 'assistant',
      component: <MemoryInsightCard title="Active Memories" value="24" trend="up" />
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [stats, setStats] = useState({ nodes: 0, connections: 0, memories: 0 });
  
  // Hume AI Voice Integration
  const voice = useVoice();
  const [voiceStatus, setVoiceStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [audioVolume, setAudioVolume] = useState(0);

  // API Configuration
  const API_BASE = 'https://svc-01kaaeej1ecf9k85z0f29rp6wf.01ka41m1warcc7s5zveqw1tt3z.lmapp.run';
  const USER_ID = 'demo_user_' + Date.now();

  // Load graph data
  const loadGraphData = async (query: string = 'all') => {
    try {
      const response = await fetch(`${API_BASE}/api/graph?query=${encodeURIComponent(query)}&limit=100&user_id=${USER_ID}`);
      const result = await response.json();
      
      if (result.success) {
        const hierarchical = buildHierarchy(result.graph);
        setGraphData(hierarchical);
        setStats({
          nodes: hierarchical.nodes.length,
          connections: hierarchical.links.length,
          memories: result.rawResults?.length || 0
        });
      }
    } catch (error) {
      console.error('Failed to load graph:', error);
    }
  };

  // Build hierarchical structure
  const buildHierarchy = (flatData: any): GraphData => {
    const nodes: MemoryNode[] = [];
    const links: MemoryEdge[] = [];

    // Add central node
    nodes.push({
      id: 'central',
      label: 'You',
      type: 'person',
      weight: 1,
      level: 0,
      x: 0,
      y: 0,
      z: 0
    });

    // Group by type
    const domains: { [key: string]: any[] } = {};
    flatData.nodes.forEach((node: any) => {
      if (!domains[node.type]) domains[node.type] = [];
      domains[node.type].push(node);
    });

    // Create domain nodes (layer 1)
    Object.keys(domains).forEach((domainType, idx) => {
      const angle = (idx / Object.keys(domains).length) * Math.PI * 2;
      const radius = 10;
      const domainId = `domain-${domainType}`;
      
      nodes.push({
        id: domainId,
        label: domainType.toUpperCase(),
        type: domainType as any,
        weight: 0.8,
        level: 1,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle * 0.3) * 2,
        z: Math.sin(angle) * radius
      });

      links.push({
        source: domainId,
        target: 'central'
      });

      // Add entity nodes (layer 2)
      domains[domainType].forEach((entity: any, entityIdx: number) => {
        const entityAngle = angle + (entityIdx / domains[domainType].length) * (Math.PI / 3);
        const entityRadius = radius * 1.8;
        const entityId = `${domainType}-${entityIdx}`;
        
        nodes.push({
          id: entityId,
          label: entity.label,
          type: entity.type,
          weight: entity.weight || 0.5,
          level: 2,
          x: Math.cos(entityAngle) * entityRadius,
          y: Math.sin(entityAngle * 0.5) * 4,
          z: Math.sin(entityAngle) * entityRadius
        });

        links.push({
          source: entityId,
          target: domainId
        });
      });
    });

    return { nodes, links };
  };

  // Initialize
  useEffect(() => {
    loadGraphData();
  }, []);

  // Voice connection
  const handleVoiceConnect = async () => {
    try {
      setVoiceStatus('connecting');
      await voice.connect({
        auth: { 
          type: 'apiKey', 
          value: process.env.HUME_API_KEY || 'ZqVieTaei1w5G2dUSpkJbcHMMsganYWMkuRwcSreRqtgWugY'
        }
      });
      setVoiceStatus('connected');
      setMessages(prev => [...prev, { 
        text: "Voice agent connected. You can now speak to interact with your memory graph.", 
        type: 'assistant' 
      }]);
    } catch (error) {
      console.error('Voice connection failed:', error);
      setVoiceStatus('disconnected');
    }
  };

  const handleVoiceDisconnect = async () => {
    await voice.disconnect();
    setVoiceStatus('disconnected');
  };

  // Monitor audio volume
  useEffect(() => {
    if (voiceStatus === 'connected') {
      const interval = setInterval(() => {
        setAudioVolume(Math.random() * 0.5); // Simulated volume - replace with actual voice.volume
      }, 100);
      return () => clearInterval(interval);
    }
  }, [voiceStatus]);

  // Submit text
  const handleSubmitText = async () => {
    if (!inputText.trim()) return;

    setMessages(prev => [...prev, { text: inputText, type: 'user' }]);
    
    try {
      const response = await fetch(`${API_BASE}/infer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: inputText,
          user_id: USER_ID
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setMessages(prev => [...prev, { 
          text: "Memory saved successfully. Graph updated.", 
          type: 'assistant',
          component: <MemoryInsightCard title="New Connections" value={`+${Math.floor(Math.random() * 5) + 1}`} trend="up" />
        }]);
        loadGraphData();
      }
    } catch (error) {
      console.error('Submit failed:', error);
    }

    setInputText('');
  };

  // Sleep Cycle
  const triggerSleepCycle = async () => {
    setSleepMode(true);
    setSleepProgress(0);
    
    setMessages(prev => [...prev, { 
      text: "Initiating memory consolidation. Entering sleep state...", 
      type: 'assistant',
      component: <SleepCycleProgress progress={0} />
    }]);

    // Simulate progress
    const interval = setInterval(() => {
      setSleepProgress(prev => {
        const next = prev + 0.1;
        if (next >= 1) {
          clearInterval(interval);
          setSleepMode(false);
          setMessages(prevMsgs => [...prevMsgs, { 
            text: "Memory consolidation complete. 12 new insights generated.", 
            type: 'assistant',
            component: <MemoryInsightCard title="Insights Generated" value="12" trend="up" />
          }]);
          return 1;
        }
        return next;
      });
    }, 500);
  };

  return (
    <div className={`fixed inset-0 overflow-hidden transition-colors duration-1000 ${
      sleepMode 
        ? 'bg-gradient-to-br from-indigo-950 via-purple-950 to-black' 
        : 'bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950'
    }`}>
      {/* Animated Nebula Background */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-20 w-96 h-96 bg-purple-500 rounded-full mix-blend-screen filter blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500 rounded-full mix-blend-screen filter blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-cyan-500 rounded-full mix-blend-screen filter blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* 3D Canvas (Left 75%) */}
      <div className="absolute inset-y-0 left-0 right-[25%]">
        <Canvas camera={{ position: [0, 20, 30], fov: 60 }}>
          <Suspense fallback={null}>
            <MemoryScene 
              graphData={graphData} 
              activeNode={activeNode}
              onNodeClick={setActiveNode}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* AI Co-pilot Sidebar (Right 25%) */}
      <div className="absolute inset-y-0 right-0 w-[25%] p-6 flex flex-col">
        <div className="flex-1 backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl shadow-2xl p-6 flex flex-col">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-white text-2xl font-bold mb-2">Neural Control</h2>
            <p className="text-white/60 text-sm">AI Co-pilot Active</p>
          </div>

          {/* Audio Visualizer */}
          <div className="mb-6">
            <AudioVisualizer isActive={voiceStatus === 'connected'} volume={audioVolume} />
            <button
              onClick={voiceStatus === 'connected' ? handleVoiceDisconnect : handleVoiceConnect}
              className={`w-full mt-4 py-3 rounded-full font-semibold transition-all ${
                voiceStatus === 'connected'
                  ? 'bg-cyan-500/20 border-2 border-cyan-500 text-cyan-400 hover:bg-cyan-500/30'
                  : 'bg-white/10 border-2 border-white/20 text-white hover:bg-white/20'
              }`}
            >
              {voiceStatus === 'connecting' ? 'Connecting...' : voiceStatus === 'connected' ? '🎙️ Voice Active' : '🎤 Start Voice'}
            </button>
          </div>

          {/* Sleep Cycle Trigger */}
          <button
            onClick={triggerSleepCycle}
            disabled={sleepMode}
            className="w-full py-4 mb-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold rounded-2xl transition-all shadow-lg hover:shadow-purple-500/50"
          >
            {sleepMode ? '💤 Consolidating...' : '🌙 Trigger Sleep Cycle'}
          </button>

          {/* Chat Stream */}
          <div className="flex-1 overflow-y-auto mb-4 space-y-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
            {messages.map((msg, idx) => (
              <ChatMessage key={idx} message={msg.text} type={msg.type} component={msg.component} />
            ))}
            {sleepMode && (
              <ChatMessage 
                message="Processing memories..." 
                type="assistant" 
                component={<SleepCycleProgress progress={sleepProgress} />}
              />
            )}
          </div>

          {/* Input Area */}
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSubmitText()}
              placeholder="Type a memory..."
              className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-cyan-500 focus:bg-white/15"
            />
            <button
              onClick={handleSubmitText}
              className="bg-cyan-500 hover:bg-cyan-400 text-white px-6 py-3 rounded-xl font-semibold transition-all"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Stats HUD (Bottom Left) */}
      <div className="absolute bottom-6 left-6 backdrop-blur-2xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-6 w-72">
        <h3 className="text-white font-bold mb-4 text-lg">Memory Graph Stats</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-white/60">Nodes</span>
            <span className="text-cyan-400 text-2xl font-bold">{stats.nodes}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/60">Connections</span>
            <span className="text-purple-400 text-2xl font-bold">{stats.connections}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/60">Memories</span>
            <span className="text-pink-400 text-2xl font-bold">{stats.memories}</span>
          </div>
        </div>
        
        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-white/60 text-xs font-semibold mb-2">Node Types</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-cyan-500" />
              <span className="text-white/80">Goals</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: '#ff00ff' }} />
              <span className="text-white/80">Habits</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-white/80">Projects</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-white/80">Objects</span>
            </div>
          </div>
        </div>
      </div>

      {/* Command Bar (Bottom Center) */}
      <div className="absolute bottom-6 left-[37.5%] right-[27.5%] backdrop-blur-2xl bg-white/5 border border-white/10 rounded-full shadow-2xl px-6 py-4">
        <div className="flex items-center justify-between gap-4 text-white/60 text-sm">
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-white/10 rounded text-xs">Ctrl+R</kbd>
            <span>Reset Camera</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-white/10 rounded text-xs">Space</kbd>
            <span>Auto-Rotate</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-white/10 rounded text-xs">Ctrl+F</kbd>
            <span>Focus Node</span>
          </div>
        </div>
      </div>
    </div>
  );
}
