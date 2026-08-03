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
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center font-sans">
      <div className="max-w-md w-full flex flex-col gap-8 items-center">
        
        {/* Title / Hero */}
        <div className="animate-in">
          <h1 className="text-5xl font-extrabold tracking-tight text-foreground">
            Phuebus
          </h1>
          <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mt-2 block">
            Interactive Visual Engine
          </span>
        </div>

        <p className="text-sm text-muted-foreground max-w-sm animate-in delay-75">
          Live stage visuals — shader-powered, audio-reactive, mobile-controlled.
        </p>

        {/* Session Code Card */}
        <Card className="w-full p-6 animate-in delay-150">
          <Card.Header className="flex flex-col gap-1 items-center pb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
              Active Session Code
            </span>
          </Card.Header>
          <Card.Content className="flex flex-col items-center gap-4 py-4">
            <div className="font-mono text-4xl font-extrabold tracking-widest text-primary border border-border px-8 py-3 rounded-2xl">
              {session.roomCode}
            </div>
            <div className="flex gap-2 w-full max-w-xs mt-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onPress={copyToClipboard}
              >
                {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                {copied ? 'Copied' : 'Copy URL'}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="px-3"
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
            variant="secondary"
            className="flex flex-col gap-2 h-auto py-6 rounded-3xl"
            onPress={() => navigate(`/display?code=${session.roomCode}`)}
          >
            <Monitor className="size-8" />
            <div className="flex flex-col items-center">
              <span className="text-sm font-bold">Display</span>
              <span className="text-[10px] text-muted-foreground">Projector Canvas</span>
            </div>
          </Button>

          <Button
            variant="secondary"
            className="flex flex-col gap-2 h-auto py-6 rounded-3xl"
            onPress={() => navigate(`/remote?code=${session.roomCode}`)}
          >
            <Smartphone className="size-8" />
            <div className="flex flex-col items-center">
              <span className="text-sm font-bold">Remote</span>
              <span className="text-[10px] text-muted-foreground">Camera / Controller</span>
            </div>
          </Button>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-full text-xs text-muted-foreground mt-4 animate-in delay-300">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-danger'}`}></span>
          <span>{status}</span>
        </div>

      </div>
    </div>
  );
}

export default Home;
