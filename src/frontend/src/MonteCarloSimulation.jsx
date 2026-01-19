'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Simple seeded random number generator (mulberry32)
function createRng(seed) {
  let state = seed;
  return function() {
    state |= 0;
    state = state + 0x6D2B79F5 | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Hash string to number for seed
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Run Monte Carlo simulation with progress updates
 */
export function runSimulation(throughputData, remainingWork, options = {}) {
  const {
    samples = 10000,
    seed = 'forecast',
    useIssueCount = false,
    onProgress = () => {},
    batchSize = 500,
  } = options;

  return new Promise((resolve) => {
    const rng = createRng(hashCode(seed));
    const completionWeeks = [];
    const maxWeeks = 104;
    
    // Extract throughput values
    const throughputValues = throughputData.map(t => 
      useIssueCount 
        ? (t.issues_completed || t.issuesCompleted || 0)
        : (t.points_completed || t.pointsCompleted || 0)
    ).filter(v => v > 0);
    
    if (throughputValues.length === 0) {
      resolve({
        success: false,
        error: 'No throughput data available'
      });
      return;
    }

    let currentSample = 0;
    const startTime = performance.now();

    function runBatch() {
      const batchEnd = Math.min(currentSample + batchSize, samples);
      
      for (let i = currentSample; i < batchEnd; i++) {
        let remaining = remainingWork;
        let weeks = 0;
        
        while (remaining > 0 && weeks < maxWeeks) {
          const randomIndex = Math.floor(rng() * throughputValues.length);
          const weekThroughput = throughputValues[randomIndex];
          remaining -= weekThroughput;
          weeks++;
        }
        
        completionWeeks.push(weeks);
      }
      
      currentSample = batchEnd;
      const progress = currentSample / samples;
      const elapsed = performance.now() - startTime;
      const estimatedTotal = elapsed / progress;
      const remaining = estimatedTotal - elapsed;
      
      onProgress({
        current: currentSample,
        total: samples,
        percent: Math.round(progress * 100),
        elapsed: Math.round(elapsed),
        remaining: Math.round(remaining),
      });

      if (currentSample < samples) {
        // Use setTimeout to allow UI updates
        setTimeout(runBatch, 0);
      } else {
        // Simulation complete - calculate percentiles
        completionWeeks.sort((a, b) => a - b);
        
        const p50Index = Math.floor(samples * 0.5);
        const p80Index = Math.floor(samples * 0.8);
        const p95Index = Math.floor(samples * 0.95);
        
        const p50 = completionWeeks[p50Index];
        const p80 = completionWeeks[p80Index];
        const p95 = completionWeeks[p95Index];
        
        // Generate histogram
        const histogram = {};
        for (const weeks of completionWeeks) {
          histogram[weeks] = (histogram[weeks] || 0) + 1;
        }
        
        const distribution = Object.entries(histogram)
          .map(([weeks, count]) => ({
            weeks: parseInt(weeks),
            count,
            probability: count / samples
          }))
          .sort((a, b) => a.weeks - b.weeks);
        
        // Calculate statistics
        const sum = completionWeeks.reduce((a, b) => a + b, 0);
        const mean = sum / samples;
        const min = completionWeeks[0];
        const max = completionWeeks[samples - 1];
        
        const totalTime = performance.now() - startTime;
        
        resolve({
          success: true,
          p50,
          p80,
          p95,
          mean: Math.round(mean * 10) / 10,
          min,
          max,
          distribution,
          simulationCount: samples,
          executionTime: Math.round(totalTime),
          throughputStats: {
            mean: throughputValues.reduce((a, b) => a + b, 0) / throughputValues.length,
            min: Math.min(...throughputValues),
            max: Math.max(...throughputValues),
            weeks: throughputValues.length
          }
        });
      }
    }

    // Start simulation
    runBatch();
  });
}

/**
 * Progress indicator component
 */
export function SimulationProgress({ progress, isRunning }) {
  if (!isRunning && !progress) return null;
  
  const percent = progress?.percent || 0;
  const current = progress?.current || 0;
  const total = progress?.total || 10000;
  const elapsed = progress?.elapsed || 0;
  const remaining = progress?.remaining || 0;
  
  return (
    <div className="simulation-progress">
      <div className="progress-header">
        <span className="progress-title">
          {isRunning ? 'Running Monte Carlo Simulation...' : 'Simulation Complete'}
        </span>
        <span className="progress-stats">
          {current.toLocaleString()} / {total.toLocaleString()} iterations
        </span>
      </div>
      
      <div className="progress-bar-container">
        <div 
          className="progress-bar-fill" 
          style={{ width: `${percent}%` }}
        />
        <div className="progress-bar-glow" style={{ left: `${percent}%` }} />
      </div>
      
      <div className="progress-details">
        <span className="progress-percent">{percent}%</span>
        <span className="progress-time">
          {isRunning ? (
            <>
              <span className="time-label">Elapsed:</span> {formatTime(elapsed)}
              {remaining > 0 && (
                <>
                  <span className="time-separator">|</span>
                  <span className="time-label">ETA:</span> {formatTime(remaining)}
                </>
              )}
            </>
          ) : (
            <>
              <span className="time-label">Completed in</span> {formatTime(elapsed)}
            </>
          )}
        </span>
      </div>
      
      {isRunning && (
        <div className="progress-animation">
          <div className="simulation-dots">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 100) / 10;
  return `${seconds}s`;
}

/**
 * Hook to run simulation with progress
 */
export function useSimulation() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(false);

  const run = useCallback(async (throughputData, remainingWork, options = {}) => {
    setIsRunning(true);
    setProgress({ current: 0, total: options.samples || 10000, percent: 0 });
    setResult(null);
    setError(null);
    abortRef.current = false;

    try {
      const simResult = await runSimulation(throughputData, remainingWork, {
        ...options,
        onProgress: (p) => {
          if (!abortRef.current) {
            setProgress(p);
          }
        }
      });

      if (!abortRef.current) {
        setResult(simResult);
        setIsRunning(false);
      }
      
      return simResult;
    } catch (err) {
      if (!abortRef.current) {
        setError(err.message);
        setIsRunning(false);
      }
      return { success: false, error: err.message };
    }
  }, []);

  const abort = useCallback(() => {
    abortRef.current = true;
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setProgress(null);
    setResult(null);
    setError(null);
  }, []);

  return {
    run,
    abort,
    reset,
    isRunning,
    progress,
    result,
    error
  };
}

export default SimulationProgress;
