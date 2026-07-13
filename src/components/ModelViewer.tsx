import React, { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF, Html, Environment } from '@react-three/drei';
import { Loader2, AlertTriangle, Box } from 'lucide-react';

interface ModelViewerProps {
  url: string;
  fileName?: string;
}

/**
 * Loads and renders a single GLB/GLTF model. Suspends while loading.
 * useGLTF uses drei's GLTFLoader (with DRACO support) under the hood, which
 * replaces the previous CDN <model-viewer> web component that failed to load.
 */
function Model({ url }: { url: string }) {
  const isExternalUrl = url.startsWith('http://') || url.startsWith('https://');
  const targetUrl = isExternalUrl 
    ? `/api/proxy-glb?url=${encodeURIComponent(url)}` 
    : url;

  const { scene } = useGLTF(targetUrl);
  return <primitive object={scene} />;
}

function CanvasLoader() {
  return (
    <Html center>
      <div className="flex flex-col items-center text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400 mb-2" />
        <span className="text-[10px] font-mono uppercase tracking-widest">Loading 3D geometry...</span>
      </div>
    </Html>
  );
}

/**
 * Small error boundary so a corrupt/unreachable GLB shows a message
 * instead of crashing the whole workspace.
 */
class ModelErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export const ModelViewer: React.FC<ModelViewerProps> = ({ url, fileName }) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-center p-6">
        <AlertTriangle className="h-10 w-10 text-amber-400 mb-3" />
        <p className="text-sm font-semibold text-slate-200">Unable to render this 3D model</p>
        <p className="text-[11px] text-slate-400 mt-1 max-w-sm leading-relaxed">
          The file could not be loaded. Please confirm it is a valid binary <code className="text-blue-300">.glb</code> file
          and that Firebase Storage CORS is configured to allow model downloads.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-slate-900">
      <ModelErrorBoundary onError={() => setFailed(true)}>
        <Canvas
          camera={{ position: [0, 2, 6], fov: 50 }}
          dpr={[1, 2]}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
        >
          <color attach="background" args={['#0f172a']} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <Suspense fallback={<CanvasLoader />}>
            <Stage environment="city" intensity={0.5} adjustCamera shadows={false}>
              <Model url={url} />
            </Stage>
            <Environment preset="city" />
          </Suspense>
          <OrbitControls
            makeDefault
            enableDamping
            autoRotate
            autoRotateSpeed={0.6}
            minDistance={0.5}
            maxDistance={100}
          />
        </Canvas>
      </ModelErrorBoundary>

      {/* Floating overlay with model details */}
      <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg p-3 text-xs font-sans text-left space-y-1 shadow-lg max-w-sm pointer-events-none">
        <div className="flex items-center gap-1.5 text-blue-400 font-bold uppercase tracking-wider text-[10px]">
          <Box className="h-3.5 w-3.5" />
          <span>3D BIM Environment</span>
        </div>
        {fileName && <div className="text-white font-medium truncate">File: {fileName}</div>}
        <div className="text-[10px] text-slate-400">Drag to orbit • Scroll to zoom • Right-drag to pan</div>
      </div>
    </div>
  );
};