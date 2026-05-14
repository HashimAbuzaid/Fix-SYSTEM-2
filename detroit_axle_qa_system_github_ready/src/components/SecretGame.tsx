import React, { useState, useEffect, useCallback, useRef } from 'react';

const GRID_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION = { x: 0, y: -1 };
const INITIAL_FOOD = { x: 15, y: 15 };
const SPEED = 150;

export const SecretGame: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  const [food, setFood] = useState(INITIAL_FOOD);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const gameLoopRef = useRef<number | null>(null);

  const moveSnake = useCallback(() => {
    if (gameOver) return;
    setSnake((prevSnake) => {
      const head = prevSnake[0];
      const newHead = {
        x: (head.x + direction.x + GRID_SIZE) % GRID_SIZE,
        y: (head.y + direction.y + GRID_SIZE) % GRID_SIZE,
      };
      if (prevSnake.some((segment) => segment.x === newHead.x && segment.y === newHead.y)) {
        setGameOver(true);
        return prevSnake;
      }
      const newSnake = [newHead, ...prevSnake];
      if (newHead.x === food.x && newHead.y === food.y) {
        setScore((s) => s + 10);
        setFood({ x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) });
      } else {
        newSnake.pop();
      }
      return newSnake;
    });
  }, [direction, food, gameOver]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': if (direction.y === 0) setDirection({ x: 0, y: -1 }); break;
        case 'ArrowDown': if (direction.y === 0) setDirection({ x: 0, y: 1 }); break;
        case 'ArrowLeft': if (direction.x === 0) setDirection({ x: -1, y: 0 }); break;
        case 'ArrowRight': if (direction.x === 0) setDirection({ x: 1, y: 0 }); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [direction]);

  useEffect(() => {
    gameLoopRef.current = window.setInterval(moveSnake, SPEED);
    return () => { if (gameLoopRef.current) clearInterval(gameLoopRef.current); };
  }, [moveSnake]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(6, 10, 18, 0.95)', display: 'grid', placeItems: 'center', backdropFilter: 'blur(8px)', fontFamily: 'Geist, sans-serif' }}>
      <div style={{ background: 'var(--screen-panel-bg, #0f172a)', border: '1px solid var(--screen-border, rgba(59, 130, 246, 0.2))', borderRadius: '24px', padding: '32px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ color: '#60a5fa', margin: 0, fontSize: '24px' }}>Detroit Axle: Turbo Snake</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>Score: {score}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID_SIZE}, 15px)`, gridTemplateRows: `repeat(${GRID_SIZE}, 15px)`, gap: '1px', background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', padding: '4px' }}>
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
            const x = i % GRID_SIZE; const y = Math.floor(i / GRID_SIZE);
            const isSnake = snake.some((s) => s.x === x && s.y === y);
            const isHead = snake[0].x === x && snake[0].y === y;
            const isFood = food.x === x && food.y === y;
            return <div key={i} style={{ width: '15px', height: '15px', borderRadius: '2px', background: isHead ? '#3b82f6' : isSnake ? '#60a5fa' : isFood ? '#ef4444' : 'transparent', boxShadow: isFood ? '0 0 8px #ef4444' : 'none' }} />;
          })}
        </div>
        {gameOver && (
          <div style={{ marginTop: '20px' }}>
            <p style={{ color: '#ef4444', fontWeight: 'bold' }}>GAME OVER!</p>
            <button onClick={() => { setSnake(INITIAL_SNAKE); setGameOver(false); setScore(0); }} style={{ padding: '10px 20px', borderRadius: '12px', background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Try Again</button>
          </div>
        )}
        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>Close Game</button>
        </div>
      </div>
    </div>
  );
};
