// src/hooks/useCleanup.ts
import { useEffect, useRef } from "react";
import CleanupManager from "../utils/cleanupManager";

export const useCleanup = (screenName: string) => {
  const controllersRef = useRef<Set<AbortController>>(new Set());
  const timersRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const intervalsRef = useRef<Set<NodeJS.Timeout>>(new Set());

  // Create abort controller
  const createAbortController = (): AbortController => {
    const controller = new AbortController();
    controllersRef.current.add(controller);
    CleanupManager.registerAbortController(controller);
    return controller;
  };

  // Register timer
  const registerTimer = (
    callback: () => void,
    delay: number
  ): NodeJS.Timeout => {
    const timer = setTimeout(callback, delay);
    timersRef.current.add(timer);
    CleanupManager.registerTimer(timer);
    return timer;
  };

  // Register interval
  const registerInterval = (
    callback: () => void,
    delay: number
  ): NodeJS.Timeout => {
    const interval = setInterval(callback, delay);
    intervalsRef.current.add(interval);
    CleanupManager.registerInterval(interval);
    return interval;
  };

  // Cleanup on unmount
  useEffect(() => {
    console.log(`🚀 ${screenName} mounted`);

    return () => {
      console.log(`🧹 ${screenName} unmounting - Cleaning up...`);

      // Abort all controllers
      controllersRef.current.forEach((controller) => {
        try {
          controller.abort();
        } catch (error) {
          console.error("Error aborting:", error);
        }
      });
      controllersRef.current.clear();

      // Clear timers
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();

      // Clear intervals
      intervalsRef.current.forEach((interval) => clearInterval(interval));
      intervalsRef.current.clear();

      console.log(` ${screenName} cleaned up`);
    };
  }, [screenName]);

  return {
    createAbortController,
    registerTimer,
    registerInterval,
  };
};
