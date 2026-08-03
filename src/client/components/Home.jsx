import React, { useState, useEffect } from 'react';
import { Button, Card } from '@heroui/react';
import { Copy, RotateCw, Monitor, Smartphone, Check, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();
  const [session, setSession] = useState({ roomCode: '----', remoteUrl: '', displayUrl: '' });
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState('Connecting...');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Check local API /api/session
    fetchSession();

    // Verify server connectivity
    const checkConnection = () => {
      fetch('/api/session')
        .then(() => {
          setStatus('Server connected');
          setIsConnected(true);
        })
        .catch(() => {
          setStatus('Disconnected');
          setIsConnected(false);
        });
    };

    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchSession = async (endpoint = '/api/session') => {
    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      setSession(data);
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  };

  const copyToClipboard = async () => {
    if (!session.remoteUrl) return;
    try {
      await navigator.clipboard.writeText(session.remoteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const generateNewCode = () => {
    fetchSession('/api/session/new');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-zinc-950 font-sans">
      <div className="max-w-md w-full flex flex-col gap-8 items-center">
        
        {/* Title / Hero */}
        <div className="animate-in">
          <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-violet-500 to-cyan-400 bg-clip-text text-transparent">
            Phuebus
          </h1>
          <span className="text-xs font-semibold tracking-widest text-zinc-500 uppercase mt-2 block">
            Interactive Visual Engine
          </span>
        </div>

        <p className="text-sm text-zinc-400 max-w-sm animate-in delay-75">
          Live stage visuals — shader-powered, audio-reactive, mobile-controlled.
        </p>

        {/* Session Code Card */}
        <Card className="w-full bg-zinc-900 border-zinc-800 rounded-3xl p-6 shadow-2xl glow-accent animate-in delay-150">
          <Card.Header className="flex flex-col gap-1 items-center pb-2">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">
              Active Session Code
            </span>
          </Card.Header>
          <Card.Content className="flex flex-col items-center gap-4 py-4">
            <div className="font-mono text-4xl font-extrabold tracking-widest text-violet-400 bg-violet-950/20 border border-violet-800/30 px-8 py-3 rounded-2xl">
              {session.roomCode}
            </div>
            <div className="flex gap-2 w-full max-w-xs mt-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="flex-1 bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800 text-zinc-300"
                onPress={copyToClipboard}
              >
                {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                {copied ? 'Copied' : 'Copy URL'}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800 text-zinc-300 px-3"
                onPress={generateNewCode}
              >
                <RotateCw className="size-4" />
              </Button>
            </div>
          </Card.Content>
        </Card>

        {/* Mode Selector Grid */}
        <div className="grid grid-cols-2 gap-4 w-full animate-in delay-200">
          <Button
            className="flex flex-col gap-2 h-auto py-6 rounded-3xl border border-cyan-950/50 bg-cyan-950/10 hover:bg-cyan-950/20 hover:border-cyan-500/50 text-zinc-100 transition-all shadow-md hover:shadow-cyan-950/30 hover:shadow-lg"
            onPress={() => navigate(`/display?code=${session.roomCode}`)}
          >
            <Monitor className="size-8 text-cyan-400" />
            <div className="flex flex-col items-center">
              <span className="text-sm font-bold">Display</span>
              <span className="text-[10px] text-zinc-500">Projector Canvas</span>
            </div>
          </Button>

          <Button
            className="flex flex-col gap-2 h-auto py-6 rounded-3xl border border-pink-950/50 bg-pink-950/10 hover:bg-pink-950/20 hover:border-pink-500/50 text-zinc-100 transition-all shadow-md hover:shadow-pink-950/30 hover:shadow-lg"
            onPress={() => navigate(`/remote?code=${session.roomCode}`)}
          >
            <Smartphone className="size-8 text-pink-400" />
            <div className="flex flex-col items-center">
              <span className="text-sm font-bold">Remote</span>
              <span className="text-[10px] text-zinc-500">Camera / Controller</span>
            </div>
          </Button>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/60 border border-zinc-800 rounded-full text-xs text-zinc-400 mt-4 animate-in delay-300">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></span>
          <span>{status}</span>
        </div>

      </div>
    </div>
  );
}

export default Home;
